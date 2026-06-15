import path from 'node:path';
import matter from 'gray-matter';
import { FileSystemService, fileSystemService } from './file-system.service.js';
import { TemplateService, templateService } from './template.service.js';
import { emailResolutionService, EmailResolutionService } from './email-resolution.service.js';
import { getWorkspaceRoot as resolveWorkspaceRoot } from '../utils/workspace.js';
import { normalizeSlug } from '../utils/normalization.js';
import { formatWikiLink } from '../utils/wiki-link.js';
import { addRelation } from '../utils/frontmatter-relations.js';
import type { IProjectRelations } from '../types/relations.types.js';
import type {
  IBatchLinkResult,
  ILinkResult,
  IProjectFileOptions,
  IProjectSummary,
} from '../types/project.types.js';

// ── Path helpers ──────────────────────────────────────────────────────────────

/**
 * Normalizes a project name to a slug and appends '-project' suffix if not already present.
 * Slug conversion (via normalizeSlug) happens first so user-provided names like
 * "My Project" produce "my-project-project" predictably.
 * e.g. 'My Internship' → 'my-internship-project'
 *      'internship-program' → 'internship-program-project'
 */
export function normalizeProjectName(name: string): string {
  const slug = normalizeSlug(name);
  return slug.endsWith('-project') ? slug : `${slug}-project`;
}

function projectsDir(ws: string): string {
  return path.join(ws, 'my-company', 'projects');
}

function projectBaseDir(ws: string, name: string): string {
  return path.join(projectsDir(ws), normalizeProjectName(name));
}

function projectOverviewPath(ws: string, name: string): string {
  const normalized = normalizeProjectName(name);
  return path.join(projectBaseDir(ws, name), `${normalized}.md`);
}

function projectStandupsDir(ws: string, name: string): string {
  return path.join(projectBaseDir(ws, name), 'standups');
}

function projectMeetingsDir(ws: string, name: string): string {
  return path.join(projectBaseDir(ws, name), 'meetings');
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0] as string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEPS_YAML_STUB = `# deps.yaml — project dependency manifest
# Populated automatically by /tmr-project-impact <project-path> deps
# Run that command to set up structured dependency tracking for this project.
# Do not edit manually unless you understand the schema.

sources: {}
`;

// ── ProjectService ────────────────────────────────────────────────────────────

export class ProjectService {
  constructor(
    private readonly _fs: FileSystemService,
    private readonly _template: TemplateService,
    private readonly _emailResolution: EmailResolutionService,
  ) {}

  getWorkspaceRoot(): string {
    return resolveWorkspaceRoot();
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Links an entity to a project on BOTH sides via frontmatter (idempotent).
   * Project side: appends the entity wiki-link to the overview's `members`/`stakeholders`
   * array. Reciprocal: appends the project wiki-link to the entity's `projects` array.
   * The reciprocal `projects` entry is identical for members and stakeholders — the
   * role distinction lives only on the project side.
   */
  private async _linkEntity(
    name: string,
    normalizedEmail: string,
    role: 'members' | 'stakeholders',
    ws: string,
  ): Promise<ILinkResult> {
    const overviewPath = projectOverviewPath(ws, name);
    if (!(await this._fs.exists(overviewPath))) {
      throw new Error(`Project '${name}' not found. Run 'tmr project add ${name}' first.`);
    }

    const resolved = await this._emailResolution.resolve(normalizedEmail, ws);

    const entityLink = formatWikiLink(resolved.absolutePath, overviewPath, normalizedEmail);
    await addRelation(overviewPath, role, entityLink, this._fs);

    const projectLink = formatWikiLink(
      overviewPath,
      resolved.absolutePath,
      normalizeProjectName(name),
    );
    await addRelation(resolved.absolutePath, 'projects', projectLink, this._fs);

    return { wikiLink: entityLink, created: resolved.created };
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Creates the full project structure.
   * Returns { created: false } if the project already exists (idempotent).
   */
  async addProject(name: string, ws: string): Promise<{ created: boolean }> {
    const overviewPath = projectOverviewPath(ws, name);

    if (await this._fs.exists(overviewPath)) {
      return { created: false };
    }

    const normalized = normalizeProjectName(name);
    const date = todayIso();

    await this._fs.writeFile(
      overviewPath,
      this._template.getProjectOverviewTemplate(normalized, date),
    );

    await this._fs.createDirectory(projectStandupsDir(ws, name));
    await this._fs.createDirectory(projectMeetingsDir(ws, name));

    await this._fs.writeFile(path.join(projectBaseDir(ws, name), 'deps.yaml'), DEPS_YAML_STUB);

    return { created: true };
  }

  /**
   * Creates a standup file in the project's standups/ directory.
   */
  async addStandup(
    name: string,
    opts: IProjectFileOptions,
    ws: string,
  ): Promise<{ filePath: string }> {
    const overviewPath = projectOverviewPath(ws, name);
    if (!(await this._fs.exists(overviewPath))) {
      throw new Error(`Project '${name}' not found. Run 'tmr project add ${name}' first.`);
    }

    const normalized = normalizeProjectName(name);
    const date = opts.date ?? todayIso();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`Invalid date format '${date}'. Expected YYYY-MM-DD.`);
    }
    const fileName = `${date}-${normalized}-standup.md`;
    const filePath = path.join(projectStandupsDir(ws, name), fileName);
    await this._fs.writeFile(
      filePath,
      this._template.getStandupTemplate(date, normalized, overviewPath, filePath),
    );

    return { filePath };
  }

  /**
   * Links an email to the project's `members` frontmatter array (both sides).
   */
  async linkMember(name: string, email: string, ws: string): Promise<ILinkResult> {
    return this._linkEntity(name, email.toLowerCase(), 'members', ws);
  }

  /**
   * Links an email to the project's `stakeholders` frontmatter array (both sides).
   */
  async linkStakeholder(name: string, email: string, ws: string): Promise<ILinkResult> {
    return this._linkEntity(name, email.toLowerCase(), 'stakeholders', ws);
  }

  /**
   * Batch-links multiple emails to the project's `members` frontmatter array (both sides).
   */
  async linkMembers(name: string, emails: string[], ws: string): Promise<IBatchLinkResult> {
    return this._linkBatch(name, emails, 'members', ws);
  }

  /**
   * Batch-links multiple emails to the project's `stakeholders` frontmatter array (both sides).
   */
  async linkStakeholders(name: string, emails: string[], ws: string): Promise<IBatchLinkResult> {
    return this._linkBatch(name, emails, 'stakeholders', ws);
  }

  private async _linkBatch(
    name: string,
    emails: string[],
    role: 'members' | 'stakeholders',
    ws: string,
  ): Promise<IBatchLinkResult> {
    let linked = 0;
    let created = 0;

    for (const email of emails) {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) continue;

      const result = await this._linkEntity(name, normalizedEmail, role, ws);
      linked++;
      if (result.created) created++;
    }

    return { linked, created };
  }

  /**
   * Lists all projects with member and stakeholder counts read from frontmatter.
   * Projects whose overview lacks `members`/`stakeholders` frontmatter keys are
   * flagged with `needsMigration` so the command layer can surface a warning.
   */
  async listProjects(ws: string): Promise<IProjectSummary[]> {
    const root = projectsDir(ws);
    if (!(await this._fs.exists(root))) return [];

    const names = await this._fs.listDirectories(root);
    const projectNames = names.filter((n) => n.endsWith('-project'));
    if (projectNames.length === 0) return [];

    return Promise.all(
      projectNames.map(async (name): Promise<IProjectSummary> => {
        const overviewPath = projectOverviewPath(ws, name);
        if (!(await this._fs.exists(overviewPath))) {
          return { name, memberCount: 0, stakeholderCount: 0, needsMigration: false };
        }
        const content = await this._fs.readFile(overviewPath);
        try {
          const data = matter(content).data as Partial<IProjectRelations>;
          const hasMembers = Array.isArray(data.members);
          const hasStakeholders = Array.isArray(data.stakeholders);
          return {
            name,
            memberCount: hasMembers ? data.members!.length : 0,
            stakeholderCount: hasStakeholders ? data.stakeholders!.length : 0,
            needsMigration: !hasMembers && !hasStakeholders,
          };
        } catch {
          return { name, memberCount: 0, stakeholderCount: 0, needsMigration: false };
        }
      }),
    );
  }
}

export const projectService = new ProjectService(
  fileSystemService,
  templateService,
  emailResolutionService,
);
