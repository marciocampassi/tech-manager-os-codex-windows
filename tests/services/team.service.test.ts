import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import matter from 'gray-matter';
import { TeamService } from '../../src/services/team.service.js';
import type { FileSystemService } from '../../src/services/file-system.service.js';

// ── Mock FileSystemService ────────────────────────────────────────────────────

type MockFS = {
  [K in keyof FileSystemService]: jest.MockedFunction<FileSystemService[K]>;
};

function createMockFS(): MockFS {
  return {
    createDirectory: jest.fn<FileSystemService['createDirectory']>().mockResolvedValue(undefined),
    writeFile: jest.fn<FileSystemService['writeFile']>().mockResolvedValue(undefined),
    readFile: jest.fn<FileSystemService['readFile']>().mockResolvedValue(''),
    moveFile: jest.fn<FileSystemService['moveFile']>().mockResolvedValue(undefined),
    exists: jest.fn<FileSystemService['exists']>().mockResolvedValue(false),
    appendFile: jest.fn<FileSystemService['appendFile']>().mockResolvedValue(undefined),
    listFiles: jest.fn<FileSystemService['listFiles']>().mockResolvedValue([]),
    listDirectories: jest.fn<FileSystemService['listDirectories']>().mockResolvedValue([]),
  };
}

const WORKSPACE = '/fake/workspace';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildProfileMd(email: string, teams: string[]): string {
  return matter.stringify('## Current Manager\n\n', {
    email,
    role: 'Engineer',
    location: 'Remote',
    teams,
    date_added: '2026-01-01',
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TeamService', () => {
  let svc: TeamService;
  let mockFS: MockFS;

  beforeEach(() => {
    mockFS = createMockFS();
    svc = new TeamService(mockFS as unknown as FileSystemService);
  });

  // ── createTeam ──────────────────────────────────────────────────────────────

  describe('createTeam', () => {
    it('creates team context and members files when team does not exist', async () => {
      mockFS.exists.mockResolvedValue(false);

      await svc.createTeam('alpha', WORKSPACE);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('_teams/alpha/alpha-context.md'),
        expect.stringContaining('team: alpha'),
      );
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('_teams/alpha/alpha-members.md'),
        expect.stringContaining('# Team Members'),
      );
    });

    it('is idempotent — skips creation when context file already exists', async () => {
      mockFS.exists.mockResolvedValue(true);

      await svc.createTeam('alpha', WORKSPACE);

      expect(mockFS.writeFile).not.toHaveBeenCalled();
    });
  });

  // ── addMember ────────────────────────────────────────────────────────────────

  describe('addMember', () => {
    it('creates full directory structure and profile for a new member', async () => {
      // team context exists, profile does not
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('alpha-context.md')) return true;
        return false;
      });
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('alpha-members.md')) return '# Team Members\n';
        if (p.includes('profile.md')) return matter.stringify('', { email: 'mgr@co.com' });
        return '';
      });

      await svc.addMember(
        'alpha',
        'John@Co.Com',
        { role: 'Engineer', location: 'Remote' },
        WORKSPACE,
      );

      // Email normalized to lowercase
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('john@co.com/john@co.com.md'),
        expect.stringContaining('email: john@co.com'),
      );
      // Subdirectories created
      expect(mockFS.createDirectory).toHaveBeenCalledWith(expect.stringContaining('1on1s'));
      expect(mockFS.createDirectory).toHaveBeenCalledWith(expect.stringContaining('feedback'));
      // Wiki-link appended
      expect(mockFS.appendFile).toHaveBeenCalledWith(
        expect.stringContaining('alpha-members.md'),
        expect.stringContaining('john@co.com'),
      );
    });

    it('appends team to existing member without recreating directory', async () => {
      const existingProfile = buildProfileMd('john@co.com', ['beta']);
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('alpha-context.md')) return true;
        if (p.includes('john@co.com.md')) return true;
        return false;
      });
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('john@co.com.md')) return existingProfile;
        if (p.includes('alpha-members.md')) return '# Team Members\n';
        return '';
      });

      await svc.addMember('alpha', 'john@co.com', {}, WORKSPACE);

      // Profile updated with appended team
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('john@co.com.md'),
        expect.stringContaining('alpha'),
      );
      // No new directories created
      expect(mockFS.createDirectory).not.toHaveBeenCalled();
    });

    it('does not duplicate wiki-link when member already in members file', async () => {
      const wikiLink = '- [[../../_members/john@co.com/john@co.com.md|john@co.com]]';
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('alpha-context.md')) return true;
        if (p.includes('john@co.com.md')) return true;
        return false;
      });
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('john@co.com.md')) return buildProfileMd('john@co.com', ['alpha']);
        if (p.includes('alpha-members.md')) return `# Team Members\n${wikiLink}\n`;
        return '';
      });

      await svc.addMember('alpha', 'john@co.com', {}, WORKSPACE);

      expect(mockFS.appendFile).not.toHaveBeenCalled();
    });

    it('auto-creates team when it does not exist', async () => {
      mockFS.exists.mockResolvedValue(false);
      mockFS.readFile.mockResolvedValue('# Team Members\n');

      await svc.addMember('newteam', 'x@co.com', {}, WORKSPACE);

      // Team context file should be created
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('_teams/newteam/newteam-context.md'),
        expect.any(String),
      );
    });
  });

  // ── listTeams ────────────────────────────────────────────────────────────────

  describe('listTeams', () => {
    it('returns empty array when teams root does not exist', async () => {
      mockFS.exists.mockResolvedValue(false);
      const result = await svc.listTeams(WORKSPACE);
      expect(result).toEqual([]);
    });
  });

  // ── listTeamMembers ──────────────────────────────────────────────────────────

  describe('listTeamMembers', () => {
    it('returns empty array when members file does not exist', async () => {
      mockFS.exists.mockResolvedValue(false);
      const result = await svc.listTeamMembers('alpha', WORKSPACE);
      expect(result).toEqual([]);
    });

    it('parses wiki-links and reads member frontmatter', async () => {
      const profileMd = matter.stringify('', {
        email: 'a@co.com',
        role: 'Engineer',
        location: 'Remote',
        date_added: '2026-01-01',
        teams: ['alpha'],
      });

      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('alpha-members.md')) return true;
        if (p.includes('a@co.com.md')) return true;
        return false;
      });
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('alpha-members.md'))
          return '# Team Members\n- [[../../_members/a@co.com/a@co.com.md|a@co.com]]\n';
        if (p.includes('a@co.com.md')) return profileMd;
        return '';
      });

      const result = await svc.listTeamMembers('alpha', WORKSPACE);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ email: 'a@co.com', role: 'Engineer' });
    });
  });

  // ── archiveMember ────────────────────────────────────────────────────────────

  describe('archiveMember', () => {
    it('moves member directory and updates frontmatter', async () => {
      const profileMd = buildProfileMd('a@co.com', ['alpha']);
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('_members/a@co.com')) return true;
        if (p.includes('a@co.com.md') && p.includes('_archived')) return true;
        return false;
      });
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('a@co.com.md')) return profileMd;
        if (p.includes('alpha-members.md'))
          return '# Team Members\n- [[../../_members/a@co.com/a@co.com.md|a@co.com]]\n';
        return '';
      });

      await svc.archiveMember('alpha', 'a@co.com', {}, WORKSPACE);

      expect(mockFS.moveFile).toHaveBeenCalledWith(
        expect.stringContaining('_members/a@co.com'),
        expect.stringContaining('_archived'),
      );
      // Frontmatter update
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('_archived'),
        expect.stringContaining('archived: true'),
      );
    });

    it('throws when member directory does not exist', async () => {
      mockFS.exists.mockResolvedValue(false);
      await expect(svc.archiveMember('alpha', 'x@co.com', {}, WORKSPACE)).rejects.toThrow(
        'not found',
      );
    });
  });

  // ── fireMember ───────────────────────────────────────────────────────────────

  describe('fireMember', () => {
    it('archives and adds termination fields', async () => {
      const profileMd = buildProfileMd('a@co.com', ['alpha']);
      mockFS.exists.mockImplementation(async (p: string) => {
        return p.includes('_members/a@co.com') || p.includes('a@co.com.md');
      });
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('a@co.com.md')) return profileMd;
        if (p.includes('alpha-members.md')) return '# Team Members\n';
        return '';
      });

      await svc.fireMember('alpha', 'a@co.com', WORKSPACE);

      // termination fields written
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('_archived'),
        expect.stringContaining('termination: true'),
      );
    });
  });

  // ── showProfile ──────────────────────────────────────────────────────────────

  describe('showProfile', () => {
    it('returns profile content when member exists in _members', async () => {
      mockFS.exists.mockImplementation(async (p: string) =>
        p.includes('_members/john@co.com/john@co.com.md'),
      );
      mockFS.readFile.mockResolvedValue('profile content');

      const result = await svc.showProfile('john@co.com', WORKSPACE);

      expect(result).not.toBeNull();
      expect(result?.location).toBe('member');
      expect(result?.content).toBe('profile content');
    });

    it('normalizes email to lowercase before searching', async () => {
      mockFS.exists.mockImplementation(async (p: string) =>
        p.includes('_members/john@co.com/john@co.com.md'),
      );
      mockFS.readFile.mockResolvedValue('content');

      const result = await svc.showProfile('JOHN@CO.COM', WORKSPACE);
      expect(result?.location).toBe('member');
    });

    it('returns null when email not found anywhere', async () => {
      mockFS.exists.mockResolvedValue(false);
      const result = await svc.showProfile('nobody@co.com', WORKSPACE);
      expect(result).toBeNull();
    });
  });
});
