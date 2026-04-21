import chalk from 'chalk';
import { Command } from 'commander';
import { configService } from '../services/config.service.js';
import { SkillRegistryService } from '../services/skill-registry.service.js';
import { getWorkspaceRoot } from '../utils/workspace.js';

function isNewerVersion(candidate: string, installed: string): boolean {
  const parse = (v: string): number[] => v.split('.').map(Number);
  const [ca, cb, cc] = parse(candidate);
  const [ia, ib, ic] = parse(installed);
  if (ca !== ia) return ca > ia;
  if (cb !== ib) return cb > ib;
  return cc > ic;
}

export async function runUpdate(opts: { plain: boolean }): Promise<void> {
  configService.initialize();
  const workspaceRoot = getWorkspaceRoot();
  const registry = new SkillRegistryService(workspaceRoot);

  const green: (t: string) => string = opts.plain
    ? (t: string): string => t
    : (t: string): string => chalk.green(t);
  const dim: (t: string) => string = opts.plain
    ? (t: string): string => t
    : (t: string): string => chalk.dim(t);
  const red: (t: string) => string = opts.plain
    ? (t: string): string => t
    : (t: string): string => chalk.red(t);
  const bold: (t: string) => string = opts.plain
    ? (t: string): string => t
    : (t: string): string => chalk.bold(t);

  const installed = registry.listInstalledSkills();
  if (installed.length === 0) {
    process.stdout.write('No skills installed. Run `tmr install <skill-name>` to get started.\n');
    return;
  }

  process.stdout.write(bold('Checking for skill updates...\n'));

  for (const entry of installed) {
    const result = await registry.fetchSkillContent(entry.name);
    if (!result.success) {
      process.stdout.write(
        red(`  ✗ ${entry.name}: could not reach registry — ${result.error}`) + '\n',
      );
      continue;
    }

    const { content, version: latestVersion } = result.data;
    if (isNewerVersion(latestVersion, entry.version)) {
      registry.installSkill(entry.name, content, latestVersion);
      process.stdout.write(
        green(`  ✓ ${entry.name}: updated v${entry.version} → v${latestVersion}`) + '\n',
      );
    } else {
      process.stdout.write(dim(`  · ${entry.name}: already up to date (v${entry.version})`) + '\n');
    }
  }
}

export function createUpdateCommand(): Command {
  return new Command('update')
    .description('update all installed skills to their latest versions from the registry')
    .action(async (_opts: unknown, command: Command) => {
      const globals = command.parent?.opts() as { plain?: boolean } | undefined;
      const plain = globals?.plain ?? false;
      await runUpdate({ plain });
    });
}
