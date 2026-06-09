import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { MyselfService } from '../../src/services/myself.service.js';
import type { FileSystemService } from '../../src/services/file-system.service.js';
import type { EmailResolutionService } from '../../src/services/email-resolution.service.js';
import type { TemplateService } from '../../src/services/template.service.js';
import type { SectionParserService } from '../../src/services/section-parser.service.js';
import { ConfigurationError, ValidationError } from '../../src/errors/tmr-error.js';

// ── Mock types ────────────────────────────────────────────────────────────────

type MockFS = {
  [K in keyof FileSystemService]: jest.MockedFunction<FileSystemService[K]>;
};

type MockEmailResolution = {
  resolve: jest.MockedFunction<EmailResolutionService['resolve']>;
};

type MockTemplate = {
  getTemplate: jest.MockedFunction<TemplateService['getTemplate']>;
};

type MockSectionParser = {
  appendToFile: jest.MockedFunction<SectionParserService['appendToFile']>;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const WORKSPACE = '/fake/workspace';
const OWN_EMAIL = 'me@company.com';
const CAREER_ROOT = `${WORKSPACE}/my-career`;
const PROFILE_PATH = `${CAREER_ROOT}/${OWN_EMAIL}.md`;

const DEFAULT_RESOLVED = {
  type: 'self' as const,
  absolutePath: PROFILE_PATH,
  created: false,
};

// ── Factories ─────────────────────────────────────────────────────────────────

function createMockFS(): MockFS {
  return {
    createDirectory: jest.fn<FileSystemService['createDirectory']>().mockResolvedValue(undefined),
    writeFile: jest.fn<FileSystemService['writeFile']>().mockResolvedValue(undefined),
    readFile: jest.fn<FileSystemService['readFile']>().mockResolvedValue(''),
    moveFile: jest.fn<FileSystemService['moveFile']>().mockResolvedValue(undefined),
    exists: jest.fn<FileSystemService['exists']>().mockResolvedValue(false),
    appendFile: jest.fn<FileSystemService['appendFile']>().mockResolvedValue(undefined),
    listFiles: jest.fn<FileSystemService['listFiles']>().mockResolvedValue([PROFILE_PATH]),
    listDirectories: jest.fn<FileSystemService['listDirectories']>().mockResolvedValue([]),
    removeFile: jest.fn<FileSystemService['removeFile']>().mockResolvedValue(undefined),
  };
}

function createMockEmailResolution(): MockEmailResolution {
  return {
    resolve: jest.fn<EmailResolutionService['resolve']>().mockResolvedValue(DEFAULT_RESOLVED),
  };
}

function createMockTemplate(): MockTemplate {
  return {
    getTemplate: jest
      .fn<TemplateService['getTemplate']>()
      .mockReturnValue('# Performance Review template'),
  };
}

function createMockSectionParser(): MockSectionParser {
  return {
    appendToFile: jest.fn<SectionParserService['appendToFile']>().mockResolvedValue(undefined),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MyselfService', () => {
  let svc: MyselfService;
  let mockFS: MockFS;
  let mockEmailResolution: MockEmailResolution;
  let mockTemplate: MockTemplate;
  let mockSectionParser: MockSectionParser;

  beforeEach(() => {
    mockFS = createMockFS();
    mockEmailResolution = createMockEmailResolution();
    mockTemplate = createMockTemplate();
    mockSectionParser = createMockSectionParser();
    svc = new MyselfService(
      mockFS as unknown as FileSystemService,
      mockEmailResolution as unknown as EmailResolutionService,
      mockTemplate as unknown as TemplateService,
      mockSectionParser as unknown as SectionParserService,
    );
  });

  describe('addPerformanceReview', () => {
    it('creates a performance-review file in my-career/ with current month prefix', async () => {
      const result = await svc.addPerformanceReview({}, WORKSPACE);

      expect(mockTemplate.getTemplate).toHaveBeenCalledWith(
        'performance-review',
        expect.stringMatching(/^\d{4}-\d{2}$/),
        OWN_EMAIL,
      );
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`-performance-review-${OWN_EMAIL}.md`),
        '# Performance Review template',
      );
      expect(result.filePath).toContain(`-performance-review-${OWN_EMAIL}.md`);
      expect(result.filePath).toMatch(
        /[\/\\]my-career[\/\\]performance-reviews[\/\\]\d{4}-\d{2}-performance-review-/,
      );
    });

    it('uses provided --date YYYY-MM as filename prefix and passes it to template', async () => {
      const result = await svc.addPerformanceReview({ date: '2026-03' }, WORKSPACE);

      expect(result.filePath).toContain(`2026-03-performance-review-${OWN_EMAIL}.md`);
      expect(mockTemplate.getTemplate).toHaveBeenCalledWith(
        'performance-review',
        '2026-03',
        OWN_EMAIL,
      );
    });

    it('slices YYYY-MM-DD to YYYY-MM for both filename and template', async () => {
      const result = await svc.addPerformanceReview({ date: '2026-03-15' }, WORKSPACE);

      expect(result.filePath).toContain(`2026-03-performance-review-${OWN_EMAIL}.md`);
      expect(mockTemplate.getTemplate).toHaveBeenCalledWith(
        'performance-review',
        '2026-03',
        OWN_EMAIL,
      );
    });

    it('returns profilePath from EmailResolutionService.resolve()', async () => {
      const result = await svc.addPerformanceReview({}, WORKSPACE);

      expect(result.profilePath).toBe(PROFILE_PATH);
      expect(mockEmailResolution.resolve).toHaveBeenCalledWith(OWN_EMAIL, WORKSPACE);
    });

    it('appends wiki-link to Performance Reviews section of self profile', async () => {
      await svc.addPerformanceReview({ date: '2026-05' }, WORKSPACE);

      const expectedFileName = `2026-05-performance-review-${OWN_EMAIL}.md`;
      expect(mockSectionParser.appendToFile).toHaveBeenCalledWith(
        PROFILE_PATH,
        'Performance Reviews',
        `- [[performance-reviews/${expectedFileName}]]`,
      );
    });

    it('throws ConfigurationError when no self-profile exists in my-career/', async () => {
      mockFS.listFiles.mockResolvedValue([]);

      await expect(svc.addPerformanceReview({}, WORKSPACE)).rejects.toThrow(ConfigurationError);
      await expect(svc.addPerformanceReview({}, WORKSPACE)).rejects.toThrow(
        /No self-profile found/,
      );
    });

    it('writes file into my-career/performance-reviews/ subdirectory', async () => {
      await svc.addPerformanceReview({ date: '2026-05' }, WORKSPACE);

      const [[writtenPath]] = mockFS.writeFile.mock.calls as [string, string][];
      expect(writtenPath).toMatch(/[\/\\]my-career[\/\\]performance-reviews[\/\\]/);
    });

    it('uses resolve() canonical absolutePath as profilePath even if listFiles returns different path', async () => {
      const canonicalPath = `${WORKSPACE}/my-career/me@company.com.md`;
      mockEmailResolution.resolve.mockResolvedValue({
        type: 'self',
        absolutePath: canonicalPath,
        created: false,
      });

      const result = await svc.addPerformanceReview({}, WORKSPACE);

      expect(result.profilePath).toBe(canonicalPath);
    });

    it('throws ValidationError for invalid --date format', async () => {
      await expect(svc.addPerformanceReview({ date: 'foo' }, WORKSPACE)).rejects.toThrow(
        ValidationError,
      );
      await expect(svc.addPerformanceReview({ date: 'foo' }, WORKSPACE)).rejects.toThrow(
        /Invalid date format/,
      );
    });

    it('falls back to current month when --date is empty string', async () => {
      const result = await svc.addPerformanceReview({ date: '' }, WORKSPACE);

      expect(result.filePath).toMatch(
        /[\/\\]my-career[\/\\]performance-reviews[\/\\]\d{4}-\d{2}-performance-review-/,
      );
    });

    it('skips dated files when selecting profile from multiple my-career/ entries', async () => {
      const datedFile = `${CAREER_ROOT}/2026-05-performance-review-${OWN_EMAIL}.md`;
      mockFS.listFiles.mockResolvedValue([datedFile, PROFILE_PATH]);

      const result = await svc.addPerformanceReview({ date: '2026-05' }, WORKSPACE);

      expect(mockEmailResolution.resolve).toHaveBeenCalledWith(OWN_EMAIL, WORKSPACE);
      expect(result.profilePath).toBe(PROFILE_PATH);
    });
  });
});
