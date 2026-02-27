import Conf from 'conf';
import dotenv from 'dotenv';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ENV_MAP, CONFIG_DEFAULTS } from '../types/config.types.js';
import type { AppConfig, ProviderConfig } from '../types/config.types.js';
import { redact } from '../utils/redact.js';

/**
 * Config stored at ~/.config/tmr/config.json — architecture-mandated path.
 * (components.md § Configuration Service)
 */
const CONFIG_DIR = join(homedir(), '.config', 'tmr');

export class ConfigService {
  private readonly store: Conf<AppConfig>;

  constructor() {
    this.store = new Conf<AppConfig>({
      projectName: 'tmr',
      cwd: CONFIG_DIR,
      encryptionKey: 'tmr-config-v1',
    });
  }

  initialize(): void {
    dotenv.config();
  }

  // ─── Generic low-level API ───────────────────────────────────────────────

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.store.set(key, value as AppConfig[K]);
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] | undefined {
    const envVar = ENV_MAP[key];
    if (envVar !== undefined) {
      const envValue = process.env[envVar];
      if (envValue !== undefined) {
        return envValue as AppConfig[K];
      }
    }
    return this.store.get(key) as AppConfig[K] | undefined;
  }

  has(key: keyof AppConfig): boolean {
    const envVar = ENV_MAP[key];
    if (envVar !== undefined && process.env[envVar] !== undefined) return true;
    return this.store.has(key);
  }

  delete(key: keyof AppConfig): void {
    this.store.delete(key);
  }

  /** Display-safe value for logging — never log raw API keys. */
  getRedacted(key: keyof AppConfig): string {
    const value = this.get(key);
    if (value === undefined) return '(not set)';
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    return redact(str);
  }

  // ─── High-level domain API (architecture: components.md § ConfigService) ─

  /** Active AI provider name ('openai' | 'claude' | 'gemini'). */
  getActiveProvider(): string | undefined {
    return (this.get('active_provider') ?? this.get('provider')) as string | undefined;
  }

  /** Switch the active provider — persists immediately. */
  setActiveProvider(name: string): void {
    this.set('active_provider', name);
  }

  /**
   * Register or update a provider entry.
   * Pass the raw API key — `conf` stores it encrypted (AES-256) at rest.
   * The `api_key_encrypted` field name reflects what is stored on disk,
   * not that callers are expected to pre-encrypt the value.
   */
  addProvider(name: string, apiKey: string, model: string): void {
    const providers: Record<string, ProviderConfig> = this.get('providers') ?? {};
    providers[name] = {
      model,
      api_key_encrypted: apiKey,
      configured_date: new Date().toISOString().split('T')[0],
    };
    this.set('providers', providers);
  }

  /** Per-provider config (model + encrypted key) for the named provider. */
  getProviderConfig(name: string): ProviderConfig | undefined {
    const providers = this.get('providers') ?? {};
    return providers[name];
  }

  /** Absolute path to the user's Obsidian workspace. */
  getWorkspacePath(): string | undefined {
    return this.get('workspace_path') as string | undefined;
  }

  /** AI routing confidence threshold. Defaults to 0.75 per architecture. */
  getConfidenceThreshold(): number {
    const stored = this.get('confidence_threshold');
    return typeof stored === 'number' ? stored : CONFIG_DEFAULTS.confidence_threshold;
  }
}

export const configService = new ConfigService();
