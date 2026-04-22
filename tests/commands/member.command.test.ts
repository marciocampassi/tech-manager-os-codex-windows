import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// ── Mock declarations (must precede dynamic imports) ──────────────────────────

const mockGetWorkspaceRoot = jest.fn<() => string>().mockReturnValue('/fake/ws');
const mockCreateMemberFile = jest
  .fn<() => Promise<{ filePath: string; profilePath: string; wikiLink: string }>>()
  .mockResolvedValue({
    filePath: '/fake/ws/my-teams/members/john@co.com/1on1s/2026-03-07-john@co.com-1on1.md',
    profilePath: '/fake/ws/my-teams/members/john@co.com/john@co.com.md',
    wikiLink: '- [[1on1s/2026-03-07-john@co.com-1on1.md]]',
  });
const mockCreateMember = jest
  .fn<() => Promise<{ created: boolean }>>()
  .mockResolvedValue({ created: true });
const mockFindMember = jest
  .fn<() => Promise<string | null>>()
  .mockResolvedValue('/fake/ws/my-teams/members/john@co.com/john@co.com.md');

const mockMemberServiceInstance = {
  getWorkspaceRoot: mockGetWorkspaceRoot,
  createMemberFile: mockCreateMemberFile,
  createMember: mockCreateMember,
  findMember: mockFindMember,
};

jest.unstable_mockModule('../../src/services/member.service.js', () => ({
  MemberService: jest.fn(() => mockMemberServiceInstance),
  memberService: mockMemberServiceInstance,
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

// Dynamic imports after mocks
const { createMemberCommand, runMemberAdd } = await import('../../src/commands/member.command.js');

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('member command', () => {
  let stdoutSpy: ReturnType<typeof jest.spyOn>;
  let stderrSpy: ReturnType<typeof jest.spyOn>;
  let exitCodeSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitCodeSpy = jest.spyOn(process, 'exitCode', 'set').mockImplementation(() => {});
    jest.clearAllMocks();
    mockGetWorkspaceRoot.mockReturnValue('/fake/ws');
    mockCreateMemberFile.mockResolvedValue({
      filePath: '/fake/ws/my-teams/members/john@co.com/1on1s/2026-03-07-john@co.com-1on1.md',
      profilePath: '/fake/ws/my-teams/members/john@co.com/john@co.com.md',
      wikiLink: '- [[1on1s/2026-03-07-john@co.com-1on1.md]]',
    });
    mockCreateMember.mockResolvedValue({ created: true });
    mockPrompt.mockResolvedValue({});
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    exitCodeSpy.mockRestore();
  });

  // ── `tmr member add <type> <email>` ──────────────────────────────────────────

  describe('type-first routing', () => {
    it('creates 1on1 file via Commander add subcommand', async () => {
      const cmd = createMemberCommand();
      await cmd.parseAsync(['add', '1on1', 'john@co.com'], { from: 'user' });

      expect(mockCreateMemberFile).toHaveBeenCalledWith(
        'john@co.com',
        '1on1',
        expect.objectContaining({}),
        '/fake/ws',
      );
    });

    it('creates feedback file', async () => {
      const cmd = createMemberCommand();
      await cmd.parseAsync(['add', 'feedback', 'john@co.com'], { from: 'user' });

      expect(mockCreateMemberFile).toHaveBeenCalledWith(
        'john@co.com',
        'feedback',
        expect.any(Object),
        '/fake/ws',
      );
    });

    it('creates assessment file', async () => {
      const cmd = createMemberCommand();
      await cmd.parseAsync(['add', 'assessment', 'john@co.com'], { from: 'user' });

      expect(mockCreateMemberFile).toHaveBeenCalledWith(
        'john@co.com',
        'assessment',
        expect.any(Object),
        '/fake/ws',
      );
    });

    it('creates performance-review file', async () => {
      const cmd = createMemberCommand();
      await cmd.parseAsync(['add', 'performance-review', 'john@co.com'], { from: 'user' });

      expect(mockCreateMemberFile).toHaveBeenCalledWith(
        'john@co.com',
        'performance-review',
        expect.any(Object),
        '/fake/ws',
      );
    });

    it('passes --date option to service', async () => {
      const cmd = createMemberCommand();
      await cmd.parseAsync(['add', '1on1', 'john@co.com', '--date', '2026-01-15'], {
        from: 'user',
      });

      expect(mockCreateMemberFile).toHaveBeenCalledWith(
        'john@co.com',
        '1on1',
        expect.objectContaining({ date: '2026-01-15' }),
        '/fake/ws',
      );
    });

    it('prints success output with file and wiki-link info', async () => {
      const cmd = createMemberCommand();
      await cmd.parseAsync(['add', '1on1', 'john@co.com'], { from: 'user' });

      const output = stdoutSpy.mock.calls.map((c: unknown[]) => c[0]).join('');
      expect(output).toContain('1on1s/2026-03-07-john@co.com-1on1.md');
    });
  });

  // ── email-first routing ───────────────────────────────────────────────────────

  describe('email-first routing (member creation mode)', () => {
    it('calls createMember when first arg is a valid email', async () => {
      mockPrompt.mockResolvedValue({ name: '', gender: '', role: '' });

      await runMemberAdd(mockMemberServiceInstance as never, 'newuser@co.com', undefined, {});

      expect(mockCreateMember).toHaveBeenCalledWith(
        'newuser@co.com',
        expect.objectContaining({}),
        '/fake/ws',
      );
      expect(mockCreateMemberFile).not.toHaveBeenCalled();
    });

    it('prints success when member is created', async () => {
      mockPrompt.mockResolvedValue({ name: '', gender: '', role: '' });
      mockCreateMember.mockResolvedValue({ created: true });

      await runMemberAdd(mockMemberServiceInstance as never, 'newuser@co.com', undefined, {});

      const output = stdoutSpy.mock.calls.map((c: unknown[]) => c[0]).join('');
      expect(output).toContain('newuser@co.com');
    });

    it('prints already-exists message when member profile exists', async () => {
      mockPrompt.mockResolvedValue({ name: '', gender: '', role: '' });
      mockCreateMember.mockResolvedValue({ created: false });

      await runMemberAdd(mockMemberServiceInstance as never, 'existing@co.com', undefined, {});

      const output = stdoutSpy.mock.calls.map((c: unknown[]) => c[0]).join('');
      expect(output).toContain('already exists');
    });
  });

  // ── Interactive prompt ────────────────────────────────────────────────────────

  describe('interactive mode (type-first without email)', () => {
    it('prompts for email when email argument is missing', async () => {
      mockPrompt.mockResolvedValueOnce({ resolvedEmail: 'alice@co.com' } as Record<string, string>);
      mockCreateMemberFile.mockResolvedValueOnce({
        filePath: '/fake/ws/my-teams/members/alice@co.com/1on1s/2026-03-07-alice@co.com-1on1.md',
        profilePath: '/fake/ws/my-teams/members/alice@co.com/alice@co.com.md',
        wikiLink: '- [[1on1s/2026-03-07-alice@co.com-1on1.md]]',
      });

      await runMemberAdd(mockMemberServiceInstance as never, '1on1', undefined, {});

      expect(mockPrompt).toHaveBeenCalled();
      expect(mockCreateMemberFile).toHaveBeenCalledWith(
        'alice@co.com',
        '1on1',
        expect.any(Object),
        '/fake/ws',
      );
    });
  });

  // ── Error handling ────────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('prints error and sets exitCode when type is invalid', async () => {
      await runMemberAdd(mockMemberServiceInstance as never, 'invalid-type', 'john@co.com', {});

      const errOutput = stderrSpy.mock.calls.map((c: unknown[]) => c[0]).join('');
      expect(errOutput).toContain('Unknown type');
      expect(exitCodeSpy).toHaveBeenCalledWith(1);
    });

    it('prints error and sets exitCode when member not found', async () => {
      mockCreateMemberFile.mockRejectedValueOnce(
        new Error("Member 'john@co.com' not found. Run 'tmr team add <team> john@co.com' first."),
      );

      await runMemberAdd(mockMemberServiceInstance as never, '1on1', 'john@co.com', {});

      const errOutput = stderrSpy.mock.calls.map((c: unknown[]) => c[0]).join('');
      expect(errOutput).toContain('not found');
      expect(exitCodeSpy).toHaveBeenCalledWith(1);
    });
  });
});
