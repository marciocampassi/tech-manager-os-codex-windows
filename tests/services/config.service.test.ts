import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Must mock before dynamic import so the module loads with the mock in place
jest.unstable_mockModule('conf', () => ({
  default: jest.fn().mockImplementation(() => {
    // Fresh Map per Conf instance — each new ConfigService() gets isolated state
    const store = new Map<string, unknown>();
    return {
      get: (key: string) => store.get(key),
      set: (key: string, value: unknown) => {
        store.set(key, value);
      },
      has: (key: string) => store.has(key),
      delete: (key: string) => {
        store.delete(key);
      },
    };
  }),
}));

jest.unstable_mockModule('dotenv', () => ({
  default: { config: jest.fn() },
}));

const { ConfigService } = await import('../../src/services/config.service.js');
const { default: dotenv } = await import('dotenv');

let service: InstanceType<typeof ConfigService>;

beforeEach(() => {
  service = new ConfigService();
});

afterEach(() => {
  delete process.env['TM_PROVIDER'];
  delete process.env['TM_API_KEY'];
});

describe('ConfigService — storage (AC: 1, 3)', () => {
  it('set + get round-trip returns the stored value for provider', () => {
    service.set('provider', 'openai');
    expect(service.get('provider')).toBe('openai');
  });

  it('set + get round-trip returns the stored value for apiKey', () => {
    service.set('apiKey', 'sk-test-abcd-1234');
    expect(service.get('apiKey')).toBe('sk-test-abcd-1234');
  });

  it('get returns undefined for a key that was never set', () => {
    expect(service.get('provider')).toBeUndefined();
  });

  it('has returns false before set', () => {
    expect(service.has('provider')).toBe(false);
  });

  it('has returns true after set', () => {
    service.set('provider', 'anthropic');
    expect(service.has('provider')).toBe(true);
  });

  it('delete removes the stored value', () => {
    service.set('apiKey', 'sk-test-1234');
    service.delete('apiKey');
    expect(service.get('apiKey')).toBeUndefined();
    expect(service.has('apiKey')).toBe(false);
  });
});

describe('ConfigService — environment variable precedence (AC: 5)', () => {
  it('get("provider") returns TM_PROVIDER env var over stored value', () => {
    service.set('provider', 'openai');
    process.env['TM_PROVIDER'] = 'anthropic';
    expect(service.get('provider')).toBe('anthropic');
  });

  it('get("apiKey") returns TM_API_KEY env var over stored value', () => {
    service.set('apiKey', 'stored-key');
    process.env['TM_API_KEY'] = 'env-key';
    expect(service.get('apiKey')).toBe('env-key');
  });

  it('get falls back to conf store when env var is not set', () => {
    service.set('provider', 'gemini');
    expect(service.get('provider')).toBe('gemini');
  });

  it('has returns true when env var is set even if conf store is empty', () => {
    process.env['TM_PROVIDER'] = 'openai';
    expect(service.has('provider')).toBe(true);
  });
});

describe('ConfigService — initialize (AC: 1)', () => {
  it('initialize() calls dotenv.config()', () => {
    service.initialize();
    expect(dotenv.config).toHaveBeenCalled();
  });
});

describe('ConfigService — getRedacted (AC: 4)', () => {
  it('returns masked value for a stored apiKey', () => {
    service.set('apiKey', 'sk-test-ABCD');
    const result = service.getRedacted('apiKey');
    expect(result).toBe('********ABCD');
    expect(result).not.toContain('sk-test');
  });

  it('returns (not set) when key has no value', () => {
    expect(service.getRedacted('apiKey')).toBe('(not set)');
  });

  it('returns masked env var value when env var is set', () => {
    process.env['TM_API_KEY'] = 'env-secret-ZZZZ';
    const result = service.getRedacted('apiKey');
    expect(result.endsWith('ZZZZ')).toBe(true);
    expect(result).not.toContain('env-secret');
  });
});

// ─── High-level domain API ────────────────────────────────────────────────────

describe('ConfigService — getActiveProvider / setActiveProvider', () => {
  it('getActiveProvider returns undefined when nothing configured', () => {
    expect(service.getActiveProvider()).toBeUndefined();
  });

  it('setActiveProvider + getActiveProvider round-trips correctly', () => {
    service.setActiveProvider('claude');
    expect(service.getActiveProvider()).toBe('claude');
  });

  it('getActiveProvider falls back to legacy provider key', () => {
    service.set('provider', 'openai');
    expect(service.getActiveProvider()).toBe('openai');
  });

  it('active_provider takes precedence over legacy provider', () => {
    service.set('provider', 'openai');
    service.setActiveProvider('claude');
    expect(service.getActiveProvider()).toBe('claude');
  });
});

describe('ConfigService — addProvider / getProviderConfig', () => {
  it('getProviderConfig returns undefined for unconfigured provider', () => {
    expect(service.getProviderConfig('openai')).toBeUndefined();
  });

  it('addProvider stores and getProviderConfig retrieves provider config', () => {
    service.addProvider('claude', 'sk-ant-raw-key', 'claude-3-5-sonnet-20241022');
    const cfg = service.getProviderConfig('claude');
    expect(cfg).toMatchObject({
      model: 'claude-3-5-sonnet-20241022',
      api_key_encrypted: 'sk-ant-raw-key', // conf encrypts at rest; field name reflects stored state
    });
  });

  it('addProvider stores configured_date as ISO date string', () => {
    service.addProvider('openai', 'sk-raw-key', 'gpt-4o');
    const cfg = service.getProviderConfig('openai');
    expect(cfg?.configured_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('addProvider supports multiple providers independently', () => {
    service.addProvider('openai', 'sk-openai', 'gpt-4o');
    service.addProvider('claude', 'sk-claude', 'claude-3-5-sonnet-20241022');
    expect(service.getProviderConfig('openai')?.model).toBe('gpt-4o');
    expect(service.getProviderConfig('claude')?.model).toBe('claude-3-5-sonnet-20241022');
  });
});

describe('ConfigService — getWorkspacePath', () => {
  it('returns undefined when workspace_path not set', () => {
    expect(service.getWorkspacePath()).toBeUndefined();
  });

  it('returns the stored workspace path', () => {
    service.set('workspace_path', '/Users/me/Obsidian');
    expect(service.getWorkspacePath()).toBe('/Users/me/Obsidian');
  });
});

describe('ConfigService — setWorkspacePath', () => {
  it('persists the workspace path so getWorkspacePath returns it', () => {
    service.setWorkspacePath('/Users/me/my-vault');
    expect(service.getWorkspacePath()).toBe('/Users/me/my-vault');
  });

  it('overwrites a previously set workspace path', () => {
    service.setWorkspacePath('/Users/me/old-vault');
    service.setWorkspacePath('/Users/me/new-vault');
    expect(service.getWorkspacePath()).toBe('/Users/me/new-vault');
  });
});

describe('ConfigService — getConfidenceThreshold', () => {
  it('returns default threshold (0.75) when not configured', () => {
    expect(service.getConfidenceThreshold()).toBe(0.75);
  });

  it('returns stored threshold when set', () => {
    service.set('confidence_threshold', 0.9);
    expect(service.getConfidenceThreshold()).toBe(0.9);
  });
});
