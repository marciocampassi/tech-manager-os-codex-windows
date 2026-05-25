import path from 'node:path';
import matter from 'gray-matter';
import { FileSystemService, fileSystemService } from './file-system.service.js';
import { SectionParserService, sectionParserService } from './section-parser.service.js';
import { TemplateService, templateService } from './template.service.js';
import { getWorkspaceRoot as resolveWorkspaceRoot } from '../utils/workspace.js';
import type {
  IAddLeadershipOptions,
  ILeadershipFrontmatter,
  ILeadershipSummary,
} from '../types/leadership.types.js';
import type { ICreateFileResult } from '../types/member.types.js';

// ── Path helpers ──────────────────────────────────────────────────────────────

function leadershipRoot(ws: string): string {
  return path.join(ws, 'my-leadership');
}

function leadershipDir(ws: string, email: string): string {
  return path.join(leadershipRoot(ws), email);
}

function leadershipProfilePath(ws: string, email: string): string {
  return path.join(leadershipDir(ws, email), `${email}.md`);
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0] as string;
}

// ── Profile template ──────────────────────────────────────────────────────────

function buildLeadershipProfileMd(email: string, opts: IAddLeadershipOptions): string {
  const date = opts.date ?? todayIso();
  const frontmatter: ILeadershipFrontmatter = {
    email,
    name: opts.name ?? '',
    role: opts.role ?? '',
    ...(opts.location ? { location: opts.location } : {}),
    ...(opts.gender ? { gender: opts.gender } : {}),
    areas_of_responsibility: opts.areas_of_responsibility ?? '',
    relationship: 'leadership',
    date_added: date,
  };
  return matter.stringify(`\n# Leadership — ${email}\n\n## Notes\n\n## 1on1s\n`, frontmatter);
}

// ── LeadershipService ─────────────────────────────────────────────────────────

export class LeadershipService {
  constructor(
    private readonly _fs: FileSystemService,
    private readonly _sectionParser: SectionParserService,
    private readonly _template: TemplateService,
  ) {}

  getWorkspaceRoot(): string {
    return resolveWorkspaceRoot();
  }

  /**
   * Returns the profile path if the leadership contact exists, null otherwise.
   */
  async findLeadership(email: string, workspaceRoot: string): Promise<string | null> {
    const profilePath = leadershipProfilePath(workspaceRoot, email.toLowerCase());
    const exists = await this._fs.exists(profilePath);
    return exists ? profilePath : null;
  }

  /**
   * Creates a new leadership profile + 1on1s/ directory.
   * Returns { created: true } if new, { created: false } if already existed.
   */
  async addLeadership(
    email: string,
    opts: IAddLeadershipOptions,
    workspaceRoot: string,
  ): Promise<{ created: boolean }> {
    const normalizedEmail = email.toLowerCase();
    const profilePath = leadershipProfilePath(workspaceRoot, normalizedEmail);

    if (await this._fs.exists(profilePath)) {
      return { created: false };
    }

    const oneOnOneDir = path.join(leadershipDir(workspaceRoot, normalizedEmail), '1on1s');
    await this._fs.createDirectory(oneOnOneDir);

    const content = buildLeadershipProfileMd(normalizedEmail, opts);
    await this._fs.writeFile(profilePath, content);

    return { created: true };
  }

  /**
   * Creates a 1on1 file for an existing leadership contact and appends the
   * wiki-link to the `## 1on1s` section of the leadership profile.
   */
  async add1on1(
    email: string,
    opts: IAddLeadershipOptions,
    workspaceRoot: string,
  ): Promise<ICreateFileResult> {
    const normalizedEmail = email.toLowerCase();
    const date = opts.date ?? todayIso();

    const profilePath = leadershipProfilePath(workspaceRoot, normalizedEmail);
    if (!(await this._fs.exists(profilePath))) {
      throw new Error(
        `Leadership '${normalizedEmail}' not found. Run 'tmr leadership add ${normalizedEmail}' first.`,
      );
    }

    const oneOnOneDir = path.join(leadershipDir(workspaceRoot, normalizedEmail), '1on1s');
    await this._fs.createDirectory(oneOnOneDir);

    const fileName = `${date}-1on1-${normalizedEmail}.md`;
    const filePath = path.join(oneOnOneDir, fileName);

    const content = this._template.getLeadership1on1Template(date, normalizedEmail);
    await this._fs.writeFile(filePath, content);

    const wikiLink = `- [[1on1s/${fileName}]]`;
    await this._sectionParser.appendToFile(profilePath, '1on1s', wikiLink);

    return { filePath, profilePath, wikiLink };
  }

  /**
   * Lists all leadership contacts, sorted by most recent 1on1 interaction (descending).
   * Contacts with no 1on1s appear at the bottom.
   */
  async listLeadership(workspaceRoot: string): Promise<ILeadershipSummary[]> {
    const root = leadershipRoot(workspaceRoot);
    if (!(await this._fs.exists(root))) return [];

    const emails = await this._fs.listDirectories(root);
    if (emails.length === 0) return [];

    const summaries = await Promise.all(
      emails.map(async (email): Promise<ILeadershipSummary> => {
        const profilePath = leadershipProfilePath(workspaceRoot, email);
        const content = await this._fs.readFile(profilePath);
        const { data } = matter(content);

        const oneOnOneDir = path.join(leadershipDir(workspaceRoot, email), '1on1s');
        let lastInteraction = '-';

        if (await this._fs.exists(oneOnOneDir)) {
          const files = await this._fs.listFiles(oneOnOneDir, '.md');
          if (files.length > 0) {
            const lastFile = files[files.length - 1];
            if (lastFile !== undefined) {
              const baseName = path.basename(lastFile);
              const dateMatch = baseName.match(/^(\d{4}-\d{2}-\d{2})/);
              if (dateMatch) lastInteraction = dateMatch[1] as string;
            }
          }
        }

        return {
          email: String(data['email'] ?? email),
          name: String(data['name'] ?? ''),
          role: String(data['role'] ?? ''),
          lastInteraction,
        };
      }),
    );

    return summaries.sort((a, b) => {
      if (a.lastInteraction === '-' && b.lastInteraction === '-') return 0;
      if (a.lastInteraction === '-') return 1;
      if (b.lastInteraction === '-') return -1;
      return b.lastInteraction.localeCompare(a.lastInteraction);
    });
  }
}

export const leadershipService = new LeadershipService(
  fileSystemService,
  sectionParserService,
  templateService,
);
