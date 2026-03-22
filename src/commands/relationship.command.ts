import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { relationshipService, RelationshipService } from '../services/relationship.service.js';
import { projectService } from '../services/project.service.js';
import type { IAddRelationshipOptions } from '../types/relationship.types.js';

// ── Formatting helpers ────────────────────────────────────────────────────────

function padEnd(s: string, len: number): string {
  return s.length >= len ? s : s + ' '.repeat(len - s.length);
}

// ── Sub-command handlers ──────────────────────────────────────────────────────

export async function runRelationshipAdd(
  svc: RelationshipService,
  emailOrListArg: string | undefined,
  opts: IAddRelationshipOptions,
): Promise<void> {
  const ws = svc.getWorkspaceRoot();

  // Parse email(s)
  let emails: string[] = [];
  if (emailOrListArg) {
    emails = emailOrListArg
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }

  // Interactive mode — single email with prompts
  if (emails.length === 0) {
    const answers = await inquirer.prompt<{
      email: string;
      name: string;
      role: string;
      department: string;
      relationship_type: string;
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
      { type: 'input', name: 'department', message: 'Department (optional):' },
      { type: 'input', name: 'relationship_type', message: 'Relationship type (optional):' },
    ]);
    emails = [answers.email.trim().toLowerCase()];
    opts = {
      ...opts,
      name: answers.name || opts.name,
      role: answers.role || opts.role,
      department: answers.department || opts.department,
      relationship_type: answers.relationship_type || opts.relationship_type,
    };
  }

  // Batch mode
  if (emails.length > 1) {
    process.stdout.write(`Processing ${emails.length} relationships…\n`);
    const result = await svc.addBatch(emails, opts, ws);
    process.stdout.write(
      `${chalk.green('✔')} Done — ${result.created} created, ${result.existed} already existed\n`,
    );
    return;
  }

  // Single mode
  const email = emails[0] as string;
  const result = await svc.addRelationship(email, opts, ws);
  if (result.created) {
    process.stdout.write(`${chalk.green('✔')} Relationship "${email}" created\n`);
  } else {
    process.stdout.write(`${chalk.dim('ℹ')} Relationship "${email}" already exists\n`);
  }

  // Optional project linking
  const { projectName } = await inquirer.prompt<{ projectName: string }>([
    {
      type: 'input',
      name: 'projectName',
      message: 'Link to project? (optional, press Enter to skip):',
    },
  ]);

  if (projectName.trim()) {
    try {
      await projectService.addProject(projectName.trim(), ws);
      await projectService.linkMember(projectName.trim(), email, ws);
      process.stdout.write(`${chalk.green('✔')} Linked to project "${projectName.trim()}"\n`);
    } catch (err) {
      process.stdout.write(
        `${chalk.yellow('⚠')} Could not link to project: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
  }
}

export async function runRelationship1on1(
  svc: RelationshipService,
  emailArg: string | undefined,
  opts: { date?: string; noEdit?: boolean },
): Promise<void> {
  let email = emailArg?.trim().toLowerCase() ?? '';
  if (!email) {
    const { resolvedEmail } = await inquirer.prompt<{ resolvedEmail: string }>([
      {
        type: 'input',
        name: 'resolvedEmail',
        message: 'Relationship email:',
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
}

export async function runRelationshipList(svc: RelationshipService): Promise<void> {
  const ws = svc.getWorkspaceRoot();
  const rows = await svc.listRelationships(ws);

  if (rows.length === 0) {
    process.stdout.write(
      'No relationships found. Run `tmr relationship add <email>` to create one.\n',
    );
    return;
  }

  const header = `${padEnd('Email', 30)}  ${padEnd('Name', 20)}  ${padEnd('Department', 18)}  ${padEnd('Type', 16)}  Last 1on1`;
  const divider = '─'.repeat(header.length);
  process.stdout.write(`${chalk.bold(header)}\n${divider}\n`);

  for (const row of rows) {
    process.stdout.write(
      `${padEnd(row.email, 30)}  ${padEnd(row.name, 20)}  ${padEnd(row.department, 18)}  ${padEnd(row.relationship_type, 16)}  ${row.lastInteraction}\n`,
    );
  }
}

// ── Command factory ───────────────────────────────────────────────────────────

export function createRelationshipCommand(): Command {
  const svc = relationshipService;

  const cmd = new Command('relationship').description('manage company relationships');

  cmd
    .command('add [email-or-list]')
    .description('add one or more relationships (comma-separated for batch)')
    .option('--name <name>', 'contact name')
    .option('--role <role>', 'contact role')
    .option('--department <department>', 'contact department')
    .option('--type <type>', 'relationship type (e.g. collaborator, stakeholder)')
    .action(
      async (
        emailOrList: string | undefined,
        opts: { name?: string; role?: string; department?: string; type?: string },
      ) => {
        await runRelationshipAdd(svc, emailOrList, {
          name: opts.name,
          role: opts.role,
          department: opts.department,
          relationship_type: opts.type,
        });
      },
    );

  cmd
    .command('1on1 [email]')
    .description('create a 1on1 note for a relationship')
    .option('--date <date>', 'date for the file (YYYY-MM-DD), defaults to today')
    .action(async (email: string | undefined, opts: { date?: string }) => {
      await runRelationship1on1(svc, email, opts);
    });

  cmd
    .command('list')
    .description('list all relationships sorted by most recent 1on1')
    .action(async () => {
      await runRelationshipList(svc);
    });

  return cmd;
}
