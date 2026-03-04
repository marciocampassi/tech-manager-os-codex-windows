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
    // promptWorkspacePath
    .mockResolvedValueOnce({ workspacePath: '/tmp/test-workspace' })
    // promptProviderSelection
    .mockResolvedValueOnce({ provider: 'openai' })
    // promptApiKey
    .mockResolvedValueOnce({ apiKey: 'sk-test-key' })
    // promptManagerProfile
    .mockResolvedValueOnce({
      name: 'Alice Example',
      email: 'alice@example.com',
      role: 'Engineering Manager',
    })
    // promptLeadershipContext
    .mockResolvedValueOnce({
      managerName: 'Bob Manager',
      managerEmail: 'bob@example.com',
    })
    // promptTeamMembers — loop iteration 1: email prompt
    .mockResolvedValueOnce({ email: 'member@example.com' })
    // loop iteration 1: name/gender/role prompt
    .mockResolvedValueOnce({ name: 'Member One', gender: 'Male', role: 'Developer' })
    // loop iteration 2: email prompt (empty → exits loop)
    .mockResolvedValueOnce({ email: '' });
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

  describe('connection failure — retry loop', () => {
    it('shows spinner.fail and re-prompts API key when testConnection throws, then succeeds on retry', async () => {
      mockPrompt
        .mockResolvedValueOnce({ workspacePath: '/tmp/test-workspace' })
        .mockResolvedValueOnce({ provider: 'openai' })
        // first attempt — bad key
        .mockResolvedValueOnce({ apiKey: 'bad-key' })
        // second attempt — good key (rest of happy path)
        .mockResolvedValueOnce({ apiKey: 'sk-good-key' })
        .mockResolvedValueOnce({ name: 'Alice', email: 'alice@example.com', role: 'EM' })
        .mockResolvedValueOnce({ managerName: 'Bob', managerEmail: 'bob@example.com' })
        .mockResolvedValueOnce({ email: '' });

      mockTestConnection.mockRejectedValueOnce(new Error('Unauthorized')).mockResolvedValue(true);

      await new InitCommand().run();

      expect(mockFail).toHaveBeenCalledWith(expect.stringContaining('openai'));
      expect(mockSucceed).toHaveBeenCalledWith(expect.stringContaining('openai'));
      expect(mockAICreate).toHaveBeenCalledWith('openai', 'sk-good-key');
    });

    it('shows spinner.fail and re-prompts API key when testConnection returns false, then succeeds on retry', async () => {
      mockPrompt
        .mockResolvedValueOnce({ workspacePath: '/tmp/test-workspace' })
        .mockResolvedValueOnce({ provider: 'claude' })
        // first attempt — bad key
        .mockResolvedValueOnce({ apiKey: 'bad-key' })
        // second attempt — good key (rest of happy path)
        .mockResolvedValueOnce({ apiKey: 'sk-good-key' })
        .mockResolvedValueOnce({ name: 'Alice', email: 'alice@example.com', role: 'EM' })
        .mockResolvedValueOnce({ managerName: 'Bob', managerEmail: 'bob@example.com' })
        .mockResolvedValueOnce({ email: '' });

      mockTestConnection.mockResolvedValueOnce(false).mockResolvedValue(true);

      await new InitCommand().run();

      expect(mockFail).toHaveBeenCalledWith(expect.stringContaining('claude'));
      expect(mockSucceed).toHaveBeenCalledWith(expect.stringContaining('claude'));
      expect(mockAICreate).toHaveBeenCalledWith('claude', 'sk-good-key');
    });
  });

  describe('team members — empty loop', () => {
    it('completes successfully when the user immediately exits the team member loop', async () => {
      mockPrompt
        .mockResolvedValueOnce({ workspacePath: '/tmp/test-workspace' })
        .mockResolvedValueOnce({ provider: 'openai' })
        .mockResolvedValueOnce({ apiKey: 'sk-test-key' })
        .mockResolvedValueOnce({ name: 'Alice Example', email: 'alice@example.com', role: 'EM' })
        .mockResolvedValueOnce({ managerName: 'Bob', managerEmail: 'bob@example.com' })
        // team loop: immediately empty → exits
        .mockResolvedValueOnce({ email: '' });

      await new InitCommand().run();
      // Only 6 base files written (no team member files)
      expect(mockWriteFile).toHaveBeenCalledTimes(6);
    });
  });

  describe('team members — multiple members', () => {
    it('writes one profile file per member and correct paths for 2 members', async () => {
      mockPrompt
        .mockResolvedValueOnce({ workspacePath: '/tmp/test-workspace' })
        .mockResolvedValueOnce({ provider: 'openai' })
        .mockResolvedValueOnce({ apiKey: 'sk-test-key' })
        .mockResolvedValueOnce({ name: 'Alice Example', email: 'alice@example.com', role: 'EM' })
        .mockResolvedValueOnce({ managerName: 'Bob', managerEmail: 'bob@example.com' })
        // loop iteration 1
        .mockResolvedValueOnce({ email: 'dev1@example.com' })
        .mockResolvedValueOnce({ name: 'Dev One', gender: 'Male', role: 'Engineer' })
        // loop iteration 2
        .mockResolvedValueOnce({ email: 'dev2@example.com' })
        .mockResolvedValueOnce({ name: 'Dev Two', gender: 'Female', role: 'Designer' })
        // loop exit
        .mockResolvedValueOnce({ email: '' });

      await new InitCommand().run();

      const writtenPaths = (mockWriteFile.mock.calls as [string, string][]).map((c) => c[0]);
      // 6 base files + 2 team member profiles
      expect(mockWriteFile).toHaveBeenCalledTimes(8);
      expect(writtenPaths.some((p) => p.includes('my-team/dev1@example.com/profile.md'))).toBe(
        true,
      );
      expect(writtenPaths.some((p) => p.includes('my-team/dev2@example.com/profile.md'))).toBe(
        true,
      );
    });

    it('skips duplicate emails without writing a second profile file', async () => {
      mockPrompt
        .mockResolvedValueOnce({ workspacePath: '/tmp/test-workspace' })
        .mockResolvedValueOnce({ provider: 'openai' })
        .mockResolvedValueOnce({ apiKey: 'sk-test-key' })
        .mockResolvedValueOnce({ name: 'Alice Example', email: 'alice@example.com', role: 'EM' })
        .mockResolvedValueOnce({ managerName: 'Bob', managerEmail: 'bob@example.com' })
        // loop iteration 1 — first entry
        .mockResolvedValueOnce({ email: 'dup@example.com' })
        .mockResolvedValueOnce({ name: 'Original', gender: 'Male', role: 'Engineer' })
        // loop iteration 2 — duplicate email, skipped (no name/gender/role prompt follows)
        .mockResolvedValueOnce({ email: 'dup@example.com' })
        // loop exit
        .mockResolvedValueOnce({ email: '' });

      await new InitCommand().run();

      const writtenPaths = (mockWriteFile.mock.calls as [string, string][]).map((c) => c[0]);
      // 6 base files + 1 team member profile (duplicate not written)
      expect(mockWriteFile).toHaveBeenCalledTimes(7);
      expect(writtenPaths.filter((p) => p.includes('dup@example.com'))).toHaveLength(1);
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
      expect(writtenPaths.some((p) => p.endsWith('process-agent.mdc'))).toBe(true);
      expect(writtenPaths.filter((p) => p.endsWith('process-agent.md'))).toHaveLength(2);
    });

    it('writes 6 base files plus one file per team member', async () => {
      setupHappyPath();
      await new InitCommand().run();
      // 6 base files + 1 team member profile
      expect(mockWriteFile).toHaveBeenCalledTimes(7);
    });

    it('writes team member profile under my-team/{email}/', async () => {
      setupHappyPath();
      await new InitCommand().run();

      const writtenPaths = (mockWriteFile.mock.calls as [string, string][]).map((c) => c[0]);
      expect(writtenPaths.some((p) => p.includes('my-team/member@example.com/profile.md'))).toBe(
        true,
      );
    });
  });

  describe('next steps', () => {
    it('writes next steps message containing the workspace path', async () => {
      setupHappyPath();
      await new InitCommand().run();

      const allOutput = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(allOutput).toContain('/tmp/test-workspace');
    });
  });
});
