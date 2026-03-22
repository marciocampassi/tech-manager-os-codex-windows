import boxen from 'boxen';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { execSync, spawnSync } from 'node:child_process';
import matter from 'gray-matter';
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
  promptGoogleDriveSetup,
} from '../workflows/onboarding.prompts.js';
import { buildWorkspaceStructure } from '../workflows/workspace-builder.js';
import { obsidianPluginService } from '../services/obsidian-plugin.service.js';
import {
  generateCareerProfile,
  generatePdp,
  generateLeadershipProfile,
  generateTeamMemberProfile,
  generateDefaultTeamContext,
  generateDefaultTeamMembers,
  generateCursorRule,
  generateAgentStub,
  generateTaskFileTemplate,
  generateActionItemsTemplate,
} from '../templates/onboarding.templates.js';
import {
  googleDriveService,
  generateSyncScript,
  generateSyncSetupGuide,
} from '../services/google-drive.service.js';
import type { TaskPeriod } from '../types/task.types.js';
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
    const { profile, leadershipContext } = data;
    const leadershipDir = join(workspacePath, 'my-leadership', leadershipContext.managerEmail);
    const taskPeriods: TaskPeriod[] = ['today', 'this-week', 'this-month', 'this-quarter'];
    const taskFileWrites = taskPeriods.map(async (period) => {
      const filePath = join(workspacePath, 'my-tasks', `${period}.md`);
      const exists = await fileSystemService.exists(filePath);
      if (!exists) {
        await fileSystemService.writeFile(filePath, generateTaskFileTemplate(period));
      }
    });
    await Promise.all([
      fileSystemService.writeFile(
        join(workspacePath, 'my-career', profile.email, `${profile.email}.md`),
        generateCareerProfile(data),
      ),
      fileSystemService.writeFile(
        join(workspacePath, 'my-career', profile.email, 'pdp.md'),
        generatePdp(data),
      ),
      fileSystemService.writeFile(
        join(leadershipDir, `${leadershipContext.managerEmail}.md`),
        generateLeadershipProfile(data),
      ),
      fileSystemService.createDirectory(join(leadershipDir, '1on1s')),
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
      ...taskFileWrites,
    ]);
  }

  private async writeTeamMemberFiles(
    workspacePath: string,
    members: TeamMember[],
    managerEmail: string,
    googleEnabled: boolean,
    folderDriveId: string,
  ): Promise<void> {
    await Promise.all(
      members.map(async (member) => {
        const memberDir = join(workspacePath, 'my-teams', '_members', member.email);

        // Always create the action items .md file (idempotent)
        const actionItemsPath = join(memberDir, `action-items-${member.email}.md`);
        const actionItemsExists = await fileSystemService.exists(actionItemsPath);

        await Promise.all([
          fileSystemService.createDirectory(join(memberDir, '1on1s')),
          fileSystemService.createDirectory(join(memberDir, 'feedback')),
          fileSystemService.createDirectory(join(memberDir, 'assessments')),
          fileSystemService.createDirectory(join(memberDir, 'performance-reviews')),
          fileSystemService.writeFile(
            join(memberDir, `${member.email}.md`),
            generateTeamMemberProfile(member, managerEmail),
          ),
          ...(actionItemsExists
            ? []
            : [
                fileSystemService.writeFile(
                  actionItemsPath,
                  generateActionItemsTemplate(member.email),
                ),
              ]),
        ]);

        // Google Drive integration (only when enabled)
        if (googleEnabled && folderDriveId) {
          await this._createGoogleDocForMember(member.email, memberDir, folderDriveId);
        }
      }),
    );
  }

  private async _createGoogleDocForMember(
    email: string,
    memberDir: string,
    folderDriveId: string,
  ): Promise<void> {
    try {
      const templateContent = generateActionItemsTemplate(email);
      const { docId, url } = await googleDriveService.createActionItemsDoc(
        email,
        folderDriveId,
        templateContent,
      );

      if (!docId) return;

      await googleDriveService.shareDocument(docId, email, 'writer');

      // Update member profile frontmatter with GDoc URL (AC5)
      const profilePath = join(memberDir, `${email}.md`);
      const profileContent = await fileSystemService.readFile(profilePath);
      const parsed = matter(profileContent);
      parsed.data['action_items_gdoc'] = url;
      await fileSystemService.writeFile(profilePath, matter.stringify(parsed.content, parsed.data));

      const pointerPath = join(memberDir, `action-items-${email}.gdoc`);
      await googleDriveService.createGdocPointerFile(pointerPath, docId, url, email);
    } catch (err) {
      // Google failure must never block local .md creation
      process.stderr.write(
        `⚠  Google Drive integration failed for ${email}: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }
  }

  private async writeDefaultTeam(workspacePath: string, members: TeamMember[]): Promise<void> {
    if (members.length === 0) return;
    const defaultTeamDir = join(workspacePath, 'my-teams', '_teams', 'default');
    await Promise.all([
      fileSystemService.writeFile(
        join(defaultTeamDir, 'default-context.md'),
        generateDefaultTeamContext(),
      ),
      fileSystemService.writeFile(
        join(defaultTeamDir, 'default-members.md'),
        generateDefaultTeamMembers(members),
      ),
    ]);
  }

  private async writeGoogleSyncFiles(workspacePath: string, folderDriveId: string): Promise<void> {
    const utilsDir = join(workspacePath, 'utils');
    await Promise.all([
      fileSystemService.writeFile(
        join(utilsDir, 'sync-action-items.gs'),
        generateSyncScript(folderDriveId),
      ),
      fileSystemService.writeFile(
        join(utilsDir, 'sync-action-items-setup.md'),
        generateSyncSetupGuide(),
      ),
    ]);
  }

  async deployWithClasp(workspacePath: string): Promise<void> {
    const gsFilePath = join(workspacePath, 'utils', 'sync-action-items.gs');
    const setupGuidePath = join(workspacePath, 'utils', 'sync-action-items-setup.md');

    process.stdout.write('\n─────────────────────────────────────────────────────\n');
    process.stdout.write('AppScript Sync — Deployment\n');
    process.stdout.write('─────────────────────────────────────────────────────\n');
    process.stdout.write(`The sync script was generated at:\n  ${gsFilePath}\n`);
    process.stdout.write('\nIt needs to be deployed to Google Apps Script to run daily.\n');

    const whichResult = spawnSync('which', ['clasp'], { encoding: 'utf8' });
    const claspPath = whichResult.status === 0 ? whichResult.stdout.trim() : null;

    if (claspPath) {
      process.stdout.write(chalk.green('\n✓ clasp detected.\n'));
      const { deploy } = await inquirer.prompt<{ deploy: boolean }>([
        {
          type: 'confirm',
          name: 'deploy',
          message:
            'Deploy the sync script now via clasp? (Strongly recommended — saves 8 manual steps)',
          default: true,
        },
      ]);

      if (deploy) {
        const spinner = ora('Deploying sync script via clasp…').start();
        try {
          const utilsDir = join(workspacePath, 'utils');
          const claspRc = join(homedir(), '.clasprc.json');

          if (!(await fileSystemService.exists(claspRc))) {
            spinner.info('Opening browser for clasp login…');
            execSync('clasp login', { stdio: 'inherit', cwd: utilsDir });
          }

          execSync('clasp create --title "TMR Action Items Sync" --type standalone', {
            cwd: utilsDir,
          });
          execSync('clasp push', { cwd: utilsDir });
          execSync('clasp run onInstall', { cwd: utilsDir });
          spinner.succeed('Sync script deployed. Daily trigger active at 7 AM.');
        } catch {
          spinner.warn('clasp deployment failed. See manual instructions below.');
          this._displayManualInstructions(setupGuidePath);
        }
        return;
      }
    } else {
      process.stdout.write(chalk.yellow('\nℹ  clasp not found on your system.\n'));
    }

    process.stdout.write('\nTo enable daily sync, choose one of these options:\n\n');
    process.stdout.write(
      chalk.bold('  Option A (Recommended): Install clasp and deploy automatically\n'),
    );
    process.stdout.write('    npm install -g @google/clasp\n');
    process.stdout.write(`    cd ${join(workspacePath, 'utils')}\n`);
    process.stdout.write('    clasp login\n');
    process.stdout.write('    clasp create --title "TMR Action Items Sync" --type standalone\n');
    process.stdout.write('    clasp push && clasp run onInstall\n\n');
    process.stdout.write(
      chalk.bold('  Option B: Deploy manually via Google Apps Script web editor\n'),
    );
    process.stdout.write(`    See: ${setupGuidePath}\n\n`);
  }

  private _displayManualInstructions(setupGuidePath: string): void {
    process.stdout.write('\nManual deployment instructions:\n');
    process.stdout.write(`  See: ${setupGuidePath}\n\n`);
  }

  private displayNextSteps(workspacePath: string): void {
    const lines = [
      chalk.bold.green(`\n✓ Workspace created at ${workspacePath}`),
      '',
      chalk.bold('Next steps:'),
      `  ${chalk.cyan('1.')} Open ${chalk.bold(workspacePath)} as your Obsidian vault — plugins are ready`,
      `  ${chalk.cyan('2.')} Add meeting notes to ${chalk.bold('inbox/')} (via Granola or manually)`,
      `  ${chalk.cyan('3.')} Run ${chalk.bold('tmr process')} to process inbox files`,
      `  ${chalk.cyan('4.')} Run ${chalk.bold('tmr --help')} to explore all available commands`,
      '',
      chalk.dim('Obsidian plugins installed (obsidian-git, granola-sync, terminal)'),
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
    configService.set('workspace_path', workspacePath);
    configService.setActiveProvider(provider);
    if (keyValidated) {
      configService.addProvider(provider, apiKey, '');
    }

    const profile = await promptManagerProfile();
    const leadershipContext = await promptLeadershipContext();
    const teamMembers = await promptTeamMembers();

    // Google Drive integration prompt (after workspace setup)
    const googleSetup = await promptGoogleDriveSetup();
    if (googleSetup.enabled) {
      configService.set('google_drive_enabled', true);
      configService.set('google_drive_folder_id', googleSetup.folderDriveId);
      configService.set('google_client_id', googleSetup.clientId);
      configService.set('google_client_secret', googleSetup.clientSecret);

      const authSpinner = ora('Authenticating with Google…').start();
      try {
        const token = await googleDriveService.authenticate(
          googleSetup.clientId,
          googleSetup.clientSecret,
        );
        configService.set('google_oauth_token', token);
        authSpinner.succeed('Google authentication complete');
      } catch {
        authSpinner.warn('Google authentication skipped — run `tmr google auth` later');
      }
    }

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
    await this.writeTeamMemberFiles(
      workspacePath,
      teamMembers,
      leadershipContext.managerEmail,
      googleSetup.enabled,
      googleSetup.folderDriveId,
    );
    await this.writeDefaultTeam(workspacePath, teamMembers);

    if (googleSetup.enabled) {
      await this.writeGoogleSyncFiles(workspacePath, googleSetup.folderDriveId);
    }

    spinner.succeed('Workspace ready');

    if (googleSetup.enabled) {
      await this.deployWithClasp(workspacePath);
    }

    const pluginSpinner = ora('Downloading Obsidian plugins…').start();
    await obsidianPluginService.installPlugins(workspacePath);
    pluginSpinner.succeed('Obsidian plugins installed');

    this.displayNextSteps(workspacePath);
  }
}
