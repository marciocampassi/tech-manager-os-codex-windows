import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// ── Mock declarations (must precede dynamic imports) ──────────────────────────

const mockGetWorkspaceRoot = jest.fn<() => string>().mockReturnValue('/fake/ws');
const mockCreateMemberFile = jest
  .fn<() => Promise<{ filePath: string; profilePath: string; wikiLink: string }>>()
  .mockResolvedValue({
    filePath: '/fake/ws/my-teams/members/john@co.com/1on1s/2026-03-07-1on1-john@co.com.md',
    profilePath: '/fake/ws/my-teams/members/john@co.com/john@co.com.md',
    wikiLink: '- [[1on1s/2026-03-07-1on1-john@co.com.md]]',
  });
const mockAddMember = jest
  .fn<() => Promise<{ created: boolean }>>()
  .mockResolvedValue({ created: true });
const mockFindMember = jest
  .fn<() => Promise<string | null>>()
  .mockResolvedValue('/fake/ws/my-teams/members/john@co.com/john@co.com.md');

const mockGetInternalDomains = jest.fn<() => Promise<string[]>>().mockResolvedValue([]);
const mockAppendInternalDomain = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);

const mockMemberServiceInstance = {
  getWorkspaceRoot: mockGetWorkspaceRoot,
  createMemberFile: mockCreateMemberFile,
  addMember: mockAddMember,
  findMember: mockFindMember,
  getInternalDomains: mockGetInternalDomains,
  appendInternalDomain: mockAppendInternalDomain,
};

jest.unstable_mockModule('../../src/services/member.service.js', () => ({
  MemberService: jest.fn(() => mockMemberServiceInstance),
  memberService: mockMemberServiceInstance,
}));

const mockFindSimilarEmail = jest
  .fn<(email: string, ws: string) => string | null>()
  .mockReturnValue(null);
jest.unstable_mockModule('../../src/utils/email-similarity.js', () => ({
  findSimilarEmail: mockFindSimilarEmail,
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
    yellow: (s: string) => s,
  },
}));

const mockResolveSelfEmail = jest.fn<() => Promise<string | null>>().mockResolvedValue(null);
jest.unstable_mockModule('../../src/utils/self-email.js', () => ({
  resolveSelfEmail: mockResolveSelfEmail,
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
    mockFindSimilarEmail.mockReturnValue(null);
    mockGetWorkspaceRoot.mockReturnValue('/fake/ws');
    mockCreateMemberFile.mockResolvedValue({
      filePath: '/fake/ws/my-teams/members/john@co.com/1on1s/2026-03-07-1on1-john@co.com.md',
      profilePath: '/fake/ws/my-teams/members/john@co.com/john@co.com.md',
      wikiLink: '- [[1on1s/2026-03-07-1on1-john@co.com.md]]',
    });
    mockAddMember.mockResolvedValue({ created: true });
    mockGetInternalDomains.mockResolvedValue([]);
    mockPrompt.mockResolvedValue({});
    mockResolveSelfEmail.mockResolvedValue(null);
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

    it('creates feedback file (self-email resolved from my-career/)', async () => {
      mockResolveSelfEmail.mockResolvedValueOnce('manager@co.com');
      const cmd = createMemberCommand();
      await cmd.parseAsync(['add', 'feedback', 'john@co.com'], { from: 'user' });

      expect(mockCreateMemberFile).toHaveBeenCalledWith(
        'john@co.com',
        'feedback',
        expect.objectContaining({ fromEmail: 'manager@co.com' }),
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
      expect(output).toContain('1on1s/2026-03-07-1on1-john@co.com.md');
    });
  });

  // ── email-first routing ───────────────────────────────────────────────────────

  describe('email-first routing (member creation mode)', () => {
    it('calls addMember when first arg is a valid email', async () => {
      mockPrompt.mockResolvedValue({ name: '', gender: '', role: '', location: '' });

      await runMemberAdd(mockMemberServiceInstance as never, 'newuser@co.com', undefined, {});

      expect(mockAddMember).toHaveBeenCalledWith(
        'newuser@co.com',
        expect.objectContaining({}),
        '/fake/ws',
      );
      expect(mockCreateMemberFile).not.toHaveBeenCalled();
    });

    it('MEM-INT-001: no --team flag routes to company scope (addMember called without team)', async () => {
      mockPrompt.mockResolvedValue({ name: '', gender: '', role: '', location: '' });
      const cmd = createMemberCommand();
      await cmd.parseAsync(['add', 'joao@company.com'], { from: 'user' });

      expect(mockAddMember).toHaveBeenCalledWith(
        'joao@company.com',
        expect.not.objectContaining({ team: expect.anything() }),
        '/fake/ws',
      );
    });

    it('MEM-INT-002: --team flag routes to team scope (addMember called with team)', async () => {
      mockPrompt.mockResolvedValue({ name: '', gender: '', role: '', location: '' });
      const cmd = createMemberCommand();
      await cmd.parseAsync(['add', 'joao@company.com', '--team', 'backend'], { from: 'user' });

      expect(mockAddMember).toHaveBeenCalledWith(
        'joao@company.com',
        expect.objectContaining({ team: 'backend' }),
        '/fake/ws',
      );
    });

    it('prints success when member is created', async () => {
      mockPrompt.mockResolvedValue({ name: '', gender: '', role: '', location: '' });
      mockAddMember.mockResolvedValue({ created: true });

      await runMemberAdd(mockMemberServiceInstance as never, 'newuser@co.com', undefined, {});

      const output = stdoutSpy.mock.calls.map((c: unknown[]) => c[0]).join('');
      expect(output).toContain('newuser@co.com');
    });

    it('prints already-exists message when member profile exists', async () => {
      mockPrompt.mockResolvedValue({ name: '', gender: '', role: '', location: '' });
      mockAddMember.mockResolvedValue({ created: false });

      await runMemberAdd(mockMemberServiceInstance as never, 'existing@co.com', undefined, {});

      const output = stdoutSpy.mock.calls.map((c: unknown[]) => c[0]).join('');
      expect(output).toContain('already exists');
    });
  });

  // ── Domain-check + contractor routing (FR41 / FR42) ──────────────────────────

  describe('domain-check and contractor routing', () => {
    it('FR41: does not prompt when internal_domains list is empty', async () => {
      mockGetInternalDomains.mockResolvedValue([]);
      mockPrompt.mockResolvedValue({ name: '', gender: '', role: '', location: '' });

      await runMemberAdd(mockMemberServiceInstance as never, 'ext@partner.com', undefined, {});

      // Only the name/gender/role prompt should have been called — no routing prompt
      expect(mockAddMember).toHaveBeenCalledWith(
        'ext@partner.com',
        expect.objectContaining({ contractor: false }),
        '/fake/ws',
      );
    });

    it('FR41: does not prompt when email domain matches internal list', async () => {
      mockGetInternalDomains.mockResolvedValue(['internal.com']);
      mockPrompt.mockResolvedValue({ name: '', gender: '', role: '', location: '' });

      await runMemberAdd(mockMemberServiceInstance as never, 'user@internal.com', undefined, {});

      expect(mockAddMember).toHaveBeenCalledWith(
        'user@internal.com',
        expect.objectContaining({ contractor: false }),
        '/fake/ws',
      );
    });

    it('FR41: prompts routing when email domain is external and internal_domains is configured', async () => {
      mockGetInternalDomains.mockResolvedValue(['internal.com']);
      // Prompt order in runMemberAdd: (1) name/gender/role/location, (2) routing (no company prompt)
      mockPrompt
        .mockResolvedValueOnce({ name: '', gender: '', role: '', location: '' } as Record<
          string,
          string
        >)
        .mockResolvedValueOnce({ routing: 'contractor' } as Record<string, string>);

      await runMemberAdd(mockMemberServiceInstance as never, 'ext@partner.com', undefined, {});

      expect(mockAddMember).toHaveBeenCalledWith(
        'ext@partner.com',
        expect.objectContaining({ contractor: true }),
        '/fake/ws',
      );
    });

    it('FR41: routes to member (not contractor) when user picks member in prompt', async () => {
      mockGetInternalDomains.mockResolvedValue(['internal.com']);
      // Prompt order: (1) name/gender/role/location, (2) routing → member (no company prompt)
      mockPrompt
        .mockResolvedValueOnce({ name: '', gender: '', role: '', location: '' } as Record<
          string,
          string
        >)
        .mockResolvedValueOnce({ routing: 'member' } as Record<string, string>);

      await runMemberAdd(mockMemberServiceInstance as never, 'ext@partner.com', undefined, {});

      expect(mockAddMember).toHaveBeenCalledWith(
        'ext@partner.com',
        expect.objectContaining({ contractor: false }),
        '/fake/ws',
      );
    });

    it('FR41: --contractor flag bypasses routing prompt entirely', async () => {
      mockGetInternalDomains.mockResolvedValue(['internal.com']);
      // Prompt order: (1) name/gender/role/location only (routing skipped, no company prompt)
      mockPrompt.mockResolvedValueOnce({ name: '', gender: '', role: '', location: '' } as Record<
        string,
        string
      >);

      await runMemberAdd(mockMemberServiceInstance as never, 'ext@partner.com', undefined, {
        contractor: true,
      });

      // only name/gender/role (1) should fire — no routing prompt, no company prompt
      expect(mockPrompt).toHaveBeenCalledTimes(1);
      expect(mockAddMember).toHaveBeenCalledWith(
        'ext@partner.com',
        expect.objectContaining({ contractor: true }),
        '/fake/ws',
      );
    });

    it('P2: gracefully skips domain check when getInternalDomains throws (I/O error)', async () => {
      mockGetInternalDomains.mockRejectedValueOnce(new Error('EACCES: permission denied'));
      mockPrompt.mockResolvedValue({ name: '', gender: '', role: '', location: '' });

      await runMemberAdd(mockMemberServiceInstance as never, 'ext@partner.com', undefined, {});

      // should still create the member — no crash, no routing prompt
      expect(mockAddMember).toHaveBeenCalledWith(
        'ext@partner.com',
        expect.objectContaining({ contractor: false }),
        '/fake/ws',
      );
    });

    it('9.5: contractor routing — no company-name prompt fires (company field removed)', async () => {
      mockGetInternalDomains.mockResolvedValue(['internal.com']);
      // Prompt order: (1) name/gender/role/location, (2) routing → contractor (no third prompt)
      mockPrompt
        .mockResolvedValueOnce({ name: '', gender: '', role: '', location: '' } as Record<
          string,
          string
        >)
        .mockResolvedValueOnce({ routing: 'contractor' } as Record<string, string>);

      await runMemberAdd(mockMemberServiceInstance as never, 'ext@partner.com', undefined, {});

      expect(mockPrompt).toHaveBeenCalledTimes(2);
      expect(mockAddMember).toHaveBeenCalledWith(
        'ext@partner.com',
        expect.not.objectContaining({ company: expect.anything() }),
        '/fake/ws',
      );
    });
  });

  // ── Story 9.7 — location prompt ──────────────────────────────────────────────

  describe('9.7: location prompt', () => {
    it('9.7: prompts for location when --location flag is not provided', async () => {
      mockPrompt.mockResolvedValueOnce({ name: '', gender: '', role: '', location: 'Berlin' });

      await runMemberAdd(mockMemberServiceInstance as never, 'user@co.com', undefined, {});

      expect(mockAddMember).toHaveBeenCalledWith(
        'user@co.com',
        expect.objectContaining({ location: 'Berlin' }),
        '/fake/ws',
      );
    });

    it('9.7: skips location prompt and uses --location flag value', async () => {
      // --location flag provided; location question filtered out — prompt returns only name/gender/role
      mockPrompt.mockResolvedValueOnce({ name: '', gender: '', role: '' });

      await runMemberAdd(mockMemberServiceInstance as never, 'user@co.com', undefined, {
        location: 'São Paulo',
      });

      expect(mockAddMember).toHaveBeenCalledWith(
        'user@co.com',
        expect.objectContaining({ location: 'São Paulo' }),
        '/fake/ws',
      );
    });

    it('9.7: location prompt fires for --team flag (no --location)', async () => {
      mockPrompt.mockResolvedValueOnce({ name: '', gender: '', role: '', location: 'Remote' });

      await runMemberAdd(mockMemberServiceInstance as never, 'user@co.com', undefined, {
        team: 'backend',
      });

      expect(mockAddMember).toHaveBeenCalledWith(
        'user@co.com',
        expect.objectContaining({ location: 'Remote', team: 'backend' }),
        '/fake/ws',
      );
    });

    it('9.7: location prompt fires for --contractor flag (no --location)', async () => {
      mockPrompt.mockResolvedValueOnce({ name: '', gender: '', role: '', location: 'NYC' });

      await runMemberAdd(mockMemberServiceInstance as never, 'user@co.com', undefined, {
        contractor: true,
      });

      expect(mockAddMember).toHaveBeenCalledWith(
        'user@co.com',
        expect.objectContaining({ location: 'NYC', contractor: true }),
        '/fake/ws',
      );
    });
  });

  // ── Story 9.8 — email similarity warning ─────────────────────────────────────

  describe('9.8: email similarity warning', () => {
    it('9.8: aborts and skips addMember when user confirms similar email (Y)', async () => {
      mockFindSimilarEmail.mockReturnValueOnce('newuser@co.com');
      mockPrompt.mockResolvedValueOnce({ proceed: true } as unknown as Record<string, string>); // Y = "yes I meant that" → abort

      await runMemberAdd(mockMemberServiceInstance as never, 'newusr@co.com', undefined, {});

      expect(mockAddMember).not.toHaveBeenCalled();
    });

    it('9.8: continues with original email when user declines similar (N)', async () => {
      mockFindSimilarEmail.mockReturnValueOnce('newuser@co.com');
      mockPrompt
        .mockResolvedValueOnce({ proceed: false } as unknown as Record<string, string>) // N = "continue with my email"
        .mockResolvedValueOnce({ name: '', gender: '', role: '', location: '' });

      await runMemberAdd(mockMemberServiceInstance as never, 'newusr@co.com', undefined, {});

      expect(mockAddMember).toHaveBeenCalledWith('newusr@co.com', expect.any(Object), '/fake/ws');
    });

    it('9.8: proceeds without warning when no similar email exists', async () => {
      mockFindSimilarEmail.mockReturnValueOnce(null);
      mockPrompt.mockResolvedValueOnce({ name: '', gender: '', role: '', location: '' });

      await runMemberAdd(mockMemberServiceInstance as never, 'unique@co.com', undefined, {});

      expect(mockAddMember).toHaveBeenCalledWith('unique@co.com', expect.any(Object), '/fake/ws');
      // Prompt should only be called once (name/gender/role/location) — no similarity prompt
      expect(mockPrompt).toHaveBeenCalledTimes(1);
    });
  });

  // ── Interactive prompt ────────────────────────────────────────────────────────

  describe('interactive mode (type-first without email)', () => {
    it('prompts for email when email argument is missing', async () => {
      mockPrompt.mockResolvedValueOnce({ resolvedEmail: 'alice@co.com' } as Record<string, string>);
      mockCreateMemberFile.mockResolvedValueOnce({
        filePath: '/fake/ws/my-teams/members/alice@co.com/1on1s/2026-03-07-1on1-alice@co.com.md',
        profilePath: '/fake/ws/my-teams/members/alice@co.com/alice@co.com.md',
        wikiLink: '- [[1on1s/2026-03-07-1on1-alice@co.com.md]]',
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

  // ── Story 9.9 — feedback --from flag and self-email resolution ───────────────

  describe('9.9: feedback --from flag and self-email resolution', () => {
    it('9.9: passes --from email as fromEmail option to createMemberFile', async () => {
      const cmd = createMemberCommand();
      await cmd.parseAsync(['add', 'feedback', 'john@co.com', '--from', 'manager@co.com'], {
        from: 'user',
      });

      expect(mockCreateMemberFile).toHaveBeenCalledWith(
        'john@co.com',
        'feedback',
        expect.objectContaining({ fromEmail: 'manager@co.com' }),
        '/fake/ws',
      );
    });

    it('9.9: resolves reviewer email from self-email when --from is omitted', async () => {
      mockResolveSelfEmail.mockResolvedValueOnce('self@co.com');

      const cmd = createMemberCommand();
      await cmd.parseAsync(['add', 'feedback', 'john@co.com'], { from: 'user' });

      expect(mockCreateMemberFile).toHaveBeenCalledWith(
        'john@co.com',
        'feedback',
        expect.objectContaining({ fromEmail: 'self@co.com' }),
        '/fake/ws',
      );
    });

    it('9.9: prompts for reviewer email when --from omitted and self-email unresolvable', async () => {
      mockResolveSelfEmail.mockResolvedValueOnce(null);
      mockPrompt.mockResolvedValueOnce({ resolved: 'prompted@co.com' } as Record<string, string>);

      const cmd = createMemberCommand();
      await cmd.parseAsync(['add', 'feedback', 'john@co.com'], { from: 'user' });

      expect(mockCreateMemberFile).toHaveBeenCalledWith(
        'john@co.com',
        'feedback',
        expect.objectContaining({ fromEmail: 'prompted@co.com' }),
        '/fake/ws',
      );
    });

    it('9.9: prints error and sets exitCode when --from has invalid email', async () => {
      await runMemberAdd(mockMemberServiceInstance as never, 'feedback', 'john@co.com', {
        from: 'not-an-email',
      });

      const errOutput = stderrSpy.mock.calls.map((c: unknown[]) => c[0]).join('');
      expect(errOutput).toContain('Invalid email address');
      expect(exitCodeSpy).toHaveBeenCalledWith(1);
      expect(mockCreateMemberFile).not.toHaveBeenCalled();
    });

    it('9.9: --from email is normalized to lowercase', async () => {
      const cmd = createMemberCommand();
      await cmd.parseAsync(['add', 'feedback', 'john@co.com', '--from', 'MANAGER@CO.COM'], {
        from: 'user',
      });

      expect(mockCreateMemberFile).toHaveBeenCalledWith(
        'john@co.com',
        'feedback',
        expect.objectContaining({ fromEmail: 'manager@co.com' }),
        '/fake/ws',
      );
    });

    it('9.9: non-feedback types do not resolve fromEmail (fromEmail undefined)', async () => {
      const cmd = createMemberCommand();
      await cmd.parseAsync(['add', '1on1', 'john@co.com'], { from: 'user' });

      expect(mockCreateMemberFile).toHaveBeenCalledWith(
        'john@co.com',
        '1on1',
        expect.not.objectContaining({ fromEmail: expect.anything() }),
        '/fake/ws',
      );
      expect(mockResolveSelfEmail).not.toHaveBeenCalled();
    });
  });

  // ── Story 9.11 — 1on1 similarity check ordering ──────────────────────────────

  describe('9.11: similarity check fires before 1on1 creation (type-first path)', () => {
    // NOTE: `proceed: true` = abort. The prompt message is "Did you mean <similar>?"
    // so answering Y (true) means "yes, I meant the similar email" → abort the current one.
    // `proceed: false` = "no, continue with my original email" → createMemberFile is called.

    it('9.11: abort on similar email prevents createMemberFile call', async () => {
      mockFindSimilarEmail.mockReturnValueOnce('user1@co.com');
      mockPrompt.mockResolvedValueOnce({ proceed: true } as unknown as Record<string, string>);

      await runMemberAdd(mockMemberServiceInstance as never, '1on1', 'usr1@co.com', {});

      // P2: verify the check was invoked with the correct args
      expect(mockFindSimilarEmail).toHaveBeenCalledWith('usr1@co.com', '/fake/ws');
      // P3: verify the user was shown the warning prompt
      expect(mockPrompt).toHaveBeenCalled();
      expect(mockCreateMemberFile).not.toHaveBeenCalled();
    });

    it('9.11: continuing past similar-email warning still creates the 1on1 file', async () => {
      mockFindSimilarEmail.mockReturnValueOnce('user1@co.com');
      mockPrompt.mockResolvedValueOnce({ proceed: false } as unknown as Record<string, string>);

      await runMemberAdd(mockMemberServiceInstance as never, '1on1', 'usr1@co.com', {});

      expect(mockCreateMemberFile).toHaveBeenCalledWith(
        'usr1@co.com',
        '1on1',
        expect.any(Object),
        '/fake/ws',
      );
    });

    // P4: happy-path — no similar email found → no prompt, file created immediately
    it('9.11: no similar email found → createMemberFile called without prompt', async () => {
      mockFindSimilarEmail.mockReturnValueOnce(null);

      await runMemberAdd(mockMemberServiceInstance as never, '1on1', 'john@co.com', {});

      expect(mockFindSimilarEmail).toHaveBeenCalledWith('john@co.com', '/fake/ws');
      expect(mockPrompt).not.toHaveBeenCalled();
      expect(mockCreateMemberFile).toHaveBeenCalledWith(
        'john@co.com',
        '1on1',
        expect.any(Object),
        '/fake/ws',
      );
    });
  });

  // ── Error handling ────────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('prints InvalidEmailError and sets exitCode when first arg is not a valid email or type', async () => {
      await runMemberAdd(mockMemberServiceInstance as never, 'invalid-type', 'john@co.com', {});

      const errOutput = stderrSpy.mock.calls.map((c: unknown[]) => c[0]).join('');
      expect(errOutput).toContain('Invalid email address');
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
