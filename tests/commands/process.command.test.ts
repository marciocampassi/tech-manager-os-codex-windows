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

// ── Helpers ───────────────────────────────────────────────────────────────────

const ANSI_RE = /\x1b\[[0-9;]*m/;

function configuredProvider(): void {
  mockGetActiveProvider.mockReturnValue('openai');
  mockGetProviderConfig.mockReturnValue({ api_key_encrypted: 'sk-test-key' });
}

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

  it('--json: outputs valid JSON with error status when no provider is configured', async () => {
    mockGetActiveProvider.mockReturnValue(undefined);

    await runProcess({ dryRun: false, verbose: false, plain: true, json: true });

    const out = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
    const parsed = JSON.parse(out) as { status: string; message: string };
    expect(parsed.status).toBe('error');
    expect(parsed.message).toContain('API key');
    expect(process.exitCode).toBe(78);
  });
});

describe('runProcess — output format', () => {
  let stdoutSpy: ReturnType<typeof jest.spyOn>;
  let stderrSpy: ReturnType<typeof jest.spyOn>;
  const originalExitCode = process.exitCode;

  beforeEach(() => {
    jest.clearAllMocks();
    process.exitCode = 0;
    configuredProvider();
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it('summary lists filesScanned, categorized, and context update counts', async () => {
    mockRun.mockResolvedValue({
      success: true,
      data: {
        ...FULL_PROCESS_SUMMARY.data,
        filesScanned: 5,
        filesCategorizedOk: 4,
        memberContextUpdates: 2,
        projectContextUpdates: 1,
      },
    });

    await runProcess({ dryRun: false, verbose: false, plain: true });

    const out = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
    expect(out).toContain('5');
    expect(out).toContain('4');
    expect(out).toContain('2 member');
    expect(out).toContain('1 project');
  });

  it('summary shows "Flagged for review" line when needsReviewCount > 0', async () => {
    mockRun.mockResolvedValue({
      success: true,
      data: { ...FULL_PROCESS_SUMMARY.data, needsReviewCount: 3 },
    });

    await runProcess({ dryRun: false, verbose: false, plain: true });

    const out = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
    expect(out).toMatch(/[Ff]lagged/);
    expect(out).toContain('3');
  });

  it('--dry-run: header contains "(dry-run)" and task lines are skipped', async () => {
    mockRun.mockResolvedValue({
      success: true,
      data: { ...FULL_PROCESS_SUMMARY.data, dryRun: true },
    });

    await runProcess({ dryRun: true, verbose: false, plain: true });

    const out = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
    expect(out).toContain('dry-run');
    expect(out).not.toContain('Tasks added');
    expect(out).not.toContain('Tasks marked done');
  });

  it('--dry-run: summary contains "dry-run" note instead of task counts', async () => {
    mockRun.mockResolvedValue({
      success: true,
      data: { ...FULL_PROCESS_SUMMARY.data, dryRun: true },
    });

    await runProcess({ dryRun: true, verbose: false, plain: true });

    const out = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
    expect(out).toMatch(/dry.run.*skip|skip.*dry.run/i);
  });

  it('--verbose: workspace path written to stdout before pipeline', async () => {
    mockRun.mockResolvedValue(FULL_PROCESS_SUMMARY);

    await runProcess({ dryRun: false, verbose: true, plain: true });

    const out = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
    expect(out).toContain('/test/workspace');
  });

  it('--plain: stdout contains no ANSI escape codes', async () => {
    mockRun.mockResolvedValue({
      success: true,
      data: { ...FULL_PROCESS_SUMMARY.data, filesScanned: 2, needsReviewCount: 1 },
    });

    await runProcess({ dryRun: false, verbose: false, plain: true });

    const out = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
    expect(ANSI_RE.test(out)).toBe(false);
  });

  it('summary shows categorize errors when present', async () => {
    mockRun.mockResolvedValue({
      success: true,
      data: {
        ...FULL_PROCESS_SUMMARY.data,
        categorizeErrors: ['file-a.md: parse error', 'file-b.md: timeout'],
      },
    });

    await runProcess({ dryRun: false, verbose: false, plain: true });

    const out = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
    expect(out).toMatch(/[Cc]ategoriz/);
    expect(out).toContain('file-a.md');
    expect(out).toContain('file-b.md');
  });

  it('summary shows context errors when present', async () => {
    mockRun.mockResolvedValue({
      success: true,
      data: {
        ...FULL_PROCESS_SUMMARY.data,
        contextErrors: ['member/foo: write failed'],
      },
    });

    await runProcess({ dryRun: false, verbose: false, plain: true });

    const out = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
    expect(out).toMatch(/[Cc]ontext/);
    expect(out).toContain('member/foo');
  });

  it('summary shows organize errors when present', async () => {
    mockRun.mockResolvedValue({
      success: true,
      data: {
        ...FULL_PROCESS_SUMMARY.data,
        organizeErrors: ['inbox/note.md: move failed'],
      },
    });

    await runProcess({ dryRun: false, verbose: false, plain: true });

    const out = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
    expect(out).toMatch(/[Oo]rganiz/);
    expect(out).toContain('inbox/note.md');
  });

  it('service.run() returning { success: false } prints error and sets exitCode 1', async () => {
    mockRun.mockResolvedValue({ success: false, error: 'workspace not found' });

    await runProcess({ dryRun: false, verbose: false, plain: true });

    const errOut = (stderrSpy.mock.calls as [string][]).map((c) => c[0]).join('');
    expect(errOut).toContain('workspace not found');
    expect(process.exitCode).toBe(1);
  });
});

describe('runProcess — --json output', () => {
  let stdoutSpy: ReturnType<typeof jest.spyOn>;
  let stderrSpy: ReturnType<typeof jest.spyOn>;
  const originalExitCode = process.exitCode;

  beforeEach(() => {
    jest.clearAllMocks();
    process.exitCode = 0;
    configuredProvider();
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it('--json: success response has all expected keys', async () => {
    mockRun.mockResolvedValue({
      success: true,
      data: {
        ...FULL_PROCESS_SUMMARY.data,
        filesScanned: 3,
        filesCategorizedOk: 2,
        needsReviewCount: 1,
        tasksAdded: 4,
        tasksMarkedDone: 1,
        filesOrganizedOk: 2,
        dryRun: false,
      },
    });

    await runProcess({ dryRun: false, verbose: false, plain: true, json: true });

    const out = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
    const parsed = JSON.parse(out) as Record<string, unknown>;
    expect(parsed).toHaveProperty('processed', 2);
    expect(parsed).toHaveProperty('skipped', 1);
    expect(parsed).toHaveProperty('errors', 0);
    expect(parsed).toHaveProperty('tasksAdded', 4);
    expect(parsed).toHaveProperty('tasksMarkedDone', 1);
    expect(parsed).toHaveProperty('filesOrganized', 2);
    expect(parsed).toHaveProperty('dryRun', false);
  });

  it('--json: dryRun is true when --dry-run flag used', async () => {
    mockRun.mockResolvedValue({
      success: true,
      data: { ...FULL_PROCESS_SUMMARY.data, dryRun: true },
    });

    await runProcess({ dryRun: true, verbose: false, plain: true, json: true });

    const out = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
    const parsed = JSON.parse(out) as Record<string, unknown>;
    expect(parsed.dryRun).toBe(true);
  });

  it('--json: failure outputs error JSON with exitCode 1', async () => {
    mockRun.mockResolvedValue({ success: false, error: 'inbox dir missing' });

    await runProcess({ dryRun: false, verbose: false, plain: true, json: true });

    const out = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
    const parsed = JSON.parse(out) as { status: string; message: string };
    expect(parsed.status).toBe('error');
    expect(parsed.message).toContain('inbox dir missing');
    expect(process.exitCode).toBe(1);
  });

  it('--json: output contains no ANSI escape codes', async () => {
    mockRun.mockResolvedValue(FULL_PROCESS_SUMMARY);

    await runProcess({ dryRun: false, verbose: false, plain: false, json: true });

    const out = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
    expect(ANSI_RE.test(out)).toBe(false);
  });
});
