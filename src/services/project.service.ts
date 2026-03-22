import path from 'node:path';
import { FileSystemService, fileSystemService } from './file-system.service.js';
import { TemplateService, templateService } from './template.service.js';
import { emailResolutionService, EmailResolutionService } from './email-resolution.service.js';
import { getWorkspaceRoot as resolveWorkspaceRoot } from '../utils/workspace.js';
import type {
  IBatchLinkResult,
  ILinkResult,
  IProjectFileOptions,
  IProjectSummary,
} from '../types/project.types.js';

// ── Path helpers ──────────────────────────────────────────────────────────────

/**
 * Normalizes a project name by appending '-project' suffix if not already present.
 * e.g. 'internship-program' → 'internship-program-project'
 */
export function normalizeProjectName(name: string): string {
  return name.endsWith('-project') ? name : `${name}-project`;
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

function compositionPath(ws: string, name: string): string {
  const normalized = normalizeProjectName(name);
  return path.join(projectBaseDir(ws, name), `${normalized}-composition.md`);
}

function projectStandupDir(ws: string, name: string): string {
  return path.join(projectBaseDir(ws, name), 'standup');
}

function projectDiscussionDir(ws: string, name: string): string {
  return path.join(projectBaseDir(ws, name), 'discussion');
}

function projectPresentationDir(ws: string, name: string): string {
  return path.join(projectBaseDir(ws, name), 'presentation');
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0] as string;
}

function toSlug(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-');
}

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
   * Appends `line` to a `# sectionName` section in the content string.
   * Creates the section at the end if missing.
   * Handles `# ` (single hash) headers — composition file format.
   */
  private appendToHashSection(content: string, sectionName: string, line: string): string {
    const lines = content.split('\n');
    const secIdx = lines.findIndex((l) => l === `# ${sectionName}`);

    if (secIdx === -1) {
      return content.trimEnd() + `\n\n# ${sectionName}\n\n${line}\n`;
    }

    let nextSecIdx = lines.findIndex((l, i) => i > secIdx && l.startsWith('# '));
    if (nextSecIdx === -1) nextSecIdx = lines.length;

    const before = lines.slice(0, nextSecIdx).join('\n').trimEnd();
    const after = lines.slice(nextSecIdx).join('\n');

    return after.length > 0 ? `${before}\n${line}\n\n${after}` : `${before}\n${line}\n`;
  }

  /**
   * Counts `- [[` entries within a `# sectionName` section.
   */
  private countHashSection(content: string, sectionName: string): number {
    const lines = content.split('\n');
    const secIdx = lines.findIndex((l) => l === `# ${sectionName}`);
    if (secIdx === -1) return 0;

    let nextSecIdx = lines.findIndex((l, i) => i > secIdx && l.startsWith('# '));
    if (nextSecIdx === -1) nextSecIdx = lines.length;

    return lines.slice(secIdx + 1, nextSecIdx).filter((l) => l.startsWith('- [[')).length;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Creates the full project structure.
   * Returns { created: false } if the project already exists (idempotent).
   */
  async addProject(name: string, ws: string): Promise<{ created: boolean }> {
    const compPath = compositionPath(ws, name);

    if (await this._fs.exists(compPath)) {
      return { created: false };
    }

    const normalized = normalizeProjectName(name);
    const date = todayIso();

    // my-company/projects/{name}-project/{name}-project.md (overview)
    await this._fs.writeFile(
      projectOverviewPath(ws, name),
      this._template.getProjectOverviewTemplate(normalized, date),
    );

    // subdirectories inside the project folder
    await this._fs.createDirectory(projectStandupDir(ws, name));
    await this._fs.createDirectory(projectDiscussionDir(ws, name));
    await this._fs.createDirectory(projectPresentationDir(ws, name));

    // {name}-project/{name}-project-composition.md
    await this._fs.writeFile(compPath, this._template.getProjectCompositionTemplate());

    return { created: true };
  }

  /**
   * Creates a standup file in my-projects/{name}/standup/.
   */
  async addStandup(
    name: string,
    opts: IProjectFileOptions,
    ws: string,
  ): Promise<{ filePath: string }> {
    const compPath = compositionPath(ws, name);
    if (!(await this._fs.exists(compPath))) {
      throw new Error(`Project '${name}' not found. Run 'tmr project add ${name}' first.`);
    }

    const normalized = normalizeProjectName(name);
    const date = opts.date ?? todayIso();
    const fileName = `${date}-${normalized}-standup.md`;
    const filePath = path.join(projectStandupDir(ws, name), fileName);
    await this._fs.writeFile(filePath, this._template.getStandupTemplate(date, normalized));

    return { filePath };
  }

  /**
   * Creates a discussion file inside the project directory.
   */
  async addDiscussion(
    name: string,
    opts: IProjectFileOptions,
    ws: string,
  ): Promise<{ filePath: string }> {
    const compPath = compositionPath(ws, name);
    if (!(await this._fs.exists(compPath))) {
      throw new Error(`Project '${name}' not found. Run 'tmr project add ${name}' first.`);
    }

    const normalized = normalizeProjectName(name);
    const date = opts.date ?? todayIso();
    const fileName = `${date}-${normalized}-discussion.md`;
    const filePath = path.join(projectDiscussionDir(ws, name), fileName);
    await this._fs.writeFile(filePath, this._template.getDiscussionTemplate(date, normalized));

    return { filePath };
  }

  /**
   * Creates a presentation file inside the project directory.
   */
  async addPresentation(
    name: string,
    topic: string,
    opts: IProjectFileOptions,
    ws: string,
  ): Promise<{ filePath: string }> {
    const compPath = compositionPath(ws, name);
    if (!(await this._fs.exists(compPath))) {
      throw new Error(`Project '${name}' not found. Run 'tmr project add ${name}' first.`);
    }

    const normalized = normalizeProjectName(name);
    const date = opts.date ?? todayIso();
    const slug = toSlug(topic);
    const fileName = `${date}-${normalized}-presentation-${slug}.md`;
    const filePath = path.join(projectPresentationDir(ws, name), fileName);
    await this._fs.writeFile(
      filePath,
      this._template.getPresentationTemplate(date, normalized, topic),
    );

    return { filePath };
  }

  /**
   * Links an email to the `# Team Members` section of the project composition file.
   */
  async linkMember(name: string, email: string, ws: string): Promise<ILinkResult> {
    const normalizedEmail = email.toLowerCase();
    const compPath = compositionPath(ws, name);

    if (!(await this._fs.exists(compPath))) {
      throw new Error(`Project '${name}' not found. Run 'tmr project add ${name}' first.`);
    }

    const resolved = await this._emailResolution.resolve(normalizedEmail, ws);
    const wikiLink = `- ${this._emailResolution.generateWikiLink(normalizedEmail, resolved.absolutePath, compPath)}`;

    const content = await this._fs.readFile(compPath);
    const updated = this.appendToHashSection(content, 'Team Members', wikiLink);
    await this._fs.writeFile(compPath, updated);

    return { wikiLink, created: resolved.created };
  }

  /**
   * Links an email to the `# Stakeholders` section of the project composition file.
   */
  async linkStakeholder(name: string, email: string, ws: string): Promise<ILinkResult> {
    const normalizedEmail = email.toLowerCase();
    const compPath = compositionPath(ws, name);

    if (!(await this._fs.exists(compPath))) {
      throw new Error(`Project '${name}' not found. Run 'tmr project add ${name}' first.`);
    }

    const resolved = await this._emailResolution.resolve(normalizedEmail, ws);
    const wikiLink = `- ${this._emailResolution.generateWikiLink(normalizedEmail, resolved.absolutePath, compPath)}`;

    const content = await this._fs.readFile(compPath);
    const updated = this.appendToHashSection(content, 'Stakeholders', wikiLink);
    await this._fs.writeFile(compPath, updated);

    return { wikiLink, created: resolved.created };
  }

  /**
   * Batch-links multiple emails to the `# Team Members` section.
   */
  async linkMembers(name: string, emails: string[], ws: string): Promise<IBatchLinkResult> {
    let linked = 0;
    let created = 0;

    for (const email of emails) {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) continue;

      const compPath = compositionPath(ws, name);
      const resolved = await this._emailResolution.resolve(normalizedEmail, ws);
      const wikiLink = `- ${this._emailResolution.generateWikiLink(normalizedEmail, resolved.absolutePath, compPath)}`;

      const content = await this._fs.readFile(compPath);
      await this._fs.writeFile(
        compPath,
        this.appendToHashSection(content, 'Team Members', wikiLink),
      );

      linked++;
      if (resolved.created) created++;
    }

    return { linked, created };
  }

  /**
   * Batch-links multiple emails to the `# Stakeholders` section.
   */
  async linkStakeholders(name: string, emails: string[], ws: string): Promise<IBatchLinkResult> {
    let linked = 0;
    let created = 0;

    for (const email of emails) {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) continue;

      const compPath = compositionPath(ws, name);
      const resolved = await this._emailResolution.resolve(normalizedEmail, ws);
      const wikiLink = `- ${this._emailResolution.generateWikiLink(normalizedEmail, resolved.absolutePath, compPath)}`;

      const content = await this._fs.readFile(compPath);
      await this._fs.writeFile(
        compPath,
        this.appendToHashSection(content, 'Stakeholders', wikiLink),
      );

      linked++;
      if (resolved.created) created++;
    }

    return { linked, created };
  }

  /**
   * Lists all projects with member and stakeholder counts.
   */
  async listProjects(ws: string): Promise<IProjectSummary[]> {
    const root = projectsDir(ws);
    if (!(await this._fs.exists(root))) return [];

    const names = await this._fs.listDirectories(root);
    const projectNames = names.filter((n) => n.endsWith('-project'));
    if (projectNames.length === 0) return [];

    return Promise.all(
      projectNames.map(async (name): Promise<IProjectSummary> => {
        const compPath = compositionPath(ws, name);
        if (!(await this._fs.exists(compPath))) {
          return { name, memberCount: 0, stakeholderCount: 0 };
        }
        const content = await this._fs.readFile(compPath);
        return {
          name,
          memberCount: this.countHashSection(content, 'Team Members'),
          stakeholderCount: this.countHashSection(content, 'Stakeholders'),
        };
      }),
    );
  }
}

export const projectService = new ProjectService(
  fileSystemService,
  templateService,
  emailResolutionService,
);
