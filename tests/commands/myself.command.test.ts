import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// ── Mock declarations (must precede dynamic imports) ──────────────────────────

const mockGetWorkspaceRoot = jest.fn<() => string>().mockReturnValue('/fake/ws');
const mockAddPerformanceReview = jest
  .fn<() => Promise<{ filePath: string; profilePath: string }>>()
  .mockResolvedValue({
    filePath: '/fake/ws/my-career/2026-05-performance-review-me@co.com.md',
    profilePath: '/fake/ws/my-career/me@co.com.md',
  });

const mockSetManager = jest
  .fn<
    () => Promise<{
      selfPath: string;
      leaderPath: string;
      newManagerEmail: string;
      previousManagerEmail: string | null;
      changed: boolean;
    }>
  >()
  .mockResolvedValue({
    selfPath: '/fake/ws/my-career/me@co.com.md',
    leaderPath: '/fake/ws/my-leadership/chef@co.com/chef@co.com.md',
    newManagerEmail: 'chef@co.com',
    previousManagerEmail: 'marlon@co.com',
    changed: true,
  });

const mockMyselfServiceInstance = {
  getWorkspaceRoot: mockGetWorkspaceRoot,
  addPerformanceReview: mockAddPerformanceReview,
  setManager: mockSetManager,
};

jest.unstable_mockModule('../../src/services/myself.service.js', () => ({
  MyselfService: jest.fn(() => mockMyselfServiceInstance),
  myselfService: mockMyselfServiceInstance,
}));

// ── Dynamic imports (after mocks) ─────────────────────────────────────────────

const { runMyselfAddPerformanceReview, runMyselfSetManager, createMyselfCommand } =
  await import('../../src/commands/myself.command.js');

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('myself command', () => {
  let stdoutSpy: jest.SpiedFunction<typeof process.stdout.write>;
  let stderrSpy: jest.SpiedFunction<typeof process.stderr.write>;

  beforeEach(() => {
    stdoutSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true) as jest.SpiedFunction<typeof process.stdout.write>;
    stderrSpy = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true) as jest.SpiedFunction<typeof process.stderr.write>;
    process.exitCode = 0;
  });

  afterEach(() => {
    jest.clearAllMocks();
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    process.exitCode = 0;
  });

  describe('runMyselfAddPerformanceReview', () => {
    it('outputs created file path on success', async () => {
      await runMyselfAddPerformanceReview(mockMyselfServiceInstance as never, {});

      expect(stdoutSpy).toHaveBeenCalledWith(
        expect.stringContaining('2026-05-performance-review-me@co.com.md'),
      );
    });

    it('outputs profile updated path on success', async () => {
      await runMyselfAddPerformanceReview(mockMyselfServiceInstance as never, {});

      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('me@co.com.md'));
    });

    it('passes --date option to addPerformanceReview', async () => {
      await runMyselfAddPerformanceReview(mockMyselfServiceInstance as never, {
        date: '2026-03',
      });

      expect(mockAddPerformanceReview).toHaveBeenCalledWith({ date: '2026-03' }, '/fake/ws');
    });

    it('prints error and sets exitCode=1 on failure', async () => {
      mockAddPerformanceReview.mockRejectedValueOnce(
        new Error('No self-profile found in my-career/. Run tmr init first.'),
      );

      await runMyselfAddPerformanceReview(mockMyselfServiceInstance as never, {});

      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('No self-profile found'));
      expect(process.exitCode).toBe(1);
    });

    it('sets exitCode=1 when getWorkspaceRoot throws (workspace resolution failure)', async () => {
      mockGetWorkspaceRoot.mockImplementationOnce(() => {
        throw new Error('No tmr vault found');
      });

      await runMyselfAddPerformanceReview(mockMyselfServiceInstance as never, {});

      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('No tmr vault found'));
      expect(process.exitCode).toBe(1);
    });
  });

  describe('runMyselfSetManager', () => {
    it('prints a success summary including the new and previous manager', async () => {
      await runMyselfSetManager(mockMyselfServiceInstance as never, 'chef@co.com');

      expect(mockSetManager).toHaveBeenCalledWith('chef@co.com', '/fake/ws');
      expect(stdoutSpy).toHaveBeenCalledWith(
        expect.stringContaining('Current manager set to chef@co.com'),
      );
      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('marlon@co.com'));
      expect(process.exitCode).toBe(0);
    });

    it('prints a no-change notice when already the current manager', async () => {
      mockSetManager.mockResolvedValueOnce({
        selfPath: '/fake/ws/my-career/me@co.com.md',
        leaderPath: '/fake/ws/my-leadership/chef@co.com/chef@co.com.md',
        newManagerEmail: 'chef@co.com',
        previousManagerEmail: null,
        changed: false,
      });

      await runMyselfSetManager(mockMyselfServiceInstance as never, 'chef@co.com');

      expect(stdoutSpy).toHaveBeenCalledWith(
        expect.stringContaining('already your current manager'),
      );
    });

    it('prints error and sets exitCode=1 on failure', async () => {
      mockSetManager.mockRejectedValueOnce(
        new Error('Leader "chef@co.com" not found in my-leadership/.'),
      );

      await runMyselfSetManager(mockMyselfServiceInstance as never, 'chef@co.com');

      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('not found in my-leadership'));
      expect(process.exitCode).toBe(1);
    });
  });

  // ── createMyselfCommand CLI wiring ───────────────────────────────────────────

  describe('createMyselfCommand', () => {
    it('routes `add performance-review --date` to addPerformanceReview with correct opts', async () => {
      const cmd = createMyselfCommand();
      await cmd.parseAsync(['add', 'performance-review', '--date', '2026-03'], { from: 'user' });

      expect(mockAddPerformanceReview).toHaveBeenCalledWith({ date: '2026-03' }, '/fake/ws');
    });

    it('routes `add performance-review` without --date (opts.date undefined)', async () => {
      const cmd = createMyselfCommand();
      await cmd.parseAsync(['add', 'performance-review'], { from: 'user' });

      expect(mockAddPerformanceReview).toHaveBeenCalledWith({ date: undefined }, '/fake/ws');
    });

    it('routes `set-manager <email>` to setManager', async () => {
      const cmd = createMyselfCommand();
      await cmd.parseAsync(['set-manager', 'chef@co.com'], { from: 'user' });

      expect(mockSetManager).toHaveBeenCalledWith('chef@co.com', '/fake/ws');
    });
  });
});
