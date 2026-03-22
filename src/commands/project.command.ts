import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { projectService, ProjectService } from '../services/project.service.js';
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

  const ws = svc.getWorkspaceRoot();
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
    process.stdout.write(`${chalk.red('✖')} Project name is required\n`);
    process.exitCode = 1;
    return;
  }

  const ws = svc.getWorkspaceRoot();
  let result;
  try {
    result = await svc.addStandup(name, opts, ws);
  } catch (err) {
    process.stdout.write(`${chalk.red('✖')} ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`${chalk.green('✔')} Created: ${result.filePath}\n`);
}

export async function runProjectDiscussion(
  svc: ProjectService,
  nameArg: string | undefined,
  opts: IProjectFileOptions,
): Promise<void> {
  const name = nameArg?.trim() ?? '';
  if (!name) {
    process.stdout.write(`${chalk.red('✖')} Project name is required\n`);
    process.exitCode = 1;
    return;
  }

  const ws = svc.getWorkspaceRoot();
  let result;
  try {
    result = await svc.addDiscussion(name, opts, ws);
  } catch (err) {
    process.stdout.write(`${chalk.red('✖')} ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`${chalk.green('✔')} Created: ${result.filePath}\n`);
}

export async function runProjectPresentation(
  svc: ProjectService,
  nameArg: string | undefined,
  opts: IProjectFileOptions,
): Promise<void> {
  const name = nameArg?.trim() ?? '';
  if (!name) {
    process.stdout.write(`${chalk.red('✖')} Project name is required\n`);
    process.exitCode = 1;
    return;
  }

  let topic = opts.topic?.trim() ?? '';
  if (!topic) {
    const { resolvedTopic } = await inquirer.prompt<{ resolvedTopic: string }>([
      {
        type: 'input',
        name: 'resolvedTopic',
        message: 'Presentation topic:',
        validate: (v: string): boolean | string => v.trim().length > 0 || 'Topic is required',
      },
    ]);
    topic = resolvedTopic.trim();
  }

  const ws = svc.getWorkspaceRoot();
  let result;
  try {
    result = await svc.addPresentation(name, topic, opts, ws);
  } catch (err) {
    process.stdout.write(`${chalk.red('✖')} ${err instanceof Error ? err.message : String(err)}\n`);
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
  const email = emailArg?.trim().toLowerCase() ?? '';

  if (!name || !email) {
    process.stdout.write(`${chalk.red('✖')} Project name and email are required\n`);
    process.exitCode = 1;
    return;
  }

  const ws = svc.getWorkspaceRoot();
  let result;
  try {
    result = await svc.linkMember(name, email, ws);
  } catch (err) {
    process.stdout.write(`${chalk.red('✖')} ${err instanceof Error ? err.message : String(err)}\n`);
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
    process.stdout.write(`${chalk.red('✖')} Project name and at least one email are required\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`Linking ${emails.length} member(s) to "${name}"…\n`);
  const ws = svc.getWorkspaceRoot();

  let result;
  try {
    result = await svc.linkMembers(name, emails, ws);
  } catch (err) {
    process.stdout.write(`${chalk.red('✖')} ${err instanceof Error ? err.message : String(err)}\n`);
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
  const email = emailArg?.trim().toLowerCase() ?? '';

  if (!name || !email) {
    process.stdout.write(`${chalk.red('✖')} Project name and email are required\n`);
    process.exitCode = 1;
    return;
  }

  const ws = svc.getWorkspaceRoot();
  let result;
  try {
    result = await svc.linkStakeholder(name, email, ws);
  } catch (err) {
    process.stdout.write(`${chalk.red('✖')} ${err instanceof Error ? err.message : String(err)}\n`);
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
    process.stdout.write(`${chalk.red('✖')} Project name and at least one email are required\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`Linking ${emails.length} stakeholder(s) to "${name}"…\n`);
  const ws = svc.getWorkspaceRoot();

  let result;
  try {
    result = await svc.linkStakeholders(name, emails, ws);
  } catch (err) {
    process.stdout.write(`${chalk.red('✖')} ${err instanceof Error ? err.message : String(err)}\n`);
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

  const cmd = new Command('project')
    .description('manage projects and team composition')
    .passThroughOptions()
    .allowUnknownOption()
    .action(async () => {
      // Raw argv routing for: tmr project <name> <link-action> [args]
      // process.argv = ['node', 'tmr', 'project', nameOrAction, actionOrArg?, ...]
      const args = process.argv.slice(3);
      const [first, second, third] = args;

      if (!first || first === 'list') {
        await runProjectList(svc);
        return;
      }

      if (first === 'add') {
        await runProjectAdd(svc, second, {});
        return;
      }

      if (first === 'standup') {
        await runProjectStandup(svc, second, {});
        return;
      }

      if (first === 'discussion') {
        await runProjectDiscussion(svc, second, {});
        return;
      }

      if (first === 'presentation') {
        await runProjectPresentation(svc, second, {});
        return;
      }

      // tmr project <name> <link-action> [arg]
      const name = first;
      const action = second;
      const arg = third;

      if (action === 'link-member') {
        await runProjectLinkMember(svc, name, arg);
      } else if (action === 'link-members') {
        await runProjectLinkMembers(svc, name, arg);
      } else if (action === 'link-stakeholder') {
        await runProjectLinkStakeholder(svc, name, arg);
      } else if (action === 'link-stakeholders') {
        await runProjectLinkStakeholders(svc, name, arg);
      } else if (action === 'standup') {
        await runProjectStandup(svc, name, {});
      } else if (action === 'discussion') {
        await runProjectDiscussion(svc, name, {});
      } else if (action === 'presentation') {
        await runProjectPresentation(svc, name, {});
      } else {
        process.stdout.write(
          `${chalk.red('✖')} Unknown project action "${action ?? first}". ` +
            `Valid: add, list, standup, discussion, presentation, link-member, link-members, link-stakeholder, link-stakeholders\n`,
        );
        process.exitCode = 1;
      }
    });

  return cmd;
}
