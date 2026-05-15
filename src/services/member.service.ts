import path from 'node:path';
import matter from 'gray-matter';
import { FileSystemService, fileSystemService } from './file-system.service.js';
import { SectionParserService, sectionParserService } from './section-parser.service.js';
import { TemplateService, templateService } from './template.service.js';
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
  type ICreateMemberOptions,
} from '../types/member.types.js';

// ── Path helpers ──────────────────────────────────────────────────────────────

function membersRoot(ws: string): string {
  return path.join(ws, 'my-teams', 'members');
}

function memberDir(ws: string, email: string): string {
  return path.join(membersRoot(ws), email);
}

function memberProfilePath(ws: string, email: string): string {
  return path.join(memberDir(ws, email), `${email}.md`);
}

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
  ) {}

  getWorkspaceRoot(): string {
    return resolveWorkspaceRoot();
  }

  /**
   * Creates a new member profile with the full directory tree under my-teams/members/.
   * Idempotent — skips creation if profile already exists.
   */
  async createMember(
    email: string,
    opts: ICreateMemberOptions,
    workspaceRoot: string,
  ): Promise<{ created: boolean }> {
    const normalizedEmail = email.toLowerCase();
    const profilePath = memberProfilePath(workspaceRoot, normalizedEmail);

    if (await this._fs.exists(profilePath)) {
      return { created: false };
    }

    const date = todayIso();
    const fm: Record<string, unknown> = {
      email: `[[${normalizedEmail}]]`,
      name: opts.name ?? '',
      role: opts.role ?? '',
      gender: opts.gender ?? '',
      location: '',
      teams: [],
      date_added: date,
    };

    const body =
      '\n## Current Manager\n\n## Previous Managers\n\n## Other Leaderships\n\n## Previous Leaderships\n\n## Performance Reviews\n\n## 1on1s\n\n## Assessments\n\n## Feedbacks\n';
    const profileMd = matter.stringify(body, fm);

    await this._fs.createDirectory(path.join(memberDir(workspaceRoot, normalizedEmail), '1on1s'));
    await this._fs.createDirectory(
      path.join(memberDir(workspaceRoot, normalizedEmail), 'feedback'),
    );
    await this._fs.createDirectory(
      path.join(memberDir(workspaceRoot, normalizedEmail), 'assessments'),
    );
    await this._fs.createDirectory(
      path.join(memberDir(workspaceRoot, normalizedEmail), 'performance-reviews'),
    );
    await this._fs.writeFile(profilePath, profileMd);

    return { created: true };
  }

  /**
   * Returns the member profile path if the member exists, null otherwise.
   * Searches only the legacy nested path (my-teams/members/<email>/<email>.md).
   * Use findMemberGlobally() when all scopes must be searched.
   */
  async findMember(email: string, workspaceRoot: string): Promise<string | null> {
    const profilePath = memberProfilePath(workspaceRoot, email.toLowerCase());
    const exists = await this._fs.exists(profilePath);
    return exists ? profilePath : null;
  }

  /**
   * Searches all member scopes in priority order:
   *   1. my-teams/members/<email>.md                           (flat team-scoped)
   *   2. my-company/members/<email>.md                         (flat company-scoped)
   *   3. my-company/contractors/<email>/<email>.md             (contractor-scoped)
   *   4. my-teams/members/<email>/<email>.md                   (nested legacy, TeamService)
   * Returns the first matching path, or null if the member is not found in any scope.
   */
  async findMemberGlobally(email: string, workspaceRoot: string): Promise<string | null> {
    const normalizedEmail = email.toLowerCase();
    const candidates = [
      path.join(workspaceRoot, 'my-teams', 'members', `${normalizedEmail}.md`),
      path.join(workspaceRoot, 'my-company', 'members', `${normalizedEmail}.md`),
      path.join(
        workspaceRoot,
        'my-company',
        'contractors',
        normalizedEmail,
        `${normalizedEmail}.md`,
      ),
      memberProfilePath(workspaceRoot, normalizedEmail),
    ];
    for (const p of candidates) {
      if (await this._fs.exists(p)) return p;
    }
    return null;
  }

  /**
   * Routes a new member profile to the correct scope:
   * - Contractor scope (contractor: true): my-company/contractors/<email>/<email>.md
   *   Also creates my-company/contractors/<email>/1on1s/ for future meeting notes.
   * - Team scope (team provided): my-teams/members/<email>.md with manager wiki-link
   * - Company scope (default): my-company/members/<email>.md
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
        ? path.join(workspaceRoot, 'my-teams', 'members', `${normalizedEmail}.md`)
        : path.join(workspaceRoot, 'my-company', 'members', `${normalizedEmail}.md`);

    if (await this._fs.exists(profilePath)) {
      return { created: false };
    }

    const managerLink = opts.team ? await this._resolveManagerLink(profilePath, workspaceRoot) : '';

    const fm: Record<string, unknown> = {
      email: normalizedEmail,
      name: opts.name ?? '',
      role: opts.role ?? '',
      gender: opts.gender ?? '',
      location: opts.location ?? '',
      date_added: todayIso(),
      ...(opts.contractor ? { relationship: 'contractor' } : {}),
      ...(opts.team ? { manager: managerLink } : {}),
    };

    const body = '\n## Performance Reviews\n\n## Feedbacks\n';
    const profileMd = matter.stringify(body, fm);

    await this._fs.createDirectory(path.dirname(profilePath));
    if (opts.contractor) {
      await this._fs.createDirectory(path.join(path.dirname(profilePath), '1on1s'));
    }
    await this._fs.writeFile(profilePath, profileMd);

    return { created: true };
  }

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

  /**
   * Creates a dated member file (1on1, feedback, assessment, performance-review),
   * then appends its wiki-link to the corresponding section in the member profile.
   *
   * Searches all scopes via findMemberGlobally() — flat team, flat company, and nested legacy.
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

    // Global lookup across all three scopes; auto-create if not found (FR24)
    let profilePath = await this.findMemberGlobally(normalizedEmail, workspaceRoot);
    if (!profilePath) {
      await this.addMember(normalizedEmail, {}, workspaceRoot);
      profilePath = path.join(workspaceRoot, 'my-company', 'members', `${normalizedEmail}.md`);
    }

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
}

export const memberService = new MemberService(
  fileSystemService,
  sectionParserService,
  templateService,
);
