import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ── Mock declarations (must precede dynamic imports) ─────────────────────────
// Mirror the same conf + dotenv stubs used in config.service.test.ts so that
// ConfigService can construct without touching the real filesystem or conf package.

jest.unstable_mockModule('conf', () => ({
  default: jest.fn().mockImplementation(() => {
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

// Top-level await — both modules share the same singleton after mocks are in place.
const { getWorkspaceRoot } = await import('../../src/utils/workspace.js');
const { configService } = await import('../../src/services/config.service.js');

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getWorkspaceRoot', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the configured workspace path when set', () => {
    jest.spyOn(configService, 'getWorkspacePath').mockReturnValue('/configured/workspace');
    expect(getWorkspaceRoot()).toBe('/configured/workspace');
  });

  it('falls back to process.cwd() when workspace path is not configured', () => {
    jest.spyOn(configService, 'getWorkspacePath').mockReturnValue(undefined);
    expect(getWorkspaceRoot()).toBe(process.cwd());
  });
});
