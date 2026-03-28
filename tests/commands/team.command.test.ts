import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// ── Mock declarations (must precede dynamic imports) ──────────────────────────

const mockGetWorkspaceRoot = jest.fn<() => string>().mockReturnValue('/fake/ws');
const mockCreateTeam = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockAddMember = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockListTeams = jest
  .fn<() => Promise<{ teamName: string; memberCount: number }[]>>()
  .mockResolvedValue([]);
const mockListTeamMembers = jest
  .fn<() => Promise<{ email: string; role: string; location: string; dateAdded: string }[]>>()
  .mockResolvedValue([]);
const mockArchiveMember = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockFireMember = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockShowProfile = jest.fn<() => Promise<null>>().mockResolvedValue(null);

const mockTeamServiceInstance = {
  getWorkspaceRoot: mockGetWorkspaceRoot,
  createTeam: mockCreateTeam,
  addMember: mockAddMember,
  listTeams: mockListTeams,
  listTeamMembers: mockListTeamMembers,
  archiveMember: mockArchiveMember,
  fireMember: mockFireMember,
  showProfile: mockShowProfile,
};

jest.unstable_mockModule('../../src/services/team.service.js', () => ({
  TeamService: jest.fn(() => mockTeamServiceInstance),
  teamService: mockTeamServiceInstance,
}));

jest.unstable_mockModule('../../src/services/file-system.service.js', () => ({
  FileSystemService: jest.fn(),
  fileSystemService: {},
  FileSystemError: class FileSystemError extends Error {},
  // listDirectories added in QA refactor pass
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
  },
}));

// Dynamic imports after mocks
const { createTeamCommand, runShow } = await import('../../src/commands/team.command.js');

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('team command', () => {
  let stdoutSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    jest.clearAllMocks();
    mockGetWorkspaceRoot.mockReturnValue('/fake/ws');
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  // ── team create ─────────────────────────────────────────────────────────────

  describe('team create', () => {
    it('calls createTeam with provided team name', async () => {
      const cmd = createTeamCommand();
      await cmd.parseAsync(['create', 'alpha'], { from: 'user' });
      expect(mockCreateTeam).toHaveBeenCalledWith('alpha', '/fake/ws');
    });

    it('prompts for team name when none provided', async () => {
      mockPrompt.mockResolvedValueOnce({ name: 'prompted-team' });

      const cmd = createTeamCommand();
      await cmd.parseAsync(['create'], { from: 'user' });

      expect(mockPrompt).toHaveBeenCalled();
      expect(mockCreateTeam).toHaveBeenCalledWith('prompted-team', '/fake/ws');
    });
  });

  // ── team add ────────────────────────────────────────────────────────────────

  describe('team add', () => {
    it('calls addMember with flags and secondary prompts', async () => {
      // Secondary prompt response (always shown even when flags provided)
      mockPrompt.mockResolvedValueOnce({ name: '', role: '', gender: '', location: '' });

      const cmd = createTeamCommand();
      await cmd.parseAsync(
        ['add', 'alpha', 'john@co.com', '--role', 'Engineer', '--location', 'Remote'],
        { from: 'user' },
      );
      expect(mockAddMember).toHaveBeenCalledWith(
        'alpha',
        'john@co.com',
        expect.objectContaining({ role: 'Engineer', location: 'Remote' }),
        '/fake/ws',
      );
    });

    it('prompts interactively when no args given', async () => {
      // Primary prompt (teamName + email), then secondary prompt (name/role/gender/location)
      mockPrompt
        .mockResolvedValueOnce({ teamName: 'alpha', email: 'x@co.com' })
        .mockResolvedValueOnce({ name: '', role: 'QA', gender: '', location: 'Remote' });

      const cmd = createTeamCommand();
      await cmd.parseAsync(['add'], { from: 'user' });

      expect(mockPrompt).toHaveBeenCalled();
      expect(mockAddMember).toHaveBeenCalledWith(
        'alpha',
        'x@co.com',
        expect.objectContaining({ role: 'QA' }),
        '/fake/ws',
      );
    });
  });

  // ── team list ───────────────────────────────────────────────────────────────

  describe('team list', () => {
    it('calls listTeams when no team name provided', async () => {
      mockListTeams.mockResolvedValueOnce([{ teamName: 'alpha', memberCount: 2 }]);

      const cmd = createTeamCommand();
      await cmd.parseAsync(['list'], { from: 'user' });

      expect(mockListTeams).toHaveBeenCalledWith('/fake/ws');
      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('alpha'));
    });

    it('calls listTeamMembers when team name provided', async () => {
      const cmd = createTeamCommand();
      await cmd.parseAsync(['list', 'alpha'], { from: 'user' });

      expect(mockListTeamMembers).toHaveBeenCalledWith('alpha', '/fake/ws');
    });
  });

  // ── team archive ────────────────────────────────────────────────────────────

  describe('team archive', () => {
    it('calls archiveMember with team name and email', async () => {
      const cmd = createTeamCommand();
      await cmd.parseAsync(['archive', 'alpha', 'john@co.com'], { from: 'user' });

      expect(mockArchiveMember).toHaveBeenCalledWith(
        'alpha',
        'john@co.com',
        { from: undefined, to: undefined },
        '/fake/ws',
      );
    });

    it('passes date flags to archiveMember', async () => {
      const cmd = createTeamCommand();
      await cmd.parseAsync(
        ['archive', 'alpha', 'john@co.com', '--from', '2026-01-01', '--to', '2026-03-01'],
        { from: 'user' },
      );

      expect(mockArchiveMember).toHaveBeenCalledWith(
        'alpha',
        'john@co.com',
        { from: '2026-01-01', to: '2026-03-01' },
        '/fake/ws',
      );
    });
  });

  // ── team fire ───────────────────────────────────────────────────────────────

  describe('team fire', () => {
    it('calls fireMember with team name, email, and optional note', async () => {
      mockPrompt.mockResolvedValueOnce({ terminationNote: '' });

      const cmd = createTeamCommand();
      await cmd.parseAsync(['fire', 'alpha', 'john@co.com'], { from: 'user' });

      expect(mockFireMember).toHaveBeenCalledWith('alpha', 'john@co.com', '/fake/ws', undefined);
    });

    it('passes termination note when provided', async () => {
      mockPrompt.mockResolvedValueOnce({ terminationNote: 'Performance issues' });

      const cmd = createTeamCommand();
      await cmd.parseAsync(['fire', 'alpha', 'john@co.com'], { from: 'user' });

      expect(mockFireMember).toHaveBeenCalledWith(
        'alpha',
        'john@co.com',
        '/fake/ws',
        'Performance issues',
      );
    });
  });

  // ── show (root command) ─────────────────────────────────────────────────────

  describe('runShow', () => {
    it('outputs profile content when found', async () => {
      mockShowProfile.mockResolvedValueOnce({
        location: 'member',
        filePath: '/fake/path.md',
        content: 'profile body',
      } as never);

      await runShow('john@co.com');

      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('profile body'));
    });

    it('outputs not-found message when profile missing', async () => {
      mockShowProfile.mockResolvedValueOnce(null as never);

      await runShow('nobody@co.com');

      expect(stdoutSpy).toHaveBeenCalledWith(
        expect.stringContaining('Profile not found for nobody@co.com'),
      );
    });
  });
});
