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

type ManifestEntry = { name: string; version: string; installedAt: string };
type SuccessResult = { success: true; data: { content: string; version: string } };
type FailResult = { success: false; error: string };

const mockListInstalledSkills = jest.fn<() => ManifestEntry[]>(() => []);
const mockFetchSkillContent = jest.fn<(n: string) => Promise<SuccessResult | FailResult>>();
const mockInstallSkill = jest.fn<(n: string, c: string, v: string) => void>();
const mockIsInstalled = jest.fn<() => boolean>(() => false);
const mockGetInstalledVersion = jest.fn<() => string | undefined>(() => undefined);

jest.unstable_mockModule('../../src/services/skill-registry.service.js', () => ({
  SkillRegistryService: jest.fn(() => ({
    listInstalledSkills: mockListInstalledSkills,
    fetchSkillContent: mockFetchSkillContent,
    installSkill: mockInstallSkill,
    isInstalled: mockIsInstalled,
    getInstalledVersion: mockGetInstalledVersion,
  })),
}));

// ── Dynamic imports (after mocks) ─────────────────────────────────────────────

const { runUpdate } = await import('../../src/commands/update.command.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

function entry(name: string, version: string): ManifestEntry {
  return { name, version, installedAt: '2026-04-21T00:00:00.000Z' };
}

function ok(version: string): SuccessResult {
  return { success: true, data: { content: `<!-- version: ${version} -->`, version } };
}

function fail(error: string): FailResult {
  return { success: false, error };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('runUpdate', () => {
  let stdoutSpy: ReturnType<typeof jest.spyOn>;
  let stderrSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    jest.clearAllMocks();
    process.exitCode = undefined;
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('Test A: no skills installed — prints helpful message', async () => {
    mockListInstalledSkills.mockReturnValue([]);

    await runUpdate({ plain: true });

    const output = (stdoutSpy.mock.calls as unknown[][]).map((c) => String(c[0])).join('');
    expect(output).toContain('No skills installed');
    expect(output).toContain('tmr install');
    expect(mockInstallSkill).not.toHaveBeenCalled();
  });

  it('Test B: one skill installed, newer version available — updates it', async () => {
    mockListInstalledSkills.mockReturnValue([entry('tmr-inbox', '1.0.0')]);
    mockFetchSkillContent.mockResolvedValue(ok('1.1.0'));

    await runUpdate({ plain: true });

    expect(mockInstallSkill).toHaveBeenCalledWith('tmr-inbox', expect.any(String), '1.1.0');
    const output = (stdoutSpy.mock.calls as unknown[][]).map((c) => String(c[0])).join('');
    expect(output).toContain('updated');
    expect(output).toContain('1.0.0');
    expect(output).toContain('1.1.0');
  });

  it('Test C: one skill installed, already at latest — reports up to date', async () => {
    mockListInstalledSkills.mockReturnValue([entry('tmr-inbox', '1.2.0')]);
    mockFetchSkillContent.mockResolvedValue(ok('1.2.0'));

    await runUpdate({ plain: true });

    expect(mockInstallSkill).not.toHaveBeenCalled();
    const output = (stdoutSpy.mock.calls as unknown[][]).map((c) => String(c[0])).join('');
    expect(output).toContain('already up to date');
    expect(output).toContain('1.2.0');
  });

  it('Test D: fetch fails for one skill — shows error, continues', async () => {
    mockListInstalledSkills.mockReturnValue([
      entry('tmr-inbox', '1.0.0'),
      entry('tmr-other', '2.0.0'),
    ]);
    mockFetchSkillContent
      .mockResolvedValueOnce(fail('Network error: timeout'))
      .mockResolvedValueOnce(ok('2.1.0'));

    await runUpdate({ plain: true });

    const errOutput = (stderrSpy.mock.calls as unknown[][]).map((c) => String(c[0])).join('');
    expect(errOutput).toContain('could not reach registry');
    expect(errOutput).toContain('tmr-inbox');
    expect(mockInstallSkill).toHaveBeenCalledWith('tmr-other', expect.any(String), '2.1.0');
  });
});
