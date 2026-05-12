import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { homedir } from 'node:os';
import { join } from 'node:path';

// ── Mock declarations ─────────────────────────────────────────────────────────

const mockExistsSync = jest.fn<(p: string) => boolean>(() => false);
const mockReadFileSync = jest.fn<(p: string, enc: string) => string>();
const mockReaddirSync = jest.fn<(p: string) => string[]>(() => []);
jest.unstable_mockModule('node:fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  readdirSync: mockReaddirSync,
}));

const mockGetWorkspacePath = jest.fn<() => string | undefined>(() => undefined);
jest.unstable_mockModule('../../src/services/config.service.js', () => ({
  configService: { getWorkspacePath: mockGetWorkspacePath },
}));

const mockWhich = jest.fn<(cmd: string, opts?: { nothrow: boolean }) => Promise<string | null>>(
  () => Promise.resolve(null),
);
jest.unstable_mockModule('which', () => ({ default: mockWhich }));

// ── Dynamic imports (after mocks) ─────────────────────────────────────────────

const { DoctorService } = await import('../../src/services/doctor.service.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

const ORIGINAL_PLATFORM = process.platform;
const ORIGINAL_VERSION = process.version;

function setPlatform(p: string): void {
  Object.defineProperty(process, 'platform', { value: p, configurable: true });
}

function setNodeVersion(v: string): void {
  Object.defineProperty(process, 'version', { value: v, configurable: true });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DoctorService', () => {
  let service: InstanceType<typeof DoctorService>;

  beforeEach(() => {
    jest.clearAllMocks();
    setPlatform('darwin');
    setNodeVersion('v20.12.0');
    mockGetWorkspacePath.mockReturnValue(undefined);
    mockExistsSync.mockReturnValue(false);
    mockWhich.mockResolvedValue(null);
    service = new DoctorService('1.0.0');
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: ORIGINAL_PLATFORM, configurable: true });
    Object.defineProperty(process, 'version', { value: ORIGINAL_VERSION, configurable: true });
  });

  // ── Node.js check ────────────────────────────────────────────────────────────

  describe('Node.js check', () => {
    it('passes when major version is exactly 18', async () => {
      setNodeVersion('v18.0.0');
      const results = await service.runChecks();
      const check = results.find((r) => r.key === 'nodejs')!;
      expect(check.ok).toBe(true);
      // P5: value is clean version string only; annotation added by command display layer
      expect(check.value).toBe('v18.0.0');
      expect(check.value).not.toContain('required');
    });

    it('passes when major version is 20', async () => {
      setNodeVersion('v20.12.0');
      const results = await service.runChecks();
      const check = results.find((r) => r.key === 'nodejs')!;
      expect(check.ok).toBe(true);
      expect(check.value).toBe('v20.12.0');
    });

    it('fails when major version is below 18', async () => {
      setNodeVersion('v16.14.0');
      const results = await service.runChecks();
      const check = results.find((r) => r.key === 'nodejs')!;
      expect(check.ok).toBe(false);
      expect(check.fix).toBeDefined();
    });
  });

  // ── tmr check ────────────────────────────────────────────────────────────────

  describe('tmr check', () => {
    it('always passes and returns injected version string', async () => {
      const results = await service.runChecks();
      const check = results.find((r) => r.key === 'tmr')!;
      expect(check.ok).toBe(true);
      expect(check.value).toBe('v1.0.0');
    });
  });

  // ── Vault check ──────────────────────────────────────────────────────────────

  describe('Vault check', () => {
    it('fails when workspace path is undefined', async () => {
      mockGetWorkspacePath.mockReturnValue(undefined);
      const results = await service.runChecks();
      const check = results.find((r) => r.key === 'vault')!;
      expect(check.ok).toBe(false);
      expect(check.detail).toContain('not configured');
      expect(check.fix).toBe('tmr init');
    });

    it('fails when workspace path does not exist on disk', async () => {
      mockGetWorkspacePath.mockReturnValue('/some/missing/path');
      mockExistsSync.mockImplementation((p) => p !== '/some/missing/path');
      const results = await service.runChecks();
      const check = results.find((r) => r.key === 'vault')!;
      expect(check.ok).toBe(false);
    });

    it('passes when workspace path exists on disk', async () => {
      mockGetWorkspacePath.mockReturnValue('/users/marlon/vault');
      mockExistsSync.mockImplementation((p) => p === '/users/marlon/vault');
      const results = await service.runChecks();
      const check = results.find((r) => r.key === 'vault')!;
      expect(check.ok).toBe(true);
      expect(check.value).toBe('/users/marlon/vault');
    });
  });

  // ── Obsidian check ───────────────────────────────────────────────────────────

  describe('Obsidian check', () => {
    it('passes on macOS when system-wide app bundle exists', async () => {
      setPlatform('darwin');
      mockExistsSync.mockImplementation((p) => p === '/Applications/Obsidian.app');
      const results = await service.runChecks();
      const check = results.find((r) => r.key === 'obsidian')!;
      expect(check.ok).toBe(true);
      expect(check.value).toBe('installed');
    });

    it('passes on macOS when per-user ~/Applications bundle exists (P7)', async () => {
      setPlatform('darwin');
      const userApp = join(homedir(), 'Applications', 'Obsidian.app');
      mockExistsSync.mockImplementation((p) => p === userApp);
      const results = await service.runChecks();
      const check = results.find((r) => r.key === 'obsidian')!;
      expect(check.ok).toBe(true);
    });

    it('fails on macOS when app bundle is absent and suggests brew cask', async () => {
      setPlatform('darwin');
      mockExistsSync.mockReturnValue(false);
      const results = await service.runChecks();
      const check = results.find((r) => r.key === 'obsidian')!;
      expect(check.ok).toBe(false);
      expect(check.fix).toContain('brew install --cask obsidian');
    });

    it('passes on Windows when which resolves', async () => {
      setPlatform('win32');
      mockWhich.mockImplementation((cmd) =>
        cmd === 'Obsidian' ? Promise.resolve('/path/to/obsidian') : Promise.resolve(null),
      );
      const results = await service.runChecks();
      const check = results.find((r) => r.key === 'obsidian')!;
      expect(check.ok).toBe(true);
    });

    it('fails on Windows when which returns null and suggests winget', async () => {
      setPlatform('win32');
      mockWhich.mockResolvedValue(null);
      const results = await service.runChecks();
      const check = results.find((r) => r.key === 'obsidian')!;
      expect(check.ok).toBe(false);
      expect(check.fix).toContain('winget install Obsidian.Obsidian');
    });

    it('fails on Linux when not in PATH and suggests snap', async () => {
      setPlatform('linux');
      mockWhich.mockResolvedValue(null);
      const results = await service.runChecks();
      const check = results.find((r) => r.key === 'obsidian')!;
      expect(check.ok).toBe(false);
      expect(check.fix).toContain('snap install obsidian');
    });
  });

  // ── Granola check ────────────────────────────────────────────────────────────

  describe('Granola check', () => {
    it('returns info (not warning) on Linux — does not contribute to exit code', async () => {
      setPlatform('linux');
      const results = await service.runChecks();
      const check = results.find((r) => r.key === 'granola')!;
      expect(check.ok).toBe(false);
      expect(check.info).toBe(true);
      expect(check.detail).toContain('not available on Linux');
    });

    it('returns info (not warning) on unknown platforms (P6)', async () => {
      setPlatform('freebsd');
      const results = await service.runChecks();
      const check = results.find((r) => r.key === 'granola')!;
      expect(check.ok).toBe(false);
      expect(check.info).toBe(true);
      expect(check.detail).toContain('not available on this platform');
    });

    it('passes on macOS when system-wide app bundle exists', async () => {
      setPlatform('darwin');
      mockExistsSync.mockImplementation((p) => p === '/Applications/Granola.app');
      const results = await service.runChecks();
      const check = results.find((r) => r.key === 'granola')!;
      expect(check.ok).toBe(true);
      expect(check.value).toBe('installed');
    });

    it('passes on macOS when per-user ~/Applications bundle exists (P7)', async () => {
      setPlatform('darwin');
      const userApp = join(homedir(), 'Applications', 'Granola.app');
      mockExistsSync.mockImplementation((p) => p === userApp);
      const results = await service.runChecks();
      const check = results.find((r) => r.key === 'granola')!;
      expect(check.ok).toBe(true);
    });

    it('fails on macOS when app absent and suggests brew cask', async () => {
      setPlatform('darwin');
      mockExistsSync.mockReturnValue(false);
      const results = await service.runChecks();
      const check = results.find((r) => r.key === 'granola')!;
      expect(check.ok).toBe(false);
      expect(check.info).toBeFalsy();
      expect(check.fix).toContain('brew install --cask granola');
    });
  });

  // ── Google Drive check ───────────────────────────────────────────────────────

  describe('Google Drive check', () => {
    it('returns info on Linux', async () => {
      setPlatform('linux');
      const results = await service.runChecks();
      const check = results.find((r) => r.key === 'google_drive')!;
      expect(check.ok).toBe(false);
      expect(check.info).toBe(true);
    });

    it('returns info (not warning) on unknown platforms (P6)', async () => {
      setPlatform('freebsd');
      const results = await service.runChecks();
      const check = results.find((r) => r.key === 'google_drive')!;
      expect(check.ok).toBe(false);
      expect(check.info).toBe(true);
      expect(check.detail).toContain('not available on this platform');
    });

    it('passes on macOS when app bundle exists', async () => {
      setPlatform('darwin');
      mockExistsSync.mockImplementation((p) => p === '/Applications/Google Drive.app');
      const results = await service.runChecks();
      const check = results.find((r) => r.key === 'google_drive')!;
      expect(check.ok).toBe(true);
      expect(check.value).toBe('detected');
    });

    it('passes on macOS when CloudStorage GoogleDrive folder exists', async () => {
      setPlatform('darwin');
      const cloudDir = `${process.env.HOME ?? '/Users/test'}/Library/CloudStorage`;
      mockExistsSync.mockImplementation((p) => p === cloudDir);
      mockReaddirSync.mockReturnValue(['GoogleDrive-test@example.com']);
      const results = await service.runChecks();
      const check = results.find((r) => r.key === 'google_drive')!;
      expect(check.ok).toBe(true);
    });

    it('fails on macOS when neither app nor CloudStorage found', async () => {
      setPlatform('darwin');
      mockExistsSync.mockReturnValue(false);
      const results = await service.runChecks();
      const check = results.find((r) => r.key === 'google_drive')!;
      expect(check.ok).toBe(false);
      expect(check.fix).toContain('brew install --cask google-drive');
    });
  });

  // ── Granola Sync check ───────────────────────────────────────────────────────

  describe('Granola Sync check', () => {
    const VAULT = '/users/marlon/vault';
    const CONFIG_PATH = `${VAULT}/.obsidian/plugins/granola-sync/data.json`;

    beforeEach(() => {
      mockGetWorkspacePath.mockReturnValue(VAULT);
    });

    it('returns info (not warning) on Linux — Granola not applicable (P1)', async () => {
      setPlatform('linux');
      const results = await service.runChecks();
      const check = results.find((r) => r.key === 'granola_sync')!;
      expect(check.ok).toBe(false);
      expect(check.info).toBe(true);
      expect(check.detail).toContain('not applicable on Linux');
    });

    it('skips check when vault is not configured', async () => {
      mockGetWorkspacePath.mockReturnValue(undefined);
      const results = await service.runChecks();
      const check = results.find((r) => r.key === 'granola_sync')!;
      expect(check.ok).toBe(false);
      expect(check.detail).toContain('vault not configured');
    });

    it('fails when config file does not exist — detail includes remediation (P3+P4)', async () => {
      mockExistsSync.mockImplementation((p) => p === VAULT);
      const results = await service.runChecks();
      const check = results.find((r) => r.key === 'granola_sync')!;
      expect(check.ok).toBe(false);
      // P3: detail must say "missing or misconfigured"; P4: fix embedded in detail, no fix field
      expect(check.detail).toContain('plugin config missing or misconfigured');
      expect(check.detail).toContain('re-run tmr init to repair');
      expect(check.fix).toBeUndefined();
    });

    it('fails when customBaseFolder is not "inbox" — detail includes remediation (P3+P4)', async () => {
      mockExistsSync.mockImplementation((p) => p === VAULT || p === CONFIG_PATH);
      mockReadFileSync.mockReturnValue(JSON.stringify({ customBaseFolder: 'notes' }));
      const results = await service.runChecks();
      const check = results.find((r) => r.key === 'granola_sync')!;
      expect(check.ok).toBe(false);
      expect(check.detail).toContain('plugin config missing or misconfigured');
      expect(check.detail).toContain('re-run tmr init to repair');
      expect(check.fix).toBeUndefined();
    });

    it('passes when customBaseFolder is "inbox"', async () => {
      mockExistsSync.mockImplementation((p) => p === VAULT || p === CONFIG_PATH);
      mockReadFileSync.mockReturnValue(JSON.stringify({ customBaseFolder: 'inbox' }));
      const results = await service.runChecks();
      const check = results.find((r) => r.key === 'granola_sync')!;
      expect(check.ok).toBe(true);
      expect(check.value).toContain('inbox/');
    });

    it('fails gracefully when config file is malformed JSON — detail includes remediation (P4)', async () => {
      mockExistsSync.mockImplementation((p) => p === VAULT || p === CONFIG_PATH);
      mockReadFileSync.mockReturnValue('{ invalid json ');
      const results = await service.runChecks();
      const check = results.find((r) => r.key === 'granola_sync')!;
      expect(check.ok).toBe(false);
      expect(check.detail).toContain('re-run tmr init to repair');
      expect(check.fix).toBeUndefined();
    });
  });

  // ── runChecks ordering ───────────────────────────────────────────────────────

  describe('runChecks', () => {
    it('returns 7 checks in expected order', async () => {
      const results = await service.runChecks();
      expect(results.map((r) => r.key)).toEqual([
        'nodejs',
        'tmr',
        'vault',
        'obsidian',
        'granola',
        'google_drive',
        'granola_sync',
      ]);
    });
  });
});
