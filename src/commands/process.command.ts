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
import { printError, printJson } from '../utils/display.js';
import type { ProcessSummary } from '../types/process.types.js';

const CONFIG_ERROR_EXIT_CODE = 78; // EX_CONFIG: configuration error (sysexits.h)

function checkApiKeyConfigured(): { ok: true } | { ok: false; message: string } {
  const provider = configService.getActiveProvider();
  if (!provider) {
    return {
      ok: false,
      message: 'tmr process requires an AI API key. Run `tmr config` to set one up.',
    };
  }
  const pc = configService.getProviderConfig(provider);
  if (!pc?.api_key_encrypted) {
    return {
      ok: false,
      message: 'tmr process requires an AI API key. Run `tmr config` to set one up.',
    };
  }
  return { ok: true };
}

function buildInboxProcessService(): InboxProcessService {
  const provider = configService.getActiveProvider();
  if (!provider) {
    throw new Error('tmr process requires an AI API key. Run `tmr config` to set one up.');
  }
  const pc = configService.getProviderConfig(provider);
  if (!pc?.api_key_encrypted) {
    throw new Error('tmr process requires an AI API key. Run `tmr config` to set one up.');
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
  json?: boolean;
}): Promise<void> {
  configService.initialize();
  const { plain, json = false } = opts;

  const configCheck = checkApiKeyConfigured();
  if (!configCheck.ok) {
    if (json) {
      printJson({ status: 'error', message: configCheck.message });
    } else {
      printError(configCheck.message, 'Run `tmr config` to add an API key.', plain);
    }
    process.exitCode = CONFIG_ERROR_EXIT_CODE;
    return;
  }

  const workspaceRoot = getWorkspaceRoot();
  let processSvc: InboxProcessService;
  try {
    processSvc = buildInboxProcessService();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (json) {
      printJson({ status: 'error', message: msg });
    } else {
      printError(msg, 'Run `tmr config` to configure your AI provider.', plain);
    }
    process.exitCode = 1;
    return;
  }

  if (!json) {
    const bold: (t: string) => string = plain
      ? (t: string): string => t
      : (t: string): string => chalk.bold(t);
    const yellow: (t: string) => string = plain
      ? (t: string): string => t
      : (t: string): string => chalk.yellow(t);
    const dim: (t: string) => string = plain
      ? (t: string): string => t
      : (t: string): string => chalk.dim(t);
    process.stdout.write(bold('tmr process') + (opts.dryRun ? yellow(' (dry-run)') : '') + '\n');
    process.stdout.write(
      dim('Pipeline: scan → categorize → update contexts → extract tasks → organize\n\n'),
    );

    if (opts.verbose) {
      process.stdout.write(dim(`Workspace: ${workspaceRoot}\n\n`));
    }
  }

  const result = await processSvc.run(workspaceRoot, {
    dryRun: opts.dryRun,
    verbose: opts.verbose,
    plain: opts.plain,
  });

  if (!result.success) {
    if (json) {
      printJson({ status: 'error', message: result.error });
    } else {
      printError(result.error, 'Check your workspace path and AI provider configuration.', plain);
    }
    process.exitCode = 1;
    return;
  }

  if (json) {
    const s = result.data;
    printJson({
      processed: s.filesCategorizedOk,
      skipped: s.needsReviewCount,
      errors: s.categorizeErrors.length + s.contextErrors.length + s.organizeErrors.length,
      tasksAdded: s.tasksAdded,
      tasksMarkedDone: s.tasksMarkedDone,
      filesOrganized: s.filesOrganizedOk,
      dryRun: s.dryRun,
    });
  } else {
    process.stdout.write(formatSummary(result.data, plain));
  }
}

export function createProcessCommand(): Command {
  const cmd = new Command('process')
    .description('process inbox files: scan, categorize, update contexts, extract tasks, organize')
    .option('--dry-run', 'preview without writing files or updating tasks', false)
    .addHelpText(
      'after',
      '\nExamples:\n  tmr process\n  tmr process --dry-run\n  tmr process --json\n',
    )
    .action(async (opts: { dryRun?: boolean }, command: Command): Promise<void> => {
      const globals = command.parent?.opts() as
        | { verbose?: boolean; plain?: boolean; json?: boolean }
        | undefined;
      const plain = globals?.plain ?? false;
      const verbose = globals?.verbose ?? false;
      const json = globals?.json ?? false;
      const dryRun = opts.dryRun === true;
      await runProcess({ dryRun, verbose, plain, json });
    });

  return cmd;
}
