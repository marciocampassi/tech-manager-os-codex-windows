import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { memberService, MemberService } from '../services/member.service.js';
import { printError } from '../utils/display.js';
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

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

// ── Sub-command handlers ──────────────────────────────────────────────────────

export async function runMemberAdd(
  svc: MemberService,
  typeArg: string,
  emailArg: string | undefined,
  opts: { date?: string },
): Promise<void> {
  // Routing: if first arg is a valid email → member-creation mode
  if (isEmail(typeArg)) {
    const email = typeArg.trim().toLowerCase();

    const { name, gender, role } = await inquirer.prompt<{
      name: string;
      gender: string;
      role: string;
    }>([
      { type: 'input', name: 'name', message: 'Name (optional):' },
      { type: 'input', name: 'gender', message: 'Gender (optional):' },
      { type: 'input', name: 'role', message: 'Role (optional):' },
    ]);

    const ws = svc.getWorkspaceRoot();
    const result = await svc.createMember(
      email,
      {
        name: name.trim() || undefined,
        gender: gender.trim() || undefined,
        role: role.trim() || undefined,
      },
      ws,
    );

    if (result.created) {
      process.stdout.write(`${chalk.green('✔')} Member profile created for "${email}"\n`);
    } else {
      process.stdout.write(`${chalk.dim('ℹ')} Member profile for "${email}" already exists\n`);
    }
    return;
  }

  // Routing: type-first mode
  if (!isFileType(typeArg)) {
    printError(
      `Unknown type "${typeArg}".`,
      `Valid types: ${VALID_TYPES.join(', ')}, or pass an email address to create a member profile`,
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
        validate: (v: string): boolean | string =>
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
    printError(message, 'Check that the member exists: tmr team list');
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`${chalk.green('✔')} Created: ${result.filePath}\n`);
  process.stdout.write(`${chalk.dim('  Profile updated:')} ${result.profilePath}\n`);
  process.stdout.write(`${chalk.dim('  Wiki-link:')} ${result.wikiLink}\n`);
}

// ── Command factory ───────────────────────────────────────────────────────────

export function createMemberCommand(): Command {
  const svc = memberService;

  const cmd = new Command('member').description('manage member-related files');

  cmd
    .command('add <type-or-email> [email]')
    .description(
      `add a file for a team member, or create a member profile\n  type: ${VALID_TYPES.join(' | ')}\n  email: creates a member profile`,
    )
    .option('--date <date>', 'date for the file (YYYY-MM-DD), defaults to today')
    .action(async (typeOrEmail: string, email: string | undefined, opts: { date?: string }) => {
      await runMemberAdd(svc, typeOrEmail, email, opts);
    });

  return cmd;
}
