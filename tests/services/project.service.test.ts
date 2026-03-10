import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ProjectService } from '../../src/services/project.service.js';
import type { FileSystemService } from '../../src/services/file-system.service.js';
import type { RelationshipService } from '../../src/services/relationship.service.js';
import { TemplateService } from '../../src/services/template.service.js';

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

// ── Mock RelationshipService ──────────────────────────────────────────────────

type MockRelationship = {
  addRelationship: jest.MockedFunction<RelationshipService['addRelationship']>;
  getWorkspaceRoot: jest.MockedFunction<RelationshipService['getWorkspaceRoot']>;
};

function createMockRelationship(): MockRelationship {
  return {
    addRelationship: jest
      .fn<RelationshipService['addRelationship']>()
      .mockResolvedValue({ created: true }),
    getWorkspaceRoot: jest.fn<RelationshipService['getWorkspaceRoot']>().mockReturnValue('/ws'),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const WS = '/fake/workspace';
const NAME = 'platform';
const COMP_PATH = `${WS}/my-projects/${NAME}/${NAME}-composition.md`;

function compContent(members: string[] = [], stakeholders: string[] = []): string {
  const memberLines = members.map((e) => `- [[${e}]]`).join('\n');
  const stakeholderLines = stakeholders.map((e) => `- [[${e}]]`).join('\n');
  return `# Team Members\n${memberLines}\n\n# Stakeholders\n${stakeholderLines}\n`;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProjectService', () => {
  let svc: ProjectService;
  let mockFS: MockFS;
  let mockRel: MockRelationship;
  const realTemplate = new TemplateService();

  beforeEach(() => {
    mockFS = createMockFS();
    mockRel = createMockRelationship();
    svc = new ProjectService(
      mockFS as unknown as FileSystemService,
      realTemplate,
      mockRel as unknown as RelationshipService,
    );
  });

  // ── addProject ────────────────────────────────────────────────────────────────

  describe('addProject', () => {
    it('returns created: true and creates all files for a new project', async () => {
      mockFS.exists.mockResolvedValue(false);

      const result = await svc.addProject(NAME, WS);

      expect(result.created).toBe(true);
      expect(mockFS.createDirectory).toHaveBeenCalledWith(expect.stringContaining('standup'));
      expect(mockFS.createDirectory).toHaveBeenCalledWith(expect.stringContaining('discussion'));
      expect(mockFS.createDirectory).toHaveBeenCalledWith(expect.stringContaining('presentation'));
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`${NAME}-project.md`),
        expect.stringContaining('type: project'),
      );
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`${NAME}-composition.md`),
        expect.stringContaining('# Team Members'),
      );
    });

    it('returns created: false when project already exists', async () => {
      mockFS.exists.mockResolvedValue(true);

      const result = await svc.addProject(NAME, WS);

      expect(result.created).toBe(false);
      expect(mockFS.writeFile).not.toHaveBeenCalled();
    });

    it('places overview file under my-company/projects/', async () => {
      mockFS.exists.mockResolvedValue(false);
      await svc.addProject(NAME, WS);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`my-company/projects/${NAME}-project.md`),
        expect.any(String),
      );
    });

    it('places composition file under my-projects/{name}/', async () => {
      mockFS.exists.mockResolvedValue(false);
      await svc.addProject(NAME, WS);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`my-projects/${NAME}/${NAME}-composition.md`),
        expect.any(String),
      );
    });
  });

  // ── addStandup ────────────────────────────────────────────────────────────────

  describe('addStandup', () => {
    it('throws when project does not exist', async () => {
      mockFS.exists.mockResolvedValue(false);
      await expect(svc.addStandup(NAME, {}, WS)).rejects.toThrow(/not found.*tmr project add/i);
    });

    it('creates standup file at correct path', async () => {
      mockFS.exists.mockResolvedValue(true);
      await svc.addStandup(NAME, { date: '2026-03-09' }, WS);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`standup/2026-03-09-${NAME}-standup.md`),
        expect.stringContaining('type: standup'),
      );
    });

    it('includes standup template sections', async () => {
      mockFS.exists.mockResolvedValue(true);
      await svc.addStandup(NAME, { date: '2026-03-09' }, WS);

      const content = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(content).toContain('## Yesterday');
      expect(content).toContain('## Today');
      expect(content).toContain('## Blockers');
    });
  });

  // ── addDiscussion ─────────────────────────────────────────────────────────────

  describe('addDiscussion', () => {
    it('throws when project does not exist', async () => {
      mockFS.exists.mockResolvedValue(false);
      await expect(svc.addDiscussion(NAME, {}, WS)).rejects.toThrow(/not found/i);
    });

    it('creates discussion file at correct path', async () => {
      mockFS.exists.mockResolvedValue(true);
      await svc.addDiscussion(NAME, { date: '2026-03-09' }, WS);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`discussion/2026-03-09-${NAME}-discussion.md`),
        expect.stringContaining('type: discussion'),
      );
    });

    it('includes discussion template sections', async () => {
      mockFS.exists.mockResolvedValue(true);
      await svc.addDiscussion(NAME, { date: '2026-03-09' }, WS);

      const content = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(content).toContain('## Topic');
      expect(content).toContain('## Attendees');
      expect(content).toContain('## Decisions');
      expect(content).toContain('## Action Items');
    });
  });

  // ── addPresentation ───────────────────────────────────────────────────────────

  describe('addPresentation', () => {
    it('throws when project does not exist', async () => {
      mockFS.exists.mockResolvedValue(false);
      await expect(svc.addPresentation(NAME, 'Q1 Review', {}, WS)).rejects.toThrow(/not found/i);
    });

    it('slugifies topic in filename', async () => {
      mockFS.exists.mockResolvedValue(true);
      await svc.addPresentation(NAME, 'Q1 Review', { date: '2026-03-09' }, WS);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`presentation/2026-03-09-${NAME}-presentation-q1-review.md`),
        expect.any(String),
      );
    });

    it('includes topic in template content', async () => {
      mockFS.exists.mockResolvedValue(true);
      await svc.addPresentation(NAME, 'Q1 Review', { date: '2026-03-09' }, WS);

      const content = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(content).toContain('topic: Q1 Review');
      expect(content).toContain(`# ${NAME} — Q1 Review`);
      expect(content).toContain('## Slides Outline');
      expect(content).toContain('## Talking Points');
      expect(content).toContain('## Q&A');
    });
  });

  // ── resolveEmailLocation (tested via linkMember) ──────────────────────────────

  describe('resolveEmailLocation (via linkMember)', () => {
    beforeEach(() => {
      // composition exists
      mockFS.exists.mockImplementation(async (p: string) => p.includes('composition'));
      mockFS.readFile.mockResolvedValue(compContent());
    });

    it('resolves to team when team profile exists', async () => {
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('composition')) return true;
        if (p.includes('_members')) return true;
        return false;
      });

      const result = await svc.linkMember(NAME, 'alice@co.com', WS);
      expect(result.wikiLink).toContain('my-teams/_members/alice@co.com');
      expect(result.created).toBe(false);
    });

    it('resolves to leadership when leadership profile exists (no team)', async () => {
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('composition')) return true;
        if (p.includes('_members')) return false;
        if (p.includes('my-leadership')) return true;
        return false;
      });

      const result = await svc.linkMember(NAME, 'boss@co.com', WS);
      expect(result.wikiLink).toContain('my-leadership/boss@co.com');
      expect(result.created).toBe(false);
    });

    it('resolves to relationship when relationship exists (no team/leadership)', async () => {
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('composition')) return true;
        if (p.includes('relationships')) return true;
        return false;
      });

      const result = await svc.linkMember(NAME, 'partner@co.com', WS);
      expect(result.wikiLink).toContain('my-company/relationships/partner@co.com');
      expect(result.created).toBe(false);
    });

    it('auto-creates relationship and returns created: true when email not found', async () => {
      mockFS.exists.mockImplementation(async (p: string) => p.includes('composition'));

      const result = await svc.linkMember(NAME, 'newguy@co.com', WS);
      expect(mockRel.addRelationship).toHaveBeenCalledWith('newguy@co.com', {}, WS);
      expect(result.created).toBe(true);
    });
  });

  // ── linkMember ────────────────────────────────────────────────────────────────

  describe('linkMember', () => {
    beforeEach(() => {
      mockFS.exists.mockImplementation(async (p: string) => p.includes('composition'));
      mockFS.readFile.mockResolvedValue(compContent());
    });

    it('throws when project does not exist', async () => {
      mockFS.exists.mockResolvedValue(false);
      await expect(svc.linkMember(NAME, 'alice@co.com', WS)).rejects.toThrow(/not found/i);
    });

    it('appends wiki-link to composition file', async () => {
      await svc.linkMember(NAME, 'alice@co.com', WS);

      expect(mockFS.writeFile).toHaveBeenCalledWith(COMP_PATH, expect.stringContaining('[['));
    });

    it('normalizes email to lowercase in wiki-link', async () => {
      await svc.linkMember(NAME, 'ALICE@CO.COM', WS);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        COMP_PATH,
        expect.stringContaining('alice@co.com'),
      );
    });
  });

  // ── linkStakeholder ───────────────────────────────────────────────────────────

  describe('linkStakeholder', () => {
    beforeEach(() => {
      mockFS.exists.mockImplementation(async (p: string) => p.includes('composition'));
      mockFS.readFile.mockResolvedValue(compContent());
    });

    it('throws when project does not exist', async () => {
      mockFS.exists.mockResolvedValue(false);
      await expect(svc.linkStakeholder(NAME, 'alice@co.com', WS)).rejects.toThrow(/not found/i);
    });

    it('appends to Stakeholders section', async () => {
      // Make relationship exist so we can verify section targeting
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('composition') || p.includes('relationships')) return true;
        return false;
      });

      await svc.linkStakeholder(NAME, 'stake@co.com', WS);

      const written = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      const stakeholderIdx = written.indexOf('# Stakeholders');
      const linkIdx = written.indexOf('stake@co.com');
      expect(stakeholderIdx).toBeGreaterThanOrEqual(0);
      expect(linkIdx).toBeGreaterThan(stakeholderIdx);
    });
  });

  // ── linkMembers ───────────────────────────────────────────────────────────────

  describe('linkMembers', () => {
    beforeEach(() => {
      mockFS.exists.mockImplementation(async (p: string) => p.includes('composition'));
      mockFS.readFile.mockResolvedValue(compContent());
    });

    it('returns correct linked count for batch', async () => {
      const result = await svc.linkMembers(NAME, ['a@co.com', 'b@co.com', 'c@co.com'], WS);
      expect(result.linked).toBe(3);
    });

    it('counts created when relationships are auto-created', async () => {
      mockRel.addRelationship.mockResolvedValue({ created: true });

      const result = await svc.linkMembers(NAME, ['new1@co.com', 'new2@co.com'], WS);
      expect(result.created).toBe(2);
    });

    it('skips empty strings in email list', async () => {
      const result = await svc.linkMembers(NAME, ['a@co.com', '', 'b@co.com'], WS);
      expect(result.linked).toBe(2);
    });
  });

  // ── listProjects ──────────────────────────────────────────────────────────────

  describe('listProjects', () => {
    it('returns empty array when my-projects/ does not exist', async () => {
      mockFS.exists.mockResolvedValue(false);
      const result = await svc.listProjects(WS);
      expect(result).toEqual([]);
    });

    it('returns empty array when no project directories exist', async () => {
      mockFS.exists.mockResolvedValue(true);
      mockFS.listDirectories.mockResolvedValue([]);
      const result = await svc.listProjects(WS);
      expect(result).toEqual([]);
    });

    it('counts members and stakeholders correctly', async () => {
      mockFS.exists.mockResolvedValue(true);
      mockFS.listDirectories.mockResolvedValue(['platform']);
      mockFS.readFile.mockResolvedValue(compContent(['a@co.com', 'b@co.com'], ['s@co.com']));

      const result = await svc.listProjects(WS);
      expect(result[0]).toMatchObject({ name: 'platform', memberCount: 2, stakeholderCount: 1 });
    });

    it('returns zero counts when composition file missing', async () => {
      mockFS.exists
        .mockResolvedValueOnce(true) // my-projects/ exists
        .mockResolvedValueOnce(false); // composition does not exist
      mockFS.listDirectories.mockResolvedValue(['platform']);

      const result = await svc.listProjects(WS);
      expect(result[0]).toMatchObject({ name: 'platform', memberCount: 0, stakeholderCount: 0 });
    });
  });
});
