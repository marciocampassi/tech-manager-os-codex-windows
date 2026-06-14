import path from 'node:path';
import matter from 'gray-matter';
import { FileSystemService, fileSystemService } from './file-system.service.js';
import { SectionParserService, sectionParserService } from './section-parser.service.js';
import { TemplateService, templateService } from './template.service.js';
import { EmailResolutionService, emailResolutionService } from './email-resolution.service.js';
import { getWorkspaceRoot as resolveWorkspaceRoot } from '../utils/workspace.js';
import { validateEmail } from '../utils/validation.js';
import { ValidationError } from '../errors/tmr-error.js';
import { formatWikiLink } from '../utils/wiki-link.js';
import { addRelation, setScalar } from '../utils/frontmatter-relations.js';
import { normalizeSlug } from '../utils/normalization.js';
import { logger } from '../utils/logger.js';
import {
  FILE_TYPE_CONFIG,
  LAST_SCALAR_KEY,
  type FileType,
  type IAddMemberOptions,
  type ICreateFileOptions,
  type ICreateFileResult,
  type IDatedFileLinks,
} from '../types/member.types.js';

// ── Path helpers ──────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().split('T')[0] as string;
}

function yearMonth(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function filePrefix(type: FileType, isoDate: string): string {
  return type === '1on1' ? isoDate : yearMonth(isoDate);
}

/**
 * Resolves the directory where dated files (1on1s, feedback, etc.) should be written,
 * given a profile path that may be either nested or flat.
 *
 * - Nested profile: `.../members/<email>/<email>.md`  → parent dir IS the member dir
 * - Flat profile:   `.../members/<email>.md`           → create a sibling dir named <email>
 */
function memberSubDirFromProfile(profilePath: string, email: string): string {
  const parentDir = path.dirname(profilePath);
  if (path.basename(parentDir) === email) return parentDir;
  return path.join(parentDir, email);
}

// ── MemberService ─────────────────────────────────────────────────────────────

export class MemberService {
  constructor(
    private readonly _fs: FileSystemService,
    private readonly _sectionParser: SectionParserService,
    private readonly _template: TemplateService,
    private readonly _emailResolver: EmailResolutionService = emailResolutionService,
  ) {}

  getWorkspaceRoot(): string {
    return resolveWorkspaceRoot();
  }

  /**
   * Returns the member profile path if the member exists, null otherwise.
   * Searches only the nested path (my-teams/members/<email>/<email>.md).
   */
  async findMember(email: string, workspaceRoot: string): Promise<string | null> {
    const normalizedEmail = email.toLowerCase();
    const profilePath = path.join(
      workspaceRoot,
      'my-teams',
      'members',
      normalizedEmail,
      `${normalizedEmail}.md`,
    );
    const exists = await this._fs.exists(profilePath);
    return exists ? profilePath : null;
  }

  /**
   * Routes a new member profile to the correct scope using the nested folder convention:
   * - Contractor scope (contractor: true): my-company/contractors/<email>/<email>.md
   * - Team scope (team provided): my-teams/members/<email>/<email>.md with manager wiki-link
   * - Company scope (default): my-company/members/<email>/<email>.md
   *
   * All scopes scaffold subdirs: 1on1s/, feedbacks/, assessments/, performance-reviews/
   * Team scope additionally creates <email>-shared/.
   * Idempotent — returns { created: false } if profile already exists.
   */
  async addMember(
    email: string,
    opts: IAddMemberOptions,
    workspaceRoot: string,
  ): Promise<{ created: boolean }> {
    validateEmail(email);
    const normalizedEmail = email.toLowerCase();

    const selfPath = await this._getSelfProfilePath(workspaceRoot);
    if (selfPath) {
      const selfFileEmail = path.basename(selfPath, '.md').toLowerCase();
      let selfFrontmatterEmail = '';
      try {
        const selfData = matter(await this._fs.readFile(selfPath)).data as Record<string, unknown>;
        if (typeof selfData['email'] === 'string') {
          selfFrontmatterEmail = selfData['email'].trim().toLowerCase();
        }
      } catch {
        // Unreadable/invalid self profile — fall back to the filename check only.
      }
      if (selfFileEmail === normalizedEmail || selfFrontmatterEmail === normalizedEmail) {
        throw new ValidationError(
          `Cannot add "${normalizedEmail}" as a member — it is your own (self) profile. Manage your own profile with tmr myself.`,
        );
      }
    }

    const profilePath = opts.contractor
      ? path.join(
          workspaceRoot,
          'my-company',
          'contractors',
          normalizedEmail,
          `${normalizedEmail}.md`,
        )
      : opts.team
        ? path.join(workspaceRoot, 'my-teams', 'members', normalizedEmail, `${normalizedEmail}.md`)
        : path.join(
            workspaceRoot,
            'my-company',
            'members',
            normalizedEmail,
            `${normalizedEmail}.md`,
          );

    if (await this._fs.exists(profilePath)) {
      await this._syncTeamMembersFrontmatter(opts, profilePath, normalizedEmail, workspaceRoot);
      await this._syncDirectReports(opts, profilePath, normalizedEmail, workspaceRoot);
      return { created: false };
    }

    const isDirectReport = !!opts.team && !opts.contractor;
    const currentManagerLink = isDirectReport
      ? await this._resolveManagerLink(profilePath, workspaceRoot)
      : '';

    const fm: Record<string, unknown> = {
      email: normalizedEmail,
      name: opts.name ?? '',
      role: opts.role ?? '',
      gender: opts.gender ?? '',
      location: opts.location ?? '',
      relationship: opts.contractor ? 'contractor' : opts.team ? 'direct-report' : 'company-member',
      date_added: todayIso(),
      start_date: '',
      current_manager: currentManagerLink,
      previous_manager: [],
      other_leaderships: [],
      ...(isDirectReport
        ? { teams: [this._resolveTeamContextLink(opts.team as string, profilePath, workspaceRoot)] }
        : {}),
      projects: [],
    };

    const body =
      '\n## 1on1s\n\n## Feedbacks\n\n## Assessments\n\n## Performance Reviews\n\n## Notes\n';
    const profileMd = matter.stringify(body, fm);

    const entityDir = path.dirname(profilePath);
    const commonSubDirs = ['1on1s', 'feedbacks', 'assessments', 'performance-reviews'];
    for (const subDir of commonSubDirs) {
      await this._fs.createDirectory(path.join(entityDir, subDir));
    }
    if (opts.team) {
      await this._fs.createDirectory(path.join(entityDir, `${normalizedEmail}-shared`));
    }
    await this._fs.writeFile(profilePath, profileMd);

    await this._syncTeamMembersFrontmatter(opts, profilePath, normalizedEmail, workspaceRoot);
    await this._syncDirectReports(opts, profilePath, normalizedEmail, workspaceRoot);

    return { created: true };
  }

  private async _syncTeamMembersFrontmatter(
    opts: IAddMemberOptions,
    profilePath: string,
    normalizedEmail: string,
    workspaceRoot: string,
  ): Promise<void> {
    if (!opts.team) return;

    const slug = normalizeSlug(opts.team);
    const teamMembersFilePath = path.join(
      workspaceRoot,
      'my-teams',
      'teams',
      slug,
      `${slug}-members.md`,
    );
    if (await this._fs.exists(teamMembersFilePath)) {
      const link = formatWikiLink(profilePath, teamMembersFilePath, normalizedEmail);
      await addRelation(teamMembersFilePath, 'members', link, this._fs);
    }
  }

  /**
   * Reads `config/organization.yaml` and returns the `internal_domains` list.
   * Returns an empty array if the file does not exist or contains no domains.
   * Uses simple line-by-line parsing — no external YAML dependency required.
   */
  async getInternalDomains(workspaceRoot: string): Promise<string[]> {
    const orgPath = path.join(workspaceRoot, 'config', 'organization.yaml');
    if (!(await this._fs.exists(orgPath))) return [];
    const content = await this._fs.readFile(orgPath);
    const lines = content.split('\n');
    let inDomains = false;
    const domains: string[] = [];
    for (const line of lines) {
      if (line.trim().startsWith('internal_domains:')) {
        inDomains = true;
        continue;
      }
      if (inDomains) {
        const match = line.match(/^\s+-\s+(.+)$/);
        if (match?.[1]) {
          domains.push(match[1].trim().toLowerCase());
        } else if (line.trim() && !line.startsWith(' ') && !line.startsWith('\t')) {
          inDomains = false;
        }
      }
    }
    return domains;
  }

  /**
   * Appends `domain` to the `internal_domains` list in `config/organization.yaml`.
   * Idempotent — if the domain is already present (case-insensitive), does nothing.
   * Creates the file with the key if it does not exist yet.
   * Uses the same line-by-line format as `getInternalDomains()` — no external YAML lib.
   */
  async appendInternalDomain(domain: string, workspaceRoot: string): Promise<void> {
    const normalizedDomain = domain.toLowerCase();
    const existing = await this.getInternalDomains(workspaceRoot);
    if (existing.includes(normalizedDomain)) return;

    const orgPath = path.join(workspaceRoot, 'config', 'organization.yaml');
    const line = `  - ${normalizedDomain}\n`;

    if (!(await this._fs.exists(orgPath))) {
      await this._fs.writeFile(orgPath, `internal_domains:\n${line}`);
      return;
    }

    const content = await this._fs.readFile(orgPath);
    if (content.includes('internal_domains:')) {
      await this._fs.writeFile(orgPath, content.trimEnd() + '\n' + line);
    } else {
      await this._fs.writeFile(orgPath, content.trimEnd() + '\ninternal_domains:\n' + line);
    }
  }

  /**
   * Creates a dated member file (1on1, feedback, assessment, performance-review),
   * then appends its wiki-link to the corresponding section in the member profile.
   *
   * Resolves the member profile via EmailResolutionService across all scopes.
   * If the member is not found in any scope, a company-scoped profile is auto-created.
   */
  async createMemberFile(
    email: string,
    type: FileType,
    options: ICreateFileOptions,
    workspaceRoot: string,
  ): Promise<ICreateFileResult> {
    const normalizedEmail = email.toLowerCase();
    const date = options.date ?? todayIso();
    const config = FILE_TYPE_CONFIG[type];

    const resolution = await this._emailResolver.resolve(normalizedEmail, workspaceRoot);
    const profilePath = resolution.absolutePath;

    const subDirPath = path.join(
      memberSubDirFromProfile(profilePath, normalizedEmail),
      config.subDir,
    );
    await this._fs.createDirectory(subDirPath);

    const prefix = filePrefix(type, date);
    if (type === 'feedback' && !options.fromEmail) {
      throw new Error('fromEmail is required for feedback type');
    }
    // Normalize the reviewer once so the filename, the `from` wiki-link, and the
    // resolved/auto-created reviewer profile all agree on casing.
    const normalizedOptions: ICreateFileOptions = {
      ...options,
      fromEmail: options.fromEmail?.toLowerCase(),
    };
    const fileName =
      type === 'feedback'
        ? `${prefix}-feedback-${normalizedOptions.fromEmail}-${normalizedEmail}.md`
        : `${prefix}-${config.fileSuffix}-${normalizedEmail}.md`;
    const filePath = path.join(subDirPath, fileName);

    const links = await this._buildDatedFileLinks(type, normalizedOptions, normalizedEmail, {
      profilePath,
      filePath,
      workspaceRoot,
    });

    const content = this._template.getTemplate(type, date, normalizedEmail, links);
    await this._fs.writeFile(filePath, content);

    const wikiLink = `- [[${config.subDir}/${fileName}]]`;
    await this._sectionParser.appendToFile(profilePath, config.sectionName, wikiLink);

    await setScalar(profilePath, LAST_SCALAR_KEY[type], prefix, this._fs);

    return { filePath, profilePath, wikiLink };
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  /**
   * Builds the frontmatter wiki-link set for a dated file (Story 9.31).
   *
   * - `subject` always points to the member the artifact is about.
   * - For feedback, the reviewer (`fromEmail`) is resolved via EmailResolutionService —
   *   auto-creating a stub profile when absent (fixes B5) — and emitted as `from`.
   * - For all other types, the self profile (if present) is emitted as `with`; omitted
   *   entirely when no self profile exists.
   */
  private async _buildDatedFileLinks(
    type: FileType,
    options: ICreateFileOptions,
    normalizedEmail: string,
    paths: { profilePath: string; filePath: string; workspaceRoot: string },
  ): Promise<IDatedFileLinks> {
    const { profilePath, filePath, workspaceRoot } = paths;
    const links: IDatedFileLinks = {
      subject: formatWikiLink(profilePath, filePath, normalizedEmail),
    };

    if (type === 'feedback' && options.fromEmail) {
      // `fromEmail` is already lowercased by the caller.
      const reviewerEmail = options.fromEmail;
      const reviewer = await this._emailResolver.resolve(reviewerEmail, workspaceRoot);
      links.from = formatWikiLink(reviewer.absolutePath, filePath, reviewerEmail);
      return links;
    }

    const selfPath = await this._getSelfProfilePath(workspaceRoot);
    if (selfPath) {
      const selfEmail = path.basename(selfPath, '.md');
      links.with = formatWikiLink(selfPath, filePath, selfEmail);
    }
    return links;
  }

  /**
   * Resolves the manager's wiki-link from the `my-career/` directory.
   * Scans for `.md` files directly (flat structure — one profile per vault).
   * If multiple files are found, the first alphabetically is used and a warning is logged.
   */
  private async _resolveManagerLink(memberPath: string, workspaceRoot: string): Promise<string> {
    const careerRoot = path.join(workspaceRoot, 'my-career');
    if (!(await this._fs.exists(careerRoot))) return '';

    const mdFiles = await this._fs.listFiles(careerRoot, '.md');
    if (mdFiles.length === 0) return '';

    const managerProfilePath = mdFiles[0] as string;
    const managerEmail = path.basename(managerProfilePath, '.md');
    if (mdFiles.length > 1) {
      logger.warn(
        `_resolveManagerLink: found ${mdFiles.length} .md files in my-career/ — expected 1. Using "${managerEmail}" as manager.`,
      );
    }

    return formatWikiLink(managerProfilePath, memberPath, managerEmail);
  }

  /**
   * Returns the first `.md` file path found in `my-career/`, or null if absent.
   * Used by `_syncDirectReports` to locate the self profile for reciprocal writes.
   */
  private async _getSelfProfilePath(workspaceRoot: string): Promise<string | null> {
    const careerRoot = path.join(workspaceRoot, 'my-career');
    if (!(await this._fs.exists(careerRoot))) return null;
    const mdFiles = await this._fs.listFiles(careerRoot, '.md');
    return mdFiles.length > 0 ? (mdFiles[0] as string) : null;
  }

  /**
   * Computes the wiki-link pointing to a team's context file.
   * Synchronous — no filesystem reads needed; generates path without verifying existence.
   */
  private _resolveTeamContextLink(
    teamName: string,
    fromPath: string,
    workspaceRoot: string,
  ): string {
    const slug = normalizeSlug(teamName);
    const contextPath = path.join(workspaceRoot, 'my-teams', 'teams', slug, `${slug}-context.md`);
    return formatWikiLink(contextPath, fromPath, slug);
  }

  /**
   * Writes a `direct_reports` reciprocal link on the self profile when the member being
   * added is a direct report (team scope, not contractor). Silent no-op if self profile absent.
   */
  private async _syncDirectReports(
    opts: IAddMemberOptions,
    profilePath: string,
    normalizedEmail: string,
    workspaceRoot: string,
  ): Promise<void> {
    if (!opts.team || opts.contractor) return;

    const selfPath = await this._getSelfProfilePath(workspaceRoot);
    if (!selfPath) return;

    const memberLink = formatWikiLink(profilePath, selfPath, normalizedEmail);
    await addRelation(selfPath, 'direct_reports', memberLink, this._fs);
  }
}

export const memberService = new MemberService(
  fileSystemService,
  sectionParserService,
  templateService,
  emailResolutionService,
);
