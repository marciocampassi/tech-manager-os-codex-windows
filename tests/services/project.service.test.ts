import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ProjectService } from '../../src/services/project.service.js';
import type { FileSystemService } from '../../src/services/file-system.service.js';
import type { EmailResolutionService } from '../../src/services/email-resolution.service.js';
import type { IEntityLocation } from '../../src/types/email-resolution.types.js';
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
    removeFile: jest.fn<FileSystemService['removeFile']>().mockResolvedValue(undefined),
  };
}

// ── Mock EmailResolutionService ───────────────────────────────────────────────

type MockEmailResolution = {
  resolve: jest.MockedFunction<EmailResolutionService['resolve']>;
  generateWikiLink: jest.MockedFunction<EmailResolutionService['generateWikiLink']>;
};

const DEFAULT_LOCATION: IEntityLocation = {
  type: 'relationship',
  absolutePath: '/fake/workspace/my-company/members/default@co.com/default@co.com.md',
  created: false,
};

function createMockEmailResolution(): MockEmailResolution {
  return {
    resolve: jest.fn<EmailResolutionService['resolve']>().mockResolvedValue(DEFAULT_LOCATION),
    generateWikiLink: jest
      .fn<EmailResolutionService['generateWikiLink']>()
      .mockImplementation((_email, _resolved, _from) => '[[fake-path|email]]'),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const WS = '/fake/workspace';
const NAME = 'platform';
const NORMALIZED = 'platform-project';
const OVERVIEW_PATH = `${WS}/my-company/projects/${NORMALIZED}/${NORMALIZED}.md`;

function overviewContent(members: string[] = [], stakeholders: string[] = []): string {
  const memberLines = members.map((e) => `- [[${e}]]`).join('\n');
  const stakeholderLines = stakeholders.map((e) => `- [[${e}]]`).join('\n');
  return `# Team Members\n${memberLines}\n\n# Stakeholders\n${stakeholderLines}\n`;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProjectService', () => {
  let svc: ProjectService;
  let mockFS: MockFS;
  let mockEmailResolution: MockEmailResolution;
  const realTemplate = new TemplateService();

  beforeEach(() => {
    mockFS = createMockFS();
    mockEmailResolution = createMockEmailResolution();
    svc = new ProjectService(
      mockFS as unknown as FileSystemService,
      realTemplate,
      mockEmailResolution as unknown as EmailResolutionService,
    );
  });

  // ── addProject ────────────────────────────────────────────────────────────────

  describe('addProject', () => {
    it('returns created: true and creates overview file and correct directories', async () => {
      mockFS.exists.mockResolvedValue(false);

      const result = await svc.addProject(NAME, WS);

      expect(result.created).toBe(true);
      expect(mockFS.createDirectory).toHaveBeenCalledWith(expect.stringContaining('standups'));
      expect(mockFS.createDirectory).toHaveBeenCalledWith(expect.stringContaining('meetings'));
      expect(mockFS.createDirectory).not.toHaveBeenCalledWith(
        expect.stringContaining('discussion'),
      );
      expect(mockFS.createDirectory).not.toHaveBeenCalledWith(
        expect.stringContaining('presentation'),
      );
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`${NAME}-project.md`),
        expect.stringContaining('type: project'),
      );
    });

    it('overview file contains Team Members and Stakeholders sections', async () => {
      mockFS.exists.mockResolvedValue(false);
      await svc.addProject(NAME, WS);

      const written = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(written).toContain('# Team Members');
      expect(written).toContain('# Stakeholders');
    });

    it('does not create a composition file', async () => {
      mockFS.exists.mockResolvedValue(false);
      await svc.addProject(NAME, WS);

      const allPaths = (mockFS.writeFile.mock.calls as [string, string][]).map(([p]) => p);
      expect(allPaths.some((p) => p.includes('composition'))).toBe(false);
    });

    it('returns created: false when project already exists', async () => {
      mockFS.exists.mockResolvedValue(true);

      const result = await svc.addProject(NAME, WS);

      expect(result.created).toBe(false);
      expect(mockFS.writeFile).not.toHaveBeenCalled();
    });

    it('places overview file under my-company/projects/{name}-project/', async () => {
      mockFS.exists.mockResolvedValue(false);
      await svc.addProject(NAME, WS);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`my-company/projects/${NORMALIZED}/${NORMALIZED}.md`),
        expect.any(String),
      );
    });

    it('normalizes project name by appending -project suffix', async () => {
      mockFS.exists.mockResolvedValue(false);
      await svc.addProject('internship-program', WS);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('internship-program-project'),
        expect.any(String),
      );
    });

    it('does not double the -project suffix', async () => {
      mockFS.exists.mockResolvedValue(false);
      await svc.addProject('platform-project', WS);

      const allPaths = (mockFS.writeFile.mock.calls as [string, string][]).map(([p]) => p);
      expect(allPaths.some((p) => p.includes('platform-project-project'))).toBe(false);
    });

    it('PROJ-UNIT-001: writes deps.yaml to correct path with full header and sources block', async () => {
      mockFS.exists.mockResolvedValue(false);
      await svc.addProject(NAME, WS);

      const allWriteCalls = mockFS.writeFile.mock.calls as [string, string][];
      const depsCall = allWriteCalls.find(([p]) => p.endsWith('deps.yaml'));
      expect(depsCall).toBeDefined();
      expect(depsCall?.[0]).toContain(`my-company/projects/${NORMALIZED}/deps.yaml`);
      expect(depsCall?.[1]).toContain('sources: {}');
      expect(depsCall?.[1]).toContain('tmr-project-impact');
      expect(depsCall?.[1]).toContain('deps.yaml — project dependency manifest');
      expect(depsCall?.[1]).toContain('Do not edit manually unless you understand the schema.');
    });
  });

  // ── addStandup ────────────────────────────────────────────────────────────────

  describe('addStandup', () => {
    it('throws when project does not exist', async () => {
      mockFS.exists.mockResolvedValue(false);
      await expect(svc.addStandup(NAME, {}, WS)).rejects.toThrow(/not found.*tmr project add/i);
    });

    it('creates standup file under standups/ directory', async () => {
      mockFS.exists.mockResolvedValue(true);
      await svc.addStandup(NAME, { date: '2026-03-09' }, WS);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`standups/2026-03-09-${NORMALIZED}-standup.md`),
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

    // ── 9.13 tests ──────────────────────────────────────────────────────────────

    it('9.13: standup frontmatter contains a wiki-link to the project overview', async () => {
      mockFS.exists.mockResolvedValue(true);
      await svc.addStandup(NAME, { date: '2026-05-20' }, WS);

      const content = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      // The project field must be a wiki-link, not just the raw project name
      expect(content).toContain('[[');
      expect(content).toContain(`${NORMALIZED}.md`);
    });

    it('9.13: standup wiki-link points from standups/ dir to overview one level up', async () => {
      mockFS.exists.mockResolvedValue(true);
      await svc.addStandup(NAME, { date: '2026-05-20' }, WS);

      const content = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      // overview is at ../<name>.md relative to the standup file
      expect(content).toContain(`[[../${NORMALIZED}.md|${NORMALIZED}]]`);
    });

    it('9.13: standup with --date option uses specified date in filename and template', async () => {
      mockFS.exists.mockResolvedValue(true);
      await svc.addStandup(NAME, { date: '2026-05-20' }, WS);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('standups/2026-05-20-platform-project-standup.md'),
        expect.stringContaining('date: 2026-05-20'),
      );
    });
  });

  // ── linkMember ────────────────────────────────────────────────────────────────

  describe('linkMember', () => {
    beforeEach(() => {
      mockFS.exists.mockImplementation(async (p: string) => p.endsWith(`${NORMALIZED}.md`));
      mockFS.readFile.mockResolvedValue(overviewContent());
    });

    it('throws when project does not exist', async () => {
      mockFS.exists.mockResolvedValue(false);
      await expect(svc.linkMember(NAME, 'alice@co.com', WS)).rejects.toThrow(/not found/i);
    });

    it('appends wiki-link to overview file', async () => {
      mockEmailResolution.generateWikiLink.mockReturnValue('[[fake/path|alice@co.com]]');

      await svc.linkMember(NAME, 'alice@co.com', WS);

      expect(mockFS.writeFile).toHaveBeenCalledWith(OVERVIEW_PATH, expect.stringContaining('[['));
    });

    it('normalizes email to lowercase before calling resolve', async () => {
      await svc.linkMember(NAME, 'ALICE@CO.COM', WS);

      expect(mockEmailResolution.resolve).toHaveBeenCalledWith('alice@co.com', WS);
    });

    it('returns created: true when email resolution auto-creates a relationship', async () => {
      mockEmailResolution.resolve.mockResolvedValue({ ...DEFAULT_LOCATION, created: true });

      const result = await svc.linkMember(NAME, 'new@co.com', WS);

      expect(result.created).toBe(true);
    });

    it('returns created: false when email already existed', async () => {
      mockEmailResolution.resolve.mockResolvedValue({ ...DEFAULT_LOCATION, created: false });

      const result = await svc.linkMember(NAME, 'existing@co.com', WS);

      expect(result.created).toBe(false);
    });

    // ── 9.14 tests ──────────────────────────────────────────────────────────────

    it('9.14: writes project back-link to member profile under ## Projects', async () => {
      await svc.linkMember(NAME, 'alice@co.com', WS);

      // Single regex verifies ## Projects appears before the wiki-link in the same write
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        DEFAULT_LOCATION.absolutePath,
        expect.stringMatching(/## Projects[\s\S]*\[\[/),
      );
    });
  });

  // ── linkStakeholder ───────────────────────────────────────────────────────────

  describe('linkStakeholder', () => {
    beforeEach(() => {
      mockFS.exists.mockImplementation(async (p: string) => p.endsWith(`${NORMALIZED}.md`));
      mockFS.readFile.mockResolvedValue(overviewContent());
    });

    it('throws when project does not exist', async () => {
      mockFS.exists.mockResolvedValue(false);
      await expect(svc.linkStakeholder(NAME, 'alice@co.com', WS)).rejects.toThrow(/not found/i);
    });

    it('appends to Stakeholders section in overview file', async () => {
      mockEmailResolution.generateWikiLink.mockReturnValue('[[fake/path|stake@co.com]]');

      await svc.linkStakeholder(NAME, 'stake@co.com', WS);

      const written = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      const stakeholderIdx = written.indexOf('# Stakeholders');
      const linkIdx = written.indexOf('stake@co.com');
      expect(stakeholderIdx).toBeGreaterThanOrEqual(0);
      expect(linkIdx).toBeGreaterThan(stakeholderIdx);
    });

    it('normalizes email to lowercase before calling resolve', async () => {
      await svc.linkStakeholder(NAME, 'STAKE@CO.COM', WS);

      expect(mockEmailResolution.resolve).toHaveBeenCalledWith('stake@co.com', WS);
    });

    // ── 9.14 tests ──────────────────────────────────────────────────────────────

    it('9.14: writes project back-link to stakeholder profile under ## Projects', async () => {
      await svc.linkStakeholder(NAME, 'stake@co.com', WS);

      // Single regex verifies ## Projects appears before the wiki-link in the same write
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        DEFAULT_LOCATION.absolutePath,
        expect.stringMatching(/## Projects[\s\S]*\[\[/),
      );
    });
  });

  // ── linkMembers ───────────────────────────────────────────────────────────────

  describe('linkMembers', () => {
    beforeEach(() => {
      mockFS.exists.mockImplementation(async (p: string) => p.endsWith(`${NORMALIZED}.md`));
      mockFS.readFile.mockResolvedValue(overviewContent());
    });

    it('returns correct linked count for batch', async () => {
      const result = await svc.linkMembers(NAME, ['a@co.com', 'b@co.com', 'c@co.com'], WS);
      expect(result.linked).toBe(3);
    });

    it('counts created when relationships are auto-created', async () => {
      mockEmailResolution.resolve.mockResolvedValue({ ...DEFAULT_LOCATION, created: true });

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
    it('returns empty array when my-company/projects/ does not exist', async () => {
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

    it('only lists directories ending in -project', async () => {
      mockFS.exists.mockResolvedValue(true);
      mockFS.listDirectories.mockResolvedValue(['platform-project', 'random-dir']);
      mockFS.readFile.mockResolvedValue(overviewContent());

      const result = await svc.listProjects(WS);
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('platform-project');
    });

    it('counts members and stakeholders correctly', async () => {
      mockFS.exists.mockResolvedValue(true);
      mockFS.listDirectories.mockResolvedValue(['platform-project']);
      mockFS.readFile.mockResolvedValue(overviewContent(['a@co.com', 'b@co.com'], ['s@co.com']));

      const result = await svc.listProjects(WS);
      expect(result[0]).toMatchObject({
        name: 'platform-project',
        memberCount: 2,
        stakeholderCount: 1,
      });
    });

    it('returns zero counts when overview file is missing', async () => {
      mockFS.exists
        .mockResolvedValueOnce(true) // my-company/projects/ exists
        .mockResolvedValueOnce(false); // overview does not exist
      mockFS.listDirectories.mockResolvedValue(['platform-project']);

      const result = await svc.listProjects(WS);
      expect(result[0]).toMatchObject({
        name: 'platform-project',
        memberCount: 0,
        stakeholderCount: 0,
      });
    });
  });
});
