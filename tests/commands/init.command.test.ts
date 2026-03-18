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
const mockConfigSetActiveProvider = jest.fn<() => void>();
const mockConfigAddProvider = jest.fn<() => void>();
const mockConfigGetProviderConfig =
  jest.fn<(p: string) => { api_key_encrypted?: string } | undefined>();

jest.unstable_mockModule('../../src/services/config.service.js', () => ({
  configService: {
    initialize: mockConfigInitialize,
    set: mockConfigSet,
    setActiveProvider: mockConfigSetActiveProvider,
    addProvider: mockConfigAddProvider,
    getProviderConfig: mockConfigGetProviderConfig,
  },
}));

const mockCreateDirectory = jest.fn<() => Promise<void>>();
const mockWriteFile = jest.fn<(path: string, content: string) => Promise<void>>();

jest.unstable_mockModule('../../src/services/file-system.service.js', () => ({
  fileSystemService: { createDirectory: mockCreateDirectory, writeFile: mockWriteFile },
}));

const mockInstallPlugins = jest.fn<(workspacePath: string) => Promise<void>>();

jest.unstable_mockModule('../../src/services/obsidian-plugin.service.js', () => ({
  obsidianPluginService: { installPlugins: mockInstallPlugins },
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
      location: 'São Paulo, SP, Brasil',
    })
    // promptLeadershipContext
    .mockResolvedValueOnce({
      managerName: 'Bob Manager',
      managerEmail: 'bob@example.com',
    })
    // promptTeamMembers — loop iteration 1: email prompt
    .mockResolvedValueOnce({ email: 'member@example.com' })
    // loop iteration 1: name/gender/role/location prompt
    .mockResolvedValueOnce({ name: 'Member One', gender: 'Male', role: 'Developer', location: '' })
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
    mockInstallPlugins.mockResolvedValue(undefined);
    // By default no existing key — no reuse prompt shown
    mockConfigGetProviderConfig.mockReturnValue(undefined);
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
    it('sets active provider and persists key via addProvider after successful connection', async () => {
      setupHappyPath();
      await new InitCommand().run();
      expect(mockConfigSetActiveProvider).toHaveBeenCalledWith('openai');
      expect(mockConfigAddProvider).toHaveBeenCalledWith('openai', 'sk-test-key', '');
    });

    it('calls obsidianPluginService.installPlugins with the workspace path', async () => {
      setupHappyPath();
      await new InitCommand().run();
      expect(mockInstallPlugins).toHaveBeenCalledWith('/tmp/test-workspace');
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

  describe('existing key reuse', () => {
    it('skips key prompt and reuses existing key when user confirms', async () => {
      mockConfigGetProviderConfig.mockReturnValue({ api_key_encrypted: 'sk-existing' });

      mockPrompt
        .mockResolvedValueOnce({ workspacePath: '/tmp/test-workspace' })
        .mockResolvedValueOnce({ provider: 'openai' })
        // reuse confirmation → yes
        .mockResolvedValueOnce({ reuse: true })
        // rest of onboarding
        .mockResolvedValueOnce({
          name: 'Alice',
          email: 'alice@example.com',
          role: 'EM',
          location: '',
        })
        .mockResolvedValueOnce({ managerName: 'Bob', managerEmail: 'bob@example.com' })
        .mockResolvedValueOnce({ email: '' });

      await new InitCommand().run();

      // Should NOT call testConnection — key was reused without re-validation
      expect(mockTestConnection).not.toHaveBeenCalled();
      // Should persist the existing key again via addProvider
      expect(mockConfigAddProvider).toHaveBeenCalledWith('openai', 'sk-existing', '');
    });

    it('falls through to new key prompt when user declines reuse', async () => {
      mockConfigGetProviderConfig.mockReturnValue({ api_key_encrypted: 'sk-existing' });

      mockPrompt
        .mockResolvedValueOnce({ workspacePath: '/tmp/test-workspace' })
        .mockResolvedValueOnce({ provider: 'openai' })
        // reuse confirmation → no
        .mockResolvedValueOnce({ reuse: false })
        // new key entry
        .mockResolvedValueOnce({ apiKey: 'sk-new-key' })
        .mockResolvedValueOnce({
          name: 'Alice',
          email: 'alice@example.com',
          role: 'EM',
          location: '',
        })
        .mockResolvedValueOnce({ managerName: 'Bob', managerEmail: 'bob@example.com' })
        .mockResolvedValueOnce({ email: '' });

      await new InitCommand().run();

      expect(mockTestConnection).toHaveBeenCalled();
      expect(mockConfigAddProvider).toHaveBeenCalledWith('openai', 'sk-new-key', '');
    });
  });

  describe('connection failure — retry loop (capped at 3)', () => {
    it('shows spinner.fail and re-prompts API key when testConnection throws, then succeeds on 2nd attempt', async () => {
      mockPrompt
        .mockResolvedValueOnce({ workspacePath: '/tmp/test-workspace' })
        .mockResolvedValueOnce({ provider: 'openai' })
        // first attempt — bad key
        .mockResolvedValueOnce({ apiKey: 'bad-key' })
        // second attempt — good key (rest of happy path)
        .mockResolvedValueOnce({ apiKey: 'sk-good-key' })
        .mockResolvedValueOnce({
          name: 'Alice',
          email: 'alice@example.com',
          role: 'EM',
          location: '',
        })
        .mockResolvedValueOnce({ managerName: 'Bob', managerEmail: 'bob@example.com' })
        .mockResolvedValueOnce({ email: '' });

      mockTestConnection.mockRejectedValueOnce(new Error('Unauthorized')).mockResolvedValue(true);

      await new InitCommand().run();

      expect(mockFail).toHaveBeenCalledWith(expect.stringContaining('openai'));
      expect(mockSucceed).toHaveBeenCalledWith(expect.stringContaining('openai'));
      expect(mockAICreate).toHaveBeenCalledWith('openai', 'sk-good-key');
    });

    it('shows spinner.fail and re-prompts API key when testConnection returns false, then succeeds on 2nd attempt', async () => {
      mockPrompt
        .mockResolvedValueOnce({ workspacePath: '/tmp/test-workspace' })
        .mockResolvedValueOnce({ provider: 'claude' })
        // first attempt — bad key
        .mockResolvedValueOnce({ apiKey: 'bad-key' })
        // second attempt — good key (rest of happy path)
        .mockResolvedValueOnce({ apiKey: 'sk-good-key' })
        .mockResolvedValueOnce({
          name: 'Alice',
          email: 'alice@example.com',
          role: 'EM',
          location: '',
        })
        .mockResolvedValueOnce({ managerName: 'Bob', managerEmail: 'bob@example.com' })
        .mockResolvedValueOnce({ email: '' });

      mockTestConnection.mockResolvedValueOnce(false).mockResolvedValue(true);

      await new InitCommand().run();

      expect(mockFail).toHaveBeenCalledWith(expect.stringContaining('claude'));
      expect(mockSucceed).toHaveBeenCalledWith(expect.stringContaining('claude'));
      expect(mockAICreate).toHaveBeenCalledWith('claude', 'sk-good-key');
    });

    it('continues onboarding without a key after all 3 attempts fail and shows deferred warning', async () => {
      mockPrompt
        .mockResolvedValueOnce({ workspacePath: '/tmp/test-workspace' })
        .mockResolvedValueOnce({ provider: 'gemini' })
        // 3 failed attempts
        .mockResolvedValueOnce({ apiKey: 'bad-1' })
        .mockResolvedValueOnce({ apiKey: 'bad-2' })
        .mockResolvedValueOnce({ apiKey: 'bad-3' })
        // rest of onboarding continues
        .mockResolvedValueOnce({
          name: 'Alice',
          email: 'alice@example.com',
          role: 'EM',
          location: '',
        })
        .mockResolvedValueOnce({ managerName: 'Bob', managerEmail: 'bob@example.com' })
        .mockResolvedValueOnce({ email: '' });

      mockTestConnection.mockResolvedValue(false);

      await new InitCommand().run();

      expect(mockFail).toHaveBeenCalledTimes(3);
      const allOutput = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(allOutput).toContain('tmr config set-key');
      // Key must NOT be persisted when validation never succeeded
      expect(mockConfigAddProvider).not.toHaveBeenCalled();
      // But workspace creation still completes
      expect(mockWriteFile).toHaveBeenCalledTimes(6);
    });

    it('includes attempt counter in API key prompt message', async () => {
      mockPrompt
        .mockResolvedValueOnce({ workspacePath: '/tmp/test-workspace' })
        .mockResolvedValueOnce({ provider: 'gemini' })
        .mockResolvedValueOnce({ apiKey: 'bad-1' })
        .mockResolvedValueOnce({ apiKey: 'bad-2' })
        .mockResolvedValueOnce({ apiKey: 'bad-3' })
        .mockResolvedValueOnce({
          name: 'Alice',
          email: 'alice@example.com',
          role: 'EM',
          location: '',
        })
        .mockResolvedValueOnce({ managerName: 'Bob', managerEmail: 'bob@example.com' })
        .mockResolvedValueOnce({ email: '' });

      mockTestConnection.mockResolvedValue(false);

      await new InitCommand().run();

      // promptApiKey is called 3 times; each call passes different args to inquirer.prompt
      // The 3rd inquirer call is the 1st apiKey prompt (after workspace + provider)
      const apiKeyCall = mockPrompt.mock.calls[2] as unknown as [Array<{ message: string }>];
      expect(apiKeyCall[0][0].message).toContain('1/3');
    });
  });

  describe('team members — empty loop', () => {
    it('completes successfully when the user immediately exits the team member loop', async () => {
      mockPrompt
        .mockResolvedValueOnce({ workspacePath: '/tmp/test-workspace' })
        .mockResolvedValueOnce({ provider: 'openai' })
        .mockResolvedValueOnce({ apiKey: 'sk-test-key' })
        .mockResolvedValueOnce({
          name: 'Alice Example',
          email: 'alice@example.com',
          role: 'EM',
          location: '',
        })
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
        .mockResolvedValueOnce({
          name: 'Alice Example',
          email: 'alice@example.com',
          role: 'EM',
          location: '',
        })
        .mockResolvedValueOnce({ managerName: 'Bob', managerEmail: 'bob@example.com' })
        // loop iteration 1
        .mockResolvedValueOnce({ email: 'dev1@example.com' })
        .mockResolvedValueOnce({ name: 'Dev One', gender: 'Male', role: 'Engineer', location: '' })
        // loop iteration 2
        .mockResolvedValueOnce({ email: 'dev2@example.com' })
        .mockResolvedValueOnce({
          name: 'Dev Two',
          gender: 'Female',
          role: 'Designer',
          location: '',
        })
        // loop exit
        .mockResolvedValueOnce({ email: '' });

      await new InitCommand().run();

      const writtenPaths = (mockWriteFile.mock.calls as [string, string][]).map((c) => c[0]);
      // 6 base files + 2 member profiles + 2 default team files
      expect(mockWriteFile).toHaveBeenCalledTimes(10);
      expect(
        writtenPaths.some((p) =>
          p.includes('my-teams/_members/dev1@example.com/dev1@example.com.md'),
        ),
      ).toBe(true);
      expect(
        writtenPaths.some((p) =>
          p.includes('my-teams/_members/dev2@example.com/dev2@example.com.md'),
        ),
      ).toBe(true);
    });

    it('skips duplicate emails without writing a second profile file', async () => {
      mockPrompt
        .mockResolvedValueOnce({ workspacePath: '/tmp/test-workspace' })
        .mockResolvedValueOnce({ provider: 'openai' })
        .mockResolvedValueOnce({ apiKey: 'sk-test-key' })
        .mockResolvedValueOnce({
          name: 'Alice Example',
          email: 'alice@example.com',
          role: 'EM',
          location: '',
        })
        .mockResolvedValueOnce({ managerName: 'Bob', managerEmail: 'bob@example.com' })
        // loop iteration 1 — first entry
        .mockResolvedValueOnce({ email: 'dup@example.com' })
        .mockResolvedValueOnce({ name: 'Original', gender: 'Male', role: 'Engineer', location: '' })
        // loop iteration 2 — duplicate email, skipped (no name/gender/role prompt follows)
        .mockResolvedValueOnce({ email: 'dup@example.com' })
        // loop exit
        .mockResolvedValueOnce({ email: '' });

      await new InitCommand().run();

      const writtenPaths = (mockWriteFile.mock.calls as [string, string][]).map((c) => c[0]);
      // 6 base files + 1 member profile + 2 default team files (duplicate not written)
      expect(mockWriteFile).toHaveBeenCalledTimes(9);
      expect(writtenPaths.filter((p) => p.includes('dup@example.com'))).toHaveLength(1);
    });
  });

  describe('workspace files', () => {
    it('writes career profile, pdp, leadership profile, and IDE stubs at Epic-2 paths', async () => {
      setupHappyPath();
      await new InitCommand().run();

      const writtenPaths = (mockWriteFile.mock.calls as [string, string][]).map((c) => c[0]);

      expect(
        writtenPaths.some((p) => p.includes('my-career/alice@example.com/alice@example.com.md')),
      ).toBe(true);
      expect(writtenPaths.some((p) => p.endsWith('my-career/alice@example.com/pdp.md'))).toBe(true);
      expect(
        writtenPaths.some((p) => p.includes('my-leadership/bob@example.com/bob@example.com.md')),
      ).toBe(true);
      expect(writtenPaths.some((p) => p.endsWith('process-agent.mdc'))).toBe(true);
      expect(writtenPaths.filter((p) => p.endsWith('process-agent.md'))).toHaveLength(2);
    });

    it('writes 6 base files + 1 member profile + 2 default team files for 1 member', async () => {
      setupHappyPath();
      await new InitCommand().run();
      expect(mockWriteFile).toHaveBeenCalledTimes(9);
    });

    it('writes team member profile under my-teams/_members/{email}/{email}.md', async () => {
      setupHappyPath();
      await new InitCommand().run();

      const writtenPaths = (mockWriteFile.mock.calls as [string, string][]).map((c) => c[0]);
      expect(
        writtenPaths.some((p) =>
          p.includes('my-teams/_members/member@example.com/member@example.com.md'),
        ),
      ).toBe(true);
    });

    it('writes default-context.md and default-members.md when team members exist', async () => {
      setupHappyPath();
      await new InitCommand().run();

      const writtenPaths = (mockWriteFile.mock.calls as [string, string][]).map((c) => c[0]);
      expect(writtenPaths.some((p) => p.endsWith('_teams/default/default-context.md'))).toBe(true);
      expect(writtenPaths.some((p) => p.endsWith('_teams/default/default-members.md'))).toBe(true);
    });

    it('does NOT write default team files when no members are added', async () => {
      mockPrompt
        .mockResolvedValueOnce({ workspacePath: '/tmp/test-workspace' })
        .mockResolvedValueOnce({ provider: 'openai' })
        .mockResolvedValueOnce({ apiKey: 'sk-test-key' })
        .mockResolvedValueOnce({
          name: 'Alice Example',
          email: 'alice@example.com',
          role: 'EM',
          location: '',
        })
        .mockResolvedValueOnce({ managerName: 'Bob', managerEmail: 'bob@example.com' })
        .mockResolvedValueOnce({ email: '' });

      await new InitCommand().run();

      const writtenPaths = (mockWriteFile.mock.calls as [string, string][]).map((c) => c[0]);
      expect(writtenPaths.some((p) => p.includes('default'))).toBe(false);
      expect(mockWriteFile).toHaveBeenCalledTimes(6);
    });
  });

  describe('locality field (Story 1.9)', () => {
    it('includes location in career profile content when provided', async () => {
      setupHappyPath();
      await new InitCommand().run();

      const profileCall = (mockWriteFile.mock.calls as [string, string][]).find(([p]) =>
        p.includes('my-career/alice@example.com/alice@example.com.md'),
      );
      expect(profileCall).toBeDefined();
      expect(profileCall![1]).toContain('location: São Paulo, SP, Brasil');
    });

    it('omits location key from career profile when field is empty', async () => {
      mockPrompt
        .mockResolvedValueOnce({ workspacePath: '/tmp/test-workspace' })
        .mockResolvedValueOnce({ provider: 'openai' })
        .mockResolvedValueOnce({ apiKey: 'sk-test-key' })
        .mockResolvedValueOnce({
          name: 'Alice',
          email: 'alice@example.com',
          role: 'EM',
          location: '',
        })
        .mockResolvedValueOnce({ managerName: 'Bob', managerEmail: 'bob@example.com' })
        .mockResolvedValueOnce({ email: '' });

      await new InitCommand().run();

      const profileCall = (mockWriteFile.mock.calls as [string, string][]).find(([p]) =>
        p.includes('my-career/alice@example.com/alice@example.com.md'),
      );
      expect(profileCall).toBeDefined();
      expect(profileCall![1]).not.toContain('location:');
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
