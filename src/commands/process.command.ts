import chalk from 'chalk';
import { Command } from 'commander';
import { AIProviderFactory } from '../providers/ai-provider-factory.js';
import { configService } from '../services/config.service.js';
import { CategorizationService } from '../services/categorization.service.js';
import { ContextService } from '../services/context.service.js';
import { FileOrganizationService } from '../services/file-organization.service.js';
import { fileSystemService } from '../services/file-system.service.js';
import { InboxProcessService } from '../services/inbox-process.service.js';
import { InboxService } from '../services/inbox.service.js';
import { projectService } from '../services/project.service.js';
import { sectionParserService } from '../services/section-parser.service.js';
import { TaskService } from '../services/task.service.js';
import { teamService } from '../services/team.service.js';
import { getWorkspaceRoot } from '../utils/workspace.js';
import type { ProcessSummary } from '../types/process.types.js';

function buildInboxProcessService(): InboxProcessService {
  const provider = configService.getActiveProvider();
  if (!provider) {
    throw new Error(
      'No AI provider configured. Run `tmr init` or `tmr config switch-provider` and set an API key.',
    );
  }
  const pc = configService.getProviderConfig(provider);
  if (!pc?.api_key_encrypted) {
    throw new Error(
      `No API key for provider "${provider}". Run \`tmr config set-key\` to configure it.`,
    );
  }

  const ai = AIProviderFactory.create(provider, pc.api_key_encrypted);
  const threshold = configService.getConfidenceThreshold();
  const categorization = new CategorizationService(ai, threshold);
  const inbox = new InboxService(fileSystemService);
  const context = new ContextService(fileSystemService, sectionParserService);
  const tasks = new TaskService(ai, fileSystemService);
  const organize = new FileOrganizationService(fileSystemService);

  return new InboxProcessService(
    inbox,
    categorization,
    context,
    tasks,
    organize,
    teamService,
    projectService,
    fileSystemService,
  );
}

function formatSummary(s: ProcessSummary, plain: boolean): string {
  const bold: (t: string) => string = plain
    ? (t: string): string => t
    : (t: string): string => chalk.bold(t);
  const red: (t: string) => string = plain
    ? (t: string): string => t
    : (t: string): string => chalk.red(t);
  const yellow: (t: string) => string = plain
    ? (t: string): string => t
    : (t: string): string => chalk.yellow(t);
  const dim: (t: string) => string = plain
    ? (t: string): string => t
    : (t: string): string => chalk.dim(t);
  const lines: string[] = [];

  lines.push(bold('Summary'));
  lines.push(`  Files scanned:        ${s.filesScanned}`);
  lines.push(`  Categorized:          ${s.filesCategorizedOk}`);
  if (s.needsReviewCount > 0) {
    lines.push(yellow(`  Flagged for review:   ${s.needsReviewCount}`));
  }
  lines.push(
    `  Context updates:      ${s.memberContextUpdates} member, ${s.projectContextUpdates} project`,
  );
  if (s.dryRun) {
    lines.push(dim('  (dry-run: no files were written or moved)'));
  }
  if (s.taskError) {
    lines.push(red(`  Task extraction:      failed — ${s.taskError}`));
  } else if (!s.dryRun) {
    lines.push(`  Tasks added:          ${s.tasksAdded}`);
    lines.push(`  Tasks marked done:    ${s.tasksMarkedDone}`);
  } else {
    lines.push(dim('  Task extraction:      skipped (dry-run)'));
  }
  lines.push(`  Files organized:      ${s.filesOrganizedOk}`);

  const uniqueActions = [...new Set(s.suggestedActions)];
  if (uniqueActions.length > 0) {
    lines.push('');
    lines.push(bold('Suggested actions'));
    for (const a of uniqueActions) {
      lines.push(`  - ${a}`);
    }
  }

  if (s.categorizeErrors.length > 0) {
    lines.push('');
    lines.push(red(bold('Categorization errors')));
    for (const e of s.categorizeErrors) {
      lines.push(`  - ${e}`);
    }
  }
  if (s.contextErrors.length > 0) {
    lines.push('');
    lines.push(red(bold('Context update errors')));
    for (const e of s.contextErrors) {
      lines.push(`  - ${e}`);
    }
  }
  if (s.organizeErrors.length > 0) {
    lines.push('');
    lines.push(red(bold('Organization errors')));
    for (const e of s.organizeErrors) {
      lines.push(`  - ${e}`);
    }
  }

  return lines.join('\n') + '\n';
}

export async function runProcess(opts: {
  dryRun: boolean;
  verbose: boolean;
  plain: boolean;
}): Promise<void> {
  configService.initialize();

  const workspaceRoot = getWorkspaceRoot();
  let processSvc: InboxProcessService;
  try {
    processSvc = buildInboxProcessService();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stdout.write(`${opts.plain ? msg : chalk.red(msg)}\n`);
    process.exitCode = 1;
    return;
  }

  const bold: (t: string) => string = opts.plain
    ? (t: string): string => t
    : (t: string): string => chalk.bold(t);
  const yellow: (t: string) => string = opts.plain
    ? (t: string): string => t
    : (t: string): string => chalk.yellow(t);
  const dim: (t: string) => string = opts.plain
    ? (t: string): string => t
    : (t: string): string => chalk.dim(t);
  process.stdout.write(bold('tmr process') + (opts.dryRun ? yellow(' (dry-run)') : '') + '\n');
  process.stdout.write(
    dim('Pipeline: scan → categorize → update contexts → extract tasks → organize\n\n'),
  );

  if (opts.verbose) {
    process.stdout.write(dim(`Workspace: ${workspaceRoot}\n\n`));
  }

  const result = await processSvc.run(workspaceRoot, {
    dryRun: opts.dryRun,
    verbose: opts.verbose,
    plain: opts.plain,
  });

  if (!result.success) {
    process.stdout.write(`${opts.plain ? result.error : chalk.red(result.error)}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(formatSummary(result.data, opts.plain));
}

export function createProcessCommand(): Command {
  const cmd = new Command('process')
    .description('process inbox files: scan, categorize, update contexts, extract tasks, organize')
    .option('--dry-run', 'preview without writing files or updating tasks', false)
    .action(async (opts: { dryRun?: boolean }, command: Command): Promise<void> => {
      const globals = command.parent?.opts() as { verbose?: boolean; plain?: boolean } | undefined;
      const plain = globals?.plain ?? false;
      const verbose = globals?.verbose ?? false;
      const dryRun = opts.dryRun === true;
      await runProcess({ dryRun, verbose, plain });
    });

  return cmd;
}
