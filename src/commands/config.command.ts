import ora from 'ora';
import inquirer from 'inquirer';
import { Command } from 'commander';
import { configService } from '../services/config.service.js';
import { AIProviderFactory } from '../providers/ai-provider-factory.js';
import { redact } from '../utils/redact.js';
import { promptProviderSelection } from '../workflows/onboarding.prompts.js';

const MAX_SET_KEY_ATTEMPTS = 3;

const PROVIDERS = ['gemini', 'openai', 'claude'] as const;
type ProviderName = (typeof PROVIDERS)[number];

// ── Helpers ──────────────────────────────────────────────────────────────────

async function promptHiddenKey(provider: string, attempt: number, max: number): Promise<string> {
  const attemptSuffix = max > 1 ? ` (attempt ${attempt}/${max})` : '';
  const { apiKey } = await inquirer.prompt<{ apiKey: string }>([
    {
      type: 'password',
      name: 'apiKey',
      message: `Enter your ${provider} API key${attemptSuffix}:`,
      validate: (v: string) => (v.trim().length > 0 ? true : 'API key cannot be empty'),
    },
  ]);
  return apiKey;
}

async function validateKey(
  provider: string,
  apiKey: string,
  attempt: number,
  max: number,
): Promise<boolean> {
  const label = `(attempt ${attempt}/${max})`;
  const spinner = ora(`Validating ${provider} API key… ${label}`).start();
  try {
    const ai = AIProviderFactory.create(provider, apiKey);
    const ok = await ai.testConnection();
    if (!ok) {
      spinner.fail(`Could not connect to ${provider}. Check your API key.`);
      return false;
    }
    spinner.succeed(`Connected to ${provider}`);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    spinner.fail(`Could not connect to ${provider}: ${msg}`);
    return false;
  }
}

function configuredProviders(): ProviderName[] {
  return PROVIDERS.filter((p) => {
    const cfg = configService.getProviderConfig(p);
    return cfg?.api_key_encrypted !== undefined;
  });
}

// ── Subcommand implementations ────────────────────────────────────────────────

function runShowSecurity(): void {
  const homePath = process.env.HOME ?? '~';
  const storagePath = `${homePath}/.config/tmr/config.json`;
  const activeProvider = configService.getActiveProvider() ?? '(none)';

  process.stdout.write('\n🔐 API Key Security Summary\n');
  process.stdout.write('─'.repeat(40) + '\n');
  process.stdout.write(`  Storage path  : ${storagePath}\n`);
  process.stdout.write(
    '  Encryption    : AES-256 via conf library (encryptionKey: tmr-config-v1)\n',
  );
  process.stdout.write(`  Active provider: ${activeProvider}\n`);

  const configured = configuredProviders();
  if (configured.length === 0) {
    process.stdout.write('  Stored keys   : (none configured)\n');
  } else {
    process.stdout.write('  Stored keys:\n');
    for (const p of configured) {
      const cfg = configService.getProviderConfig(p);
      const raw = cfg?.api_key_encrypted ?? '';
      process.stdout.write(`    ${p.padEnd(8)}: ${redact(raw)}\n`);
    }
  }

  process.stdout.write('\n  ✔ Raw API keys are never logged, printed, or sent to stdout.\n');
  process.stdout.write('  ✔ Keys are stored encrypted on disk and only decrypted in-process.\n\n');
}

async function runSetKey(): Promise<void> {
  const provider = await promptProviderSelection();

  let validated = false;
  let apiKey = '';

  for (let attempt = 1; attempt <= MAX_SET_KEY_ATTEMPTS; attempt++) {
    apiKey = await promptHiddenKey(provider, attempt, MAX_SET_KEY_ATTEMPTS);
    validated = await validateKey(provider, apiKey, attempt, MAX_SET_KEY_ATTEMPTS);
    if (validated) break;
  }

  if (!validated) {
    process.stdout.write(
      `\n⚠  Could not validate the key after ${MAX_SET_KEY_ATTEMPTS} attempts. Key was NOT saved.\n\n`,
    );
    return;
  }

  configService.addProvider(provider, apiKey, '');
  configService.setActiveProvider(provider);
  process.stdout.write(`\n✔ Key saved for ${provider}.\n\n`);
}

async function runDeleteKey(): Promise<void> {
  const configured = configuredProviders();

  if (configured.length === 0) {
    process.stdout.write('\nNo provider keys are currently configured.\n\n');
    return;
  }

  const { provider } = await inquirer.prompt<{ provider: ProviderName }>([
    {
      type: 'select',
      name: 'provider',
      message: 'Which provider key do you want to delete?',
      choices: configured.map((p) => ({ name: p, value: p })),
    },
  ]);

  const { confirmed } = await inquirer.prompt<{ confirmed: boolean }>([
    {
      type: 'confirm',
      name: 'confirmed',
      message: `Are you sure you want to delete the ${provider} API key?`,
      default: false,
    },
  ]);

  if (!confirmed) {
    process.stdout.write('Aborted.\n');
    return;
  }

  const raw = configService.get('providers') ?? {};
  if (typeof raw !== 'object' || raw === null) {
    process.stdout.write(
      '\n⚠  Provider config is corrupted. Run tmr config set-key to reconfigure.\n\n',
    );
    return;
  }
  const providers = raw as Record<string, unknown>;
  delete providers[provider];
  configService.set('providers', providers as never);

  if (configService.getActiveProvider() === provider) {
    configService.delete('active_provider');
  }

  process.stdout.write(`\n✔ Key for ${provider} deleted.\n\n`);
}

async function runSwitchProvider(): Promise<void> {
  const configured = configuredProviders();

  const choices = PROVIDERS.map((p) => ({
    name: configured.includes(p) ? `${p} ✔` : p,
    value: p,
  }));

  const { provider } = await inquirer.prompt<{ provider: ProviderName }>([
    {
      type: 'select',
      name: 'provider',
      message: 'Select the active AI provider:',
      choices,
    },
  ]);

  configService.setActiveProvider(provider);
  process.stdout.write(`\n✔ Active provider set to ${provider}.\n\n`);
}

// ── Command factory ───────────────────────────────────────────────────────────

const SUBCOMMAND_CHOICES = [
  {
    name: 'show-security   — display how API keys are stored and their redacted values',
    value: 'show-security',
  },
  { name: 'set-key         — add or update an API key for a provider', value: 'set-key' },
  { name: 'delete-key      — delete a stored API key', value: 'delete-key' },
  { name: 'switch-provider — change the active AI provider', value: 'switch-provider' },
  { name: 'exit            — close this menu', value: 'exit' },
] as const;

type SubcommandValue = (typeof SUBCOMMAND_CHOICES)[number]['value'];

async function runInteractiveMenu(): Promise<void> {
  const { action } = await inquirer.prompt<{ action: SubcommandValue }>([
    {
      type: 'select',
      name: 'action',
      message: 'What do you want to do?',
      choices: SUBCOMMAND_CHOICES,
    },
  ]);

  switch (action) {
    case 'show-security':
      runShowSecurity();
      break;
    case 'set-key':
      await runSetKey();
      break;
    case 'delete-key':
      await runDeleteKey();
      break;
    case 'switch-provider':
      await runSwitchProvider();
      break;
    case 'exit':
      break;
  }
}

export function createConfigCommand(): Command {
  const cmd = new Command('config')
    .description('manage API keys and provider settings')
    .action(async () => {
      await runInteractiveMenu();
    });

  cmd
    .command('show-security')
    .description('display how API keys are stored and their redacted values')
    .action(() => {
      runShowSecurity();
    });

  cmd
    .command('set-key')
    .description('add or update an API key for a provider')
    .action(async () => {
      await runSetKey();
    });

  cmd
    .command('delete-key')
    .description('delete a stored API key')
    .action(async () => {
      await runDeleteKey();
    });

  cmd
    .command('switch-provider')
    .description('change the active AI provider')
    .action(async () => {
      await runSwitchProvider();
    });

  return cmd;
}
