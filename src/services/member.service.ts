import path from 'node:path';
import matter from 'gray-matter';
import { FileSystemService, fileSystemService } from './file-system.service.js';
import { SectionParserService, sectionParserService } from './section-parser.service.js';
import { TemplateService, templateService } from './template.service.js';
import { EmailResolutionService, emailResolutionService } from './email-resolution.service.js';
import { getWorkspaceRoot as resolveWorkspaceRoot } from '../utils/workspace.js';
import { validateEmail } from '../utils/validation.js';
import { formatWikiLink } from '../utils/wiki-link.js';
import { logger } from '../utils/logger.js';
import {
  FILE_TYPE_CONFIG,
  type FileType,
  type IAddMemberOptions,
  type ICreateFileOptions,
  type ICreateFileResult,
} from '../types/member.types.js';

// ── Path helpers ──────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().split('T')[0] as string;
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
      return { created: false };
    }

    // TODO(Story 9.3): update _resolveManagerLink to read flat my-career/<email>.md after Story 9.3 lands
    const managerLink = opts.team ? await this._resolveManagerLink(profilePath, workspaceRoot) : '';

    const fm: Record<string, unknown> = {
      email: normalizedEmail,
      name: opts.name ?? '',
      role: opts.role ?? '',
      gender: opts.gender ?? '',
      location: opts.location ?? '',
      date_added: todayIso(),
      ...(opts.contractor
        ? { relationship: 'contractor', ...(opts.company ? { company: opts.company } : {}) }
        : {}),
      ...(opts.team ? { manager: managerLink } : {}),
    };

    const body = '\n## Performance Reviews\n\n## Feedbacks\n';
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

    return { created: true };
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

    const fileName = `${date}-${normalizedEmail}-${config.fileSuffix}.md`;
    const filePath = path.join(subDirPath, fileName);

    const content = this._template.getTemplate(type, date, normalizedEmail);
    await this._fs.writeFile(filePath, content);

    const wikiLink = `- [[${config.subDir}/${fileName}]]`;
    await this._sectionParser.appendToFile(profilePath, config.sectionName, wikiLink);

    return { filePath, profilePath, wikiLink };
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  /**
   * Resolves the manager's wiki-link from the `my-career/` directory.
   * Assumes a single career profile subdirectory (the current user's own career folder).
   * If multiple subdirectories are found, the first alphabetically is used and a warning is logged.
   */
  private async _resolveManagerLink(memberPath: string, workspaceRoot: string): Promise<string> {
    const careerRoot = path.join(workspaceRoot, 'my-career');
    if (!(await this._fs.exists(careerRoot))) return '';
    const subdirs = await this._fs.listDirectories(careerRoot);
    if (subdirs.length === 0) return '';
    if (subdirs.length > 1) {
      logger.warn(
        `_resolveManagerLink: found ${subdirs.length} entries in my-career/ — expected 1. Using "${subdirs[0]}" as manager.`,
      );
    }
    const managerEmail = subdirs[0] as string;
    const managerProfilePath = path.join(careerRoot, managerEmail, `${managerEmail}.md`);
    if (!(await this._fs.exists(managerProfilePath))) return '';
    return formatWikiLink(managerProfilePath, memberPath, managerEmail);
  }
}

export const memberService = new MemberService(
  fileSystemService,
  sectionParserService,
  templateService,
  emailResolutionService,
);
