import chalk from 'chalk';
import path from 'node:path';
import ora from 'ora';
import type { CategorizationContext, CategorizationResult } from '../types/categorization.types.js';
import type { InboxFile } from '../types/inbox.types.js';
import type { ProcessRunOptions, ProcessSummary } from '../types/process.types.js';
import { loadCategorizationContext } from './categorization-context.loader.js';
import type { CategorizationService } from './categorization.service.js';
import type { ContextService } from './context.service.js';
import type { FileOrganizationService } from './file-organization.service.js';
import type { FileSystemService } from './file-system.service.js';
import type { InboxService } from './inbox.service.js';
import type { ProjectService } from './project.service.js';
import type { TaskService } from './task.service.js';
import type { TeamService } from './team.service.js';

type Result<T> = { success: true; data: T } | { success: false; error: string };

type CatEntry = {
  file: InboxFile;
  result: CategorizationResult;
};

interface SpinnerHandle {
  text: string;
  succeed(msg: string): void;
  fail(msg: string): void;
  stop(): void;
}

/**
 * Returns an ora spinner when running in a terminal (plain=false), or a plain-text
 * no-op shim that writes to stdout when plain=true or when output is non-interactive.
 * This keeps AI-heavy steps (categorisation, task extraction) visually informative
 * without emitting ANSI codes in CI or pipe contexts.
 */
function makeSpinner(initialText: string, plain: boolean): SpinnerHandle {
  if (plain) {
    process.stdout.write(`${initialText}\n`);
    return {
      text: '',
      succeed(msg: string): void {
        process.stdout.write(`${msg}\n`);
      },
      fail(msg: string): void {
        process.stdout.write(`${msg}\n`);
      },
      stop(): void {},
    };
  }
  return ora({ text: initialText }).start();
}

export class InboxProcessService {
  private _progress(message: string, options: ProcessRunOptions): void {
    if (options.plain) {
      process.stdout.write(`${message}\n`);
    } else {
      process.stdout.write(`${chalk.cyan('●')} ${message}\n`);
    }
  }

  constructor(
    private readonly _inbox: InboxService,
    private readonly _categorization: CategorizationService,
    private readonly _context: ContextService,
    private readonly _tasks: TaskService,
    private readonly _organize: FileOrganizationService,
    private readonly _team: TeamService,
    private readonly _project: ProjectService,
    private readonly _fs: FileSystemService,
  ) {}

  private _matchMember(key: string, ctx: CategorizationContext): { email: string } | undefined {
    const k = key.trim().toLowerCase();
    for (const m of ctx.members) {
      if (m.email.toLowerCase() === k) return { email: m.email };
      if (m.name.toLowerCase() === k) return { email: m.email };
    }
    return undefined;
  }

  private _matchProject(key: string, ctx: CategorizationContext): { slug: string } | undefined {
    const k = key.trim().toLowerCase();
    const asHyphen = k.replace(/\s+/g, '-');
    for (const p of ctx.projects) {
      if (p.name.toLowerCase() === k || p.name.toLowerCase() === asHyphen) {
        return { slug: p.name };
      }
      if (p.displayName.toLowerCase() === k) {
        return { slug: p.name };
      }
    }
    return undefined;
  }

  private async _applyInsights(
    result: CategorizationResult,
    catCtx: CategorizationContext,
    workspaceRoot: string,
    dryRun: boolean,
  ): Promise<{ member: number; project: number; errors: string[] }> {
    let member = 0;
    let project = 0;
    const errors: string[] = [];

    const entries = Object.entries(result.insights);
    for (const [entityKey, insights] of entries) {
      if (insights.length === 0) continue;

      const mem = this._matchMember(entityKey, catCtx);
      if (mem) {
        if (dryRun) {
          member += 1;
          continue;
        }
        const r = await this._context.updateContext(mem.email, insights, workspaceRoot);
        if (r.success) {
          member += 1;
        } else {
          errors.push(`${entityKey} (member): ${r.error}`);
        }
        continue;
      }

      const proj = this._matchProject(entityKey, catCtx);
      if (proj) {
        if (dryRun) {
          project += 1;
          continue;
        }
        const r = await this._context.updateProjectContext(proj.slug, insights, workspaceRoot);
        if (r.success) {
          project += 1;
        } else {
          errors.push(`${entityKey} (project): ${r.error}`);
        }
        continue;
      }
    }

    return { member, project, errors };
  }

  async run(workspaceRoot: string, options: ProcessRunOptions): Promise<Result<ProcessSummary>> {
    const { dryRun } = options;

    this._progress('[1/5] Scanning inbox…', options);
    const scan = await this._inbox.scanInbox(workspaceRoot);
    if (!scan.success) {
      return { success: false, error: scan.error };
    }

    const files = scan.data;
    const summary: ProcessSummary = {
      filesScanned: files.length,
      filesCategorizedOk: 0,
      categorizeErrors: [],
      memberContextUpdates: 0,
      projectContextUpdates: 0,
      contextErrors: [],
      tasksAdded: 0,
      tasksMarkedDone: 0,
      taskError: null,
      filesOrganizedOk: 0,
      organizeErrors: [],
      needsReviewCount: 0,
      suggestedActions: [],
      dryRun,
    };

    if (files.length === 0) {
      return { success: true, data: summary };
    }

    this._progress('[2/5] Loading team and project context…', options);
    const ctxLoaded = await loadCategorizationContext(
      workspaceRoot,
      this._team,
      this._project,
      this._fs,
    );
    if (!ctxLoaded.success) {
      return { success: false, error: ctxLoaded.error };
    }
    const catCtx = ctxLoaded.data;

    // Step 3: AI categorisation — one call per file; can exceed 500ms for any batch.
    // Use a spinner so the user sees live progress per file.
    const catSpinner = makeSpinner(`[3/5] Categorizing files… (0/${files.length})`, options.plain);
    const categorized: CatEntry[] = [];
    let catIndex = 0;

    for (const file of files) {
      catIndex += 1;
      catSpinner.text = `[3/5] Categorizing ${path.basename(file.filepath)} (${catIndex}/${files.length})…`;
      const cat = await this._categorization.categorize(file, catCtx);
      if (!cat.success) {
        summary.categorizeErrors.push(`${file.filepath}: ${cat.error}`);
        continue;
      }
      summary.filesCategorizedOk += 1;
      if (cat.data.needsReview) {
        summary.needsReviewCount += 1;
      }
      summary.suggestedActions.push(...cat.data.suggestedActions);
      categorized.push({ file, result: cat.data });
    }

    if (summary.categorizeErrors.length > 0 && categorized.length === 0) {
      catSpinner.fail(`[3/5] Categorization failed for all ${files.length} file(s)`);
    } else {
      catSpinner.succeed(
        `[3/5] Categorized ${summary.filesCategorizedOk} / ${files.length} file(s)`,
      );
    }

    for (const { result } of categorized) {
      const applied = await this._applyInsights(result, catCtx, workspaceRoot, dryRun);
      summary.memberContextUpdates += applied.member;
      summary.projectContextUpdates += applied.project;
      summary.contextErrors.push(...applied.errors);
    }

    // Step 4: AI task extraction — one call covering all files; can exceed 500ms.
    if (!dryRun) {
      const taskSpinner = makeSpinner('[4/5] Extracting tasks…', options.plain);
      const taskRes = await this._tasks.extractTasks(files, workspaceRoot);
      if (taskRes.success) {
        summary.tasksAdded = taskRes.data.tasksAdded;
        summary.tasksMarkedDone = taskRes.data.tasksMarkedDone;
        taskSpinner.succeed(
          `[4/5] Tasks: +${taskRes.data.tasksAdded} added, ${taskRes.data.tasksMarkedDone} done`,
        );
      } else {
        summary.taskError = taskRes.error;
        taskSpinner.fail(`[4/5] Task extraction failed`);
      }
    } else {
      this._progress('[4/5] Skipping task extraction (dry-run)…', options);
    }

    if (dryRun) {
      this._progress('[5/5] Skipping file moves (dry-run)…', options);
    } else {
      this._progress('[5/5] Organizing files…', options);
    }
    for (const { file, result } of categorized) {
      if (dryRun) {
        continue;
      }
      const org = await this._organize.organizeFile(file, workspaceRoot, result.destinations);
      if (org.success) {
        summary.filesOrganizedOk += 1;
      } else {
        summary.organizeErrors.push(`${file.filepath}: ${org.error}`);
      }
    }

    return { success: true, data: summary };
  }
}
