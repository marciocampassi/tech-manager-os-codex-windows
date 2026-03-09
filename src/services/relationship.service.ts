import path from 'node:path';
import matter from 'gray-matter';
import { FileSystemService, fileSystemService } from './file-system.service.js';
import { SectionParserService, sectionParserService } from './section-parser.service.js';
import { TemplateService, templateService } from './template.service.js';
import { getWorkspaceRoot as resolveWorkspaceRoot } from '../utils/workspace.js';
import type {
  IAddRelationshipOptions,
  IBatchResult,
  IRelationshipFrontmatter,
  IRelationshipSummary,
} from '../types/relationship.types.js';
import type { ICreateFileResult } from '../types/member.types.js';

// ── Path helpers ──────────────────────────────────────────────────────────────

function relationshipsRoot(ws: string): string {
  return path.join(ws, 'my-company', 'relationships');
}

function relationshipDir(ws: string, email: string): string {
  return path.join(relationshipsRoot(ws), email);
}

function relationshipProfilePath(ws: string, email: string): string {
  return path.join(relationshipDir(ws, email), `${email}.md`);
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0] as string;
}

// ── Profile template ──────────────────────────────────────────────────────────

function buildRelationshipProfileMd(email: string, opts: IAddRelationshipOptions): string {
  const date = opts.date ?? todayIso();
  const frontmatter: IRelationshipFrontmatter = {
    email,
    name: opts.name ?? '',
    role: opts.role ?? '',
    department: opts.department ?? '',
    relationship_type: opts.relationship_type ?? '',
    date_added: date,
  };
  return matter.stringify(`\n# Relationship — ${email}\n\n## Notes\n\n## 1on1s\n`, frontmatter);
}

// ── RelationshipService ───────────────────────────────────────────────────────

export class RelationshipService {
  constructor(
    private readonly _fs: FileSystemService,
    private readonly _sectionParser: SectionParserService,
    private readonly _template: TemplateService,
  ) {}

  getWorkspaceRoot(): string {
    return resolveWorkspaceRoot();
  }

  /**
   * Returns the profile path if the relationship exists, null otherwise.
   */
  async findRelationship(email: string, workspaceRoot: string): Promise<string | null> {
    const profilePath = relationshipProfilePath(workspaceRoot, email.toLowerCase());
    const exists = await this._fs.exists(profilePath);
    return exists ? profilePath : null;
  }

  /**
   * Creates a new relationship profile + 1on1s/ directory.
   * Returns { created: true } if new, { created: false } if already existed.
   */
  async addRelationship(
    email: string,
    opts: IAddRelationshipOptions,
    workspaceRoot: string,
  ): Promise<{ created: boolean }> {
    const normalizedEmail = email.toLowerCase();
    const profilePath = relationshipProfilePath(workspaceRoot, normalizedEmail);

    if (await this._fs.exists(profilePath)) {
      return { created: false };
    }

    const oneOnOneDir = path.join(relationshipDir(workspaceRoot, normalizedEmail), '1on1s');
    await this._fs.createDirectory(oneOnOneDir);

    const content = buildRelationshipProfileMd(normalizedEmail, opts);
    await this._fs.writeFile(profilePath, content);

    return { created: true };
  }

  /**
   * Batch-creates multiple relationships from a comma-separated email list.
   */
  async addBatch(
    emails: string[],
    opts: IAddRelationshipOptions,
    workspaceRoot: string,
  ): Promise<IBatchResult> {
    let created = 0;
    let existed = 0;

    for (const email of emails) {
      const result = await this.addRelationship(email.trim(), opts, workspaceRoot);
      if (result.created) {
        created++;
      } else {
        existed++;
      }
    }

    return { created, existed };
  }

  /**
   * Creates a 1on1 file for an existing relationship and appends the wiki-link
   * to the `## 1on1s` section of the relationship profile.
   */
  async add1on1(
    email: string,
    opts: IAddRelationshipOptions,
    workspaceRoot: string,
  ): Promise<ICreateFileResult> {
    const normalizedEmail = email.toLowerCase();
    const date = opts.date ?? todayIso();

    const profilePath = relationshipProfilePath(workspaceRoot, normalizedEmail);
    if (!(await this._fs.exists(profilePath))) {
      throw new Error(
        `Relationship '${normalizedEmail}' not found. Run 'tmr relationship add ${normalizedEmail}' first.`,
      );
    }

    const oneOnOneDir = path.join(relationshipDir(workspaceRoot, normalizedEmail), '1on1s');
    await this._fs.createDirectory(oneOnOneDir);

    const fileName = `${date}-${normalizedEmail}-1on1.md`;
    const filePath = path.join(oneOnOneDir, fileName);

    const content = this._template.getRelationship1on1Template(date, normalizedEmail);
    await this._fs.writeFile(filePath, content);

    const wikiLink = `- [[1on1s/${fileName}]]`;
    await this._sectionParser.appendToFile(profilePath, '1on1s', wikiLink);

    return { filePath, profilePath, wikiLink };
  }

  /**
   * Lists all relationships, sorted by most recent 1on1 interaction (descending).
   * Relationships with no 1on1s appear at the bottom.
   */
  async listRelationships(workspaceRoot: string): Promise<IRelationshipSummary[]> {
    const root = relationshipsRoot(workspaceRoot);
    if (!(await this._fs.exists(root))) return [];

    const emails = await this._fs.listDirectories(root);
    if (emails.length === 0) return [];

    const summaries = await Promise.all(
      emails.map(async (email): Promise<IRelationshipSummary> => {
        const profilePath = relationshipProfilePath(workspaceRoot, email);
        const content = await this._fs.readFile(profilePath);
        const { data } = matter(content);

        const oneOnOneDir = path.join(relationshipDir(workspaceRoot, email), '1on1s');
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
          department: String(data['department'] ?? ''),
          relationship_type: String(data['relationship_type'] ?? ''),
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

export const relationshipService = new RelationshipService(
  fileSystemService,
  sectionParserService,
  templateService,
);
