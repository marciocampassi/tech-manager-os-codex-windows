import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { MemberService } from '../../src/services/member.service.js';
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

// ── Constants ─────────────────────────────────────────────────────────────────

const WS = '/fake/workspace';
const EMAIL = 'john@co.com';
const PROFILE_PATH = `${WS}/my-teams/members/${EMAIL}/${EMAIL}.md`;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MemberService', () => {
  let svc: MemberService;
  let mockFS: MockFS;
  let mockParser: MockSectionParser;
  const realTemplate = new TemplateService();

  beforeEach(() => {
    mockFS = createMockFS();
    mockParser = createMockSectionParser();
    svc = new MemberService(
      mockFS as unknown as FileSystemService,
      mockParser as unknown as SectionParserService,
      realTemplate,
    );
  });

  // ── findMember ───────────────────────────────────────────────────────────────

  describe('findMember', () => {
    it('returns profile path when member exists', async () => {
      mockFS.exists.mockResolvedValue(true);
      const result = await svc.findMember(EMAIL, WS);
      expect(result).toBe(PROFILE_PATH);
    });

    it('returns null when member does not exist', async () => {
      mockFS.exists.mockResolvedValue(false);
      const result = await svc.findMember(EMAIL, WS);
      expect(result).toBeNull();
    });

    it('normalizes email to lowercase', async () => {
      mockFS.exists.mockResolvedValue(true);
      const result = await svc.findMember('JOHN@CO.COM', WS);
      expect(result).toContain('john@co.com');
    });
  });

  // ── createMemberFile ─────────────────────────────────────────────────────────

  describe('createMemberFile', () => {
    beforeEach(() => {
      mockFS.exists.mockResolvedValue(true);
    });

    it('throws if member profile does not exist', async () => {
      mockFS.exists.mockResolvedValue(false);
      await expect(svc.createMemberFile(EMAIL, '1on1', {}, WS)).rejects.toThrow(
        /not found.*tmr team add/i,
      );
    });

    it('creates the 1on1 file at correct path', async () => {
      const opts = { date: '2026-03-07' };
      await svc.createMemberFile(EMAIL, '1on1', opts, WS);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('1on1s/2026-03-07-john@co.com-1on1.md'),
        expect.stringContaining('type: 1on1'),
      );
    });

    it('creates the feedback file at correct path', async () => {
      await svc.createMemberFile(EMAIL, 'feedback', { date: '2026-03-07' }, WS);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('feedback/2026-03-07-john@co.com-feedback.md'),
        expect.stringContaining('type: feedback'),
      );
    });

    it('creates the assessment file at correct path', async () => {
      await svc.createMemberFile(EMAIL, 'assessment', { date: '2026-03-07' }, WS);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('assessments/2026-03-07-john@co.com-assessment.md'),
        expect.stringContaining('type: assessment'),
      );
    });

    it('creates the performance-review file with -review suffix', async () => {
      await svc.createMemberFile(EMAIL, 'performance-review', { date: '2026-03-07' }, WS);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('performance-reviews/2026-03-07-john@co.com-review.md'),
        expect.stringContaining('type: performance-review'),
      );
    });

    it('calls appendToFile with correct section name for 1on1', async () => {
      await svc.createMemberFile(EMAIL, '1on1', { date: '2026-03-07' }, WS);

      expect(mockParser.appendToFile).toHaveBeenCalledWith(
        PROFILE_PATH,
        '1on1s',
        expect.stringContaining('[[1on1s/2026-03-07-john@co.com-1on1.md]]'),
      );
    });

    it('calls appendToFile with correct section name for Feedbacks', async () => {
      await svc.createMemberFile(EMAIL, 'feedback', { date: '2026-03-07' }, WS);

      expect(mockParser.appendToFile).toHaveBeenCalledWith(
        PROFILE_PATH,
        'Feedbacks',
        expect.any(String),
      );
    });

    it('ensures subdirectory exists before writing file', async () => {
      await svc.createMemberFile(EMAIL, '1on1', { date: '2026-03-07' }, WS);

      expect(mockFS.createDirectory).toHaveBeenCalledWith(expect.stringContaining('1on1s'));
    });

    it('returns filePath, profilePath, and wikiLink', async () => {
      const result = await svc.createMemberFile(EMAIL, '1on1', { date: '2026-03-07' }, WS);

      expect(result.filePath).toContain('2026-03-07-john@co.com-1on1.md');
      expect(result.profilePath).toContain('john@co.com.md');
      expect(result.wikiLink).toContain('[[1on1s/2026-03-07-john@co.com-1on1.md]]');
    });

    it('normalizes email to lowercase', async () => {
      const result = await svc.createMemberFile('JOHN@CO.COM', '1on1', { date: '2026-03-07' }, WS);
      expect(result.filePath).toContain('john@co.com');
    });
  });
});
