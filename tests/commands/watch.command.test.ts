import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// ── Mock declarations (must precede dynamic imports) ─────────────────────────

const mockStart = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);

const mockWatchServiceInstance = { start: mockStart };

const mockInitialize = jest.fn<() => void>();
const mockGetActiveProvider = jest.fn<() => string | null>().mockReturnValue('openai');
const mockGetProviderConfig = jest
  .fn<() => { api_key_encrypted: string } | null>()
  .mockReturnValue({ api_key_encrypted: 'enc-key' });
const mockGetConfidenceThreshold = jest.fn<() => number>().mockReturnValue(0.75);

const mockGetWorkspaceRoot = jest.fn<() => string>().mockReturnValue('/fake/ws');

jest.unstable_mockModule('../../src/services/watch.service.js', () => ({
  WatchService: jest.fn(() => mockWatchServiceInstance),
}));

jest.unstable_mockModule('../../src/services/config.service.js', () => ({
  configService: {
    initialize: mockInitialize,
    getActiveProvider: mockGetActiveProvider,
    getProviderConfig: mockGetProviderConfig,
    getConfidenceThreshold: mockGetConfidenceThreshold,
  },
}));

jest.unstable_mockModule('../../src/utils/workspace.js', () => ({
  getWorkspaceRoot: mockGetWorkspaceRoot,
}));

jest.unstable_mockModule('../../src/providers/ai-provider-factory.js', () => ({
  AIProviderFactory: { create: jest.fn(() => ({})) },
}));

jest.unstable_mockModule('../../src/services/categorization.service.js', () => ({
  CategorizationService: jest.fn(() => ({})),
}));

jest.unstable_mockModule('../../src/services/context.service.js', () => ({
  ContextService: jest.fn(() => ({})),
}));

jest.unstable_mockModule('../../src/services/file-organization.service.js', () => ({
  FileOrganizationService: jest.fn(() => ({})),
}));

jest.unstable_mockModule('../../src/services/file-system.service.js', () => ({
  fileSystemService: {},
}));

jest.unstable_mockModule('../../src/services/inbox-process.service.js', () => ({
  InboxProcessService: jest.fn(() => ({})),
}));

jest.unstable_mockModule('../../src/services/inbox.service.js', () => ({
  InboxService: jest.fn(() => ({})),
}));

jest.unstable_mockModule('../../src/services/project.service.js', () => ({
  projectService: {},
}));

jest.unstable_mockModule('../../src/services/section-parser.service.js', () => ({
  sectionParserService: {},
}));

jest.unstable_mockModule('../../src/services/task.service.js', () => ({
  TaskService: jest.fn(() => ({})),
}));

jest.unstable_mockModule('../../src/services/team.service.js', () => ({
  teamService: {},
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe('createWatchCommand', () => {
  let createWatchCommand: () => import('commander').Command;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockStart.mockResolvedValue(undefined);
    mockGetActiveProvider.mockReturnValue('openai');
    mockGetProviderConfig.mockReturnValue({ api_key_encrypted: 'enc-key' });
    ({ createWatchCommand } = await import('../../src/commands/watch.command.js'));
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('creates a command named "watch"', () => {
    const cmd = createWatchCommand();
    expect(cmd.name()).toBe('watch');
  });

  it('has a description mentioning inbox and auto-process', () => {
    const cmd = createWatchCommand();
    expect(cmd.description()).toMatch(/watch|inbox|auto/i);
  });

  it('calls WatchService.start with workspace root on successful config', async () => {
    const { Command } = await import('commander');
    const program = new Command();
    program.exitOverride();
    program.option('--verbose').option('--plain');
    program.addCommand(createWatchCommand());

    await program.parseAsync(['node', 'tmr', 'watch']);

    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockStart).toHaveBeenCalledWith('/fake/ws', { verbose: false, plain: false });
  });

  it('prints error and sets exitCode=1 when no provider configured', async () => {
    mockGetActiveProvider.mockReturnValue(null);

    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const { Command } = await import('commander');
    const program = new Command();
    program.exitOverride();
    program.addCommand(createWatchCommand());

    await program.parseAsync(['node', 'tmr', 'watch']);

    const errOutput = (stderrSpy.mock.calls as [string][]).map((c) => c[0]).join('');
    expect(errOutput).toContain('No AI provider configured');
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
    stderrSpy.mockRestore();
  });

  it('prints error and sets exitCode=1 when no API key configured', async () => {
    mockGetProviderConfig.mockReturnValue(null);

    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const { Command } = await import('commander');
    const program = new Command();
    program.exitOverride();
    program.addCommand(createWatchCommand());

    await program.parseAsync(['node', 'tmr', 'watch']);

    const errOutput = (stderrSpy.mock.calls as [string][]).map((c) => c[0]).join('');
    expect(errOutput).toContain('No API key');
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
    stderrSpy.mockRestore();
  });
});
