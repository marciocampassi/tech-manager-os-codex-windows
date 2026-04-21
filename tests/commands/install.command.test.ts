import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// ── Mock declarations ─────────────────────────────────────────────────────────

const mockInitialize = jest.fn<() => void>();
jest.unstable_mockModule('../../src/services/config.service.js', () => ({
  configService: { initialize: mockInitialize },
}));

const mockGetWorkspaceRoot = jest.fn<() => string>(() => '/test/vault');
jest.unstable_mockModule('../../src/utils/workspace.js', () => ({
  getWorkspaceRoot: mockGetWorkspaceRoot,
}));

const mockIsInstalled = jest.fn<(n: string) => boolean>(() => false);
const mockGetInstalledVersion = jest.fn<(n: string) => string | undefined>(() => undefined);
const mockFetchSkillContent =
  jest.fn<
    (
      n: string,
    ) => Promise<
      | { success: true; data: { content: string; version: string } }
      | { success: false; error: string }
    >
  >();
const mockInstallSkill = jest.fn<(n: string, c: string, v: string) => void>();
const mockListInstalledSkills = jest.fn<
  () => { name: string; version: string; installedAt: string }[]
>(() => []);

jest.unstable_mockModule('../../src/services/skill-registry.service.js', () => ({
  SkillRegistryService: jest.fn(() => ({
    isInstalled: mockIsInstalled,
    getInstalledVersion: mockGetInstalledVersion,
    fetchSkillContent: mockFetchSkillContent,
    installSkill: mockInstallSkill,
    listInstalledSkills: mockListInstalledSkills,
  })),
}));

// ── Dynamic imports (after mocks) ─────────────────────────────────────────────

const { runInstall } = await import('../../src/commands/install.command.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSuccessResult(version = '1.0.0') {
  return {
    success: true as const,
    data: { content: `<!-- version: ${version} -->\n# Skill`, version },
  };
}

function makeErrorResult(error: string) {
  return { success: false as const, error };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('runInstall', () => {
  let stdoutSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    jest.clearAllMocks();
    process.exitCode = undefined;
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('Test A: install happy path — skill not installed, fetch succeeds', async () => {
    mockIsInstalled.mockReturnValue(false);
    mockGetInstalledVersion.mockReturnValue(undefined);
    mockFetchSkillContent.mockResolvedValue(makeSuccessResult('1.2.0'));

    await runInstall('tmr-inbox', { plain: true, force: false });

    expect(mockInstallSkill).toHaveBeenCalledWith('tmr-inbox', expect.any(String), '1.2.0');
    const output = (stdoutSpy.mock.calls as unknown[][]).map((c) => String(c[0])).join('');
    expect(output).toContain('Installed');
    expect(output).toContain('tmr-inbox');
    expect(output).toContain('1.2.0');
    expect(process.exitCode).toBeUndefined();
  });

  it('Test B: already installed without --force — installSkill NOT called', async () => {
    mockIsInstalled.mockReturnValue(true);
    mockGetInstalledVersion.mockReturnValue('1.0.0');

    await runInstall('tmr-inbox', { plain: true, force: false });

    expect(mockInstallSkill).not.toHaveBeenCalled();
    const output = (stdoutSpy.mock.calls as unknown[][]).map((c) => String(c[0])).join('');
    expect(output).toContain('already installed');
    expect(process.exitCode).toBeUndefined();
  });

  it('Test C: already installed with --force — reinstalls', async () => {
    mockIsInstalled.mockReturnValue(true);
    mockGetInstalledVersion.mockReturnValue('1.0.0');
    mockFetchSkillContent.mockResolvedValue(makeSuccessResult('1.0.0'));

    await runInstall('tmr-inbox', { plain: true, force: true });

    expect(mockInstallSkill).toHaveBeenCalledWith('tmr-inbox', expect.any(String), '1.0.0');
    const output = (stdoutSpy.mock.calls as unknown[][]).map((c) => String(c[0])).join('');
    expect(output).toContain('Installed');
  });

  it('Test D: fetch fails (network error) — exitCode 1', async () => {
    mockIsInstalled.mockReturnValue(false);
    mockGetInstalledVersion.mockReturnValue(undefined);
    mockFetchSkillContent.mockResolvedValue(makeErrorResult('Network error: connection refused'));

    await runInstall('tmr-inbox', { plain: true, force: false });

    expect(mockInstallSkill).not.toHaveBeenCalled();
    const output = (stdoutSpy.mock.calls as unknown[][]).map((c) => String(c[0])).join('');
    expect(output).toContain('Network error');
    expect(process.exitCode).toBe(1);
  });

  it('Test E: skill not found (404) — exitCode 1', async () => {
    mockIsInstalled.mockReturnValue(false);
    mockGetInstalledVersion.mockReturnValue(undefined);
    mockFetchSkillContent.mockResolvedValue(
      makeErrorResult('Skill "unknown-skill" not found in registry'),
    );

    await runInstall('unknown-skill', { plain: true, force: false });

    expect(mockInstallSkill).not.toHaveBeenCalled();
    const output = (stdoutSpy.mock.calls as unknown[][]).map((c) => String(c[0])).join('');
    expect(output).toContain('not found');
    expect(process.exitCode).toBe(1);
  });
});
