import { Command, CommanderError } from 'commander';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string; description: string };

export interface GlobalOptions {
  verbose?: boolean;
  plain?: boolean;
  json?: boolean;
}

export function createProgram(): Command {
  const p = new Command();

  p.name('tm')
    .description(pkg.description)
    .version(pkg.version, '-v, --version', 'output the current version')
    .helpOption('-h, --help', 'display help for command')
    .addHelpCommand(false)
    .option('--verbose', 'enable verbose output')
    .option('--plain', 'disable colors and formatting')
    .option('--json', 'output as machine-readable JSON');

  p.command('init')
    .description('interactive setup wizard — configure your workspace')
    .action(() => {
      process.stdout.write("Command 'init' coming soon — run 'tm --help' for available commands\n");
    });

  p.command('process')
    .description('process inbox files and update context')
    .action(() => {
      process.stdout.write(
        "Command 'process' coming soon — run 'tm --help' for available commands\n",
      );
    });

  p.command('watch')
    .description('watch inbox folder and auto-process new files')
    .action(() => {
      process.stdout.write(
        "Command 'watch' coming soon — run 'tm --help' for available commands\n",
      );
    });

  p.on('command:*', (operands: string[]) => {
    process.stderr.write(
      `Unknown command: '${operands[0]}'. Run 'tm --help' to see available commands.\n`,
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
      process.stderr.write(`Error: ${msg}\nRun 'tm --help' for usage information.\n`);
    }
    process.exit(1);
  }
}

// Guard: skip module-level execution when imported by Jest (JEST_WORKER_ID is set by the Jest
// worker process). If the test runner changes (e.g., Vitest sets VITEST instead), update this
// guard accordingly. Tracked in QA-1.2-04.
if (!process.env.JEST_WORKER_ID) {
  await run();
}
