import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

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
  delete process.env['TMR_PROVIDER'];
});

describe('ConfigService — storage', () => {
  it('set + get round-trip for active_provider', () => {
    service.set('active_provider', 'openai');
    expect(service.get('active_provider')).toBe('openai');
  });

  it('get returns undefined for a key that was never set', () => {
    expect(service.get('active_provider')).toBeUndefined();
  });

  it('has returns false before set', () => {
    expect(service.has('active_provider')).toBe(false);
  });

  it('has returns true after set', () => {
    service.set('active_provider', 'gemini');
    expect(service.has('active_provider')).toBe(true);
  });

  it('delete removes the stored value', () => {
    service.set('active_provider', 'claude');
    service.delete('active_provider');
    expect(service.get('active_provider')).toBeUndefined();
    expect(service.has('active_provider')).toBe(false);
  });
});

describe('ConfigService — environment variable precedence', () => {
  it('get("active_provider") returns TMR_PROVIDER env var over stored value', () => {
    service.set('active_provider', 'openai');
    process.env['TMR_PROVIDER'] = 'claude';
    expect(service.get('active_provider')).toBe('claude');
  });

  it('get falls back to conf store when env var is not set', () => {
    service.set('active_provider', 'gemini');
    expect(service.get('active_provider')).toBe('gemini');
  });

  it('has returns true when TMR_PROVIDER env var is set even if conf store is empty', () => {
    process.env['TMR_PROVIDER'] = 'openai';
    expect(service.has('active_provider')).toBe(true);
  });
});

describe('ConfigService — initialize', () => {
  it('initialize() calls dotenv.config()', () => {
    service.initialize();
    expect(dotenv.config).toHaveBeenCalled();
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

  it('getActiveProvider reads TMR_PROVIDER env var', () => {
    process.env['TMR_PROVIDER'] = 'gemini';
    expect(service.getActiveProvider()).toBe('gemini');
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

describe('ConfigService — getRedacted', () => {
  it('returns "(not set)" when the key has no value', () => {
    expect(service.getRedacted('workspace_path')).toBe('(not set)');
  });

  it('returns a masked value for a stored string — raw value is not exposed', () => {
    service.set('workspace_path', '/Users/me/vault-ABCD');
    const result = service.getRedacted('workspace_path');
    expect(result.endsWith('ABCD')).toBe(true);
    expect(result).not.toContain('/Users');
  });

  it('masks the env var value when env var overrides the stored key', () => {
    process.env['TMR_PROVIDER'] = 'my-provider-ZZZZ';
    const result = service.getRedacted('active_provider');
    expect(result.endsWith('ZZZZ')).toBe(true);
    expect(result).not.toContain('my-provider');
  });
});

// ─── ARCH-DEBT-001 structural guard ──────────────────────────────────────────

describe('ARCH-DEBT-001 guard — deprecated AppConfig fields removed', () => {
  it('no source file under src/ references AppConfig.provider or AppConfig.apiKey', () => {
    const srcRoot = path.resolve(process.cwd(), 'src');
    const violations: string[] = [];

    function walk(dir: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!entry.name.endsWith('.ts')) continue;
        const content = fs.readFileSync(full, 'utf8');
        if (content.includes('AppConfig.provider') || content.includes('AppConfig.apiKey')) {
          violations.push(path.relative(srcRoot, full));
        }
      }
    }

    walk(srcRoot);
    expect(violations).toEqual([]);
  });
});
