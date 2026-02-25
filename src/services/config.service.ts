import Conf from 'conf';
import dotenv from 'dotenv';
import { ENV_MAP } from '../types/config.types.js';
import type { AppConfig } from '../types/config.types.js';
import { redact } from '../utils/redact.js';

export class ConfigService {
  private readonly store: Conf<AppConfig>;

  constructor() {
    this.store = new Conf<AppConfig>({
      projectName: '@marlonvidal/tech-manager-os',
      encryptionKey: 'tm-config-v1',
    });
  }

  initialize(): void {
    dotenv.config();
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.store.set(key, value as AppConfig[K]);
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] | undefined {
    const envVar = ENV_MAP[key];
    const envValue = process.env[envVar];
    if (envValue !== undefined) {
      return envValue as AppConfig[K];
    }
    return this.store.get(key) as AppConfig[K] | undefined;
  }

  has(key: keyof AppConfig): boolean {
    const envVar = ENV_MAP[key];
    if (process.env[envVar] !== undefined) return true;
    return this.store.has(key);
  }

  delete(key: keyof AppConfig): void {
    this.store.delete(key);
  }

  // Returns a display-safe string for logging — masks all but last 4 chars of the value.
  // Always use this when surfacing config values in CLI output or error messages (AC: 4).
  getRedacted(key: keyof AppConfig): string {
    const value = this.get(key);
    if (value === undefined) return '(not set)';
    return redact(value);
  }
}

export const configService = new ConfigService();
