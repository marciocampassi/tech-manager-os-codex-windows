import { Command } from 'commander';
import chalk from 'chalk';
import { myselfService, MyselfService } from '../services/myself.service.js';
import { printError } from '../utils/display.js';

// ── Handlers ──────────────────────────────────────────────────────────────────

export async function runMyselfAddPerformanceReview(
  svc: MyselfService,
  opts: { date?: string },
): Promise<void> {
  let result: { filePath: string; profilePath: string };
  try {
    const ws = svc.getWorkspaceRoot();
    result = await svc.addPerformanceReview(opts, ws);
  } catch (err) {
    printError(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`${chalk.green('✔')} Created: ${result.filePath}\n`);
  process.stdout.write(`${chalk.dim('  Profile updated:')} ${result.profilePath}\n`);
}

// ── Command factory ───────────────────────────────────────────────────────────

export function createMyselfCommand(): Command {
  const svc = myselfService;
  const cmd = new Command('myself').description('manage your own career profile and documents');

  const addCmd = new Command('add').description('add a document to your career profile');

  addCmd
    .command('performance-review')
    .description('create a performance review for your own profile')
    .option('--date <date>', 'year-month for the file (YYYY-MM), defaults to current month')
    .action(async (opts: { date?: string }) => {
      await runMyselfAddPerformanceReview(svc, opts);
    });

  cmd.addCommand(addCmd);
  return cmd;
}
