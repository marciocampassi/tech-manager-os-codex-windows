export interface AppConfig {
  provider?: string;
  apiKey?: string;
}

export const CONFIG_KEYS: ReadonlyArray<keyof AppConfig> = ['provider', 'apiKey'];

export const ENV_MAP: Readonly<Record<keyof AppConfig, string>> = {
  provider: 'TM_PROVIDER',
  apiKey: 'TM_API_KEY',
};
