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

jest.unstable_mockModule('../../src/services/file-system.service.js', () => ({
  fileSystemService: {
    createDirectory: mockCreateDirectory,
    writeFile: mockWriteFile,
    exists: mockFsExists,
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

// ── Dynamic import (after all mocks) ─────────────────────────────────────────

const { InitCommand } = await import('../../src/commands/init.command.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Standard happy-path prompt sequence for the new minimal 4-question flow. */
function setupMinimalHappyPath(): void {
  mockPrompt
    // promptWorkspacePath
    .mockResolvedValueOnce({ workspacePath: '/tmp/test-workspace' })
    // promptMinimalOnboarding — all 4 fields in one call
    .mockResolvedValueOnce({
      name: 'Alice Example',
      email: 'alice@example.com',
      role: 'Engineering Manager',
      company: 'example.com',
    });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('InitCommand', () => {
  let stdoutSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateDirectory.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockFsExists.mockResolvedValue(false);
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
      const claudeCall = (mockWriteFile.mock.calls as [string, string][]).find(([p]) =>
        p.endsWith('CLAUDE.md'),
      );
      expect(claudeCall).toBeDefined();
      expect(claudeCall![1]).toContain('alice@example.com');
      expect(claudeCall![1]).toContain('Engineering Manager');
    });

    it('CLAUDE.md content contains the company field', async () => {
      setupMinimalHappyPath();
      await new InitCommand().run();
      const claudeCall = (mockWriteFile.mock.calls as [string, string][]).find(([p]) =>
        p.endsWith('CLAUDE.md'),
      );
      expect(claudeCall![1]).toContain('example.com');
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
      // If AIProviderFactory were imported and called, prompt calls would exceed 2.
      // Two prompt calls: promptWorkspacePath + promptMinimalOnboarding.
      expect(mockPrompt).toHaveBeenCalledTimes(2);
    });
  });

  describe('next steps', () => {
    it('stdout contains tmr config in next steps', async () => {
      setupMinimalHappyPath();
      await new InitCommand().run();
      const allOutput = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(allOutput).toContain('tmr config');
    });

    it('stdout contains tmr install tmr-inbox in next steps', async () => {
      setupMinimalHappyPath();
      await new InitCommand().run();
      const allOutput = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(allOutput).toContain('tmr install tmr-inbox');
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
});
