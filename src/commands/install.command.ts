import chalk from 'chalk';
import { Command } from 'commander';
import { configService } from '../services/config.service.js';
import { SkillRegistryService } from '../services/skill-registry.service.js';
import { getWorkspaceRoot } from '../utils/workspace.js';

export async function runInstall(
  skillName: string,
  opts: { plain: boolean; force: boolean },
): Promise<void> {
  configService.initialize();
  const workspaceRoot = getWorkspaceRoot();
  const registry = new SkillRegistryService(workspaceRoot);

  const green: (t: string) => string = opts.plain
    ? (t: string): string => t
    : (t: string): string => chalk.green(t);
  const yellow: (t: string) => string = opts.plain
    ? (t: string): string => t
    : (t: string): string => chalk.yellow(t);
  const red: (t: string) => string = opts.plain
    ? (t: string): string => t
    : (t: string): string => chalk.red(t);

  const installedVersion = registry.getInstalledVersion(skillName);
  if (installedVersion !== undefined && !opts.force) {
    process.stdout.write(
      yellow(
        `Skill "${skillName}" is already installed (v${installedVersion ?? 'unknown'}). Use --force to reinstall or run \`tmr update\` to check for a newer version.`,
      ) + '\n',
    );
    return;
  }

  const result = await registry.fetchSkillContent(skillName);
  if (!result.success) {
    process.stdout.write(red(result.error) + '\n');
    process.exitCode = 1;
    return;
  }

  const { content, version } = result.data;
  registry.installSkill(skillName, content, version);
  process.stdout.write(
    green(`✓ Installed ${skillName} v${version} → .claude/skills/${skillName}/SKILL.md`) + '\n',
  );
}

export function createInstallCommand(): Command {
  return new Command('install')
    .description('install a skill into your vault from the official registry')
    .argument('<skill-name>', 'name of the skill to install (e.g. tmr-inbox)')
    .option('-f, --force', 'reinstall even if already installed', false)
    .action(async (skillName: string, opts: { force?: boolean }, command: Command) => {
      const globals = command.parent?.opts() as { plain?: boolean } | undefined;
      const plain = globals?.plain ?? false;
      const force = opts.force ?? false;
      await runInstall(skillName, { plain, force });
    });
}
