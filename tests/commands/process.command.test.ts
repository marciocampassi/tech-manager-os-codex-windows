import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// ── Mock declarations (all before dynamic import) ──────────────────────────────

const mockInitialize = jest.fn<() => void>();
const mockGetActiveProvider = jest.fn<() => string | undefined>();
const mockGetProviderConfig =
  jest.fn<
    (
      p: string,
    ) => { api_key_encrypted?: string; model?: string; configured_date?: string } | undefined
  >();
const mockGetConfidenceThreshold = jest.fn<() => number>().mockReturnValue(0.75);

jest.unstable_mockModule('../../src/services/config.service.js', () => ({
  configService: {
    initialize: mockInitialize,
    getActiveProvider: mockGetActiveProvider,
    getProviderConfig: mockGetProviderConfig,
    getConfidenceThreshold: mockGetConfidenceThreshold,
  },
}));

jest.unstable_mockModule('../../src/providers/ai-provider-factory.js', () => ({
  AIProviderFactory: { create: jest.fn(() => ({})) },
}));

const mockRun = jest.fn<() => Promise<unknown>>();
jest.unstable_mockModule('../../src/services/inbox-process.service.js', () => ({
  InboxProcessService: jest.fn().mockImplementation(() => ({ run: mockRun })),
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

jest.unstable_mockModule('../../src/utils/workspace.js', () => ({
  getWorkspaceRoot: jest.fn(() => '/test/workspace'),
}));

// ── Dynamic import (after all mocks) ──────────────────────────────────────────

const { runProcess } = await import('../../src/commands/process.command.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

const FULL_PROCESS_SUMMARY = {
  success: true as const,
  data: {
    filesScanned: 0,
    filesCategorizedOk: 0,
    needsReviewCount: 0,
    memberContextUpdates: 0,
    projectContextUpdates: 0,
    tasksAdded: 0,
    tasksMarkedDone: 0,
    taskError: null,
    filesOrganizedOk: 0,
    categorizeErrors: [],
    contextErrors: [],
    organizeErrors: [],
    suggestedActions: [],
    dryRun: false,
  },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('runProcess — API key pre-check (AC: 1, 2, 3, 5)', () => {
  let stdoutSpy: ReturnType<typeof jest.spyOn>;
  let stderrSpy: ReturnType<typeof jest.spyOn>;
  const originalExitCode = process.exitCode;

  beforeEach(() => {
    jest.clearAllMocks();
    process.exitCode = 0;
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    mockRun.mockResolvedValue(FULL_PROCESS_SUMMARY);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it('exits with code 78 and message directing to tmr config when no provider is configured', async () => {
    mockGetActiveProvider.mockReturnValue(undefined);

    await runProcess({ dryRun: false, verbose: false, plain: true });

    const errOutput = (stderrSpy.mock.calls as [string][]).map((c) => c[0]).join('');
    expect(errOutput).toContain('tmr config');
    expect(errOutput).toContain('API key');
    expect(process.exitCode).toBe(78);
  });

  it('exits with code 78 and message directing to tmr config when provider has no API key', async () => {
    mockGetActiveProvider.mockReturnValue('openai');
    mockGetProviderConfig.mockReturnValue({ api_key_encrypted: undefined });

    await runProcess({ dryRun: false, verbose: false, plain: true });

    const errOutput = (stderrSpy.mock.calls as [string][]).map((c) => c[0]).join('');
    expect(errOutput).toContain('tmr config');
    expect(errOutput).toContain('API key');
    expect(process.exitCode).toBe(78);
  });

  it('does not exit with code 78 when API key is configured and proceeds normally', async () => {
    mockGetActiveProvider.mockReturnValue('openai');
    mockGetProviderConfig.mockReturnValue({ api_key_encrypted: 'sk-test-key' });

    await runProcess({ dryRun: false, verbose: false, plain: true });

    expect(process.exitCode).not.toBe(78);
    expect(mockRun).toHaveBeenCalledTimes(1);
  });
});
