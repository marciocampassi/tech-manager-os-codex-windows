import boxen from 'boxen';
import chalk from 'chalk';
import { join } from 'node:path';
import { configService } from '../services/config.service.js';
import { fileSystemService } from '../services/file-system.service.js';
import { initService } from '../services/init.service.js';
import {
  promptWorkspacePath,
  promptMinimalOnboarding,
  promptLeaderDetails,
  promptTeamCount,
  promptTeamName,
} from '../workflows/onboarding.prompts.js';
import { obsidianPluginService } from '../services/obsidian-plugin.service.js';
import { generateClaudeMd } from '../services/claude-md.generator.js';
import { generateTaskFileTemplate } from '../templates/onboarding.templates.js';
import { startSpinner, printError } from '../utils/display.js';
import type { TaskPeriod } from '../types/task.types.js';

const TASKS_MD_TEMPLATE =
  '# Tasks\n\n<!-- Backlog: add tasks here — tmr process will append extracted tasks automatically -->\n';

export class InitCommand {
  constructor(
    private readonly version: string = '1.0.0',
    private readonly plain: boolean = false,
  ) {}

  /**
   * Displays the branded welcome banner.
   * Branding uses cyan — intentional exception to the green/yellow/blue/red color contract.
   * In --plain mode, renders a simple text header instead.
   */
  displayWelcomeBanner(): void {
    if (this.plain) {
      process.stdout.write(`Tech Manager OS v${this.version}\n`);
      process.stdout.write('AI-powered workspace for engineering leaders\n\n');
      return;
    }
    const banner = boxen(
      [
        chalk.bold.cyan('Tech Manager OS'),
        chalk.gray('AI-powered workspace for engineering leaders'),
        '',
        chalk.dim(`v${this.version}`),
      ].join('\n'),
      { padding: 1, borderStyle: 'round', borderColor: 'cyan' },
    );
    process.stdout.write(banner + '\n\n');
  }

  private displayNextSteps(workspacePath: string): void {
    if (this.plain) {
      process.stdout.write(`\n✓ Workspace created at ${workspacePath}\n`);
      process.stdout.write('\nNext steps:\n');
      process.stdout.write('  1. Run `tmr config` to set your AI API key\n');
      process.stdout.write('  2. Run `tmr install tmr-inbox` to install the inbox skill\n');
      process.stdout.write(`  3. Open ${workspacePath} in Obsidian — plugins are ready\n`);
      process.stdout.write('  4. Run `tmr --help` to explore all commands\n');
      process.stdout.write(
        '\nObsidian plugins installed (obsidian-git, granola-sync, terminal, dataview)\n',
      );
      return;
    }
    const lines = [
      chalk.bold.green(`\n✓ Workspace created at ${workspacePath}`),
      '',
      chalk.bold('Next steps:'),
      `  ${chalk.cyan('1.')} Run ${chalk.bold('tmr config')} to set your AI API key`,
      `  ${chalk.cyan('2.')} Run ${chalk.bold('tmr install tmr-inbox')} to install the inbox skill`,
      `  ${chalk.cyan('3.')} Open ${chalk.bold(workspacePath)} in Obsidian — plugins are ready`,
      `  ${chalk.cyan('4.')} Run ${chalk.bold('tmr --help')} to explore all commands`,
      '',
      chalk.dim('Obsidian plugins installed (obsidian-git, granola-sync, terminal, dataview)'),
      '',
    ];
    process.stdout.write(lines.join('\n') + '\n');
  }

  async run(): Promise<void> {
    this.displayWelcomeBanner();

    // ── Prompt phase — collect all user input before any file writes ──────────
    const rawPath = await promptWorkspacePath();
    const workspacePath = initService.resolveVaultPath(rawPath);
    const answers = await promptMinimalOnboarding();
    const leader = await promptLeaderDetails();
    const teamCount = await promptTeamCount();
    const teamNames: string[] = [];
    for (let i = 1; i <= teamCount; i++) {
      teamNames.push(await promptTeamName(i));
    }

    // ── Write phase ───────────────────────────────────────────────────────────
    configService.initialize();
    configService.setWorkspacePath(workspacePath);

    const scaffoldSpinner = startSpinner('Creating workspace', this.plain);
    try {
      await initService.scaffold(workspacePath);
    } catch (err) {
      printError(
        `Failed to scaffold vault at ${workspacePath}: ${err instanceof Error ? err.message : String(err)}`,
      );
      scaffoldSpinner.fail('Workspace scaffolding failed');
      return;
    }

    const taskPeriods: TaskPeriod[] = ['today', 'this-week', 'this-month', 'this-quarter'];
    const allTaskFiles: Array<[string, string]> = [
      ['tasks.md', TASKS_MD_TEMPLATE],
      ...taskPeriods.map((period): [string, string] => [
        `${period}.md`,
        generateTaskFileTemplate(period),
      ]),
    ];

    await Promise.all(
      allTaskFiles.map(async ([filename, content]) => {
        const filePath = join(workspacePath, 'my-tasks', filename);
        if (!(await fileSystemService.exists(filePath))) {
          await fileSystemService.writeFile(filePath, content);
        }
      }),
    );

    scaffoldSpinner.succeed('Workspace ready');

    const profileSpinner = startSpinner('Creating your profile', this.plain);
    try {
      await initService.writeUserProfile(workspacePath, {
        name: answers.name,
        email: answers.email,
        role: answers.role,
      });
    } catch (err) {
      printError(
        `Failed to write user profile: ${err instanceof Error ? err.message : String(err)}`,
      );
      profileSpinner.fail('Profile creation failed');
      return;
    }
    profileSpinner.succeed('Profile created');

    const leaderSpinner = startSpinner('Creating leader profile', this.plain);
    try {
      await initService.writeLeaderProfile(workspacePath, leader);
    } catch (err) {
      printError(
        `Failed to write leader profile: ${err instanceof Error ? err.message : String(err)}`,
      );
      leaderSpinner.fail('Leader profile creation failed');
      return;
    }
    leaderSpinner.succeed('Leader profile created');

    const teamsSpinner = startSpinner('Creating team structure', this.plain);
    try {
      await initService.createTeams(workspacePath, teamNames);
    } catch (err) {
      printError(
        `Failed to create team structure: ${err instanceof Error ? err.message : String(err)}`,
      );
      teamsSpinner.fail('Team structure creation failed');
      return;
    }
    teamsSpinner.succeed('Teams created');

    const claudeSpinner = startSpinner('Generating CLAUDE.md', this.plain);
    await fileSystemService.writeFile(join(workspacePath, 'CLAUDE.md'), generateClaudeMd(answers));
    claudeSpinner.succeed('CLAUDE.md generated');

    const pluginSpinner = startSpinner('Downloading Obsidian plugins', this.plain);
    await obsidianPluginService.installPlugins(workspacePath);
    pluginSpinner.succeed('Obsidian plugins installed');

    this.displayNextSteps(workspacePath);
  }
}
