import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import matter from 'gray-matter';
import { LeadershipService } from '../../src/services/leadership.service.js';
import type { FileSystemService } from '../../src/services/file-system.service.js';
import type { SectionParserService } from '../../src/services/section-parser.service.js';
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

// ── Mock SectionParserService ─────────────────────────────────────────────────

type MockSectionParser = {
  [K in keyof SectionParserService]: jest.MockedFunction<SectionParserService[K]>;
};

function createMockSectionParser(): MockSectionParser {
  return {
    findSection: jest.fn<SectionParserService['findSection']>().mockReturnValue(true),
    appendToSection: jest.fn<SectionParserService['appendToSection']>().mockReturnValue(''),
    appendToFile: jest.fn<SectionParserService['appendToFile']>().mockResolvedValue(undefined),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const WS = '/fake/workspace';
const EMAIL = 'boss@co.com';
const PROFILE_PATH = `${WS}/my-leadership/${EMAIL}/${EMAIL}.md`;

function buildProfileContent(email: string): string {
  return matter.stringify('\n# Leadership\n\n## Notes\n\n## 1on1s\n', {
    email,
    name: 'The Boss',
    role: 'VP Engineering',
    areas_of_responsibility: 'Platform, Infrastructure',
    date_added: '2026-03-09',
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LeadershipService', () => {
  let svc: LeadershipService;
  let mockFS: MockFS;
  let mockParser: MockSectionParser;
  const realTemplate = new TemplateService();

  beforeEach(() => {
    mockFS = createMockFS();
    mockParser = createMockSectionParser();
    svc = new LeadershipService(
      mockFS as unknown as FileSystemService,
      mockParser as unknown as SectionParserService,
      realTemplate,
    );
  });

  // ── findLeadership ────────────────────────────────────────────────────────────

  describe('findLeadership', () => {
    it('returns profile path when leadership contact exists', async () => {
      mockFS.exists.mockResolvedValue(true);
      const result = await svc.findLeadership(EMAIL, WS);
      expect(result).toBe(PROFILE_PATH);
    });

    it('returns null when leadership contact does not exist', async () => {
      mockFS.exists.mockResolvedValue(false);
      const result = await svc.findLeadership(EMAIL, WS);
      expect(result).toBeNull();
    });

    it('normalizes email to lowercase', async () => {
      mockFS.exists.mockResolvedValue(true);
      const result = await svc.findLeadership('BOSS@CO.COM', WS);
      expect(result).toContain('boss@co.com');
    });
  });

  // ── addLeadership ─────────────────────────────────────────────────────────────

  describe('addLeadership', () => {
    it('creates directory, profile, and returns created: true for new contact', async () => {
      mockFS.exists.mockResolvedValue(false);

      const result = await svc.addLeadership(EMAIL, {}, WS);

      expect(result.created).toBe(true);
      expect(mockFS.createDirectory).toHaveBeenCalledWith(expect.stringContaining('1on1s'));
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`${EMAIL}.md`),
        expect.stringContaining(`email: ${EMAIL}`),
      );
    });

    it('returns created: false when contact already exists', async () => {
      mockFS.exists.mockResolvedValue(true);

      const result = await svc.addLeadership(EMAIL, {}, WS);

      expect(result.created).toBe(false);
      expect(mockFS.writeFile).not.toHaveBeenCalled();
    });

    it('normalizes email to lowercase', async () => {
      mockFS.exists.mockResolvedValue(false);

      await svc.addLeadership('BOSS@CO.COM', {}, WS);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('boss@co.com'),
        expect.any(String),
      );
    });

    it('includes provided options in profile content', async () => {
      mockFS.exists.mockResolvedValue(false);

      await svc.addLeadership(
        EMAIL,
        { name: 'The Boss', role: 'VP Engineering', areas_of_responsibility: 'Platform' },
        WS,
      );

      const writtenContent = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(writtenContent).toContain('name: The Boss');
      expect(writtenContent).toContain('role: VP Engineering');
      expect(writtenContent).toContain('areas_of_responsibility: Platform');
    });

    it('writes profile with ## 1on1s and ## Notes sections', async () => {
      mockFS.exists.mockResolvedValue(false);

      await svc.addLeadership(EMAIL, {}, WS);

      const writtenContent = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(writtenContent).toContain('## 1on1s');
      expect(writtenContent).toContain('## Notes');
    });

    it('places profile in my-leadership/{email}/ directory', async () => {
      mockFS.exists.mockResolvedValue(false);

      await svc.addLeadership(EMAIL, {}, WS);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`my-leadership/${EMAIL}/${EMAIL}.md`),
        expect.any(String),
      );
    });
  });

  // ── add1on1 ──────────────────────────────────────────────────────────────────

  describe('add1on1', () => {
    beforeEach(() => {
      mockFS.exists.mockResolvedValue(true);
    });

    it('throws if leadership contact does not exist', async () => {
      mockFS.exists.mockResolvedValue(false);
      await expect(svc.add1on1(EMAIL, {}, WS)).rejects.toThrow(/not found.*tmr leadership add/i);
    });

    it('creates 1on1 file at correct path', async () => {
      await svc.add1on1(EMAIL, { date: '2026-03-09' }, WS);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`1on1s/2026-03-09-${EMAIL}-1on1.md`),
        expect.any(String),
      );
    });

    it('uses leadership 1on1 template (type: leadership-1on1)', async () => {
      await svc.add1on1(EMAIL, { date: '2026-03-09' }, WS);

      const writtenContent = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(writtenContent).toContain('type: leadership-1on1');
    });

    it('includes all required leadership 1on1 sections', async () => {
      await svc.add1on1(EMAIL, { date: '2026-03-09' }, WS);

      const writtenContent = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(writtenContent).toContain('## Alignment Topics');
      expect(writtenContent).toContain('## Support Needed');
      expect(writtenContent).toContain('## Feedback Requested');
      expect(writtenContent).toContain('## Notes');
    });

    it('appends wiki-link to ## 1on1s section of profile', async () => {
      await svc.add1on1(EMAIL, { date: '2026-03-09' }, WS);

      expect(mockParser.appendToFile).toHaveBeenCalledWith(
        PROFILE_PATH,
        '1on1s',
        expect.stringContaining(`[[1on1s/2026-03-09-${EMAIL}-1on1.md]]`),
      );
    });

    it('returns filePath, profilePath, and wikiLink', async () => {
      const result = await svc.add1on1(EMAIL, { date: '2026-03-09' }, WS);

      expect(result.filePath).toContain(`2026-03-09-${EMAIL}-1on1.md`);
      expect(result.profilePath).toContain(`${EMAIL}.md`);
      expect(result.wikiLink).toContain(`[[1on1s/2026-03-09-${EMAIL}-1on1.md]]`);
    });
  });

  // ── listLeadership ────────────────────────────────────────────────────────────

  describe('listLeadership', () => {
    it('returns empty array when leadership root does not exist', async () => {
      mockFS.exists.mockResolvedValue(false);
      const result = await svc.listLeadership(WS);
      expect(result).toEqual([]);
    });

    it('returns empty array when no contacts exist', async () => {
      mockFS.exists.mockResolvedValue(true);
      mockFS.listDirectories.mockResolvedValue([]);
      const result = await svc.listLeadership(WS);
      expect(result).toEqual([]);
    });

    it('returns leadership summaries with parsed frontmatter', async () => {
      mockFS.exists.mockResolvedValue(true);
      mockFS.listDirectories.mockResolvedValue(['boss@co.com']);
      mockFS.readFile.mockResolvedValue(buildProfileContent('boss@co.com'));
      mockFS.listFiles.mockResolvedValue([]);

      const result = await svc.listLeadership(WS);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        email: 'boss@co.com',
        name: 'The Boss',
        role: 'VP Engineering',
        lastInteraction: '-',
      });
    });

    it('extracts last interaction date from most recent 1on1 filename', async () => {
      mockFS.exists.mockResolvedValue(true);
      mockFS.listDirectories.mockResolvedValue(['boss@co.com']);
      mockFS.readFile.mockResolvedValue(buildProfileContent('boss@co.com'));
      mockFS.listFiles.mockResolvedValue([
        `${WS}/my-leadership/boss@co.com/1on1s/2026-01-10-boss@co.com-1on1.md`,
        `${WS}/my-leadership/boss@co.com/1on1s/2026-03-09-boss@co.com-1on1.md`,
      ]);

      const result = await svc.listLeadership(WS);

      expect(result[0]?.lastInteraction).toBe('2026-03-09');
    });

    it('sorts most recent interaction first, no-interaction last', async () => {
      mockFS.exists.mockResolvedValue(true);
      mockFS.listDirectories.mockResolvedValue(['alpha@co.com', 'beta@co.com', 'gamma@co.com']);
      mockFS.readFile
        .mockResolvedValueOnce(buildProfileContent('alpha@co.com'))
        .mockResolvedValueOnce(buildProfileContent('beta@co.com'))
        .mockResolvedValueOnce(buildProfileContent('gamma@co.com'));
      // alpha: older
      mockFS.listFiles
        .mockResolvedValueOnce([
          `${WS}/my-leadership/alpha@co.com/1on1s/2026-02-01-alpha@co.com-1on1.md`,
        ])
        // beta: no 1on1s
        .mockResolvedValueOnce([])
        // gamma: most recent
        .mockResolvedValueOnce([
          `${WS}/my-leadership/gamma@co.com/1on1s/2026-03-09-gamma@co.com-1on1.md`,
        ]);

      const result = await svc.listLeadership(WS);

      expect(result[0]?.email).toBe('gamma@co.com');
      expect(result[1]?.email).toBe('alpha@co.com');
      expect(result[2]?.email).toBe('beta@co.com');
      expect(result[2]?.lastInteraction).toBe('-');
    });
  });
});
