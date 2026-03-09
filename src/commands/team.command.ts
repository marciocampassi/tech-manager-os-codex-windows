import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { teamService, TeamService } from '../services/team.service.js';

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
  let teamName = teamNameArg?.trim() ?? '';
  if (!teamName) {
    const { name } = await inquirer.prompt<{ name: string }>([
      {
        type: 'input',
        name: 'name',
        message: 'Team name:',
        validate: (v: string) => v.trim().length > 0 || 'Team name is required',
      },
    ]);
    teamName = name.trim();
  }

  const ws = svc.getWorkspaceRoot();
  await svc.createTeam(teamName, ws);
  process.stdout.write(
    `${chalk.green('✔')} Team "${teamName}" created at my-teams/_teams/${teamName}/\n`,
  );
}

async function runAdd(
  svc: TeamService,
  teamNameArg: string | undefined,
  emailArg: string | undefined,
  opts: { role?: string; location?: string },
): Promise<void> {
  let teamName = teamNameArg?.trim() ?? '';
  let email = emailArg?.trim() ?? '';
  let role = opts.role?.trim() ?? '';
  let location = opts.location?.trim() ?? '';

  if (!teamName || !email) {
    const answers = await inquirer.prompt<{
      teamName: string;
      email: string;
      role: string;
      location: string;
    }>(
      [
        !teamName && {
          type: 'input',
          name: 'teamName',
          message: 'Team name:',
          validate: (v: string) => v.trim().length > 0 || 'Required',
        },
        !email && {
          type: 'input',
          name: 'email',
          message: 'Member email:',
          validate: (v: string) =>
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) || 'Valid email required',
        },
        !role && {
          type: 'input',
          name: 'role',
          message: 'Role (optional):',
        },
        !location && {
          type: 'input',
          name: 'location',
          message: 'Location (optional):',
        },
      ].filter(Boolean) as Parameters<typeof inquirer.prompt>[0],
    );
    teamName = teamName || answers.teamName;
    email = email || answers.email;
    role = role || answers.role || '';
    location = location || answers.location || '';
  }

  const ws = svc.getWorkspaceRoot();
  await svc.addMember(teamName, email, { role, location }, ws);
  process.stdout.write(`${chalk.green('✔')} Member "${email}" added to team "${teamName}"\n`);
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
  let teamName = teamNameArg?.trim() ?? '';
  let email = emailArg?.trim() ?? '';

  if (!teamName || !email) {
    const answers = await inquirer.prompt<{ teamName: string; email: string }>(
      [
        !teamName && {
          type: 'input',
          name: 'teamName',
          message: 'Team name:',
          validate: (v: string) => v.trim().length > 0 || 'Required',
        },
        !email && {
          type: 'input',
          name: 'email',
          message: 'Member email to archive:',
          validate: (v: string) => v.trim().length > 0 || 'Required',
        },
      ].filter(Boolean) as Parameters<typeof inquirer.prompt>[0],
    );
    teamName = teamName || answers.teamName;
    email = email || answers.email;
  }

  const ws = svc.getWorkspaceRoot();
  await svc.archiveMember(teamName, email, { from: opts.from, to: opts.to }, ws);
  process.stdout.write(`${chalk.green('✔')} Member "${email}" archived from team "${teamName}"\n`);
}

async function runFire(
  svc: TeamService,
  teamNameArg: string | undefined,
  emailArg: string | undefined,
): Promise<void> {
  let teamName = teamNameArg?.trim() ?? '';
  let email = emailArg?.trim() ?? '';

  if (!teamName || !email) {
    const answers = await inquirer.prompt<{ teamName: string; email: string }>(
      [
        !teamName && {
          type: 'input',
          name: 'teamName',
          message: 'Team name:',
          validate: (v: string) => v.trim().length > 0 || 'Required',
        },
        !email && {
          type: 'input',
          name: 'email',
          message: 'Member email to terminate:',
          validate: (v: string) => v.trim().length > 0 || 'Required',
        },
      ].filter(Boolean) as Parameters<typeof inquirer.prompt>[0],
    );
    teamName = teamName || answers.teamName;
    email = email || answers.email;
  }

  const ws = svc.getWorkspaceRoot();
  await svc.fireMember(teamName, email, ws);
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
      `Profile not found for ${email}. Use 'tmr team add' or 'tmr relationship add' to create one.\n`,
    );
    return;
  }
  const locationLabel: Record<string, string> = {
    member: 'Active team member',
    archived: 'Archived member',
    leadership: 'Leadership',
    relationship: 'Relationship',
  };
  process.stdout.write(`${chalk.dim(`[${locationLabel[result.location] ?? result.location}]`)}\n`);
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
    .option('--role <role>', 'member role / job title')
    .option('--location <location>', 'member location')
    .action(
      async (
        teamName: string | undefined,
        email: string | undefined,
        opts: { role?: string; location?: string },
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
