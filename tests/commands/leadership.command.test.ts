import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// ── Mock declarations (must precede dynamic imports) ──────────────────────────

const mockGetWorkspaceRoot = jest.fn<() => string>().mockReturnValue('/fake/ws');
const mockAddLeadership = jest
  .fn<() => Promise<{ created: boolean }>>()
  .mockResolvedValue({ created: true });
const mockAdd1on1 = jest
  .fn<() => Promise<{ filePath: string; profilePath: string; wikiLink: string }>>()
  .mockResolvedValue({
    filePath: '/fake/ws/my-leadership/boss@co.com/1on1s/2026-03-09-boss@co.com-1on1.md',
    profilePath: '/fake/ws/my-leadership/boss@co.com/boss@co.com.md',
    wikiLink: '- [[1on1s/2026-03-09-boss@co.com-1on1.md]]',
  });
const mockListLeadership = jest
  .fn<
    () => Promise<
      {
        email: string;
        name: string;
        role: string;
        lastInteraction: string;
      }[]
    >
  >()
  .mockResolvedValue([]);
const mockFindLeadership = jest.fn<() => Promise<null>>().mockResolvedValue(null);

const mockSvcInstance = {
  getWorkspaceRoot: mockGetWorkspaceRoot,
  addLeadership: mockAddLeadership,
  add1on1: mockAdd1on1,
  listLeadership: mockListLeadership,
  findLeadership: mockFindLeadership,
};

jest.unstable_mockModule('../../src/services/leadership.service.js', () => ({
  LeadershipService: jest.fn(() => mockSvcInstance),
  leadershipService: mockSvcInstance,
}));

const mockPrompt = jest.fn<() => Promise<Record<string, string>>>();
jest.unstable_mockModule('inquirer', () => ({
  default: { prompt: mockPrompt },
}));

jest.unstable_mockModule('chalk', () => ({
  default: {
    bold: (s: string) => s,
    green: (s: string) => s,
    dim: (s: string) => s,
    red: (s: string) => s,
  },
}));

jest.unstable_mockModule('node:child_process', () => ({
  exec: jest.fn(),
}));

// Dynamic imports after mocks
const { createLeadershipCommand, runLeadershipAdd, runLeadership1on1, runLeadershipList } =
  await import('../../src/commands/leadership.command.js');

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('leadership command', () => {
  let stdoutSpy: ReturnType<typeof jest.spyOn>;
  let exitCodeSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    exitCodeSpy = jest.spyOn(process, 'exitCode', 'set').mockImplementation(() => {});
    jest.clearAllMocks();
    mockGetWorkspaceRoot.mockReturnValue('/fake/ws');
    mockAddLeadership.mockResolvedValue({ created: true });
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    exitCodeSpy.mockRestore();
  });

  // ── add ───────────────────────────────────────────────────────────────────────

  describe('tmr leadership add <email>', () => {
    it('calls addLeadership for a provided email', async () => {
      const cmd = createLeadershipCommand();
      await cmd.parseAsync(['add', 'boss@co.com'], { from: 'user' });

      expect(mockAddLeadership).toHaveBeenCalledWith('boss@co.com', expect.any(Object), '/fake/ws');
    });

    it('prints created message when new', async () => {
      await runLeadershipAdd(mockSvcInstance as never, 'boss@co.com', {});
      const output = stdoutSpy.mock.calls.map((c: unknown[]) => c[0]).join('');
      expect(output).toContain('created');
    });

    it('prints already-exists message when not new', async () => {
      mockAddLeadership.mockResolvedValueOnce({ created: false });
      await runLeadershipAdd(mockSvcInstance as never, 'boss@co.com', {});
      const output = stdoutSpy.mock.calls.map((c: unknown[]) => c[0]).join('');
      expect(output).toContain('already exists');
    });

    it('passes --name, --role, and --areas options to service', async () => {
      const cmd = createLeadershipCommand();
      await cmd.parseAsync(
        ['add', 'boss@co.com', '--name', 'The Boss', '--role', 'VP', '--areas', 'Platform'],
        { from: 'user' },
      );

      expect(mockAddLeadership).toHaveBeenCalledWith(
        'boss@co.com',
        expect.objectContaining({
          name: 'The Boss',
          role: 'VP',
          areas_of_responsibility: 'Platform',
        }),
        '/fake/ws',
      );
    });

    it('normalizes email to lowercase', async () => {
      await runLeadershipAdd(mockSvcInstance as never, 'BOSS@CO.COM', {});
      expect(mockAddLeadership).toHaveBeenCalledWith('boss@co.com', expect.any(Object), '/fake/ws');
    });
  });

  // ── add — interactive ─────────────────────────────────────────────────────────

  describe('interactive mode', () => {
    it('prompts for email and metadata when no email provided', async () => {
      mockPrompt.mockResolvedValueOnce({
        email: 'boss@co.com',
        name: 'The Boss',
        role: 'VP Engineering',
        areas_of_responsibility: 'Platform, Infra',
      } as Record<string, string>);

      await runLeadershipAdd(mockSvcInstance as never, undefined, {});

      expect(mockPrompt).toHaveBeenCalled();
      expect(mockAddLeadership).toHaveBeenCalledWith('boss@co.com', expect.any(Object), '/fake/ws');
    });
  });

  // ── 1on1 ─────────────────────────────────────────────────────────────────────

  describe('tmr leadership 1on1 <email>', () => {
    it('calls add1on1 with email and options', async () => {
      const cmd = createLeadershipCommand();
      await cmd.parseAsync(['1on1', 'boss@co.com', '--date', '2026-03-09', '--no-edit'], {
        from: 'user',
      });

      expect(mockAdd1on1).toHaveBeenCalledWith(
        'boss@co.com',
        expect.objectContaining({ date: '2026-03-09' }),
        '/fake/ws',
      );
    });

    it('prints success output', async () => {
      await runLeadership1on1(mockSvcInstance as never, 'boss@co.com', { noEdit: true });
      const output = stdoutSpy.mock.calls.map((c: unknown[]) => c[0]).join('');
      expect(output).toContain('Created:');
    });

    it('prints error and sets exitCode when leadership contact not found', async () => {
      mockAdd1on1.mockRejectedValueOnce(
        new Error(
          "Leadership 'boss@co.com' not found. Run 'tmr leadership add boss@co.com' first.",
        ),
      );
      await runLeadership1on1(mockSvcInstance as never, 'boss@co.com', { noEdit: true });

      const output = stdoutSpy.mock.calls.map((c: unknown[]) => c[0]).join('');
      expect(output).toContain('not found');
      expect(exitCodeSpy).toHaveBeenCalledWith(1);
    });

    it('prompts for email when not provided', async () => {
      mockPrompt.mockResolvedValueOnce({
        resolvedEmail: 'boss@co.com',
      } as Record<string, string>);
      await runLeadership1on1(mockSvcInstance as never, undefined, { noEdit: true });
      expect(mockPrompt).toHaveBeenCalled();
      expect(mockAdd1on1).toHaveBeenCalledWith('boss@co.com', expect.any(Object), '/fake/ws');
    });

    it('prints file path and wiki-link on success', async () => {
      await runLeadership1on1(mockSvcInstance as never, 'boss@co.com', { noEdit: true });
      const output = stdoutSpy.mock.calls.map((c: unknown[]) => c[0]).join('');
      expect(output).toContain('2026-03-09-boss@co.com-1on1.md');
      expect(output).toContain('[[1on1s/');
    });
  });

  // ── list ──────────────────────────────────────────────────────────────────────

  describe('tmr leadership list', () => {
    it('prints empty message when no leadership contacts', async () => {
      mockListLeadership.mockResolvedValueOnce([]);
      await runLeadershipList(mockSvcInstance as never);
      const output = stdoutSpy.mock.calls.map((c: unknown[]) => c[0]).join('');
      expect(output).toContain('No leadership contacts found');
    });

    it('prints table rows when contacts exist', async () => {
      mockListLeadership.mockResolvedValueOnce([
        {
          email: 'boss@co.com',
          name: 'The Boss',
          role: 'VP Engineering',
          lastInteraction: '2026-03-09',
        },
      ]);
      await runLeadershipList(mockSvcInstance as never);
      const output = stdoutSpy.mock.calls.map((c: unknown[]) => c[0]).join('');
      expect(output).toContain('boss@co.com');
      expect(output).toContain('VP Engineering');
      expect(output).toContain('2026-03-09');
    });
  });
});
