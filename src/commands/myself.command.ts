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

export async function runMyselfSetManager(svc: MyselfService, email: string): Promise<void> {
  let result: Awaited<ReturnType<MyselfService['setManager']>>;
  try {
    const ws = svc.getWorkspaceRoot();
    result = await svc.setManager(email, ws);
  } catch (err) {
    printError(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
    return;
  }

  if (!result.changed) {
    process.stdout.write(
      `${chalk.yellow('•')} ${result.newManagerEmail} is already your current manager — no change.\n`,
    );
    return;
  }

  process.stdout.write(`${chalk.green('✔')} Current manager set to ${result.newManagerEmail}\n`);
  process.stdout.write(`${chalk.dim('  Profile updated:')} ${result.selfPath}\n`);
  process.stdout.write(
    `${chalk.dim("  Added to manager's direct_reports:")} ${result.leaderPath}\n`,
  );
  if (result.previousManagerEmail) {
    process.stdout.write(
      `${chalk.dim('  Previous manager moved to history:')} ${result.previousManagerEmail}\n`,
    );
  }
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

  cmd
    .command('set-manager <email>')
    .description('change your current manager (moves the previous one to history)')
    .action(async (email: string) => {
      await runMyselfSetManager(svc, email);
    });

  return cmd;
}
