import { Command } from 'commander';
import { configService } from '../services/config.service.js';
import { SkillRegistryService } from '../services/skill-registry.service.js';
import { getWorkspaceRoot } from '../utils/workspace.js';
import {
  printSuccess,
  printWarning,
  printError,
  printJson,
  startSpinner,
} from '../utils/display.js';

// ── Install-all helper ────────────────────────────────────────────────────────

async function runInstallAll(
  registry: SkillRegistryService,
  opts: { plain: boolean; force: boolean; json?: boolean },
): Promise<void> {
  const { plain, force, json = false } = opts;

  const listSpinner = startSpinner('Fetching skill list from registry', plain);
  const listResult = await registry.fetchSkillList();

  if (!listResult.success) {
    listSpinner.fail('Failed to fetch skill list');
    if (json) {
      printJson({ status: 'error', message: listResult.error });
    } else {
      printError(listResult.error, 'Check your internet connection or try again later.', plain);
    }
    process.exitCode = 1;
    return;
  }

  const skills = listResult.data;
  listSpinner.succeed(`Found ${skills.length} skill(s) in registry`);

  const installed: string[] = [];
  const skipped: string[] = [];
  const failed: Array<{ name: string; error: string }> = [];

  for (const name of skills) {
    const installedVersion = registry.getInstalledVersion(name);
    if (installedVersion !== undefined && !force) {
      skipped.push(name);
      continue;
    }

    const skillSpinner = startSpinner(`Installing ${name}`, plain);
    const result = await registry.fetchSkillContent(name);

    if (!result.success) {
      skillSpinner.fail(`Failed to install ${name}`);
      if (!json) {
        printError(result.error, 'Check your internet connection or try again later.', plain);
      }
      failed.push({ name, error: result.error });
      process.exitCode = 1;
      continue;
    }

    const { content, version } = result.data;
    registry.installSkill(name, content, version);
    skillSpinner.succeed(`Installed ${name} v${version}`);
    if (!json) {
      printSuccess(`Installed ${name} v${version} → .claude/skills/${name}/SKILL.md`, plain);
    }
    installed.push(name);
  }

  if (json) {
    printJson({ installed, skipped, failed });
  }
}

// ── Public command function ───────────────────────────────────────────────────

export async function runInstall(
  skillName: string | undefined,
  opts: { plain: boolean; force: boolean; json?: boolean },
): Promise<void> {
  configService.initialize();
  const workspaceRoot = getWorkspaceRoot();
  const registry = new SkillRegistryService(workspaceRoot);

  if (skillName === undefined) {
    await runInstallAll(registry, opts);
    return;
  }

  const { plain, force, json = false } = opts;

  const installedVersion = registry.getInstalledVersion(skillName);
  if (installedVersion !== undefined && !force) {
    const msg = `Skill "${skillName}" is already installed (v${installedVersion ?? 'unknown'}).`;
    const hint = 'Use --force to reinstall or run `tmr update` to check for a newer version.';
    if (json) {
      printJson({
        skill: skillName,
        version: installedVersion,
        status: 'already_installed',
        message: `${msg} ${hint}`,
      });
    } else {
      printWarning(`${msg} ${hint}`, plain);
    }
    return;
  }

  const spinner = startSpinner(`Fetching ${skillName} from registry`, plain);
  const result = await registry.fetchSkillContent(skillName);

  if (!result.success) {
    spinner.fail(`Failed to fetch ${skillName}`);
    if (json) {
      printJson({ skill: skillName, status: 'error', message: result.error });
    } else {
      printError(result.error, 'Check your internet connection or try again later.', plain);
    }
    process.exitCode = 1;
    return;
  }

  const { content, version } = result.data;
  registry.installSkill(skillName, content, version);
  spinner.succeed(`Fetched ${skillName} v${version}`);

  if (json) {
    printJson({ skill: skillName, version, status: 'installed' });
  } else {
    printSuccess(
      `Installed ${skillName} v${version} → .claude/skills/${skillName}/SKILL.md`,
      plain,
    );
  }
}

export function createInstallCommand(): Command {
  return new Command('install')
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
    .action(async (skillName: string | undefined, opts: { force?: boolean }, command: Command) => {
      const globals = command.parent?.opts() as { plain?: boolean; json?: boolean } | undefined;
      const plain = globals?.plain ?? false;
      const json = globals?.json ?? false;
      const force = opts.force ?? false;
      await runInstall(skillName, { plain, force, json });
    });
}
