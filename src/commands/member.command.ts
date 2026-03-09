import { exec } from 'node:child_process';
import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { memberService, MemberService } from '../services/member.service.js';
import type { FileType } from '../types/member.types.js';

// ── Type guard ────────────────────────────────────────────────────────────────

const VALID_TYPES: readonly FileType[] = [
  '1on1',
  'feedback',
  'assessment',
  'performance-review',
] as const;

function isFileType(value: string): value is FileType {
  return (VALID_TYPES as readonly string[]).includes(value);
}

// ── Editor helper ─────────────────────────────────────────────────────────────

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

export async function runMemberAdd(
  svc: MemberService,
  typeArg: string,
  emailArg: string | undefined,
  opts: { date?: string; noEdit?: boolean },
): Promise<void> {
  if (!isFileType(typeArg)) {
    process.stdout.write(
      `${chalk.red('✖')} Unknown type "${typeArg}". Valid types: ${VALID_TYPES.join(', ')}\n`,
    );
    process.exitCode = 1;
    return;
  }

  let email = emailArg?.trim().toLowerCase() ?? '';
  if (!email) {
    const { resolvedEmail } = await inquirer.prompt<{ resolvedEmail: string }>([
      {
        type: 'input',
        name: 'resolvedEmail',
        message: 'Member email:',
        validate: (v: string) =>
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) || 'Valid email required',
      },
    ]);
    email = resolvedEmail.trim().toLowerCase();
  }

  const ws = svc.getWorkspaceRoot();

  let result;
  try {
    result = await svc.createMemberFile(email, typeArg, opts, ws);
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

// ── Command factory ───────────────────────────────────────────────────────────

export function createMemberCommand(): Command {
  const svc = memberService;

  const cmd = new Command('member').description('manage member-related files');

  cmd
    .command('add <type> [email]')
    .description(`add a file for a team member\n  type: ${VALID_TYPES.join(' | ')}`)
    .option('--date <date>', 'date for the file (YYYY-MM-DD), defaults to today')
    .option('--no-edit', 'do not open the created file in editor')
    .action(
      async (
        type: string,
        email: string | undefined,
        opts: { date?: string; noEdit?: boolean },
      ) => {
        await runMemberAdd(svc, type, email, opts);
      },
    );

  return cmd;
}
