import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { teamService, TeamService } from '../services/team.service.js';
import type { ProfileLocation } from '../types/team.types.js';
import { memberService } from '../services/member.service.js';
import { printError, printSuccess, printInfo } from '../utils/display.js';
import { resolveEmailWithSimilarCheck } from '../utils/email-guard.js';
import { InvalidEmailError } from '../errors/tmr-error.js';

// ── Formatting helpers ────────────────────────────────────────────────────────

function padEnd(s: string, len: number): string {
  return s.length >= len ? s : s + ' '.repeat(len - s.length);
}

function printTeamsTable(rows: { teamName: string; memberCount: number }[]): void {
  if (rows.length === 0) {
    process.stdout.write('No teams found. Run `tmr team create <name>` to create one.\n');
    return;
  }
  const header = `${padEnd('Team', 20)}  ${padEnd('Members', 8)}`;
  const divider = '─'.repeat(header.length);
  process.stdout.write(`${chalk.bold(header)}\n${divider}\n`);
  for (const row of rows) {
    process.stdout.write(`${padEnd(row.teamName, 20)}  ${String(row.memberCount).padStart(8)}\n`);
  }
}

function printMembersTable(
  rows: { email: string; role: string; location: string; dateAdded: string }[],
): void {
  if (rows.length === 0) {
    process.stdout.write('No members found in this team.\n');
    return;
  }
  const header = `${padEnd('Email', 28)}  ${padEnd('Role', 22)}  ${padEnd('Location', 18)}  Added`;
  const divider = '─'.repeat(header.length);
  process.stdout.write(`${chalk.bold(header)}\n${divider}\n`);
  for (const row of rows) {
    process.stdout.write(
      `${padEnd(row.email, 28)}  ${padEnd(row.role, 22)}  ${padEnd(row.location, 18)}  ${row.dateAdded}\n`,
    );
  }
}

// ── Sub-command handlers ──────────────────────────────────────────────────────

async function runCreate(svc: TeamService, teamNameArg: string | undefined): Promise<void> {
  const ws = svc.getWorkspaceRoot();
  let teamName = teamNameArg?.trim() ?? '';
  if (!teamName) {
    const { name } = await inquirer.prompt<{ name: string }>([
      {
        type: 'input',
        name: 'name',
        message: 'Team name:',
        validate: (v: string): boolean | string => v.trim().length > 0 || 'Team name is required',
      },
    ]);
    teamName = name.trim();
  }
  try {
    await svc.createTeam(teamName, ws);
  } catch (err) {
    printError(
      `Failed to create team "${teamName}": ${err instanceof Error ? err.message : String(err)}`,
    );
    return;
  }
  printSuccess(`Team "${teamName}" created`);
}

async function runAdd(
  svc: TeamService,
  teamNameArg: string | undefined,
  emailArg: string | undefined,
  opts: { name?: string; role?: string; gender?: string; location?: string },
): Promise<void> {
  const ws = svc.getWorkspaceRoot();
  let teamName = teamNameArg?.trim() ?? '';
  let email = emailArg?.trim().toLowerCase() ?? '';

  if (!teamName || !email) {
    const answers = await inquirer.prompt<{ teamName: string; email: string }>(
      [
        !teamName && {
          type: 'input',
          name: 'teamName',
          message: 'Team name:',
          validate: (v: string): boolean | string => v.trim().length > 0 || 'Required',
        },
        !email && {
          type: 'input',
          name: 'email',
          message: 'Member email:',
          validate: (v: string): boolean | string => v.trim().length > 0 || 'Required',
        },
      ].filter(Boolean) as Parameters<typeof inquirer.prompt>[0],
    );
    teamName = teamName || answers.teamName;
    email = email || answers.email.trim().toLowerCase();
  }

  email = await resolveEmailWithSimilarCheck(email, ws);

  // Secondary prompts for optional fields — always run, skip if pre-filled via flags
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

  const name = opts.name?.trim() ?? secondaryAnswers.name?.trim() ?? '';
  const role = opts.role?.trim() ?? secondaryAnswers.role?.trim() ?? '';
  const gender = opts.gender?.trim() ?? secondaryAnswers.gender?.trim() ?? '';
  const location = opts.location?.trim() ?? secondaryAnswers.location?.trim() ?? '';

  try {
    await svc.addMember(teamName, email, { name, role, gender, location }, ws);
  } catch (err) {
    if (err instanceof InvalidEmailError) {
      printError(`Invalid email address: ${email}`);
      return;
    }
    throw err;
  }
  printSuccess(`Member "${email}" added to team "${teamName}"`);

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
}

async function runList(svc: TeamService, teamNameArg: string | undefined): Promise<void> {
  const ws = svc.getWorkspaceRoot();
  if (teamNameArg) {
    const members = await svc.listTeamMembers(teamNameArg, ws);
    printMembersTable(members);
  } else {
    const teams = await svc.listTeams(ws);
    printTeamsTable(teams);
  }
}

async function runArchive(
  svc: TeamService,
  teamNameArg: string | undefined,
  emailArg: string | undefined,
  opts: { from?: string; to?: string },
): Promise<void> {
  const ws = svc.getWorkspaceRoot();
  let teamName = teamNameArg?.trim() ?? '';
  let email = emailArg?.trim() ?? '';

  if (!teamName || !email) {
    const answers = await inquirer.prompt<{ teamName: string; email: string }>(
      [
        !teamName && {
          type: 'input',
          name: 'teamName',
          message: 'Team name:',
          validate: (v: string): boolean | string => v.trim().length > 0 || 'Required',
        },
        !email && {
          type: 'input',
          name: 'email',
          message: 'Member email to archive:',
          validate: (v: string): boolean | string => v.trim().length > 0 || 'Required',
        },
      ].filter(Boolean) as Parameters<typeof inquirer.prompt>[0],
    );
    teamName = teamName || answers.teamName;
    email = email || answers.email;
  }
  await svc.archiveMember(teamName, email, { from: opts.from, to: opts.to }, ws);
  process.stdout.write(`${chalk.green('✔')} Member "${email}" archived from team "${teamName}"\n`);
}

async function runFire(
  svc: TeamService,
  teamNameArg: string | undefined,
  emailArg: string | undefined,
): Promise<void> {
  const ws = svc.getWorkspaceRoot();
  let teamName = teamNameArg?.trim() ?? '';
  let email = emailArg?.trim() ?? '';

  if (!teamName || !email) {
    const answers = await inquirer.prompt<{ teamName: string; email: string }>(
      [
        !teamName && {
          type: 'input',
          name: 'teamName',
          message: 'Team name:',
          validate: (v: string): boolean | string => v.trim().length > 0 || 'Required',
        },
        !email && {
          type: 'input',
          name: 'email',
          message: 'Member email to terminate:',
          validate: (v: string): boolean | string => v.trim().length > 0 || 'Required',
        },
      ].filter(Boolean) as Parameters<typeof inquirer.prompt>[0],
    );
    teamName = teamName || answers.teamName;
    email = email || answers.email;
  }

  const { terminationNote } = await inquirer.prompt<{ terminationNote: string }>([
    {
      type: 'input',
      name: 'terminationNote',
      message: 'Termination note (optional, press Enter to skip):',
    },
  ]);
  const note = terminationNote.trim() || undefined;
  await svc.fireMember(teamName, email, ws, note);
  process.stdout.write(
    `${chalk.green('✔')} Member "${email}" terminated and archived from team "${teamName}"\n`,
  );
}

// ── show command (root-level) ─────────────────────────────────────────────────

export async function runShow(email: string): Promise<void> {
  const svc = teamService;
  const ws = svc.getWorkspaceRoot();
  const result = await svc.showProfile(email, ws);
  if (!result) {
    process.stdout.write(
      `Profile not found for ${email}. Use 'tmr team add' to create a profile.\n`,
    );
    return;
  }
  const locationLabel: Record<ProfileLocation, string> = {
    member: 'Active team member',
    archived: 'Archived member',
    leadership: 'Leadership',
    relationship: 'Company member',
    self: 'Self',
    contractor: 'Contractor',
  };
  process.stdout.write(`${chalk.dim(`[${locationLabel[result.location]}]`)}\n`);
  process.stdout.write(`${result.content}\n`);
}

// ── Command factory ───────────────────────────────────────────────────────────

export function createTeamCommand(): Command {
  const svc = teamService;

  const cmd = new Command('team').description('manage teams and team members');

  cmd
    .command('create [team-name]')
    .description('create a new team')
    .action(async (teamName: string | undefined) => {
      await runCreate(svc, teamName);
    });

  cmd
    .command('add [team-name] [email]')
    .description('add a member to a team')
    .option('--name <name>', 'member name')
    .option('--role <role>', 'member role / job title')
    .option('--gender <gender>', 'member gender')
    .option('--location <location>', 'member location')
    .action(
      async (
        teamName: string | undefined,
        email: string | undefined,
        opts: { name?: string; role?: string; gender?: string; location?: string },
      ) => {
        await runAdd(svc, teamName, email, opts);
      },
    );

  cmd
    .command('list [team-name]')
    .description('list all teams, or members of a specific team')
    .action(async (teamName: string | undefined) => {
      await runList(svc, teamName);
    });

  cmd
    .command('archive [team-name] [email]')
    .description('archive a team member')
    .option('--from <date>', 'archive only files from this date (YYYY-MM-DD)')
    .option('--to <date>', 'archive only files up to this date (YYYY-MM-DD)')
    .action(
      async (
        teamName: string | undefined,
        email: string | undefined,
        opts: { from?: string; to?: string },
      ) => {
        await runArchive(svc, teamName, email, opts);
      },
    );

  cmd
    .command('fire [team-name] [email]')
    .description('terminate and archive a team member')
    .action(async (teamName: string | undefined, email: string | undefined) => {
      await runFire(svc, teamName, email);
    });

  return cmd;
}
