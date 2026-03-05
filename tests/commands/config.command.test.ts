import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ── Mock declarations ─────────────────────────────────────────────────────────

const mockPrompt = jest.fn<(questions: unknown) => Promise<Record<string, unknown>>>();
jest.unstable_mockModule('inquirer', () => ({
  default: { prompt: mockPrompt },
}));

const mockSucceed = jest.fn();
const mockFail = jest.fn();
const mockStart = jest.fn(() => ({ succeed: mockSucceed, fail: mockFail }));
jest.unstable_mockModule('ora', () => ({
  default: jest.fn(() => ({ start: mockStart })),
}));

const mockTestConnection = jest.fn<() => Promise<boolean>>();
const mockAICreate = jest.fn(() => ({ testConnection: mockTestConnection }));
jest.unstable_mockModule('../../src/providers/ai-provider-factory.js', () => ({
  AIProviderFactory: { create: mockAICreate },
}));

const mockGetActiveProvider = jest.fn<() => string | undefined>();
const mockSetActiveProvider = jest.fn<() => void>();
const mockGetProviderConfig =
  jest.fn<
    (
      p: string,
    ) => { api_key_encrypted?: string; model?: string; configured_date?: string } | undefined
  >();
const mockAddProvider = jest.fn<() => void>();
const mockConfigGet = jest.fn<() => unknown>();
const mockConfigSet = jest.fn<() => void>();
const mockConfigDelete = jest.fn<() => void>();

jest.unstable_mockModule('../../src/services/config.service.js', () => ({
  configService: {
    getActiveProvider: mockGetActiveProvider,
    setActiveProvider: mockSetActiveProvider,
    getProviderConfig: mockGetProviderConfig,
    addProvider: mockAddProvider,
    get: mockConfigGet,
    set: mockConfigSet,
    delete: mockConfigDelete,
  },
}));

// ── Dynamic imports (after mocks) ─────────────────────────────────────────────

const { createConfigCommand } = await import('../../src/commands/config.command.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function runSubcommand(sub: string): Promise<void> {
  const cmd = createConfigCommand();
  await cmd.parseAsync([sub], { from: 'user' });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ConfigCommand', () => {
  let stdoutSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTestConnection.mockResolvedValue(true);
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  // ── interactive menu (no subcommand) ────────────────────────────────────────

  describe('interactive menu', () => {
    it('runs show-security when selected from the menu', async () => {
      mockGetActiveProvider.mockReturnValue('gemini');
      mockGetProviderConfig.mockReturnValue(undefined);
      mockPrompt.mockResolvedValueOnce({ action: 'show-security' });

      const cmd = createConfigCommand();
      await cmd.parseAsync([], { from: 'user' });

      const output = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(output).toContain('.config/tmr/config.json');
    });

    it('runs set-key when selected from the menu', async () => {
      mockPrompt
        .mockResolvedValueOnce({ action: 'set-key' })
        .mockResolvedValueOnce({ provider: 'openai' })
        .mockResolvedValueOnce({ apiKey: 'sk-test' });

      mockTestConnection.mockResolvedValue(true);

      const cmd = createConfigCommand();
      await cmd.parseAsync([], { from: 'user' });

      expect(mockAddProvider).toHaveBeenCalledWith('openai', 'sk-test', '');
    });
  });

  // ── show-security ───────────────────────────────────────────────────────────

  describe('show-security', () => {
    it('prints storage path, encryption info, and active provider', async () => {
      mockGetActiveProvider.mockReturnValue('gemini');
      mockGetProviderConfig.mockReturnValue(undefined);

      await runSubcommand('show-security');

      const output = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(output).toContain('.config/tmr/config.json');
      expect(output).toContain('AES-256');
      expect(output).toContain('tmr-config-v1');
      expect(output).toContain('gemini');
    });

    it('shows redacted key for configured provider', async () => {
      mockGetActiveProvider.mockReturnValue('gemini');
      mockGetProviderConfig.mockImplementation((p) =>
        p === 'gemini' ? { api_key_encrypted: 'AIzaSyABCDEFGHIJKLMNO' } : undefined,
      );

      await runSubcommand('show-security');

      const output = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(output).toContain('gemini');
      // Key should be redacted — must not contain the raw key
      expect(output).not.toContain('AIzaSyABCDEFGHIJKLMNO');
      expect(output).toContain('*');
    });

    it('shows (none configured) when no providers have keys', async () => {
      mockGetActiveProvider.mockReturnValue(undefined);
      mockGetProviderConfig.mockReturnValue(undefined);

      await runSubcommand('show-security');

      const output = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(output).toContain('(none configured)');
    });
  });

  // ── set-key ─────────────────────────────────────────────────────────────────

  describe('set-key', () => {
    it('saves key and sets active provider on successful validation', async () => {
      mockPrompt
        // promptProviderSelection
        .mockResolvedValueOnce({ provider: 'openai' })
        // promptHiddenKey
        .mockResolvedValueOnce({ apiKey: 'sk-test' });

      mockTestConnection.mockResolvedValue(true);

      await runSubcommand('set-key');

      expect(mockAddProvider).toHaveBeenCalledWith('openai', 'sk-test', '');
      expect(mockSetActiveProvider).toHaveBeenCalledWith('openai');
      const output = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(output).toContain('Key saved for openai');
    });

    it('does NOT save key and shows warning after 3 failed attempts', async () => {
      mockPrompt
        .mockResolvedValueOnce({ provider: 'gemini' })
        .mockResolvedValueOnce({ apiKey: 'bad-1' })
        .mockResolvedValueOnce({ apiKey: 'bad-2' })
        .mockResolvedValueOnce({ apiKey: 'bad-3' });

      mockTestConnection.mockResolvedValue(false);

      await runSubcommand('set-key');

      expect(mockAddProvider).not.toHaveBeenCalled();
      const output = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(output).toContain('NOT saved');
    });
  });

  // ── delete-key ──────────────────────────────────────────────────────────────

  describe('delete-key', () => {
    it('shows message when no providers are configured', async () => {
      mockGetProviderConfig.mockReturnValue(undefined);

      await runSubcommand('delete-key');

      const output = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(output).toContain('No provider keys are currently configured');
    });

    it('deletes the key after confirmation', async () => {
      mockGetProviderConfig.mockImplementation((p) =>
        p === 'openai' ? { api_key_encrypted: 'sk-test' } : undefined,
      );
      mockGetActiveProvider.mockReturnValue('gemini');
      mockConfigGet.mockReturnValue({ openai: { api_key_encrypted: 'sk-test' } });

      mockPrompt
        .mockResolvedValueOnce({ provider: 'openai' })
        .mockResolvedValueOnce({ confirmed: true });

      await runSubcommand('delete-key');

      expect(mockConfigSet).toHaveBeenCalled();
      const output = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(output).toContain('Key for openai deleted');
    });

    it('aborts without deleting when user declines confirmation', async () => {
      mockGetProviderConfig.mockImplementation((p) =>
        p === 'gemini' ? { api_key_encrypted: 'AIza-test' } : undefined,
      );

      mockPrompt
        .mockResolvedValueOnce({ provider: 'gemini' })
        .mockResolvedValueOnce({ confirmed: false });

      await runSubcommand('delete-key');

      expect(mockConfigSet).not.toHaveBeenCalled();
      const output = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(output).toContain('Aborted');
    });

    it('clears active_provider when deleting the currently active provider', async () => {
      mockGetProviderConfig.mockImplementation((p) =>
        p === 'gemini' ? { api_key_encrypted: 'AIza-test' } : undefined,
      );
      mockGetActiveProvider.mockReturnValue('gemini');
      mockConfigGet.mockReturnValue({ gemini: { api_key_encrypted: 'AIza-test' } });

      mockPrompt
        .mockResolvedValueOnce({ provider: 'gemini' })
        .mockResolvedValueOnce({ confirmed: true });

      await runSubcommand('delete-key');

      expect(mockConfigDelete).toHaveBeenCalledWith('active_provider');
    });
  });

  // ── switch-provider ─────────────────────────────────────────────────────────

  describe('switch-provider', () => {
    it('persists the selected provider as active_provider', async () => {
      mockGetProviderConfig.mockReturnValue(undefined);
      mockPrompt.mockResolvedValueOnce({ provider: 'claude' });

      await runSubcommand('switch-provider');

      expect(mockSetActiveProvider).toHaveBeenCalledWith('claude');
      const output = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(output).toContain('Active provider set to claude');
    });

    it('marks providers that have a key with a checkmark in the choices label', async () => {
      mockGetProviderConfig.mockImplementation((p: string) =>
        p === 'openai' ? { api_key_encrypted: 'sk-test' } : undefined,
      );

      mockPrompt.mockImplementation((questions: unknown) => {
        const qs = questions as Array<{ choices: Array<{ name: string; value: string }> }>;
        const choices = qs[0]?.choices ?? [];
        const openaiChoice = choices.find((c) => c.value === 'openai');
        expect(openaiChoice?.name).toContain('✔');
        return Promise.resolve({ provider: 'openai' });
      });

      await runSubcommand('switch-provider');
    });
  });
});
