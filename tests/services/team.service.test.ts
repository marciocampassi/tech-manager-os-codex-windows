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
        expect.stringMatching(/teams[/\\]alpha[/\\]alpha-context\.md/),
        expect.stringContaining('team: alpha'),
      );
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/teams[/\\]alpha[/\\]alpha-members\.md/),
        expect.stringContaining('members: []'),
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
        if (p.includes('alpha-members.md')) return true;
        return false;
      });
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('alpha-members.md')) return '---\nmembers: []\n---\n\n# Team Members\n';
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
        expect.stringContaining('john@co.com'),
      );
      // Subdirectories created (including 9.12: <email>-shared)
      expect(mockFS.createDirectory).toHaveBeenCalledWith(expect.stringContaining('1on1s'));
      expect(mockFS.createDirectory).toHaveBeenCalledWith(expect.stringContaining('feedbacks'));
      expect(mockFS.createDirectory).toHaveBeenCalledWith(
        expect.stringContaining('john@co.com-shared'),
      );
      // Wiki-link written to team members frontmatter
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('alpha-members.md'),
        expect.stringContaining('john@co.com'),
      );
    });

    it('appends team to existing member without recreating directory', async () => {
      const existingProfile = buildProfileMd('john@co.com', ['beta']);
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('alpha-context.md')) return true;
        if (p.includes('john@co.com.md')) return true;
        if (p.includes('alpha-members.md')) return true;
        return false;
      });
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('john@co.com.md')) return existingProfile;
        if (p.includes('alpha-members.md')) return '---\nmembers: []\n---\n\n# Team Members\n';
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
      const wikiLink = '[[../../members/john@co.com/john@co.com.md|john@co.com]]';
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('alpha-context.md')) return true;
        if (p.includes('john@co.com.md')) return true;
        if (p.includes('alpha-members.md')) return true;
        return false;
      });
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('john@co.com.md')) return buildProfileMd('john@co.com', ['alpha']);
        if (p.includes('alpha-members.md'))
          return `---\nmembers:\n  - '${wikiLink}'\n---\n\n# Team Members\n`;
        return '';
      });

      await svc.addMember('alpha', 'john@co.com', {}, WORKSPACE);

      // addRelation is idempotent — link already present, members array has exactly one entry
      const membersWriteCall = (mockFS.writeFile.mock.calls as [string, string][]).find(([p]) =>
        p.includes('alpha-members.md'),
      );
      expect(membersWriteCall).toBeDefined();
      const { data: parsedMembers } = matter(membersWriteCall![1]);
      const membersList = Array.isArray(parsedMembers['members']) ? parsedMembers['members'] : [];
      expect(membersList).toHaveLength(1);
    });

    it('auto-creates team when it does not exist', async () => {
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('newteam-members.md')) return true;
        return false;
      });
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('newteam-members.md')) return '---\nmembers: []\n---\n\n# Team Members\n';
        return '';
      });
      mockFS.listDirectories.mockResolvedValue([]);

      await svc.addMember('newteam', 'x@co.com', {}, WORKSPACE);

      // Team context file should be created
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('teams/newteam/newteam-context.md'),
        expect.any(String),
      );
    });

    it('9.29: no action-items file created for new member (AC6)', async () => {
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('alpha-context.md')) return true;
        if (p.includes('alpha-members.md')) return true;
        return false;
      });
      mockFS.listDirectories.mockResolvedValue([]);
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('alpha-members.md')) return '---\nmembers: []\n---\n\n# Team Members\n';
        return '';
      });

      await svc.addMember('alpha', 'dev@co.com', { role: 'Engineer' }, WORKSPACE);

      const writtenPaths = (mockFS.writeFile.mock.calls as [string, string][]).map((c) => c[0]);
      expect(writtenPaths.some((p) => p.includes('action-items-'))).toBe(false);
    });

    it('appends correct relative wiki-link format to members file (AC-5)', async () => {
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('alpha-context.md')) return true;
        if (p.includes('alpha-members.md')) return true;
        return false;
      });
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('alpha-members.md')) return '---\nmembers: []\n---\n\n# Team Members\n';
        return '';
      });
      mockFS.listDirectories.mockResolvedValue([]);

      await svc.addMember('alpha', 'dev@co.com', { role: 'Engineer' }, WORKSPACE);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('alpha-members.md'),
        expect.stringContaining('[[../../members/dev@co.com/dev@co.com.md|dev@co.com]]'),
      );
    });

    it('new member profile uses relative wiki-link for manager (AC-5)', async () => {
      const managerProfileContent = matter.stringify('', { email: 'manager@co.com' });
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('alpha-context.md')) return true;
        if (p.includes('my-career')) return true;
        if (p.includes('alpha-members.md')) return true;
        return false;
      });
      mockFS.listDirectories.mockImplementation(async (p: string) => {
        if (p.includes('my-career')) return ['manager@co.com'];
        return [];
      });
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('manager@co.com.md')) return managerProfileContent;
        if (p.includes('alpha-members.md')) return '---\nmembers: []\n---\n\n# Team Members\n';
        return '';
      });

      await svc.addMember('alpha', 'dev@co.com', { role: 'Engineer' }, WORKSPACE);

      const profileCall = (mockFS.writeFile.mock.calls as [string, string][]).find(([p]) =>
        p.replace(/\\/g, '/').includes('dev@co.com/dev@co.com.md'),
      );
      expect(profileCall).toBeDefined();
      // Flat my-career path (post-Story 9.3)
      expect(profileCall![1]).toContain('[[../../../my-career/manager@co.com.md|manager@co.com]]');
    });

    it('skips action-items creation (removed in 9.29) — no action-items file written', async () => {
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('alpha-context.md')) return true;
        if (p.includes('alpha-members.md')) return true;
        return false;
      });
      mockFS.listDirectories.mockResolvedValue([]);
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('alpha-members.md')) return '---\nmembers: []\n---\n\n# Team Members\n';
        return '';
      });

      await svc.addMember('alpha', 'dev@co.com', {}, WORKSPACE);

      const writtenPaths = (mockFS.writeFile.mock.calls as [string, string][]).map((c) => c[0]);
      expect(writtenPaths.some((p) => p.includes('action-items-dev@co.com.md'))).toBe(false);
    });

    it('9.29: new member profile has no ## Action Items section and no action-items link (AC5)', async () => {
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('alpha-context.md')) return true;
        if (p.includes('alpha-members.md')) return true;
        return false;
      });
      mockFS.listDirectories.mockResolvedValue([]);
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('alpha-members.md')) return '---\nmembers: []\n---\n\n# Team Members\n';
        return '';
      });

      await svc.addMember('alpha', 'dev@co.com', { role: 'Engineer' }, WORKSPACE);

      const profileCall = (mockFS.writeFile.mock.calls as [string, string][]).find(([p]) =>
        p.replace(/\\/g, '/').includes('dev@co.com/dev@co.com.md'),
      );
      expect(profileCall).toBeDefined();
      expect(profileCall![1]).not.toContain('## Action Items');
      expect(profileCall![1]).not.toContain('action-items-dev@co.com');
    });

    it('9.29: new member profile has no action_items_gdoc frontmatter field (AC5)', async () => {
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('alpha-context.md')) return true;
        if (p.includes('alpha-members.md')) return true;
        return false;
      });
      mockFS.listDirectories.mockResolvedValue([]);
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('alpha-members.md')) return '---\nmembers: []\n---\n\n# Team Members\n';
        return '';
      });

      await svc.addMember('alpha', 'dev@co.com', { role: 'Engineer' }, WORKSPACE);

      const profileCall = (mockFS.writeFile.mock.calls as [string, string][]).find(([p]) =>
        p.replace(/\\/g, '/').includes('dev@co.com/dev@co.com.md'),
      );
      expect(profileCall![1]).not.toContain('action_items_gdoc');
    });

    it('TEAM-UNIT-003: throws InvalidEmailError before any file write for invalid email', async () => {
      await expect(svc.addMember('alpha', 'not-an-email', {}, WORKSPACE)).rejects.toThrow(
        InvalidEmailError,
      );
      expect(mockFS.writeFile).not.toHaveBeenCalled();
      expect(mockFS.createDirectory).not.toHaveBeenCalled();
    });

    it('TEAM-UNIT-004: valid email → member profile written to correct path', async () => {
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('-members.md')) return true;
        return false;
      });
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('-members.md')) return '---\nmembers: []\n---\n\n# Team Members\n';
        return '';
      });
      mockFS.listDirectories.mockResolvedValue([]);

      await svc.addMember('alpha', 'valid@company.com', {}, WORKSPACE);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('my-teams/members/valid@company.com/valid@company.com.md'),
        expect.any(String),
      );
    });

    // ── 9.12 tests ──────────────────────────────────────────────────────────────

    it('9.12: creates <email>-shared/ directory for new member', async () => {
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('alpha-context.md')) return true;
        if (p.includes('alpha-members.md')) return true;
        return false;
      });
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('alpha-members.md')) return '---\nmembers: []\n---\n\n# Team Members\n';
        return '';
      });
      mockFS.listDirectories.mockResolvedValue([]);

      await svc.addMember('alpha', 'dev@co.com', {}, WORKSPACE);

      expect(mockFS.createDirectory).toHaveBeenCalledWith(
        expect.stringContaining('dev@co.com-shared'),
      );
    });

    it('9.12: new member profile includes relationship: direct-report frontmatter', async () => {
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('alpha-context.md')) return true;
        if (p.includes('alpha-members.md')) return true;
        return false;
      });
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('alpha-members.md')) return '---\nmembers: []\n---\n\n# Team Members\n';
        return '';
      });
      mockFS.listDirectories.mockResolvedValue([]);

      await svc.addMember('alpha', 'dev@co.com', {}, WORKSPACE);

      const profileCall = (mockFS.writeFile.mock.calls as [string, string][]).find(([p]) =>
        p.replace(/\\/g, '/').includes('dev@co.com/dev@co.com.md'),
      );
      expect(profileCall).toBeDefined();
      expect(profileCall![1]).toContain('relationship: direct-report');
    });

    it('9.12: <email>-shared/ dir uses normalized (lowercase) email', async () => {
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('alpha-context.md')) return true;
        if (p.includes('alpha-members.md')) return true;
        return false;
      });
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('alpha-members.md')) return '---\nmembers: []\n---\n\n# Team Members\n';
        return '';
      });
      mockFS.listDirectories.mockResolvedValue([]);

      await svc.addMember('alpha', 'DEV@CO.COM', {}, WORKSPACE);

      // P1: assert lowercase form was used AND uppercase form was NOT
      expect(mockFS.createDirectory).toHaveBeenCalledWith(
        expect.stringContaining('dev@co.com-shared'),
      );
      expect(mockFS.createDirectory).not.toHaveBeenCalledWith(
        expect.stringContaining('DEV@CO.COM-shared'),
      );
    });

    // ── 9.29 new tests ──────────────────────────────────────────────────────────

    it('9.29: new member profile has current_manager, previous_manager, other_leaderships, start_date, projects (AC4)', async () => {
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('alpha-context.md')) return true;
        if (p.includes('alpha-members.md')) return true;
        return false;
      });
      mockFS.listDirectories.mockResolvedValue([]);
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('alpha-members.md')) return '---\nmembers: []\n---\n\n# Team Members\n';
        return '';
      });

      await svc.addMember('alpha', 'dev@co.com', { role: 'Engineer' }, WORKSPACE);

      const profileCall = (mockFS.writeFile.mock.calls as [string, string][]).find(([p]) =>
        p.replace(/\\/g, '/').includes('dev@co.com/dev@co.com.md'),
      );
      expect(profileCall).toBeDefined();
      const { data } = matter(profileCall![1]);
      expect(data).toHaveProperty('current_manager');
      expect(data['previous_manager']).toEqual([]);
      expect(data['other_leaderships']).toEqual([]);
      expect(data['start_date']).toBe('');
      expect(data['projects']).toEqual([]);
    });

    it('9.29: new member profile teams: array contains wiki-link to context file, not bare slug (AC4)', async () => {
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('alpha-context.md')) return true;
        if (p.includes('alpha-members.md')) return true;
        return false;
      });
      mockFS.listDirectories.mockResolvedValue([]);
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('alpha-members.md')) return '---\nmembers: []\n---\n\n# Team Members\n';
        return '';
      });

      await svc.addMember('alpha', 'dev@co.com', {}, WORKSPACE);

      const profileCall = (mockFS.writeFile.mock.calls as [string, string][]).find(([p]) =>
        p.replace(/\\/g, '/').includes('dev@co.com/dev@co.com.md'),
      );
      expect(profileCall).toBeDefined();
      const { data } = matter(profileCall![1]);
      expect(Array.isArray(data['teams'])).toBe(true);
      expect((data['teams'] as string[])[0]).toMatch(/\[\[.*alpha-context\.md\|alpha\]\]/);
    });

    it('TEAM-UNIT-005: addMember writes direct_reports on self profile when self exists', async () => {
      const selfProfilePath = `${WORKSPACE}/my-career/me@co.com.md`;
      mockFS.exists.mockImplementation(async (p: string) => {
        const n = p.replace(/\\/g, '/');
        if (n.includes('alpha-context.md')) return true;
        if (n.includes('alpha-members.md')) return true;
        if (n.includes('my-career')) return true;
        if (n.includes('me@co.com.md')) return true;
        return false;
      });
      mockFS.listFiles.mockResolvedValue([selfProfilePath]);
      mockFS.listDirectories.mockResolvedValue([]);
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('alpha-members.md')) return '---\nmembers: []\n---\n\n# Team Members\n';
        if (p.replace(/\\/g, '/').includes('me@co.com.md')) return '---\ndirect_reports: []\n---\n';
        return '';
      });

      await svc.addMember('alpha', 'dev@co.com', { role: 'Engineer' }, WORKSPACE);

      const selfWriteCall = (mockFS.writeFile.mock.calls as [string, string][]).find(([p]) =>
        p.replace(/\\/g, '/').includes('me@co.com.md'),
      );
      expect(selfWriteCall).toBeDefined();
      expect(selfWriteCall![1]).toContain('direct_reports');
      expect(selfWriteCall![1]).toContain('dev@co.com');
    });
  });

  // ── listTeams ────────────────────────────────────────────────────────────────

  describe('listTeams', () => {
    it('returns empty array when teams root does not exist', async () => {
      mockFS.exists.mockResolvedValue(false);
      const result = await svc.listTeams(WORKSPACE);
      expect(result).toEqual([]);
    });

    it('reads member count from frontmatter members array (AC8)', async () => {
      mockFS.exists.mockImplementation(async (p: string) => {
        const n = p.replace(/\\/g, '/');
        if (n.endsWith('my-teams/teams')) return true;
        if (n.includes('alpha-members.md')) return true;
        return false;
      });
      mockFS.listDirectories.mockResolvedValue(['alpha']);
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('alpha-members.md'))
          return "---\nmembers:\n  - '[[../../members/a@co.com/a@co.com.md|a@co.com]]'\n  - '[[../../members/b@co.com/b@co.com.md|b@co.com]]'\n---\n\n# Team Members\n";
        return '';
      });

      const result = await svc.listTeams(WORKSPACE);

      expect(result).toEqual([{ teamName: 'alpha', memberCount: 2 }]);
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
          return "---\nmembers:\n  - '[[../../members/a@co.com/a@co.com.md|a@co.com]]'\n---\n\n# Team Members\n";
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
        const n = p.replace(/\\/g, '/');
        if (n.includes('my-teams/members/a@co.com') && !n.includes('archived')) return true;
        if (n.includes('my-teams/archived') && n.includes('a@co.com.md')) return true;
        if (n.includes('alpha-members.md')) return true;
        return false;
      });
      mockFS.readFile.mockImplementation(async (p: string) => {
        const n = p.replace(/\\/g, '/');
        if (n.includes('alpha-members.md'))
          return "---\nmembers:\n  - '[[../../members/a@co.com/a@co.com.md|a@co.com]]'\n---\n\n# Team Members\n";
        if (n.includes('a@co.com/a@co.com.md')) return profileMd;
        return '';
      });

      await svc.archiveMember('alpha', 'a@co.com', {}, WORKSPACE);

      const [moveSrc, moveDest] = mockFS.moveFile.mock.calls[0] as [string, string];
      expect(moveSrc.replace(/\\/g, '/')).toContain('members/a@co.com');
      expect(moveDest.replace(/\\/g, '/')).toContain('archived');
      // Frontmatter update
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('archived'),
        expect.stringContaining('archived: true'),
      );
      const membersWriteCall = (mockFS.writeFile.mock.calls as [string, string][]).find(([p]) =>
        p.includes('alpha-members.md'),
      );
      expect(membersWriteCall).toBeDefined();
      const { data: membersData } = matter(membersWriteCall![1]);
      const membersList = Array.isArray(membersData['members']) ? membersData['members'] : [];
      expect(membersList).toHaveLength(0);
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
        const n = p.replace(/\\/g, '/');
        if (n.includes('my-teams/members/a@co.com')) return true;
        if (n.includes('my-teams/archived') && n.includes('a@co.com.md')) return true;
        if (n.includes('alpha-members.md')) return true;
        return false;
      });
      mockFS.readFile.mockImplementation(async (p: string) => {
        const n = p.replace(/\\/g, '/');
        if (n.includes('alpha-members.md'))
          return "---\nmembers:\n  - '[[../../members/a@co.com/a@co.com.md|a@co.com]]'\n---\n\n# Team Members\n";
        if (n.includes('a@co.com/a@co.com.md')) return profileMd;
        return '';
      });

      await svc.fireMember('alpha', 'a@co.com', WORKSPACE);

      // termination fields written
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('archived'),
        expect.stringContaining('termination: true'),
      );
      const membersWriteCall = (mockFS.writeFile.mock.calls as [string, string][]).find(([p]) =>
        p.includes('alpha-members.md'),
      );
      expect(membersWriteCall).toBeDefined();
      const { data: membersData } = matter(membersWriteCall![1]);
      const membersList = Array.isArray(membersData['members']) ? membersData['members'] : [];
      expect(membersList).toHaveLength(0);
    });

    it('writes termination_note when note is provided', async () => {
      const profileMd = buildProfileMd('a@co.com', ['alpha']);
      mockFS.exists.mockImplementation(async (p: string) => {
        const n = p.replace(/\\/g, '/');
        if (n.includes('my-teams/members/a@co.com')) return true;
        if (n.includes('my-teams/archived') && n.includes('a@co.com.md')) return true;
        if (n.includes('alpha-members.md')) return true;
        return false;
      });
      mockFS.readFile.mockImplementation(async (p: string) => {
        const n = p.replace(/\\/g, '/');
        if (n.includes('a@co.com/a@co.com.md')) return profileMd;
        if (n.includes('alpha-members.md')) return '---\nmembers: []\n---\n\n# Team Members\n';
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
        const n = p.replace(/\\/g, '/');
        if (n.includes('my-teams/members/a@co.com')) return true;
        if (n.includes('my-teams/archived') && n.includes('a@co.com.md')) return true;
        if (n.includes('alpha-members.md')) return true;
        return false;
      });
      mockFS.readFile.mockImplementation(async (p: string) => {
        const n = p.replace(/\\/g, '/');
        if (n.includes('a@co.com/a@co.com.md')) return profileMd;
        if (n.includes('alpha-members.md')) return '---\nmembers: []\n---\n\n# Team Members\n';
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

    // ── 9.15 tests ──────────────────────────────────────────────────────────────

    it('9.15: self profile takes priority over active team member when both exist', async () => {
      const selfPath = `${WORKSPACE}/my-career/me@co.com.md`;
      const memberPath = `${WORKSPACE}/my-teams/members/me@co.com/me@co.com.md`;
      mockFS.exists.mockImplementation(async (p: string) => p === selfPath || p === memberPath);
      mockFS.readFile.mockResolvedValue('self profile content');

      const result = await svc.showProfile('me@co.com', WORKSPACE);

      expect(result?.location).toBe('self');
    });

    it('9.15: returns self profile when my-career/<email>.md exists', async () => {
      const selfPath = `${WORKSPACE}/my-career/me@co.com.md`;
      mockFS.exists.mockImplementation(async (p: string) => p === selfPath);
      mockFS.readFile.mockResolvedValue('self profile content');

      const result = await svc.showProfile('me@co.com', WORKSPACE);

      expect(result).not.toBeNull();
      expect(result?.location).toBe('self');
      expect(result?.filePath).toBe(selfPath);
      expect(result?.content).toBe('self profile content');
    });

    it('9.15: returns contractor profile when my-company/contractors/<email>/<email>.md exists', async () => {
      const contractorPath = `${WORKSPACE}/my-company/contractors/ext@vendor.com/ext@vendor.com.md`;
      mockFS.exists.mockImplementation(async (p: string) => p === contractorPath);
      mockFS.readFile.mockResolvedValue('contractor profile content');

      const result = await svc.showProfile('ext@vendor.com', WORKSPACE);

      expect(result).not.toBeNull();
      expect(result?.location).toBe('contractor');
      expect(result?.filePath).toBe(contractorPath);
      expect(result?.content).toBe('contractor profile content');
    });
  });
});
