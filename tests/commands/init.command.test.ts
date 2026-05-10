import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// ── Mock declarations (must precede dynamic imports) ──────────────────────────

const mockPrompt = jest.fn<() => Promise<Record<string, unknown>>>();

jest.unstable_mockModule('inquirer', () => ({
  default: { prompt: mockPrompt },
}));

function makeBold(s: string): string {
  return s;
}
makeBold.cyan = (s: string) => s;
makeBold.green = (s: string) => s;

jest.unstable_mockModule('chalk', () => ({
  default: {
    bold: makeBold,
    gray: (s: string) => s,
    dim: (s: string) => s,
    cyan: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    blue: (s: string) => s,
  },
}));

jest.unstable_mockModule('boxen', () => ({
  default: jest.fn((_content: string) => '[boxen]'),
}));

const mockSucceed = jest.fn();
const mockFail = jest.fn();
const mockWarn = jest.fn();
const mockStart = jest.fn(() => ({
  succeed: mockSucceed,
  fail: mockFail,
  warn: mockWarn,
}));
const mockOra = jest.fn(() => ({ start: mockStart }));

jest.unstable_mockModule('ora', () => ({
  default: mockOra,
}));

const mockCreateDirectory = jest.fn<() => Promise<void>>();
const mockWriteFile = jest.fn<(path: string, content: string) => Promise<void>>();
const mockFsExists = jest.fn<(path: string) => Promise<boolean>>();
const mockReadFile = jest.fn<(path: string) => Promise<string>>();
const mockAppendFile = jest.fn<(path: string, content: string) => Promise<void>>();
const mockListDirectories = jest.fn<(path: string) => Promise<string[]>>();

jest.unstable_mockModule('../../src/services/file-system.service.js', () => ({
  fileSystemService: {
    createDirectory: mockCreateDirectory,
    writeFile: mockWriteFile,
    exists: mockFsExists,
    readFile: mockReadFile,
    appendFile: mockAppendFile,
    listDirectories: mockListDirectories,
  },
}));

const mockInstallPlugins = jest.fn<(workspacePath: string) => Promise<void>>();

jest.unstable_mockModule('../../src/services/obsidian-plugin.service.js', () => ({
  obsidianPluginService: { installPlugins: mockInstallPlugins },
}));

const mockConfigInitialize = jest.fn<() => void>();
const mockSetWorkspacePath = jest.fn<(p: string) => void>();

jest.unstable_mockModule('../../src/services/config.service.js', () => ({
  configService: {
    initialize: mockConfigInitialize,
    setWorkspacePath: mockSetWorkspacePath,
  },
}));

jest.unstable_mockModule('../../src/services/skill-registry.service.js', () => ({
  SkillRegistryService: jest.fn().mockImplementation(() => ({
    fetchSkillContent: jest
      .fn<() => Promise<{ success: true; data: { content: string; version: string } }>>()
      .mockResolvedValue({ success: true, data: { content: '# skill', version: '1.0.0' } }),
    installSkill: jest.fn<() => void>(),
  })),
}));

// ── Dynamic import (after all mocks) ─────────────────────────────────────────

const { InitCommand } = await import('../../src/commands/init.command.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Standard happy-path prompt sequence (Story 2.3): 10 calls total. */
function setupMinimalHappyPath(): void {
  mockPrompt
    // 1. promptWorkspacePath
    .mockResolvedValueOnce({ workspacePath: '/tmp/test-workspace' })
    // 2. promptMinimalOnboarding
    .mockResolvedValueOnce({
      name: 'Alice Example',
      email: 'alice@example.com',
      role: 'Engineering Manager',
      company: 'example.com',
    })
    // 3. promptLeaderDetails
    .mockResolvedValueOnce({
      name: 'Bob Director',
      email: 'bob@example.com',
      role: 'Engineering Director',
    })
    // 4. promptTeamCount
    .mockResolvedValueOnce({ teamCount: '2' })
    // 5. promptTeamName(1)
    .mockResolvedValueOnce({ teamName: 'Backend Team' })
    // 6. promptTeamName(2)
    .mockResolvedValueOnce({ teamName: 'Frontend Team' })
    // 7. promptMemberEmail(Backend Team) — one member
    .mockResolvedValueOnce({ memberEmail: 'member@example.com' })
    // 8. promptMemberDetails()
    .mockResolvedValueOnce({ name: 'Test Member', role: 'Engineer', gender: '', location: '' })
    // 9. promptMemberEmail(Backend Team) — end loop
    .mockResolvedValueOnce({ memberEmail: '' })
    // 10. promptMemberEmail(Frontend Team) — end loop
    .mockResolvedValueOnce({ memberEmail: '' });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('InitCommand', () => {
  let stdoutSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateDirectory.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockFsExists.mockResolvedValue(false);
    mockReadFile.mockResolvedValue('# Team Members\n');
    mockAppendFile.mockResolvedValue(undefined);
    mockListDirectories.mockResolvedValue([]);
    mockInstallPlugins.mockResolvedValue(undefined);
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  describe('welcome banner', () => {
    it('writes a non-empty banner to stdout on run()', async () => {
      setupMinimalHappyPath();
      await new InitCommand().run();
      expect(stdoutSpy).toHaveBeenCalled();
      const firstCall = stdoutSpy.mock.calls[0]?.[0] as string;
      expect(typeof firstCall).toBe('string');
      expect(firstCall.length).toBeGreaterThan(0);
    });

    it('plain mode: banner writes "Tech Manager OS" to stdout directly', () => {
      const cmd = new InitCommand('1.2.3', true);
      cmd.displayWelcomeBanner();
      const allOutput = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(allOutput).toContain('Tech Manager OS');
    });

    it('plain mode: banner includes version string', () => {
      const cmd = new InitCommand('2.5.0', true);
      cmd.displayWelcomeBanner();
      const allOutput = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(allOutput).toContain('2.5.0');
    });

    it('plain mode: no boxen output (uses plain text instead)', () => {
      const cmd = new InitCommand('1.0.0', true);
      cmd.displayWelcomeBanner();
      const allOutput = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      // In plain mode boxen is not called — '[boxen]' should not appear
      expect(allOutput).not.toContain('[boxen]');
    });

    it('color mode: uses boxen (output contains [boxen] from mock)', () => {
      const cmd = new InitCommand('1.0.0', false);
      cmd.displayWelcomeBanner();
      const allOutput = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      // The mock returns '[boxen]' — verify boxen was called
      expect(allOutput).toContain('[boxen]');
    });
  });

  describe('happy path', () => {
    it('persists the workspace path to config so other commands use the correct vault', async () => {
      setupMinimalHappyPath();
      await new InitCommand().run();
      expect(mockConfigInitialize).toHaveBeenCalledTimes(1);
      expect(mockSetWorkspacePath).toHaveBeenCalledWith('/tmp/test-workspace');
    });

    it('calls obsidianPluginService.installPlugins with the workspace path', async () => {
      setupMinimalHappyPath();
      await new InitCommand().run();
      expect(mockInstallPlugins).toHaveBeenCalledWith('/tmp/test-workspace');
    });

    it('writes CLAUDE.md at the workspace root', async () => {
      setupMinimalHappyPath();
      await new InitCommand().run();
      const writtenPaths = (mockWriteFile.mock.calls as [string, string][]).map((c) => c[0]);
      expect(writtenPaths.some((p) => p.endsWith('CLAUDE.md'))).toBe(true);
    });

    it('CLAUDE.md content contains the user email and role', async () => {
      setupMinimalHappyPath();
      await new InitCommand().run();
      // scaffold() writes a stub first; InitCommand overwrites with user data — check last write
      const claudeWrites = (mockWriteFile.mock.calls as [string, string][]).filter(([p]) =>
        p.endsWith('CLAUDE.md'),
      );
      const claudeCall = claudeWrites[claudeWrites.length - 1];
      expect(claudeCall).toBeDefined();
      expect(claudeCall[1]).toContain('alice@example.com');
      expect(claudeCall[1]).toContain('Engineering Manager');
    });

    it('CLAUDE.md content contains the company field', async () => {
      setupMinimalHappyPath();
      await new InitCommand().run();
      const claudeWrites = (mockWriteFile.mock.calls as [string, string][]).filter(([p]) =>
        p.endsWith('CLAUDE.md'),
      );
      const claudeCall = claudeWrites[claudeWrites.length - 1];
      expect(claudeCall).toBeDefined();
      expect(claudeCall[1]).toContain('example.com');
    });

    it('writes my-tasks/tasks.md', async () => {
      setupMinimalHappyPath();
      await new InitCommand().run();
      const writtenPaths = (mockWriteFile.mock.calls as [string, string][]).map((c) => c[0]);
      expect(writtenPaths.some((p) => p.includes('my-tasks/tasks.md'))).toBe(true);
    });

    it('writes all 4 period task files', async () => {
      setupMinimalHappyPath();
      await new InitCommand().run();
      const writtenPaths = (mockWriteFile.mock.calls as [string, string][]).map((c) => c[0]);
      expect(writtenPaths.some((p) => p.includes('my-tasks/today.md'))).toBe(true);
      expect(writtenPaths.some((p) => p.includes('my-tasks/this-week.md'))).toBe(true);
      expect(writtenPaths.some((p) => p.includes('my-tasks/this-month.md'))).toBe(true);
      expect(writtenPaths.some((p) => p.includes('my-tasks/this-quarter.md'))).toBe(true);
    });

    it('does not collect API keys — no AIProviderFactory calls', async () => {
      setupMinimalHappyPath();
      await new InitCommand().run();
      // 10 prompt calls: workspace + onboarding + leader + teamCount + 2 names + 4 member prompts.
      // No extra API key prompts are made.
      expect(mockPrompt).toHaveBeenCalledTimes(10);
    });
  });

  describe('next steps', () => {
    it('stdout contains tmr config in next steps', async () => {
      setupMinimalHappyPath();
      await new InitCommand().run();
      const allOutput = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(allOutput).toContain('tmr config');
    });

    it('stdout contains /tmr-inbox in next steps', async () => {
      setupMinimalHappyPath();
      await new InitCommand().run();
      const allOutput = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(allOutput).toContain('/tmr-inbox');
    });

    it('stdout contains workspace path in next steps', async () => {
      setupMinimalHappyPath();
      await new InitCommand().run();
      const allOutput = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(allOutput).toContain('/tmp/test-workspace');
    });
  });

  describe('idempotent task files', () => {
    it('skips writing tasks.md when it already exists', async () => {
      mockFsExists.mockImplementation(async (p: string) => p.includes('tasks.md'));
      setupMinimalHappyPath();
      await new InitCommand().run();
      const writtenPaths = (mockWriteFile.mock.calls as [string, string][]).map((c) => c[0]);
      expect(writtenPaths.filter((p) => p.endsWith('tasks.md'))).toHaveLength(0);
    });

    it('skips writing period files when they already exist', async () => {
      mockFsExists.mockImplementation(async (p: string) => p.includes('my-tasks/'));
      setupMinimalHappyPath();
      await new InitCommand().run();
      const writtenPaths = (mockWriteFile.mock.calls as [string, string][]).map((c) => c[0]);
      const taskPeriodWrites = writtenPaths.filter(
        (p) =>
          p.includes('today.md') ||
          p.includes('this-week.md') ||
          p.includes('this-month.md') ||
          p.includes('this-quarter.md') ||
          p.endsWith('tasks.md'),
      );
      expect(taskPeriodWrites).toHaveLength(0);
    });
  });

  describe('user profile written (AC: 1)', () => {
    it('writes my-career/<email>/<email>.md', async () => {
      setupMinimalHappyPath();
      await new InitCommand().run();
      const writtenPaths = (mockWriteFile.mock.calls as [string, string][]).map((c) => c[0]);
      expect(writtenPaths.some((p) => p.includes('my-career/alice@example.com'))).toBe(true);
    });
  });

  describe('leader profile written (AC: 2)', () => {
    it('writes my-leadership/<email>/<email>.md', async () => {
      setupMinimalHappyPath();
      await new InitCommand().run();
      const writtenPaths = (mockWriteFile.mock.calls as [string, string][]).map((c) => c[0]);
      expect(writtenPaths.some((p) => p.includes('my-leadership/bob@example.com'))).toBe(true);
    });
  });

  describe('member files written (AC: 1)', () => {
    it('writes member profile at my-teams/members/<email>/<email>.md', async () => {
      setupMinimalHappyPath();
      await new InitCommand().run();
      const writtenPaths = (mockWriteFile.mock.calls as [string, string][]).map((c) => c[0]);
      expect(writtenPaths.some((p) => p.includes('my-teams/members/member@example.com'))).toBe(
        true,
      );
    });
  });

  describe('scaffold error handling', () => {
    /** Sets up the full 10-call prompt sequence then injects a scaffold failure. */
    function setupScaffoldFailure(): void {
      mockCreateDirectory.mockRejectedValueOnce(new Error('disk full'));
      mockPrompt
        .mockResolvedValueOnce({ workspacePath: '/tmp/test-workspace' })
        .mockResolvedValueOnce({
          name: 'Alice Example',
          email: 'alice@example.com',
          role: 'Engineering Manager',
          company: 'example.com',
        })
        .mockResolvedValueOnce({
          name: 'Bob Director',
          email: 'bob@example.com',
          role: 'Engineering Director',
        })
        .mockResolvedValueOnce({ teamCount: '2' })
        .mockResolvedValueOnce({ teamName: 'Backend Team' })
        .mockResolvedValueOnce({ teamName: 'Frontend Team' })
        // member collection for both teams (empty → no members)
        .mockResolvedValueOnce({ memberEmail: '' })
        .mockResolvedValueOnce({ memberEmail: '' });
    }

    it('calls printError and exits gracefully when scaffold fails (AC9)', async () => {
      const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
      setupScaffoldFailure();

      await new InitCommand().run();

      const stderrOutput = (stderrSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(stderrOutput).toContain('disk full');
      stderrSpy.mockRestore();
    });

    it('does not propagate the error to the caller when scaffold fails', async () => {
      jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
      setupScaffoldFailure();

      await expect(new InitCommand().run()).resolves.not.toThrow();
      jest.restoreAllMocks();
    });
  });
});
