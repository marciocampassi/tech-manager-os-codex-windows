import path from 'node:path';
import { FileSystemService, fileSystemService } from './file-system.service.js';
import { SectionParserService, sectionParserService } from './section-parser.service.js';
import {
  CONTEXT_SECTION_NAME,
  type ContextUpdateResult,
  type EntityType,
} from '../types/context.types.js';

type Result<T> = { success: true; data: T } | { success: false; error: string };

// ── Path helpers ──────────────────────────────────────────────────────────────

function normalizeProjectName(name: string): string {
  return name.endsWith('-project') ? name : `${name}-project`;
}

function memberContextPath(ws: string, email: string): string {
  return path.join(ws, 'my-teams', 'members', email, 'context.md');
}

function memberDirPath(ws: string, email: string): string {
  return path.join(ws, 'my-teams', 'members', email);
}

function projectContextPath(ws: string, name: string): string {
  return path.join(ws, 'my-company', 'projects', normalizeProjectName(name), 'context.md');
}

function leadershipContextPath(ws: string, email: string): string {
  return path.join(ws, 'my-leadership', email, 'context.md');
}

function leadershipDirPath(ws: string, email: string): string {
  return path.join(ws, 'my-leadership', email);
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0] as string;
}

// ── ContextService ────────────────────────────────────────────────────────────

export class ContextService {
  constructor(
    private readonly _fs: FileSystemService,
    private readonly _sectionParser: SectionParserService,
  ) {}

  /**
   * Formats an array of insight strings into a dated markdown block suitable
   * for appending to a `## Context Log` section.
   *
   * Example output:
   * ```
   * ### 2026-04-07
   * - Insight text 1
   * - Insight text 2
   * ```
   */
  private _formatInsightBlock(insights: string[], date: string): string {
    const items = insights.map((i) => `- ${i}`).join('\n');
    // Leading newline produces a blank line between consecutive dated blocks when
    // SectionParserService trims the previous entry's trailing whitespace before insert.
    return `\n### ${date}\n${items}`;
  }

  /**
   * Ensures a context.md file exists at `contextFilePath`, creating it with
   * a skeleton `## Context Log` header if it does not yet exist.
   *
   * Returns `{ created: true }` when the file was newly created.
   */
  private async _ensureContextFile(contextFilePath: string): Promise<{ created: boolean }> {
    const exists = await this._fs.exists(contextFilePath);
    if (!exists) {
      await this._fs.writeFile(contextFilePath, `# Context Log\n\n## ${CONTEXT_SECTION_NAME}\n`);
      return { created: true };
    }
    return { created: false };
  }

  /**
   * Appends a dated insight block to the `## Context Log` section of
   * `contextFilePath`. Creates the file if it does not exist.
   *
   * When `insights` is empty no section write is performed (the file is still
   * created if missing so the caller receives an accurate `created` flag).
   */
  private async _appendInsights(
    contextFilePath: string,
    insights: string[],
  ): Promise<{ created: boolean }> {
    const { created } = await this._ensureContextFile(contextFilePath);

    if (insights.length > 0) {
      const block = this._formatInsightBlock(insights, todayIso());
      await this._sectionParser.appendToFile(contextFilePath, CONTEXT_SECTION_NAME, block);
    }

    return { created };
  }

  /**
   * Updates the context summary for a **team member or leadership contact**.
   *
   * Entity type is auto-detected:
   * 1. If `my-teams/members/{email}` directory exists → `'member'`
   * 2. Else if `my-leadership/{email}` directory exists → `'leadership'`
   * 3. Otherwise → `{ success: false, error: 'Entity not found...' }`
   *
   * This is the primary "CLI injection" entry point. The AI-generated insights
   * from `CategorizationResult.insights` are injected into the context file
   * via the Epic 2 `SectionParserService`, without ever reading the full file
   * back into an AI prompt (token-optimized).
   */
  async updateContext(
    email: string,
    insights: string[],
    workspaceRoot: string,
  ): Promise<Result<ContextUpdateResult>> {
    const normalizedEmail = email.toLowerCase();

    let entityType: EntityType;
    let contextFilePath: string;

    try {
      if (await this._fs.exists(memberDirPath(workspaceRoot, normalizedEmail))) {
        entityType = 'member';
        contextFilePath = memberContextPath(workspaceRoot, normalizedEmail);
      } else if (await this._fs.exists(leadershipDirPath(workspaceRoot, normalizedEmail))) {
        entityType = 'leadership';
        contextFilePath = leadershipContextPath(workspaceRoot, normalizedEmail);
      } else {
        return {
          success: false,
          error: `Entity not found for email: ${normalizedEmail}`,
        };
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : `Failed to resolve entity: ${normalizedEmail}`,
      };
    }

    try {
      const { created } = await this._appendInsights(contextFilePath, insights);
      return {
        success: true,
        data: {
          entityType,
          identifier: normalizedEmail,
          contextFilePath,
          insightsAppended: insights.length,
          created,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : `Failed to update context: ${normalizedEmail}`,
      };
    }
  }

  /**
   * Updates the context summary for a **project**.
   *
   * `projectName` is the raw project slug (e.g. `'api-redesign'`). The
   * `-project` suffix is normalized automatically (matches `ProjectService`
   * convention).
   */
  async updateProjectContext(
    projectName: string,
    insights: string[],
    workspaceRoot: string,
  ): Promise<Result<ContextUpdateResult>> {
    const contextFilePath = projectContextPath(workspaceRoot, projectName);

    try {
      const { created } = await this._appendInsights(contextFilePath, insights);
      return {
        success: true,
        data: {
          entityType: 'project',
          identifier: projectName,
          contextFilePath,
          insightsAppended: insights.length,
          created,
        },
      };
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error ? err.message : `Failed to update project context: ${projectName}`,
      };
    }
  }
}

export const contextService = new ContextService(fileSystemService, sectionParserService);
