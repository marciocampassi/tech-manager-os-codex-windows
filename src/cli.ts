import { Command, CommanderError } from 'commander';
import { createRequire } from 'module';
import { printError } from './utils/display.js';
// Lightweight commands — imported statically (file-I/O only, no AI SDKs or heavy deps)
import { createConfigCommand } from './commands/config.command.js';
import { createDoctorCommand } from './commands/doctor.command.js';
import { createTeamCommand, runShow } from './commands/team.command.js';
import { createMemberCommand } from './commands/member.command.js';
import { createLeadershipCommand } from './commands/leadership.command.js';
import { createProjectCommand } from './commands/project.command.js';
import { createTaskViewCommands } from './commands/task-view.command.js';
// Heavy commands (AI SDKs, inquirer, googleapis, chokidar) are lazy-loaded via dynamic
// import() so that `tmr --version`, `tmr --help`, and lightweight commands don't pay
// their startup cost. tsup splitting is enabled to create separate chunks for each.

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

  // Lazy: init loads inquirer, boxen, googleapis chain — only needed when actually running init
  p.command('init')
    .description('interactive setup wizard — configure your workspace')
    .action(async (_opts: unknown, command: Command) => {
      const globals = command.parent?.opts() as { plain?: boolean } | undefined;
      const plain = globals?.plain ?? false;
      const { InitCommand } = await import('./commands/init.command.js');
      await new InitCommand(pkg.version, plain).run();
    });

  p.addCommand(createConfigCommand());
  p.addCommand(createDoctorCommand(pkg.version));
  p.addCommand(createTeamCommand());
  p.addCommand(createMemberCommand());
  p.addCommand(createLeadershipCommand());
  p.addCommand(createProjectCommand());

  for (const cmd of createTaskViewCommands()) {
    p.addCommand(cmd);
  }

  p.command('show <email>')
    .description('display profile for an email address (searches teams, leadership)')
    .action(async (email: string) => {
      await runShow(email);
    });

  // Lazy: process loads all AI providers + inbox/categorization services
  p.addCommand(
    new Command('process')
      .description(
        'process inbox files: scan, categorize, update contexts, extract tasks, organize',
      )
      .option('--dry-run', 'preview without writing files or updating tasks', false)
      .action(async (opts: { dryRun?: boolean }, command: Command): Promise<void> => {
        const globals = command.parent?.opts() as
          | { verbose?: boolean; plain?: boolean }
          | undefined;
        const plain = globals?.plain ?? false;
        const verbose = globals?.verbose ?? false;
        const dryRun = opts.dryRun === true;
        const { runProcess } = await import('./commands/process.command.js');
        await runProcess({ dryRun, verbose, plain });
      }),
  );

  // Lazy: watch loads chokidar + all process command deps
  p.addCommand(
    new Command('watch')
      .description('watch inbox folder and auto-process new files when added')
      .action(async (_opts: Record<string, unknown>, command: Command): Promise<void> => {
        const globals = command.parent?.opts() as
          | { verbose?: boolean; plain?: boolean }
          | undefined;
        const plain = globals?.plain ?? false;
        const verbose = globals?.verbose ?? false;
        const { runWatch } = await import('./commands/watch.command.js');
        await runWatch({ verbose, plain });
      }),
  );

  // Lazy: install loads SkillRegistryService + node:https
  p.addCommand(
    new Command('install')
      .description('install a skill into your vault from the official registry')
      .argument(
        '[skill-name]',
        'name of the skill to install (e.g. tmr-inbox); omit to install all available skills',
      )
      .option('-f, --force', 'reinstall even if already installed', false)
      .addHelpText(
        'after',
        '\nExamples:\n  tmr install\n  tmr install tmr-inbox\n  tmr install tmr-inbox --force\n',
      )
      .action(
        async (
          skillName: string | undefined,
          opts: { force?: boolean },
          command: Command,
        ): Promise<void> => {
          const globals = command.parent?.opts() as { plain?: boolean; json?: boolean } | undefined;
          const plain = globals?.plain ?? false;
          const json = globals?.json ?? false;
          const force = opts.force ?? false;
          const { runInstall } = await import('./commands/install.command.js');
          await runInstall(skillName, { plain, force, json });
        },
      ),
  );

  // Lazy: update shares deps with install
  p.addCommand(
    new Command('update')
      .description('update all installed skills to their latest versions from the registry')
      .action(async (_opts: unknown, command: Command): Promise<void> => {
        const globals = command.parent?.opts() as { plain?: boolean } | undefined;
        const plain = globals?.plain ?? false;
        const { runUpdate } = await import('./commands/update.command.js');
        await runUpdate({ plain });
      }),
  );

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
    const plain = opts.plain ?? false;
    const msg = err instanceof Error ? err.message : String(err);
    if (opts.verbose && err instanceof Error) {
      printError(`${msg}\n${err.stack ?? ''}`, undefined, plain);
    } else {
      printError(msg, "Run 'tmr --help' for usage information.", plain);
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
