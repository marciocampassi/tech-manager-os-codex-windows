import boxen from 'boxen';
import chalk from 'chalk';
import inquirer from 'inquirer';
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
  promptLeadershipContext,
  promptTeamMembers,
} from '../workflows/onboarding.prompts.js';
import { buildWorkspaceStructure } from '../workflows/workspace-builder.js';
import {
  generateCareerProfile,
  generatePdp,
  generateLeadershipProfile,
  generateTeamMemberProfile,
  generateCursorRule,
  generateAgentStub,
} from '../templates/onboarding.templates.js';
import type { OnboardingData, TeamMember } from '../types/onboarding.types.js';

const MAX_API_KEY_ATTEMPTS = 3;

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

  private async validateConnection(
    provider: string,
    apiKey: string,
    attempt = 1,
    maxAttempts = MAX_API_KEY_ATTEMPTS,
  ): Promise<boolean> {
    const attemptLabel = `(attempt ${attempt}/${maxAttempts})`;
    const spinner = ora(`Validating ${provider} API key… ${attemptLabel}`).start();
    try {
      const ai = AIProviderFactory.create(provider, apiKey);
      const connected = await ai.testConnection();
      if (!connected) {
        spinner.fail(`Could not connect to ${provider}. Check your API key and try again.`);
        return false;
      }
      spinner.succeed(`Connected to ${provider}`);
      return true;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      spinner.fail(`Could not connect to ${provider}: ${reason}`);
      return false;
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
        join(workspacePath, '.cursor', 'rules', 'tmr', 'process-agent.mdc'),
        generateCursorRule('process-agent'),
      ),
      fileSystemService.writeFile(
        join(workspacePath, '.claude', 'agents', 'process-agent.md'),
        generateAgentStub('process-agent'),
      ),
      fileSystemService.writeFile(
        join(workspacePath, '.gemini', 'agents', 'process-agent.md'),
        generateAgentStub('process-agent'),
      ),
    ]);
  }

  private async writeTeamMemberFiles(workspacePath: string, members: TeamMember[]): Promise<void> {
    await Promise.all(
      members.map((member) =>
        fileSystemService.writeFile(
          join(workspacePath, 'my-team', member.email, 'profile.md'),
          generateTeamMemberProfile(member),
        ),
      ),
    );
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

    // Reuse existing key if one is already configured for the selected provider
    const existingCfg = configService.getProviderConfig(provider);
    let apiKey = existingCfg?.api_key_encrypted ?? '';
    let keyValidated = false;

    if (apiKey) {
      const { reuse } = await inquirer.prompt<{ reuse: boolean }>([
        {
          type: 'confirm',
          name: 'reuse',
          message: `A key is already configured for ${provider}. Use the existing key?`,
          default: true,
        },
      ]);
      if (reuse) {
        keyValidated = true;
        process.stdout.write(`\n✔ Using existing ${provider} key.\n\n`);
      } else {
        apiKey = '';
      }
    }

    if (!keyValidated) {
      for (let attempt = 1; attempt <= MAX_API_KEY_ATTEMPTS; attempt++) {
        apiKey = await promptApiKey(provider, attempt, MAX_API_KEY_ATTEMPTS);
        keyValidated = await this.validateConnection(
          provider,
          apiKey,
          attempt,
          MAX_API_KEY_ATTEMPTS,
        );
        if (keyValidated) break;
      }
    }

    if (!keyValidated) {
      process.stdout.write(
        `\n⚠  Could not validate the API key after ${MAX_API_KEY_ATTEMPTS} attempts.\n` +
          '   You can configure it later with: tmr config set-key\n\n',
      );
    }

    configService.initialize();
    configService.setActiveProvider(provider);
    if (keyValidated) {
      configService.addProvider(provider, apiKey, '');
    }

    const profile = await promptManagerProfile();
    const leadershipContext = await promptLeadershipContext();
    const teamMembers = await promptTeamMembers();

    const data: OnboardingData = {
      provider,
      apiKey,
      workspacePath,
      profile,
      leadershipContext,
      teamMembers,
    };

    const spinner = ora('Creating workspace…').start();
    await buildWorkspaceStructure(workspacePath);
    await this.writeWorkspaceFiles(workspacePath, data);
    await this.writeTeamMemberFiles(workspacePath, teamMembers);
    spinner.succeed('Workspace ready');

    this.displayNextSteps(workspacePath);
  }
}
