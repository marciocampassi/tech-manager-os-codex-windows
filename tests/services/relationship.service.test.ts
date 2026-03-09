import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import matter from 'gray-matter';
import { RelationshipService } from '../../src/services/relationship.service.js';
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
const EMAIL = 'alice@co.com';
const PROFILE_PATH = `${WS}/my-company/relationships/${EMAIL}/${EMAIL}.md`;

function buildProfileContent(email: string): string {
  return matter.stringify('\n# Relationship\n\n## Notes\n\n## 1on1s\n', {
    email,
    name: 'Alice',
    role: 'PM',
    department: 'Product',
    relationship_type: 'collaborator',
    date_added: '2026-03-07',
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RelationshipService', () => {
  let svc: RelationshipService;
  let mockFS: MockFS;
  let mockParser: MockSectionParser;
  const realTemplate = new TemplateService();

  beforeEach(() => {
    mockFS = createMockFS();
    mockParser = createMockSectionParser();
    svc = new RelationshipService(
      mockFS as unknown as FileSystemService,
      mockParser as unknown as SectionParserService,
      realTemplate,
    );
  });

  // ── findRelationship ──────────────────────────────────────────────────────────

  describe('findRelationship', () => {
    it('returns profile path when relationship exists', async () => {
      mockFS.exists.mockResolvedValue(true);
      const result = await svc.findRelationship(EMAIL, WS);
      expect(result).toBe(PROFILE_PATH);
    });

    it('returns null when relationship does not exist', async () => {
      mockFS.exists.mockResolvedValue(false);
      const result = await svc.findRelationship(EMAIL, WS);
      expect(result).toBeNull();
    });

    it('normalizes email to lowercase', async () => {
      mockFS.exists.mockResolvedValue(true);
      const result = await svc.findRelationship('ALICE@CO.COM', WS);
      expect(result).toContain('alice@co.com');
    });
  });

  // ── addRelationship ───────────────────────────────────────────────────────────

  describe('addRelationship', () => {
    it('creates directory, profile, and returns created: true for new relationship', async () => {
      mockFS.exists.mockResolvedValue(false);

      const result = await svc.addRelationship(EMAIL, {}, WS);

      expect(result.created).toBe(true);
      expect(mockFS.createDirectory).toHaveBeenCalledWith(expect.stringContaining('1on1s'));
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`${EMAIL}.md`),
        expect.stringContaining(`email: ${EMAIL}`),
      );
    });

    it('returns created: false when relationship already exists', async () => {
      mockFS.exists.mockResolvedValue(true);

      const result = await svc.addRelationship(EMAIL, {}, WS);

      expect(result.created).toBe(false);
      expect(mockFS.writeFile).not.toHaveBeenCalled();
    });

    it('normalizes email to lowercase', async () => {
      mockFS.exists.mockResolvedValue(false);

      await svc.addRelationship('ALICE@CO.COM', {}, WS);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('alice@co.com'),
        expect.any(String),
      );
    });

    it('includes provided options in profile content', async () => {
      mockFS.exists.mockResolvedValue(false);

      await svc.addRelationship(
        EMAIL,
        { name: 'Alice', department: 'Product', relationship_type: 'collaborator' },
        WS,
      );

      const writtenContent = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(writtenContent).toContain('name: Alice');
      expect(writtenContent).toContain('department: Product');
      expect(writtenContent).toContain('relationship_type: collaborator');
    });

    it('writes profile with ## 1on1s and ## Notes sections', async () => {
      mockFS.exists.mockResolvedValue(false);

      await svc.addRelationship(EMAIL, {}, WS);

      const writtenContent = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(writtenContent).toContain('## 1on1s');
      expect(writtenContent).toContain('## Notes');
    });
  });

  // ── addBatch ──────────────────────────────────────────────────────────────────

  describe('addBatch', () => {
    it('returns correct created/existed counts for all new', async () => {
      mockFS.exists.mockResolvedValue(false);

      const result = await svc.addBatch(['alice@co.com', 'bob@co.com', 'carol@co.com'], {}, WS);

      expect(result.created).toBe(3);
      expect(result.existed).toBe(0);
    });

    it('returns correct created/existed counts for mixed batch', async () => {
      mockFS.exists
        .mockResolvedValueOnce(false) // alice — new
        .mockResolvedValueOnce(true) // bob — exists
        .mockResolvedValueOnce(false); // carol — new

      const result = await svc.addBatch(['alice@co.com', 'bob@co.com', 'carol@co.com'], {}, WS);

      expect(result.created).toBe(2);
      expect(result.existed).toBe(1);
    });

    it('returns existed: N when all already exist', async () => {
      mockFS.exists.mockResolvedValue(true);

      const result = await svc.addBatch(['alice@co.com', 'bob@co.com'], {}, WS);

      expect(result.created).toBe(0);
      expect(result.existed).toBe(2);
    });
  });

  // ── add1on1 ──────────────────────────────────────────────────────────────────

  describe('add1on1', () => {
    beforeEach(() => {
      mockFS.exists.mockResolvedValue(true);
    });

    it('throws if relationship does not exist', async () => {
      mockFS.exists.mockResolvedValue(false);
      await expect(svc.add1on1(EMAIL, {}, WS)).rejects.toThrow(/not found.*tmr relationship add/i);
    });

    it('creates 1on1 file at correct path', async () => {
      await svc.add1on1(EMAIL, { date: '2026-03-07' }, WS);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('1on1s/2026-03-07-alice@co.com-1on1.md'),
        expect.stringContaining('type: 1on1'),
      );
    });

    it('uses relationship 1on1 template (Alignment Topics section)', async () => {
      await svc.add1on1(EMAIL, { date: '2026-03-07' }, WS);

      const writtenContent = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(writtenContent).toContain('## Alignment Topics');
      expect(writtenContent).toContain('## Support Needed');
      expect(writtenContent).toContain('## Feedback Requested');
    });

    it('appends wiki-link to ## 1on1s section of profile', async () => {
      await svc.add1on1(EMAIL, { date: '2026-03-07' }, WS);

      expect(mockParser.appendToFile).toHaveBeenCalledWith(
        PROFILE_PATH,
        '1on1s',
        expect.stringContaining('[[1on1s/2026-03-07-alice@co.com-1on1.md]]'),
      );
    });

    it('returns filePath, profilePath, and wikiLink', async () => {
      const result = await svc.add1on1(EMAIL, { date: '2026-03-07' }, WS);

      expect(result.filePath).toContain('2026-03-07-alice@co.com-1on1.md');
      expect(result.profilePath).toContain('alice@co.com.md');
      expect(result.wikiLink).toContain('[[1on1s/2026-03-07-alice@co.com-1on1.md]]');
    });
  });

  // ── listRelationships ─────────────────────────────────────────────────────────

  describe('listRelationships', () => {
    it('returns empty array when relationships root does not exist', async () => {
      mockFS.exists.mockResolvedValue(false);
      const result = await svc.listRelationships(WS);
      expect(result).toEqual([]);
    });

    it('returns empty array when no relationships exist', async () => {
      mockFS.exists.mockResolvedValue(true);
      mockFS.listDirectories.mockResolvedValue([]);
      const result = await svc.listRelationships(WS);
      expect(result).toEqual([]);
    });

    it('returns relationship summaries with parsed frontmatter', async () => {
      mockFS.exists.mockResolvedValue(true);
      mockFS.listDirectories.mockResolvedValue(['alice@co.com']);
      mockFS.readFile.mockResolvedValue(buildProfileContent('alice@co.com'));
      mockFS.listFiles.mockResolvedValue([]);

      const result = await svc.listRelationships(WS);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        email: 'alice@co.com',
        name: 'Alice',
        department: 'Product',
        relationship_type: 'collaborator',
        lastInteraction: '-',
      });
    });

    it('extracts last interaction date from most recent 1on1 filename', async () => {
      mockFS.exists.mockResolvedValue(true);
      mockFS.listDirectories.mockResolvedValue(['alice@co.com']);
      mockFS.readFile.mockResolvedValue(buildProfileContent('alice@co.com'));
      mockFS.listFiles.mockResolvedValue([
        `${WS}/my-company/relationships/alice@co.com/1on1s/2026-01-10-alice@co.com-1on1.md`,
        `${WS}/my-company/relationships/alice@co.com/1on1s/2026-03-07-alice@co.com-1on1.md`,
      ]);

      const result = await svc.listRelationships(WS);

      expect(result[0]?.lastInteraction).toBe('2026-03-07');
    });

    it('sorts most recent interaction first, no-interaction last', async () => {
      mockFS.exists.mockResolvedValue(true);
      mockFS.listDirectories.mockResolvedValue(['alice@co.com', 'bob@co.com', 'carol@co.com']);
      mockFS.readFile
        .mockResolvedValueOnce(buildProfileContent('alice@co.com'))
        .mockResolvedValueOnce(buildProfileContent('bob@co.com'))
        .mockResolvedValueOnce(buildProfileContent('carol@co.com'));
      // alice: has 1on1s
      mockFS.listFiles
        .mockResolvedValueOnce([
          `${WS}/my-company/relationships/alice@co.com/1on1s/2026-03-01-alice@co.com-1on1.md`,
        ])
        // bob: no 1on1s
        .mockResolvedValueOnce([])
        // carol: more recent
        .mockResolvedValueOnce([
          `${WS}/my-company/relationships/carol@co.com/1on1s/2026-03-07-carol@co.com-1on1.md`,
        ]);

      const result = await svc.listRelationships(WS);

      expect(result[0]?.email).toBe('carol@co.com');
      expect(result[1]?.email).toBe('alice@co.com');
      expect(result[2]?.email).toBe('bob@co.com');
      expect(result[2]?.lastInteraction).toBe('-');
    });
  });
});
