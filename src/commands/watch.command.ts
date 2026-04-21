import chalk from 'chalk';
import { Command } from 'commander';
import { AIProviderFactory } from '../providers/ai-provider-factory.js';
import { configService } from '../services/config.service.js';
import { CategorizationService } from '../services/categorization.service.js';
import { ContextService } from '../services/context.service.js';
import { FileOrganizationService } from '../services/file-organization.service.js';
import { fileSystemService } from '../services/file-system.service.js';
import { InboxProcessService } from '../services/inbox-process.service.js';
import { InboxService } from '../services/inbox.service.js';
import { projectService } from '../services/project.service.js';
import { sectionParserService } from '../services/section-parser.service.js';
import { TaskService } from '../services/task.service.js';
import { teamService } from '../services/team.service.js';
import { WatchService } from '../services/watch.service.js';
import { getWorkspaceRoot } from '../utils/workspace.js';

function buildInboxProcessService(): InboxProcessService {
  const provider = configService.getActiveProvider();
  if (!provider) {
    throw new Error(
      'No AI provider configured. Run `tmr init` or `tmr config switch-provider` and set an API key.',
    );
  }
  const pc = configService.getProviderConfig(provider);
  if (!pc?.api_key_encrypted) {
    throw new Error(
      `No API key for provider "${provider}". Run \`tmr config set-key\` to configure it.`,
    );
  }

  const ai = AIProviderFactory.create(provider, pc.api_key_encrypted);
  const threshold = configService.getConfidenceThreshold();
  const categorization = new CategorizationService(ai, threshold);
  const inbox = new InboxService(fileSystemService);
  const context = new ContextService(fileSystemService, sectionParserService);
  const tasks = new TaskService(ai, fileSystemService);
  const organize = new FileOrganizationService(fileSystemService);

  return new InboxProcessService(
    inbox,
    categorization,
    context,
    tasks,
    organize,
    teamService,
    projectService,
    fileSystemService,
  );
}

export async function runWatch(opts: { verbose: boolean; plain: boolean }): Promise<void> {
  configService.initialize();
  const { plain, verbose } = opts;

  let processSvc: InboxProcessService;
  try {
    processSvc = buildInboxProcessService();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stdout.write(`${plain ? msg : chalk.red(msg)}\n`);
    process.exitCode = 1;
    return;
  }

  const watchSvc = new WatchService(processSvc, fileSystemService);
  const workspaceRoot = getWorkspaceRoot();
  await watchSvc.start(workspaceRoot, { verbose, plain });
}

export function createWatchCommand(): Command {
  const cmd = new Command('watch')
    .description('watch inbox folder and auto-process new files when added')
    .action(async (_opts: Record<string, unknown>, command: Command): Promise<void> => {
      const globals = command.parent?.opts() as { verbose?: boolean; plain?: boolean } | undefined;
      const plain = globals?.plain ?? false;
      const verbose = globals?.verbose ?? false;
      await runWatch({ verbose, plain });
    });

  return cmd;
}
