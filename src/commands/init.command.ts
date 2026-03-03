import boxen from 'boxen';
import chalk from 'chalk';
import ora from 'ora';
import { join } from 'node:path';
import { AIProviderFactory } from '../providers/ai-provider-factory.js';
import { configService } from '../services/config.service.js';
import { fileSystemService } from '../services/file-system.service.js';
import {
  promptWorkspacePath,
  promptProviderSelection,
  promptApiKey,
  promptManagerProfile,
  promptCareerGoals,
  promptLeadershipContext,
} from '../workflows/onboarding.prompts.js';
import { buildWorkspaceStructure } from '../workflows/workspace-builder.js';
import {
  generateCareerProfile,
  generatePdp,
  generateLeadershipProfile,
  generateCursorRule,
  generateAgentStub,
} from '../templates/onboarding.templates.js';
import type { OnboardingData } from '../types/onboarding.types.js';

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

  private async validateConnection(provider: string, apiKey: string): Promise<void> {
    const spinner = ora(`Validating ${provider} API key…`).start();
    try {
      const ai = AIProviderFactory.create(provider, apiKey);
      const connected = await ai.testConnection();
      if (!connected) {
        spinner.fail(`Could not connect to ${provider}. Check your API key.`);
        process.exit(1);
        return;
      }
      spinner.succeed(`Connected to ${provider}`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      spinner.fail(`Could not connect to ${provider}: ${reason}`);
      process.exit(1);
    }
  }

  private async writeWorkspaceFiles(workspacePath: string, data: OnboardingData): Promise<void> {
    await Promise.all([
      fileSystemService.writeFile(
        join(workspacePath, 'my-career', 'profile.md'),
        generateCareerProfile(data),
      ),
      fileSystemService.writeFile(join(workspacePath, 'my-career', 'pdp.md'), generatePdp(data)),
      fileSystemService.writeFile(
        join(workspacePath, 'my-leadership', 'profile.md'),
        generateLeadershipProfile(data),
      ),
      fileSystemService.writeFile(
        join(workspacePath, '.cursor', 'rules', 'tmr', 'cycle-agent.mdc'),
        generateCursorRule('cycle-agent'),
      ),
      fileSystemService.writeFile(
        join(workspacePath, '.claude', 'agents', 'cycle-agent.md'),
        generateAgentStub('cycle-agent'),
      ),
      fileSystemService.writeFile(
        join(workspacePath, '.gemini', 'agents', 'cycle-agent.md'),
        generateAgentStub('cycle-agent'),
      ),
    ]);
  }

  private displayNextSteps(workspacePath: string): void {
    const lines = [
      chalk.bold.green(`\n✓ Workspace created at ${workspacePath}`),
      '',
      chalk.bold('Next steps:'),
      `  ${chalk.cyan('1.')} Open ${chalk.bold(workspacePath)} as your Obsidian vault`,
      `  ${chalk.cyan('2.')} Add meeting notes to ${chalk.bold('inbox/')} (via Granola or manually)`,
      `  ${chalk.cyan('3.')} Run ${chalk.bold('tmr process')} to process inbox files`,
      `  ${chalk.cyan('4.')} Run ${chalk.bold('tmr --help')} to explore all available commands`,
      '',
    ];
    process.stdout.write(lines.join('\n') + '\n');
  }

  async run(): Promise<void> {
    this.displayWelcomeBanner();

    const workspacePath = await promptWorkspacePath();
    const provider = await promptProviderSelection();
    const apiKey = await promptApiKey(provider);

    await this.validateConnection(provider, apiKey);

    configService.initialize();
    configService.set('provider', provider);
    configService.set('apiKey', apiKey);

    const profile = await promptManagerProfile();
    const careerGoals = await promptCareerGoals();
    const leadershipContext = await promptLeadershipContext();

    const data: OnboardingData = {
      provider,
      apiKey,
      workspacePath,
      profile,
      careerGoals,
      leadershipContext,
    };

    const spinner = ora('Creating workspace…').start();
    await buildWorkspaceStructure(workspacePath);
    await this.writeWorkspaceFiles(workspacePath, data);
    spinner.succeed('Workspace ready');

    this.displayNextSteps(workspacePath);
  }
}
