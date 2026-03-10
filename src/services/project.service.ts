import path from 'node:path';
import { FileSystemService, fileSystemService } from './file-system.service.js';
import { TemplateService, templateService } from './template.service.js';
import { RelationshipService, relationshipService } from './relationship.service.js';
import { getWorkspaceRoot as resolveWorkspaceRoot } from '../utils/workspace.js';
import type {
  IBatchLinkResult,
  IEmailLocation,
  ILinkResult,
  IProjectFileOptions,
  IProjectSummary,
} from '../types/project.types.js';

// ── Path helpers ──────────────────────────────────────────────────────────────

function projectsCompanyDir(ws: string): string {
  return path.join(ws, 'my-company', 'projects');
}

function overviewPath(ws: string, name: string): string {
  return path.join(projectsCompanyDir(ws), `${name}-project.md`);
}

function projectsDir(ws: string): string {
  return path.join(ws, 'my-projects');
}

function projectDir(ws: string, name: string): string {
  return path.join(projectsDir(ws), name);
}

function compositionPath(ws: string, name: string): string {
  return path.join(projectDir(ws, name), `${name}-composition.md`);
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
    private readonly _relationship: RelationshipService,
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

  /**
   * Resolves an email to its location in the workspace (team → leadership → relationship).
   * Auto-creates as a relationship if not found anywhere.
   * Returns `created: true` when a new relationship was auto-created (step 4).
   *
   * Tech Debt: Story 2.6 will extract this into a formal EmailResolutionService.
   * When that story is implemented, replace calls to this method with EmailResolutionService.resolve().
   */
  private async resolveEmailLocation(
    email: string,
    ws: string,
  ): Promise<IEmailLocation & { created: boolean }> {
    const e = email.toLowerCase();

    // 1. Team member
    const teamProfile = path.join(ws, 'my-teams', '_members', e, `${e}.md`);
    if (await this._fs.exists(teamProfile)) {
      return { type: 'team', relativePath: `../../my-teams/_members/${e}/${e}.md`, created: false };
    }

    // 2. Leadership
    const leaderProfile = path.join(ws, 'my-leadership', e, `${e}.md`);
    if (await this._fs.exists(leaderProfile)) {
      return {
        type: 'leadership',
        relativePath: `../../my-leadership/${e}/${e}.md`,
        created: false,
      };
    }

    // 3. Relationship (already exists)
    const relProfile = path.join(ws, 'my-company', 'relationships', e, `${e}.md`);
    if (await this._fs.exists(relProfile)) {
      return {
        type: 'relationship',
        relativePath: `../../my-company/relationships/${e}/${e}.md`,
        created: false,
      };
    }

    // 4. Not found — auto-create as relationship
    await this._relationship.addRelationship(e, {}, ws);
    return {
      type: 'relationship',
      relativePath: `../../my-company/relationships/${e}/${e}.md`,
      created: true,
    };
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

    const date = todayIso();

    // my-company/projects/{name}-project.md
    await this._fs.writeFile(
      overviewPath(ws, name),
      this._template.getProjectOverviewTemplate(name, date),
    );

    // my-projects/{name}/ subdirectories
    await this._fs.createDirectory(path.join(projectDir(ws, name), 'standup'));
    await this._fs.createDirectory(path.join(projectDir(ws, name), 'discussion'));
    await this._fs.createDirectory(path.join(projectDir(ws, name), 'presentation'));

    // my-projects/{name}/{name}-composition.md
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

    const date = opts.date ?? todayIso();
    const fileName = `${date}-${name}-standup.md`;
    const filePath = path.join(projectDir(ws, name), 'standup', fileName);
    await this._fs.writeFile(filePath, this._template.getStandupTemplate(date, name));

    return { filePath };
  }

  /**
   * Creates a discussion file in my-projects/{name}/discussion/.
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

    const date = opts.date ?? todayIso();
    const fileName = `${date}-${name}-discussion.md`;
    const filePath = path.join(projectDir(ws, name), 'discussion', fileName);
    await this._fs.writeFile(filePath, this._template.getDiscussionTemplate(date, name));

    return { filePath };
  }

  /**
   * Creates a presentation file in my-projects/{name}/presentation/.
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

    const date = opts.date ?? todayIso();
    const slug = toSlug(topic);
    const fileName = `${date}-${name}-presentation-${slug}.md`;
    const filePath = path.join(projectDir(ws, name), 'presentation', fileName);
    await this._fs.writeFile(filePath, this._template.getPresentationTemplate(date, name, topic));

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

    const location = await this.resolveEmailLocation(normalizedEmail, ws);
    const wikiLink = `- [[${location.relativePath}|${normalizedEmail}]]`;

    const content = await this._fs.readFile(compPath);
    const updated = this.appendToHashSection(content, 'Team Members', wikiLink);
    await this._fs.writeFile(compPath, updated);

    return { wikiLink, created: location.created };
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

    const location = await this.resolveEmailLocation(normalizedEmail, ws);
    const wikiLink = `- [[${location.relativePath}|${normalizedEmail}]]`;

    const content = await this._fs.readFile(compPath);
    const updated = this.appendToHashSection(content, 'Stakeholders', wikiLink);
    await this._fs.writeFile(compPath, updated);

    return { wikiLink, created: location.created };
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

      const location = await this.resolveEmailLocation(normalizedEmail, ws);
      const wikiLink = `- [[${location.relativePath}|${normalizedEmail}]]`;

      const compPath = compositionPath(ws, name);
      const content = await this._fs.readFile(compPath);
      await this._fs.writeFile(
        compPath,
        this.appendToHashSection(content, 'Team Members', wikiLink),
      );

      linked++;
      if (location.created) created++;
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

      const location = await this.resolveEmailLocation(normalizedEmail, ws);
      const wikiLink = `- [[${location.relativePath}|${normalizedEmail}]]`;

      const compPath = compositionPath(ws, name);
      const content = await this._fs.readFile(compPath);
      await this._fs.writeFile(
        compPath,
        this.appendToHashSection(content, 'Stakeholders', wikiLink),
      );

      linked++;
      if (location.created) created++;
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
    if (names.length === 0) return [];

    return Promise.all(
      names.map(async (name): Promise<IProjectSummary> => {
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
  relationshipService,
);
