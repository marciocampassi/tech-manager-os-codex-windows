import { exec } from 'node:child_process';
import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { leadershipService, LeadershipService } from '../services/leadership.service.js';
import type { IAddLeadershipOptions } from '../types/leadership.types.js';

// ── Formatting helpers ────────────────────────────────────────────────────────

function padEnd(s: string, len: number): string {
  return s.length >= len ? s : s + ' '.repeat(len - s.length);
}

function openInEditor(filePath: string): void {
  try {
    const editor = process.env['EDITOR'];
    if (editor) {
      exec(`${editor} "${filePath}"`);
    } else if (process.platform === 'darwin') {
      exec(`open "${filePath}"`);
    } else {
      exec(`xdg-open "${filePath}"`);
    }
  } catch {
    // Editor failure is non-fatal; path already printed
  }
}

// ── Sub-command handlers ──────────────────────────────────────────────────────

export async function runLeadershipAdd(
  svc: LeadershipService,
  emailArg: string | undefined,
  opts: IAddLeadershipOptions,
): Promise<void> {
  const ws = svc.getWorkspaceRoot();

  let email = emailArg?.trim().toLowerCase() ?? '';

  if (!email) {
    const answers = await inquirer.prompt<{
      email: string;
      name: string;
      role: string;
      areas_of_responsibility: string;
    }>([
      {
        type: 'input',
        name: 'email',
        message: 'Email:',
        validate: (v: string): boolean | string =>
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) || 'Valid email required',
      },
      { type: 'input', name: 'name', message: 'Name (optional):' },
      { type: 'input', name: 'role', message: 'Role (optional):' },
      {
        type: 'input',
        name: 'areas_of_responsibility',
        message: 'Areas of responsibility (optional):',
      },
    ]);
    email = answers.email.trim().toLowerCase();
    opts = {
      ...opts,
      name: answers.name || opts.name,
      role: answers.role || opts.role,
      areas_of_responsibility: answers.areas_of_responsibility || opts.areas_of_responsibility,
    };
  }

  const result = await svc.addLeadership(email, opts, ws);
  if (result.created) {
    process.stdout.write(`${chalk.green('✔')} Leadership "${email}" created\n`);
  } else {
    process.stdout.write(`${chalk.dim('ℹ')} Leadership "${email}" already exists\n`);
  }
}

export async function runLeadership1on1(
  svc: LeadershipService,
  emailArg: string | undefined,
  opts: { date?: string; noEdit?: boolean },
): Promise<void> {
  let email = emailArg?.trim().toLowerCase() ?? '';

  if (!email) {
    const { resolvedEmail } = await inquirer.prompt<{ resolvedEmail: string }>([
      {
        type: 'input',
        name: 'resolvedEmail',
        message: 'Leadership email:',
        validate: (v: string): boolean | string =>
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) || 'Valid email required',
      },
    ]);
    email = resolvedEmail.trim().toLowerCase();
  }

  const ws = svc.getWorkspaceRoot();
  let result;
  try {
    result = await svc.add1on1(email, opts, ws);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stdout.write(`${chalk.red('✖')} ${message}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`${chalk.green('✔')} Created: ${result.filePath}\n`);
  process.stdout.write(`${chalk.dim('  Profile updated:')} ${result.profilePath}\n`);
  process.stdout.write(`${chalk.dim('  Wiki-link:')} ${result.wikiLink}\n`);

  if (!opts.noEdit) {
    openInEditor(result.filePath);
  }
}

export async function runLeadershipList(svc: LeadershipService): Promise<void> {
  const ws = svc.getWorkspaceRoot();
  const rows = await svc.listLeadership(ws);

  if (rows.length === 0) {
    process.stdout.write(
      'No leadership contacts found. Run `tmr leadership add <email>` to create one.\n',
    );
    return;
  }

  const header = `${padEnd('Email', 30)}  ${padEnd('Name', 20)}  ${padEnd('Role', 20)}  Last 1on1`;
  const divider = '─'.repeat(header.length);
  process.stdout.write(`${chalk.bold(header)}\n${divider}\n`);

  for (const row of rows) {
    process.stdout.write(
      `${padEnd(row.email, 30)}  ${padEnd(row.name, 20)}  ${padEnd(row.role, 20)}  ${row.lastInteraction}\n`,
    );
  }
}

// ── Command factory ───────────────────────────────────────────────────────────

export function createLeadershipCommand(): Command {
  const svc = leadershipService;

  const cmd = new Command('leadership').description('manage leadership relationships');

  cmd
    .command('add [email]')
    .description('add a leadership contact')
    .option('--name <name>', 'contact name')
    .option('--role <role>', 'contact role')
    .option('--areas <areas>', 'areas of responsibility')
    .action(
      async (
        emailArg: string | undefined,
        opts: { name?: string; role?: string; areas?: string },
      ) => {
        await runLeadershipAdd(svc, emailArg, {
          name: opts.name,
          role: opts.role,
          areas_of_responsibility: opts.areas,
        });
      },
    );

  cmd
    .command('1on1 [email]')
    .description('create a 1on1 note for a leadership contact')
    .option('--date <date>', 'date for the file (YYYY-MM-DD), defaults to today')
    .option('--no-edit', 'do not open the created file in editor')
    .action(async (email: string | undefined, opts: { date?: string; noEdit?: boolean }) => {
      await runLeadership1on1(svc, email, opts);
    });

  cmd
    .command('list')
    .description('list all leadership contacts sorted by most recent 1on1')
    .action(async () => {
      await runLeadershipList(svc);
    });

  return cmd;
}
