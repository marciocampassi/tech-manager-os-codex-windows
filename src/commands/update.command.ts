import { Command } from 'commander';
import { configService } from '../services/config.service.js';
import { SkillRegistryService } from '../services/skill-registry.service.js';
import { getWorkspaceRoot } from '../utils/workspace.js';
import { printSuccess, printInfo, printJson, startSpinner } from '../utils/display.js';
import chalk from 'chalk';

function isNewerVersion(candidate: string, installed: string): boolean {
  const parse = (v: string): number[] => v.split('.').map(Number);
  const [ca, cb, cc] = parse(candidate);
  const [ia, ib, ic] = parse(installed);
  if (ca !== ia) return ca > ia;
  if (cb !== ib) return cb > ib;
  return cc > ic;
}

interface UpdateResult {
  skill: string;
  from: string;
  to: string;
  status: 'updated' | 'up_to_date' | 'error';
  message?: string;
}

export async function runUpdate(opts: { plain: boolean; json?: boolean }): Promise<void> {
  configService.initialize();
  const workspaceRoot = getWorkspaceRoot();
  const registry = new SkillRegistryService(workspaceRoot);
  const { plain, json = false } = opts;

  const installed = registry.listInstalledSkills();
  if (installed.length === 0) {
    const msg = 'No skills installed.';
    const hint = 'Run `tmr install <skill-name>` to get started.';
    if (json) {
      printJson({ updated: [], upToDate: [], errors: [], message: `${msg} ${hint}` });
    } else {
      printInfo(`${msg} ${hint}`, plain);
    }
    return;
  }

  if (!json) {
    const bold = plain ? (t: string): string => t : (t: string): string => chalk.bold(t);
    process.stdout.write(bold('Checking for skill updates...\n'));
  }

  const results: UpdateResult[] = [];

  for (const entry of installed) {
    const spinner = startSpinner(`Checking ${entry.name}`, plain);
    const result = await registry.fetchSkillContent(entry.name);

    if (!result.success) {
      // Terminate the spinner with the error message, then show recovery hint as a separate dim line.
      // Using spinner.fail() alone (not printError) avoids a duplicate ✗ prefix.
      spinner.fail(`${entry.name}: could not reach registry — ${result.error}`);
      if (!json) {
        const hint = plain
          ? `  → Check your internet connection or try again later.\n`
          : chalk.dim(`  → Check your internet connection or try again later.\n`);
        process.stderr.write(hint);
      }
      results.push({
        skill: entry.name,
        from: entry.version,
        to: entry.version,
        status: 'error',
        message: result.error,
      });
      continue;
    }

    const { content, version: latestVersion } = result.data;
    if (isNewerVersion(latestVersion, entry.version)) {
      registry.installSkill(entry.name, content, latestVersion);
      spinner.succeed(`${entry.name}: updated v${entry.version} → v${latestVersion}`);
      if (!json) {
        printSuccess(`${entry.name}: updated v${entry.version} → v${latestVersion}`, plain);
      }
      results.push({
        skill: entry.name,
        from: entry.version,
        to: latestVersion,
        status: 'updated',
      });
    } else {
      spinner.succeed(`${entry.name}: already up to date (v${entry.version})`);
      if (!json) {
        const dim = plain ? (t: string): string => t : (t: string): string => chalk.dim(t);
        process.stdout.write(
          dim(`  · ${entry.name}: already up to date (v${entry.version})`) + '\n',
        );
      }
      results.push({
        skill: entry.name,
        from: entry.version,
        to: entry.version,
        status: 'up_to_date',
      });
    }
  }

  if (json) {
    printJson({
      updated: results
        .filter((r) => r.status === 'updated')
        .map(({ skill, from, to }) => ({ skill, from, to })),
      upToDate: results
        .filter((r) => r.status === 'up_to_date')
        .map(({ skill, to }) => ({ skill, version: to })),
      errors: results
        .filter((r) => r.status === 'error')
        .map(({ skill, message }) => ({ skill, message })),
    });
  }
}

export function createUpdateCommand(): Command {
  return new Command('update')
    .description('update all installed skills to their latest versions from the registry')
    .addHelpText('after', '\nExamples:\n  tmr update\n  tmr update --plain\n  tmr update --json\n')
    .action(async (_opts: unknown, command: Command) => {
      const globals = command.parent?.opts() as { plain?: boolean; json?: boolean } | undefined;
      const plain = globals?.plain ?? false;
      const json = globals?.json ?? false;
      await runUpdate({ plain, json });
    });
}
