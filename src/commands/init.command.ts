import boxen from 'boxen';
import chalk from 'chalk';
import ora from 'ora';
import { join } from 'node:path';
import { configService } from '../services/config.service.js';
import { fileSystemService } from '../services/file-system.service.js';
import { promptWorkspacePath, promptMinimalOnboarding } from '../workflows/onboarding.prompts.js';
import { buildWorkspaceStructure } from '../workflows/workspace-builder.js';
import { obsidianPluginService } from '../services/obsidian-plugin.service.js';
import { generateClaudeMd } from '../services/claude-md.generator.js';
import { generateTaskFileTemplate } from '../templates/onboarding.templates.js';
import type { TaskPeriod } from '../types/task.types.js';

const TASKS_MD_TEMPLATE =
  '# Tasks\n\n<!-- Backlog: add tasks here — tmr process will append extracted tasks automatically -->\n';

export class InitCommand {
  constructor(private readonly version: string = '1.0.0') {}

  private displayWelcomeBanner(): void {
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

    const workspacePath = await promptWorkspacePath();
    const answers = await promptMinimalOnboarding();

    configService.initialize();
    configService.setWorkspacePath(workspacePath);

    const scaffoldSpinner = ora('Creating workspace…').start();
    await buildWorkspaceStructure(workspacePath);

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

    const claudeSpinner = ora('Generating CLAUDE.md…').start();
    await fileSystemService.writeFile(join(workspacePath, 'CLAUDE.md'), generateClaudeMd(answers));
    claudeSpinner.succeed('CLAUDE.md generated');

    const pluginSpinner = ora('Downloading Obsidian plugins…').start();
    await obsidianPluginService.installPlugins(workspacePath);
    pluginSpinner.succeed('Obsidian plugins installed');

    this.displayNextSteps(workspacePath);
  }
}
