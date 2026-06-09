import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { projectService, ProjectService } from '../services/project.service.js';
import { printError } from '../utils/display.js';
import { resolveEmailWithSimilarCheck } from '../utils/email-guard.js';
import type { IProjectFileOptions } from '../types/project.types.js';

// ── Formatting helpers ────────────────────────────────────────────────────────

function padEnd(s: string, len: number): string {
  return s.length >= len ? s : s + ' '.repeat(len - s.length);
}

// ── Sub-command handlers ──────────────────────────────────────────────────────

export async function runProjectAdd(
  svc: ProjectService,
  nameArg: string | undefined,
  _opts: IProjectFileOptions,
): Promise<void> {
  const ws = svc.getWorkspaceRoot();
  let name = nameArg?.trim() ?? '';

  if (!name) {
    const { resolvedName } = await inquirer.prompt<{ resolvedName: string }>([
      {
        type: 'input',
        name: 'resolvedName',
        message: 'Project name:',
        validate: (v: string): boolean | string =>
          v.trim().length > 0 || 'Project name is required',
      },
    ]);
    name = resolvedName.trim();
  }
  const result = await svc.addProject(name, ws);

  if (result.created) {
    process.stdout.write(`${chalk.green('✔')} Project "${name}" created\n`);
  } else {
    process.stdout.write(`${chalk.dim('ℹ')} Project "${name}" already exists\n`);
  }
}

export async function runProjectStandup(
  svc: ProjectService,
  nameArg: string | undefined,
  opts: IProjectFileOptions,
): Promise<void> {
  const name = nameArg?.trim() ?? '';
  if (!name) {
    printError('Project name is required', 'Usage: tmr project standup <name>');
    process.exitCode = 1;
    return;
  }

  const ws = svc.getWorkspaceRoot();
  let result;
  try {
    result = await svc.addStandup(name, opts, ws);
  } catch (err) {
    printError(
      err instanceof Error ? err.message : String(err),
      'Check that the project exists: tmr project list',
    );
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`${chalk.green('✔')} Created: ${result.filePath}\n`);
}

export async function runProjectLinkMember(
  svc: ProjectService,
  nameArg: string | undefined,
  emailArg: string | undefined,
): Promise<void> {
  const name = nameArg?.trim() ?? '';
  let email = emailArg?.trim().toLowerCase() ?? '';

  if (!name || !email) {
    printError(
      'Project name and email are required',
      'Usage: tmr project <name> link-member <email>',
    );
    process.exitCode = 1;
    return;
  }

  const ws = svc.getWorkspaceRoot();

  email = await resolveEmailWithSimilarCheck(email, ws);

  let result;
  try {
    result = await svc.linkMember(name, email, ws);
  } catch (err) {
    printError(
      err instanceof Error ? err.message : String(err),
      'Check that the project exists: tmr project list',
    );
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`${chalk.green('✔')} Linked: ${result.wikiLink}\n`);
  if (result.created) {
    process.stdout.write(`${chalk.dim('  ℹ Auto-created relationship profile for')} ${email}\n`);
  }
}

export async function runProjectLinkMembers(
  svc: ProjectService,
  nameArg: string | undefined,
  emailListArg: string | undefined,
): Promise<void> {
  const name = nameArg?.trim() ?? '';
  const emails = (emailListArg ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!name || emails.length === 0) {
    printError(
      'Project name and at least one email are required',
      'Usage: tmr project <name> link-members <email1,email2>',
    );
    process.exitCode = 1;
    return;
  }

  const ws = svc.getWorkspaceRoot();

  const filteredEmails: string[] = [];
  for (const rawEmail of emails) {
    filteredEmails.push(await resolveEmailWithSimilarCheck(rawEmail, ws));
  }

  if (filteredEmails.length === 0) {
    process.stdout.write(`${chalk.dim('ℹ')} All emails were skipped.\n`);
    return;
  }

  process.stdout.write(`Linking ${filteredEmails.length} member(s) to "${name}"…\n`);

  let result;
  try {
    result = await svc.linkMembers(name, filteredEmails, ws);
  } catch (err) {
    printError(
      err instanceof Error ? err.message : String(err),
      'Check that the project exists: tmr project list',
    );
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `${chalk.green('✔')} Done — ${result.linked} linked, ${result.created} relationship(s) auto-created\n`,
  );
}

export async function runProjectLinkStakeholder(
  svc: ProjectService,
  nameArg: string | undefined,
  emailArg: string | undefined,
): Promise<void> {
  const name = nameArg?.trim() ?? '';
  let email = emailArg?.trim().toLowerCase() ?? '';

  if (!name || !email) {
    printError(
      'Project name and email are required',
      'Usage: tmr project <name> link-stakeholder <email>',
    );
    process.exitCode = 1;
    return;
  }

  const ws = svc.getWorkspaceRoot();

  email = await resolveEmailWithSimilarCheck(email, ws);

  let result;
  try {
    result = await svc.linkStakeholder(name, email, ws);
  } catch (err) {
    printError(
      err instanceof Error ? err.message : String(err),
      'Check that the project exists: tmr project list',
    );
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`${chalk.green('✔')} Linked stakeholder: ${result.wikiLink}\n`);
  if (result.created) {
    process.stdout.write(`${chalk.dim('  ℹ Auto-created relationship profile for')} ${email}\n`);
  }
}

export async function runProjectLinkStakeholders(
  svc: ProjectService,
  nameArg: string | undefined,
  emailListArg: string | undefined,
): Promise<void> {
  const name = nameArg?.trim() ?? '';
  const emails = (emailListArg ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!name || emails.length === 0) {
    printError(
      'Project name and at least one email are required',
      'Usage: tmr project <name> link-stakeholders <email1,email2>',
    );
    process.exitCode = 1;
    return;
  }

  const ws = svc.getWorkspaceRoot();

  const filteredEmails: string[] = [];
  for (const rawEmail of emails) {
    filteredEmails.push(await resolveEmailWithSimilarCheck(rawEmail, ws));
  }

  if (filteredEmails.length === 0) {
    process.stdout.write(`${chalk.dim('ℹ')} All emails were skipped.\n`);
    return;
  }

  process.stdout.write(`Linking ${filteredEmails.length} stakeholder(s) to "${name}"…\n`);

  let result;
  try {
    result = await svc.linkStakeholders(name, filteredEmails, ws);
  } catch (err) {
    printError(
      err instanceof Error ? err.message : String(err),
      'Check that the project exists: tmr project list',
    );
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `${chalk.green('✔')} Done — ${result.linked} linked, ${result.created} relationship(s) auto-created\n`,
  );
}

export async function runProjectList(svc: ProjectService): Promise<void> {
  const ws = svc.getWorkspaceRoot();
  const rows = await svc.listProjects(ws);

  if (rows.length === 0) {
    process.stdout.write('No projects found. Run `tmr project add <name>` to create one.\n');
    return;
  }

  const header = `${padEnd('Project', 30)}  ${padEnd('Members', 10)}  Stakeholders`;
  const divider = '─'.repeat(header.length);
  process.stdout.write(`${chalk.bold(header)}\n${divider}\n`);

  for (const row of rows) {
    process.stdout.write(
      `${padEnd(row.name, 30)}  ${padEnd(String(row.memberCount), 10)}  ${row.stakeholderCount}\n`,
    );
  }
}

// ── Command factory ───────────────────────────────────────────────────────────

export function createProjectCommand(): Command {
  const svc = projectService;

  const cmd = new Command('project').description('manage projects and team composition');

  cmd
    .command('list')
    .description('list all projects')
    .action(async () => {
      await runProjectList(svc);
    });

  cmd
    .command('add [name]')
    .description('create a new project')
    .action(async (name: string | undefined) => {
      await runProjectAdd(svc, name, {});
    });

  cmd
    .command('standup <name>')
    .description('create a standup note for a project')
    .option('--date <date>', 'date for the standup file (YYYY-MM-DD), defaults to today')
    .action(async (name: string, opts: { date?: string }) => {
      await runProjectStandup(svc, name, opts);
    });

  cmd
    .command('link-member <name> <email>')
    .description('link a team member to a project')
    .action(async (name: string, email: string) => {
      await runProjectLinkMember(svc, name, email);
    });

  cmd
    .command('link-members <name> <emails>')
    .description('link multiple team members (comma-separated emails)')
    .action(async (name: string, emails: string) => {
      await runProjectLinkMembers(svc, name, emails);
    });

  cmd
    .command('link-stakeholder <name> <email>')
    .description('link a stakeholder to a project')
    .action(async (name: string, email: string) => {
      await runProjectLinkStakeholder(svc, name, email);
    });

  cmd
    .command('link-stakeholders <name> <emails>')
    .description('link multiple stakeholders (comma-separated emails)')
    .action(async (name: string, emails: string) => {
      await runProjectLinkStakeholders(svc, name, emails);
    });

  return cmd;
}
