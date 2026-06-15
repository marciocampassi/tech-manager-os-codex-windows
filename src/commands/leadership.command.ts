import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { leadershipService, LeadershipService } from '../services/leadership.service.js';
import { memberService } from '../services/member.service.js';
import { printError, printInfo } from '../utils/display.js';
import { resolveEmailWithSimilarCheck } from '../utils/email-guard.js';
import type { IAddLeadershipOptions } from '../types/leadership.types.js';

// ── Formatting helpers ────────────────────────────────────────────────────────

function padEnd(s: string, len: number): string {
  return s.length >= len ? s : s + ' '.repeat(len - s.length);
}

// ── Sub-command handlers ──────────────────────────────────────────────────────

export async function runLeadershipAdd(
  svc: LeadershipService,
  typeOrEmail: string | undefined,
  emailArg: string | undefined,
  opts: IAddLeadershipOptions,
): Promise<void> {
  // Route: 1on1 subcommand — `tmr leadership add 1on1 <email>`
  if (typeOrEmail?.trim().toLowerCase() === '1on1') {
    await runLeadership1on1(svc, emailArg, opts);
    return;
  }

  const ws = svc.getWorkspaceRoot();

  let email = typeOrEmail?.trim().toLowerCase() ?? '';

  if (!email) {
    const { resolvedEmail } = await inquirer.prompt<{ resolvedEmail: string }>([
      {
        type: 'input',
        name: 'resolvedEmail',
        message: 'Email:',
        validate: (v: string): boolean | string =>
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) || 'Valid email required',
      },
    ]);
    email = resolvedEmail.trim().toLowerCase();
  }

  email = await resolveEmailWithSimilarCheck(email, ws);

  // Secondary prompts — skip individual prompts if pre-filled via flags
  const secondaryAnswers = await inquirer.prompt<{
    name: string;
    role: string;
    gender: string;
    location: string;
  }>(
    [
      !opts.name && { type: 'input', name: 'name', message: 'Name (optional):' },
      !opts.role && { type: 'input', name: 'role', message: 'Role (optional):' },
      !opts.gender && { type: 'input', name: 'gender', message: 'Gender (optional):' },
      !opts.location && { type: 'input', name: 'location', message: 'Location (optional):' },
    ].filter(Boolean) as Parameters<typeof inquirer.prompt>[0],
  );

  const resolvedOpts: IAddLeadershipOptions = {
    ...opts,
    name: opts.name?.trim() || secondaryAnswers.name?.trim() || '',
    role: opts.role?.trim() || secondaryAnswers.role?.trim() || '',
    gender: opts.gender?.trim() || secondaryAnswers.gender?.trim() || '',
    location: opts.location?.trim() || secondaryAnswers.location?.trim() || '',
  };

  const result = await svc.addLeadership(email, resolvedOpts, ws);
  if (result.created) {
    process.stdout.write(`${chalk.green('✔')} Leadership "${email}" created\n`);

    // "Remember domain" offer — fires when the domain is external (not in org config)
    const domain = email.split('@')[1]?.toLowerCase() ?? '';
    if (domain) {
      let internalDomains: string[] = [];
      try {
        internalDomains = await memberService.getInternalDomains(ws);
      } catch {
        // org.yaml unreadable — skip
      }
      if (internalDomains.length > 0 && !internalDomains.includes(domain)) {
        const { remember } = await inquirer.prompt<{ remember: boolean }>([
          {
            type: 'confirm',
            name: 'remember',
            message: `Remember "${domain}" as an internal domain for future members?`,
            default: false,
          },
        ]);
        if (remember) {
          await memberService.appendInternalDomain(domain, ws);
          printInfo(`Domain "${domain}" added to config/organization.yaml`);
        }
      }
    }
  } else {
    process.stdout.write(`${chalk.dim('ℹ')} Leadership "${email}" already exists\n`);
  }
}

export async function runLeadership1on1(
  svc: LeadershipService,
  emailArg: string | undefined,
  opts: { date?: string; noEdit?: boolean },
): Promise<void> {
  const ws = svc.getWorkspaceRoot();
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

  email = await resolveEmailWithSimilarCheck(email, ws);

  let result;
  try {
    result = await svc.add1on1(email, opts, ws);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    printError(message, 'Check that the leadership contact exists: tmr leadership list');
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`${chalk.green('✔')} Created: ${result.filePath}\n`);
  process.stdout.write(`${chalk.dim('  Profile updated:')} ${result.profilePath}\n`);
  process.stdout.write(`${chalk.dim('  Wiki-link:')} ${result.wikiLink}\n`);
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

  const cmd = new Command('leadership').description('manage leadership profiles');

  cmd
    .command('add <type-or-email> [email]')
    .description(
      'add a leadership contact, or create a 1on1 note (tmr leadership add 1on1 <email>)',
    )
    .option('--date <date>', 'date for the file (YYYY-MM-DD, defaults to today)')
    .option('--name <name>', 'contact name')
    .option('--role <role>', 'contact role')
    .option('--gender <gender>', 'contact gender')
    .option('--location <location>', 'contact location')
    .option('--areas <areas>', 'areas of responsibility')
    .action(
      async (
        typeOrEmail: string,
        emailArg: string | undefined,
        opts: {
          date?: string;
          name?: string;
          role?: string;
          gender?: string;
          location?: string;
          areas?: string;
        },
      ) => {
        await runLeadershipAdd(svc, typeOrEmail, emailArg, {
          date: opts.date,
          name: opts.name,
          role: opts.role,
          gender: opts.gender,
          location: opts.location,
          areas_of_responsibility: opts.areas,
        });
      },
    );

  cmd
    .command('list')
    .description('list all leadership contacts sorted by most recent 1on1')
    .action(async () => {
      await runLeadershipList(svc);
    });

  return cmd;
}
