import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// ── Mock declarations (must precede dynamic imports) ──────────────────────────

const mockPrompt = jest.fn<() => Promise<Record<string, unknown>>>();

jest.unstable_mockModule('inquirer', () => ({
  default: { prompt: mockPrompt },
}));

const mockSucceed = jest.fn();
const mockFail = jest.fn();
const mockStart = jest.fn(() => ({ succeed: mockSucceed, fail: mockFail }));
const mockOra = jest.fn(() => ({ start: mockStart }));

jest.unstable_mockModule('ora', () => ({
  default: mockOra,
}));

jest.unstable_mockModule('boxen', () => ({
  default: jest.fn((_content: string) => '[boxen]'),
}));

// chalk.bold is both callable (chalk.bold('text')) and a property accessor (chalk.bold.cyan)
// so it must be a function that also has sub-properties.
function makeBold(s: string): string { return s; }
makeBold.cyan = (s: string) => s;
makeBold.green = (s: string) => s;

jest.unstable_mockModule('chalk', () => ({
  default: {
    bold: makeBold,
    gray: (s: string) => s,
    dim: (s: string) => s,
    cyan: (s: string) => s,
  },
}));

const mockTestConnection = jest.fn<() => Promise<boolean>>();
const mockAICreate = jest.fn(() => ({ testConnection: mockTestConnection }));

jest.unstable_mockModule('../../src/providers/ai-provider-factory.js', () => ({
  AIProviderFactory: { create: mockAICreate },
}));

const mockConfigInitialize = jest.fn<() => void>();
const mockConfigSet = jest.fn<() => void>();

jest.unstable_mockModule('../../src/services/config.service.js', () => ({
  configService: { initialize: mockConfigInitialize, set: mockConfigSet },
}));

const mockCreateDirectory = jest.fn<() => Promise<void>>();
const mockWriteFile = jest.fn<(path: string, content: string) => Promise<void>>();

jest.unstable_mockModule('../../src/services/file-system.service.js', () => ({
  fileSystemService: { createDirectory: mockCreateDirectory, writeFile: mockWriteFile },
}));

// ── Dynamic import (after all mocks) ─────────────────────────────────────────

const { InitCommand } = await import('../../src/commands/init.command.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupHappyPath(): void {
  mockPrompt
    .mockResolvedValueOnce({ workspacePath: '/tmp/test-workspace' })
    .mockResolvedValueOnce({ provider: 'openai' })
    .mockResolvedValueOnce({ apiKey: 'sk-test-key' })
    .mockResolvedValueOnce({
      name: 'Alice Example',
      email: 'alice@example.com',
      role: 'Engineering Manager',
      experienceYears: 5,
      managementStyle: 'Coaching',
      strengths: 'Empathy, Communication',
      developmentAreas: 'Delegation, Prioritization',
    })
    .mockResolvedValueOnce({
      shortTerm: 'Lead two teams effectively',
      longTerm: 'Become Director of Engineering',
      targetRole: 'Director of Engineering',
    })
    .mockResolvedValueOnce({
      managerName: 'Bob Manager',
      managerEmail: 'bob@example.com',
      expectations: 'Scale the platform team',
    });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('InitCommand', () => {
  let stdoutSpy: ReturnType<typeof jest.spyOn>;
  let exitSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateDirectory.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockTestConnection.mockResolvedValue(true);
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((_code?: string | number | null | undefined) => {
        throw new Error('process.exit called');
      });
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    exitSpy.mockRestore();
  });

  describe('welcome banner', () => {
    it('writes a non-empty banner to stdout on run()', async () => {
      setupHappyPath();
      await new InitCommand().run();
      expect(stdoutSpy).toHaveBeenCalled();
      const firstCall = stdoutSpy.mock.calls[0]?.[0] as string;
      expect(typeof firstCall).toBe('string');
      expect(firstCall.length).toBeGreaterThan(0);
    });
  });

  describe('happy path', () => {
    it('saves provider and apiKey via configService after successful connection', async () => {
      setupHappyPath();
      await new InitCommand().run();
      expect(mockConfigSet).toHaveBeenCalledWith('provider', 'openai');
      expect(mockConfigSet).toHaveBeenCalledWith('apiKey', 'sk-test-key');
    });

    it('calls AIProviderFactory.create with correct provider and apiKey', async () => {
      setupHappyPath();
      await new InitCommand().run();
      expect(mockAICreate).toHaveBeenCalledWith('openai', 'sk-test-key');
    });

    it('calls spinner.succeed on successful testConnection', async () => {
      setupHappyPath();
      await new InitCommand().run();
      expect(mockSucceed).toHaveBeenCalledWith(expect.stringContaining('openai'));
    });
  });

  describe('connection failure', () => {
    it('calls spinner.fail and process.exit(1) when testConnection throws', async () => {
      mockPrompt
        .mockResolvedValueOnce({ workspacePath: '/tmp/test-workspace' })
        .mockResolvedValueOnce({ provider: 'openai' })
        .mockResolvedValueOnce({ apiKey: 'bad-key' });
      mockTestConnection.mockRejectedValue(new Error('Unauthorized'));

      await expect(new InitCommand().run()).rejects.toThrow('process.exit called');
      expect(mockFail).toHaveBeenCalledWith(expect.stringContaining('openai'));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('calls spinner.fail and process.exit(1) when testConnection returns false', async () => {
      mockPrompt
        .mockResolvedValueOnce({ workspacePath: '/tmp/test-workspace' })
        .mockResolvedValueOnce({ provider: 'anthropic' })
        .mockResolvedValueOnce({ apiKey: 'bad-key' });
      mockTestConnection.mockResolvedValue(false);

      await expect(new InitCommand().run()).rejects.toThrow('process.exit called');
      expect(mockFail).toHaveBeenCalledWith(expect.stringContaining('anthropic'));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('workspace files', () => {
    it('writes profile.md, pdp.md, my-leadership/profile.md, and IDE stubs', async () => {
      setupHappyPath();
      await new InitCommand().run();

      const writtenPaths = (mockWriteFile.mock.calls as [string, string][]).map((c) => c[0]);

      expect(writtenPaths.some((p) => p.endsWith('my-career/profile.md'))).toBe(true);
      expect(writtenPaths.some((p) => p.endsWith('my-career/pdp.md'))).toBe(true);
      expect(writtenPaths.some((p) => p.endsWith('my-leadership/profile.md'))).toBe(true);
      expect(writtenPaths.some((p) => p.endsWith('cycle-agent.mdc'))).toBe(true);
      expect(writtenPaths.filter((p) => p.endsWith('cycle-agent.md'))).toHaveLength(2);
    });

    it('writes all 6 files total', async () => {
      setupHappyPath();
      await new InitCommand().run();
      expect(mockWriteFile).toHaveBeenCalledTimes(6);
    });
  });

  describe('next steps', () => {
    it('writes next steps message containing the workspace path', async () => {
      setupHappyPath();
      await new InitCommand().run();

      const allOutput = (stdoutSpy.mock.calls as [string][])
        .map((c) => c[0])
        .join('');
      expect(allOutput).toContain('/tmp/test-workspace');
    });
  });
});
