import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// ── Mock declarations (must precede dynamic imports) ──────────────────────────

const mockGetWorkspaceRoot = jest.fn<() => string>().mockReturnValue('/fake/ws');
const mockAddPerformanceReview = jest
  .fn<() => Promise<{ filePath: string; profilePath: string }>>()
  .mockResolvedValue({
    filePath: '/fake/ws/my-career/2026-05-performance-review-me@co.com.md',
    profilePath: '/fake/ws/my-career/me@co.com.md',
  });

const mockMyselfServiceInstance = {
  getWorkspaceRoot: mockGetWorkspaceRoot,
  addPerformanceReview: mockAddPerformanceReview,
};

jest.unstable_mockModule('../../src/services/myself.service.js', () => ({
  MyselfService: jest.fn(() => mockMyselfServiceInstance),
  myselfService: mockMyselfServiceInstance,
}));

// ── Dynamic imports (after mocks) ─────────────────────────────────────────────

const { runMyselfAddPerformanceReview, createMyselfCommand } =
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
  });
});
