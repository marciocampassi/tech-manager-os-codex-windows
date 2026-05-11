import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import matter from 'gray-matter';
import { TeamService } from '../../src/services/team.service.js';
import type { FileSystemService } from '../../src/services/file-system.service.js';
import { InvalidEmailError } from '../../src/errors/tmr-error.js';

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
    removeFile: jest.fn<FileSystemService['removeFile']>().mockResolvedValue(undefined),
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
        expect.stringContaining('teams/alpha/alpha-context.md'),
        expect.stringContaining('team: alpha'),
      );
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('teams/alpha/alpha-members.md'),
        expect.stringContaining('# Team Members'),
      );
    });

    it('is idempotent — skips creation when context file already exists', async () => {
      mockFS.exists.mockResolvedValue(true);

      await svc.createTeam('alpha', WORKSPACE);

      expect(mockFS.writeFile).not.toHaveBeenCalled();
    });

    it('TEAM-UNIT-001: normalizes "Backend Team" → creates files under "backend-team" slug', async () => {
      mockFS.exists.mockResolvedValue(false);

      await svc.createTeam('Backend Team', WORKSPACE);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('teams/backend-team/backend-team-context.md'),
        expect.any(String),
      );
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('teams/backend-team/backend-team-members.md'),
        expect.any(String),
      );
    });

    it('TEAM-UNIT-002: normalizes "FRONTEND" → creates files under "frontend" slug', async () => {
      mockFS.exists.mockResolvedValue(false);

      await svc.createTeam('FRONTEND', WORKSPACE);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('teams/frontend/frontend-context.md'),
        expect.any(String),
      );
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
        return '';
      });
      mockFS.listDirectories.mockResolvedValue([]);

      await svc.addMember(
        'alpha',
        'John@Co.Com',
        { role: 'Engineer', location: 'Remote' },
        WORKSPACE,
      );

      // Email normalized to lowercase
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('john@co.com/john@co.com.md'),
        expect.stringContaining('"john@co.com"'),
      );
      // Subdirectories created
      expect(mockFS.createDirectory).toHaveBeenCalledWith(expect.stringContaining('1on1s'));
      expect(mockFS.createDirectory).toHaveBeenCalledWith(expect.stringContaining('feedbacks'));
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
      const wikiLink = '- [[../../members/john@co.com/john@co.com.md|john@co.com]]';
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
      mockFS.listDirectories.mockResolvedValue([]);

      await svc.addMember('newteam', 'x@co.com', {}, WORKSPACE);

      // Team context file should be created
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('teams/newteam/newteam-context.md'),
        expect.any(String),
      );
    });

    it('creates action-items-{email}.md for new member (Story 2.10)', async () => {
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('alpha-context.md')) return true;
        return false;
      });
      mockFS.listDirectories.mockResolvedValue([]);
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('alpha-members.md')) return '# Team Members\n';
        return '';
      });

      await svc.addMember('alpha', 'dev@co.com', { role: 'Engineer' }, WORKSPACE);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('action-items-dev@co.com.md'),
        expect.stringContaining('type: action-items'),
      );
    });

    it('appends correct relative wiki-link format to members file (AC-5)', async () => {
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('alpha-context.md')) return true;
        return false;
      });
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('alpha-members.md')) return '# Team Members\n';
        return '';
      });
      mockFS.listDirectories.mockResolvedValue([]);

      await svc.addMember('alpha', 'dev@co.com', { role: 'Engineer' }, WORKSPACE);

      expect(mockFS.appendFile).toHaveBeenCalledWith(
        expect.stringContaining('alpha-members.md'),
        '- [[../../members/dev@co.com/dev@co.com.md|dev@co.com]]\n',
      );
    });

    it('new member profile uses relative wiki-link for manager (AC-5)', async () => {
      const managerProfileContent = matter.stringify('', { email: 'manager@co.com' });
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('alpha-context.md')) return true;
        if (p.includes('my-career')) return true;
        return false;
      });
      mockFS.listDirectories.mockImplementation(async (p: string) => {
        if (p.includes('my-career')) return ['manager@co.com'];
        return [];
      });
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('manager@co.com.md')) return managerProfileContent;
        if (p.includes('alpha-members.md')) return '# Team Members\n';
        return '';
      });

      await svc.addMember('alpha', 'dev@co.com', { role: 'Engineer' }, WORKSPACE);

      const profileCall = (mockFS.writeFile.mock.calls as [string, string][]).find(([p]) =>
        p.includes('dev@co.com/dev@co.com.md'),
      );
      expect(profileCall).toBeDefined();
      expect(profileCall![1]).toContain(
        '[[../../../my-career/manager@co.com/manager@co.com.md|manager@co.com]]',
      );
    });

    it('skips action-items creation when file already exists (idempotent)', async () => {
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('alpha-context.md')) return true;
        if (p.includes('action-items-dev@co.com.md')) return true;
        return false;
      });
      mockFS.listDirectories.mockResolvedValue([]);
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('alpha-members.md')) return '# Team Members\n';
        return '';
      });

      await svc.addMember('alpha', 'dev@co.com', {}, WORKSPACE);

      const writtenPaths = (mockFS.writeFile.mock.calls as [string, string][]).map((c) => c[0]);
      expect(writtenPaths.some((p) => p.includes('action-items-dev@co.com.md'))).toBe(false);
    });

    it('new member profile includes ## Action Items section (Story 2.10)', async () => {
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('alpha-context.md')) return true;
        return false;
      });
      mockFS.listDirectories.mockResolvedValue([]);
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('alpha-members.md')) return '# Team Members\n';
        return '';
      });

      await svc.addMember('alpha', 'dev@co.com', { role: 'Engineer' }, WORKSPACE);

      const profileCall = (mockFS.writeFile.mock.calls as [string, string][]).find(([p]) =>
        p.includes('dev@co.com/dev@co.com.md'),
      );
      expect(profileCall).toBeDefined();
      expect(profileCall![1]).toContain('## Action Items');
      expect(profileCall![1]).toContain('[[action-items-dev@co.com|Action Items Tracker]]');
    });

    it('new member profile includes action_items_gdoc frontmatter field (Story 2.10)', async () => {
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('alpha-context.md')) return true;
        return false;
      });
      mockFS.listDirectories.mockResolvedValue([]);
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('alpha-members.md')) return '# Team Members\n';
        return '';
      });

      await svc.addMember('alpha', 'dev@co.com', { role: 'Engineer' }, WORKSPACE);

      const profileCall = (mockFS.writeFile.mock.calls as [string, string][]).find(([p]) =>
        p.includes('dev@co.com/dev@co.com.md'),
      );
      expect(profileCall![1]).toContain("action_items_gdoc: ''");
    });

    it('TEAM-UNIT-003: throws InvalidEmailError before any file write for invalid email', async () => {
      await expect(svc.addMember('alpha', 'not-an-email', {}, WORKSPACE)).rejects.toThrow(
        InvalidEmailError,
      );
      expect(mockFS.writeFile).not.toHaveBeenCalled();
      expect(mockFS.createDirectory).not.toHaveBeenCalled();
    });

    it('TEAM-UNIT-004: valid email → member profile written to correct path', async () => {
      mockFS.exists.mockResolvedValue(false);
      mockFS.readFile.mockResolvedValue('# Team Members\n');
      mockFS.listDirectories.mockResolvedValue([]);

      await svc.addMember('alpha', 'valid@company.com', {}, WORKSPACE);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('my-teams/members/valid@company.com/valid@company.com.md'),
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
          return '# Team Members\n- [[../../members/a@co.com/a@co.com.md|a@co.com]]\n';
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
        if (p.includes('members/a@co.com') && !p.includes('archived')) return true;
        if (p.includes('a@co.com.md') && p.includes('archived')) return true;
        return false;
      });
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('a@co.com.md')) return profileMd;
        if (p.includes('alpha-members.md'))
          return '# Team Members\n- [[../../members/a@co.com/a@co.com.md|a@co.com]]\n';
        return '';
      });

      await svc.archiveMember('alpha', 'a@co.com', {}, WORKSPACE);

      expect(mockFS.moveFile).toHaveBeenCalledWith(
        expect.stringContaining('members/a@co.com'),
        expect.stringContaining('archived'),
      );
      // Frontmatter update
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('archived'),
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
        if (p.includes('my-teams/members/a@co.com')) return true;
        if (p.includes('a@co.com.md')) return true;
        return false;
      });
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('a@co.com.md')) return profileMd;
        if (p.includes('alpha-members.md')) return '# Team Members\n';
        return '';
      });

      await svc.fireMember('alpha', 'a@co.com', WORKSPACE);

      // termination fields written
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('archived'),
        expect.stringContaining('termination: true'),
      );
    });

    it('writes termination_note when note is provided', async () => {
      const profileMd = buildProfileMd('a@co.com', ['alpha']);
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('my-teams/members/a@co.com')) return true;
        if (p.includes('a@co.com.md')) return true;
        return false;
      });
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('a@co.com.md')) return profileMd;
        if (p.includes('alpha-members.md')) return '# Team Members\n';
        return '';
      });

      await svc.fireMember('alpha', 'a@co.com', WORKSPACE, 'Performance issues');

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('archived'),
        expect.stringContaining('termination_note: Performance issues'),
      );
    });

    it('does not write termination_note when note is not provided', async () => {
      const profileMd = buildProfileMd('a@co.com', ['alpha']);
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('my-teams/members/a@co.com')) return true;
        if (p.includes('a@co.com.md')) return true;
        return false;
      });
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('a@co.com.md')) return profileMd;
        if (p.includes('alpha-members.md')) return '# Team Members\n';
        return '';
      });

      await svc.fireMember('alpha', 'a@co.com', WORKSPACE);

      const writeCall = (mockFS.writeFile.mock.calls as [string, string][]).find(([p]) =>
        p.includes('archived'),
      );
      expect(writeCall?.[1]).not.toContain('termination_note');
    });
  });

  // ── showProfile ──────────────────────────────────────────────────────────────

  describe('showProfile', () => {
    it('returns profile content when member exists in members', async () => {
      mockFS.exists.mockImplementation(async (p: string) =>
        p.includes('my-teams/members/john@co.com/john@co.com.md'),
      );
      mockFS.readFile.mockResolvedValue('profile content');

      const result = await svc.showProfile('john@co.com', WORKSPACE);

      expect(result).not.toBeNull();
      expect(result?.location).toBe('member');
      expect(result?.content).toBe('profile content');
    });

    it('normalizes email to lowercase before searching', async () => {
      mockFS.exists.mockImplementation(async (p: string) =>
        p.includes('my-teams/members/john@co.com/john@co.com.md'),
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
