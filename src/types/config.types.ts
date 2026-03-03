/**
 * Per-provider configuration record — stored inside `providers` map.
 * Architecture: database-schema.md § Configuration Schema
 */
export interface ProviderConfig {
  model: string;
  /**
   * Raw API key as stored by conf (conf encrypts the whole record with AES-256
   * using the encryptionKey in ConfigService's constructor). The field name
   * reflects its encrypted-at-rest nature, not that callers pre-encrypt it.
   */
  api_key_encrypted?: string;
  configured_date?: string;
}

/**
 * Full application configuration schema.
 * Architecture: database-schema.md § Configuration Schema
 * Stored at platform-specific user-data path (conf library handles XDG / AppData).
 *
 * ARCH NOTE: Architecture specifies active_provider, not provider, as the canonical
 * key name. The `provider` key is retained as a deprecated alias resolved at runtime
 * by ConfigService until all callers are migrated to active_provider.
 */
export interface AppConfig {
  /** Config schema version for future migrations */
  version?: string;
  /** Absolute path to the user's Obsidian workspace */
  workspace_path?: string;
  /** Canonical active provider key: 'openai' | 'claude' | 'gemini' */
  active_provider?: string;
  /** @deprecated Use active_provider. Kept for backward compat with Story 1.3 callers. */
  provider?: string;
  /** @deprecated Use providers[name].api_key_encrypted. Kept for Story 1.3 compat. */
  apiKey?: string;
  /** Confidence threshold for AI routing decisions. Default: 0.75 */
  confidence_threshold?: number;
  /** Whether to write a detailed processing log. Default: false */
  process_log_enabled?: boolean;
  /** Per-provider configuration (keys: 'openai', 'claude', 'gemini') */
  providers?: Record<string, ProviderConfig>;
}

export const CONFIG_KEYS: ReadonlyArray<keyof AppConfig> = [
  'version',
  'workspace_path',
  'active_provider',
  'provider',
  'apiKey',
  'confidence_threshold',
  'process_log_enabled',
  'providers',
];

/** Maps AppConfig keys to their TMR_* environment variable overrides */
export const ENV_MAP: Readonly<Partial<Record<keyof AppConfig, string>>> = {
  active_provider: 'TMR_PROVIDER',
  provider: 'TM_PROVIDER',
  apiKey: 'TM_API_KEY',
};

/** Default values matching architecture specification */
export const CONFIG_DEFAULTS = {
  confidence_threshold: 0.75,
  process_log_enabled: false,
  version: '1.0.0',
} as const;
