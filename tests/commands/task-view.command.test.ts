import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// ── Mock declarations (must precede dynamic imports) ──────────────────────────

const mockReadTaskFile = jest.fn<() => Promise<string>>().mockResolvedValue('');
const mockFormatHeader = jest.fn<(p: string) => string>().mockReturnValue('[HEADER]');
const mockFormatHeaderText = jest.fn<(p: string) => string>().mockReturnValue('[HEADER_TEXT]');
const mockRenderContent = jest
  .fn<(c: string, plain: boolean) => string>()
  .mockImplementation((c) => c);
const mockFormatEmptyState = jest.fn<() => string>().mockReturnValue('[EMPTY_STATE]');
const mockFormatDisplay = jest.fn<() => string>().mockReturnValue('[DISPLAY]');

const mockSvcInstance = {
  readTaskFile: mockReadTaskFile,
  formatHeader: mockFormatHeader,
  formatHeaderText: mockFormatHeaderText,
  renderContent: mockRenderContent,
  formatEmptyState: mockFormatEmptyState,
  formatDisplay: mockFormatDisplay,
};

jest.unstable_mockModule('../../src/services/task-view.service.js', () => ({
  taskViewService: mockSvcInstance,
  TaskViewService: jest.fn(() => mockSvcInstance),
}));

const mockGetWorkspaceRoot = jest.fn<() => string>().mockReturnValue('/fake/workspace');

jest.unstable_mockModule('../../src/utils/workspace.js', () => ({
  getWorkspaceRoot: mockGetWorkspaceRoot,
}));

// ── Dynamic import (after all mocks) ─────────────────────────────────────────

const { runTaskView, createTaskViewCommands } =
  await import('../../src/commands/task-view.command.js');

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('runTaskView', () => {
  let stdoutSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetWorkspaceRoot.mockReturnValue('/fake/workspace');
    mockReadTaskFile.mockResolvedValue('');
    mockFormatEmptyState.mockReturnValue('[EMPTY_STATE]');
    mockFormatDisplay.mockReturnValue('[DISPLAY]');
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it('calls readTaskFile with correct period and workspace root', async () => {
    await runTaskView('today', {}, mockSvcInstance as never);
    expect(mockReadTaskFile).toHaveBeenCalledWith('today', '/fake/workspace');
  });

  it('outputs empty state when content is empty string', async () => {
    mockReadTaskFile.mockResolvedValue('');
    await runTaskView('today', {}, mockSvcInstance as never);
    expect(mockFormatEmptyState).toHaveBeenCalledWith('today', false);
    const output = (stdoutSpy.mock.calls[0] as [string])[0];
    expect(output).toContain('[EMPTY_STATE]');
  });

  it('outputs display when content exists', async () => {
    mockReadTaskFile.mockResolvedValue('## Tasks\n\n- [ ] Do something');
    await runTaskView('today', {}, mockSvcInstance as never);
    expect(mockFormatDisplay).toHaveBeenCalledWith(
      'today',
      '## Tasks\n\n- [ ] Do something',
      false,
    );
    const output = (stdoutSpy.mock.calls[0] as [string])[0];
    expect(output).toContain('[DISPLAY]');
  });

  it('passes plain=true when --plain flag is set', async () => {
    mockReadTaskFile.mockResolvedValue('');
    await runTaskView('this-week', { plain: true }, mockSvcInstance as never);
    expect(mockFormatEmptyState).toHaveBeenCalledWith('this-week', true);
  });

  it('outputs JSON when --json flag is set', async () => {
    mockReadTaskFile.mockResolvedValue('some content');
    await runTaskView('today', { json: true }, mockSvcInstance as never);
    const output = (stdoutSpy.mock.calls[0] as [string])[0];
    const parsed = JSON.parse(output) as { period: string; content: string };
    expect(parsed.period).toBe('today');
    expect(parsed.content).toBe('some content');
  });

  it('outputs JSON with empty content when file missing and --json is set', async () => {
    mockReadTaskFile.mockResolvedValue('');
    await runTaskView('today', { json: true }, mockSvcInstance as never);
    const output = (stdoutSpy.mock.calls[0] as [string])[0];
    const parsed = JSON.parse(output) as { period: string; content: string };
    expect(parsed.content).toBe('');
  });

  it('invokes correct period for each task view command', async () => {
    const periods = ['today', 'this-week', 'this-month', 'this-quarter'] as const;
    for (const period of periods) {
      jest.clearAllMocks();
      mockReadTaskFile.mockResolvedValue('');
      mockFormatEmptyState.mockReturnValue('[EMPTY]');
      await runTaskView(period, {}, mockSvcInstance as never);
      expect(mockReadTaskFile).toHaveBeenCalledWith(period, '/fake/workspace');
    }
  });

  describe('workspace not initialized (AC 8 — cwd fallback)', () => {
    it('falls back to process.cwd() when workspace is not configured', async () => {
      const cwd = process.cwd();
      mockGetWorkspaceRoot.mockReturnValue(cwd);
      mockReadTaskFile.mockResolvedValue('');
      mockFormatEmptyState.mockReturnValue('[EMPTY_CWD]');

      await runTaskView('today', {}, mockSvcInstance as never);

      expect(mockReadTaskFile).toHaveBeenCalledWith('today', cwd);
      const output = (stdoutSpy.mock.calls[0] as [string])[0];
      expect(output).toContain('[EMPTY_CWD]');
    });

    it('shows empty state when task file is not found in cwd workspace', async () => {
      mockGetWorkspaceRoot.mockReturnValue('/some/path');
      mockReadTaskFile.mockResolvedValue('');
      mockFormatEmptyState.mockReturnValue('[EMPTY_STATE_FALLBACK]');

      await runTaskView('this-week', {}, mockSvcInstance as never);

      expect(mockFormatEmptyState).toHaveBeenCalledWith('this-week', false);
    });
  });
});

describe('createTaskViewCommands', () => {
  it('returns 4 commands', () => {
    const commands = createTaskViewCommands();
    expect(commands).toHaveLength(4);
  });

  it('returns commands named today, this-week, this-month, this-quarter', () => {
    const commands = createTaskViewCommands();
    const names = commands.map((c) => c.name());
    expect(names).toEqual(['today', 'this-week', 'this-month', 'this-quarter']);
  });

  it('each command has --plain and --json options defined', () => {
    const commands = createTaskViewCommands();
    for (const cmd of commands) {
      const optionNames = cmd.options.map((o) => o.long);
      expect(optionNames).toContain('--plain');
      expect(optionNames).toContain('--json');
    }
  });
});
