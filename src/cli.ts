import { Command, CommanderError } from 'commander';
import { createRequire } from 'module';
import { InitCommand } from './commands/init.command.js';
import { createConfigCommand } from './commands/config.command.js';
import { createTeamCommand, runShow } from './commands/team.command.js';
import { createMemberCommand } from './commands/member.command.js';
import { createRelationshipCommand } from './commands/relationship.command.js';
import { createLeadershipCommand } from './commands/leadership.command.js';
import { createProjectCommand } from './commands/project.command.js';
import { createTaskViewCommands } from './commands/task-view.command.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string; description: string };

export interface GlobalOptions {
  verbose?: boolean;
  plain?: boolean;
  json?: boolean;
}

export function createProgram(): Command {
  const p = new Command();

  p.name('tmr')
    .description(pkg.description)
    .version(pkg.version, '-v, --version', 'output the current version')
    .helpOption('-h, --help', 'display help for command')
    .addHelpCommand(false)
    .enablePositionalOptions()
    .option('--verbose', 'enable verbose output')
    .option('--plain', 'disable colors and formatting')
    .option('--json', 'output as machine-readable JSON');

  p.command('init')
    .description('interactive setup wizard — configure your workspace')
    .action(async () => {
      await new InitCommand(pkg.version).run();
    });

  p.addCommand(createConfigCommand());
  p.addCommand(createTeamCommand());
  p.addCommand(createMemberCommand());
  p.addCommand(createRelationshipCommand());
  p.addCommand(createLeadershipCommand());
  p.addCommand(createProjectCommand());

  for (const cmd of createTaskViewCommands()) {
    p.addCommand(cmd);
  }

  p.command('show <email>')
    .description('display profile for an email address (searches teams, leadership, relationships)')
    .action(async (email: string) => {
      await runShow(email);
    });

  p.command('process')
    .description('process inbox files and update context')
    .action(() => {
      process.stdout.write(
        "Command 'process' coming soon — run 'tmr --help' for available commands\n",
      );
    });

  p.command('watch')
    .description('watch inbox folder and auto-process new files')
    .action(() => {
      process.stdout.write(
        "Command 'watch' coming soon — run 'tmr --help' for available commands\n",
      );
    });

  p.on('command:*', (operands: string[]) => {
    process.stderr.write(
      `Unknown command: '${operands[0]}'. Run 'tmr --help' to see available commands.\n`,
    );
    process.exit(1);
  });

  return p;
}

export const program = createProgram();

export async function run(argv = process.argv): Promise<void> {
  if (argv.length <= 2) {
    program.outputHelp();
    return;
  }

  try {
    await program.parseAsync(argv);
  } catch (err) {
    if (err instanceof CommanderError) {
      throw err;
    }
    const opts = program.opts<GlobalOptions>();
    const msg = err instanceof Error ? err.message : String(err);
    if (opts.verbose && err instanceof Error) {
      process.stderr.write(`Error: ${msg}\n${err.stack ?? ''}\n`);
    } else {
      process.stderr.write(`Error: ${msg}\nRun 'tmr --help' for usage information.\n`);
    }
    process.exit(1);
  }
}

// Guard: skip module-level execution when imported by the test runner.
// Jest sets JEST_WORKER_ID; Vitest (architecture target) sets VITEST.
// When migrating to Vitest (architectural debt item), update this guard to check VITEST.
// Tracked in QA-1.2-04 / ARCH-DEBT-003.
if (!process.env.JEST_WORKER_ID) {
  await run();
}
