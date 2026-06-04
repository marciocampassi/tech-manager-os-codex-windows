import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import path from 'node:path';

// ── Mock declarations (must precede dynamic imports) ─────────────────────────

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

// Mock node:fs so we can control existsSync without touching the real filesystem
const mockExistsSync = jest.fn<(p: string) => boolean>().mockReturnValue(false);
jest.unstable_mockModule('node:fs', () => ({
  existsSync: mockExistsSync,
}));

// Mock display helpers to capture printError calls and suppress stderr
const mockPrintError = jest.fn<(msg: string, hint?: string) => void>();
jest.unstable_mockModule('../../src/utils/display.js', () => ({
  printError: mockPrintError,
  printSuccess: jest.fn(),
  printInfo: jest.fn(),
  printWarning: jest.fn(),
  printJson: jest.fn(),
  startSpinner: jest
    .fn()
    .mockReturnValue({ succeed: jest.fn(), fail: jest.fn(), warn: jest.fn(), stop: jest.fn() }),
}));

// Top-level await — all modules share the same singleton after mocks are in place.
const { getWorkspaceRoot } = await import('../../src/utils/workspace.js');
const { configService } = await import('../../src/services/config.service.js');

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getWorkspaceRoot', () => {
  let originalExitCode: number | undefined;

  beforeEach(() => {
    jest.restoreAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockPrintError.mockClear();
    originalExitCode = process.exitCode as number | undefined;
    process.exitCode = 0;
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
  });

  // ── Sentinel walk-up ──────────────────────────────────────────────────────

  it('WS-001: returns cwd when .tmr sentinel exists in cwd', () => {
    const cwd = process.cwd();
    mockExistsSync.mockImplementation((p: string) => p === path.join(cwd, '.tmr'));

    expect(getWorkspaceRoot()).toBe(cwd);
    expect(mockPrintError).not.toHaveBeenCalled();
  });

  it('WS-002: returns the parent dir when .tmr exists one level up', () => {
    const cwd = process.cwd();
    const parent = path.dirname(cwd);
    mockExistsSync.mockImplementation((p: string) => p === path.join(parent, '.tmr'));

    expect(getWorkspaceRoot()).toBe(parent);
    expect(mockPrintError).not.toHaveBeenCalled();
  });

  it('WS-003: sentinel takes priority over config-stored path', () => {
    const cwd = process.cwd();
    jest.spyOn(configService, 'getWorkspacePath').mockReturnValue('/configured/workspace');
    mockExistsSync.mockImplementation((p: string) => p === path.join(cwd, '.tmr'));

    expect(getWorkspaceRoot()).toBe(cwd);
  });

  // ── Config fallback ───────────────────────────────────────────────────────

  it('WS-004: returns configured path when no sentinel and CWD equals configured vault', () => {
    jest.spyOn(process, 'cwd').mockReturnValue('/configured/workspace');
    mockExistsSync.mockReturnValue(false);
    jest.spyOn(configService, 'getWorkspacePath').mockReturnValue('/configured/workspace');

    expect(getWorkspaceRoot()).toBe('/configured/workspace');
    expect(mockPrintError).not.toHaveBeenCalled();
  });

  it('WS-004b: returns configured path when no sentinel and CWD is a subdirectory of configured vault', () => {
    jest.spyOn(process, 'cwd').mockReturnValue('/configured/workspace/my-teams');
    mockExistsSync.mockReturnValue(false);
    jest.spyOn(configService, 'getWorkspacePath').mockReturnValue('/configured/workspace');

    expect(getWorkspaceRoot()).toBe('/configured/workspace');
    expect(mockPrintError).not.toHaveBeenCalled();
  });

  it('WS-004c: prints contextual error when no sentinel and CWD is outside the configured vault', () => {
    jest.spyOn(process, 'cwd').mockReturnValue('/projects/vault2');
    mockExistsSync.mockReturnValue(false);
    jest.spyOn(configService, 'getWorkspacePath').mockReturnValue('/configured/workspace');

    const result = getWorkspaceRoot();

    expect(mockPrintError).toHaveBeenCalledWith(
      'No tmr vault found in this directory or any parent.',
      "Your configured vault is at /configured/workspace — cd into it, or run 'tmr init' to create a vault here.",
    );
    expect(process.exitCode).toBe(1);
    expect(result).toBe('/projects/vault2');
  });

  it('WS-004d: does not allow a path that is a prefix of configured vault (without separator) to pass the guard', () => {
    // /configured/workspaceExtra should NOT be treated as inside /configured/workspace
    jest.spyOn(process, 'cwd').mockReturnValue('/configured/workspaceExtra');
    mockExistsSync.mockReturnValue(false);
    jest.spyOn(configService, 'getWorkspacePath').mockReturnValue('/configured/workspace');

    const result = getWorkspaceRoot();

    expect(mockPrintError).toHaveBeenCalledWith(
      'No tmr vault found in this directory or any parent.',
      "Your configured vault is at /configured/workspace — cd into it, or run 'tmr init' to create a vault here.",
    );
    expect(process.exitCode).toBe(1);
    expect(result).toBe('/configured/workspaceExtra');
  });

  // ── No vault found ────────────────────────────────────────────────────────

  it('WS-005: prints error and returns cwd when no sentinel and no config', () => {
    mockExistsSync.mockReturnValue(false);
    jest.spyOn(configService, 'getWorkspacePath').mockReturnValue(undefined);

    const result = getWorkspaceRoot();

    expect(result).toBe(process.cwd());
    expect(mockPrintError).toHaveBeenCalledWith(
      'No tmr vault found in this directory or any parent.',
      "Run 'tmr init' to create one.",
    );
    expect(process.exitCode).toBe(1);
  });
});
