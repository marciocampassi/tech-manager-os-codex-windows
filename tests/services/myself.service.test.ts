import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import matter from 'gray-matter';
import { MyselfService } from '../../src/services/myself.service.js';
import type { FileSystemService } from '../../src/services/file-system.service.js';
import type { EmailResolutionService } from '../../src/services/email-resolution.service.js';
import type { TemplateService } from '../../src/services/template.service.js';
import type { SectionParserService } from '../../src/services/section-parser.service.js';
import type { IDatedFileLinks } from '../../src/types/member.types.js';
import {
  ConfigurationError,
  ValidationError,
  InvalidEmailError,
} from '../../src/errors/tmr-error.js';
import { formatWikiLink } from '../../src/utils/wiki-link.js';

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
        expect.objectContaining({ subject: expect.stringContaining(OWN_EMAIL) }),
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
        expect.objectContaining({ subject: expect.stringContaining(OWN_EMAIL) }),
      );
    });

    it('slices YYYY-MM-DD to YYYY-MM for both filename and template', async () => {
      const result = await svc.addPerformanceReview({ date: '2026-03-15' }, WORKSPACE);

      expect(result.filePath).toContain(`2026-03-performance-review-${OWN_EMAIL}.md`);
      expect(mockTemplate.getTemplate).toHaveBeenCalledWith(
        'performance-review',
        '2026-03',
        OWN_EMAIL,
        expect.objectContaining({ subject: expect.stringContaining(OWN_EMAIL) }),
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

    it('9.32: passes links with subject wiki-link containing own email to getTemplate', async () => {
      await svc.addPerformanceReview({ date: '2026-05' }, WORKSPACE);

      const calls = mockTemplate.getTemplate.mock.calls as [
        string,
        string,
        string,
        IDatedFileLinks,
      ][];
      const [, , , links] = calls[0] as [string, string, string, IDatedFileLinks];
      expect(links).toBeDefined();
      // AC5: subject is the exact relative wiki-link from performance-reviews/ up to the flat self-profile
      expect(links.subject).toBe(`[[../${OWN_EMAIL}.md|${OWN_EMAIL}]]`);
    });

    it('9.32: links has no with or from field (self-review has no other participant)', async () => {
      await svc.addPerformanceReview({ date: '2026-05' }, WORKSPACE);

      const calls = mockTemplate.getTemplate.mock.calls as [
        string,
        string,
        string,
        IDatedFileLinks,
      ][];
      const [, , , links] = calls[0] as [string, string, string, IDatedFileLinks];
      expect(links.with).toBeUndefined();
      expect(links.from).toBeUndefined();
    });

    it('9.32: sets last_performance_review scalar on self profile', async () => {
      mockFS.exists.mockResolvedValue(true);

      await svc.addPerformanceReview({ date: '2026-05' }, WORKSPACE);

      const profileWrite = (mockFS.writeFile.mock.calls as [string, string][]).find(
        ([p]) => p === PROFILE_PATH,
      );
      expect(profileWrite).toBeDefined();
      const writtenContent = (profileWrite as [string, string])[1];
      expect(matter(writtenContent).data['last_performance_review']).toBe('2026-05');
    });

    it('9.32: last_performance_review is a single scalar — overwrite, not array (AC4)', async () => {
      mockFS.exists.mockResolvedValue(true);
      // Feed each profile write back into the next readFile so setScalar sees prior state
      let profileContent = '';
      mockFS.readFile.mockImplementation(async (p: string) =>
        p === PROFILE_PATH ? profileContent : '',
      );
      mockFS.writeFile.mockImplementation(async (p: string, c: string) => {
        if (p === PROFILE_PATH) profileContent = c;
      });

      await svc.addPerformanceReview({ date: '2026-05' }, WORKSPACE);
      await svc.addPerformanceReview({ date: '2026-07' }, WORKSPACE);

      const data = matter(profileContent).data;
      expect(data['last_performance_review']).toBe('2026-07');
      expect(Array.isArray(data['last_performance_review'])).toBe(false);
    });
  });

  describe('setManager', () => {
    const CHEF = 'chef@co.com';
    const MARLON = 'marlon@co.com';
    const CHEF_PATH = `${WORKSPACE}/my-leadership/${CHEF}/${CHEF}.md`;
    const MARLON_PATH = `${WORKSPACE}/my-leadership/${MARLON}/${MARLON}.md`;

    // Exact wiki-link strings as the service computes them
    const chefLinkOnSelf = formatWikiLink(CHEF_PATH, PROFILE_PATH, CHEF);
    const selfLinkOnChef = formatWikiLink(PROFILE_PATH, CHEF_PATH, OWN_EMAIL);
    const marlonLinkOnSelf = formatWikiLink(MARLON_PATH, PROFILE_PATH, MARLON);
    const selfLinkOnMarlon = formatWikiLink(PROFILE_PATH, MARLON_PATH, OWN_EMAIL);

    let files: Map<string, string>;

    function seed(p: string, data: Record<string, unknown>): void {
      files.set(p, matter.stringify('# Profile\n', data));
    }

    function dataOf(p: string): Record<string, unknown> {
      // gray-matter caches parse results globally and addRelation/removeRelation mutate the
      // cached object in place — bypass the cache so assertions see the freshly-written content.
      return matter(files.get(p) ?? '', { cache: false } as never).data as Record<string, unknown>;
    }

    beforeEach(() => {
      files = new Map<string, string>();
      mockFS.exists.mockImplementation(async (p: string) => files.has(p));
      mockFS.readFile.mockImplementation(async (p: string) => files.get(p) ?? '');
      mockFS.writeFile.mockImplementation(async (p: string, c: string) => {
        files.set(p, c);
      });
      mockFS.listFiles.mockResolvedValue([PROFILE_PATH]);
    });

    it('moves old manager to previous_manager[], promotes new from leadership[], sets current_manager, and fixes both reciprocals', async () => {
      seed(PROFILE_PATH, {
        current_manager: marlonLinkOnSelf,
        previous_manager: [],
        leadership: [chefLinkOnSelf],
      });
      seed(MARLON_PATH, { direct_reports: [selfLinkOnMarlon] });
      seed(CHEF_PATH, { direct_reports: [] });

      const result = await svc.setManager(CHEF, WORKSPACE);

      const self = dataOf(PROFILE_PATH);
      expect(self['current_manager']).toBe(chefLinkOnSelf);
      expect(self['previous_manager']).toContain(marlonLinkOnSelf);
      expect(self['leadership']).not.toContain(chefLinkOnSelf);
      expect(dataOf(CHEF_PATH)['direct_reports']).toContain(selfLinkOnChef);
      expect(dataOf(MARLON_PATH)['direct_reports']).not.toContain(selfLinkOnMarlon);

      expect(result.changed).toBe(true);
      expect(result.previousManagerEmail).toBe(MARLON);
      expect(result.newManagerEmail).toBe(CHEF);
    });

    it('sets current_manager and reciprocal direct_reports when there was no previous manager', async () => {
      seed(PROFILE_PATH, { current_manager: '', leadership: [] });
      seed(CHEF_PATH, { direct_reports: [] });

      const result = await svc.setManager(CHEF, WORKSPACE);

      expect(dataOf(PROFILE_PATH)['current_manager']).toBe(chefLinkOnSelf);
      expect(dataOf(CHEF_PATH)['direct_reports']).toContain(selfLinkOnChef);
      expect(result.previousManagerEmail).toBeNull();
      expect(result.changed).toBe(true);
    });

    it('is a no-op when the email is already the current manager', async () => {
      seed(PROFILE_PATH, { current_manager: chefLinkOnSelf });
      seed(CHEF_PATH, { direct_reports: [] });

      const result = await svc.setManager(CHEF, WORKSPACE);

      expect(result.changed).toBe(false);
      expect(result.previousManagerEmail).toBeNull();
      // direct_reports on chef untouched
      expect(dataOf(CHEF_PATH)['direct_reports']).toEqual([]);
    });

    it('normalizes the email to lowercase before resolving the leader', async () => {
      seed(PROFILE_PATH, { current_manager: '', leadership: [] });
      seed(CHEF_PATH, { direct_reports: [] });

      const result = await svc.setManager('CHEF@CO.COM', WORKSPACE);

      expect(result.newManagerEmail).toBe(CHEF);
      expect(dataOf(PROFILE_PATH)['current_manager']).toBe(chefLinkOnSelf);
    });

    it('throws ValidationError when the new manager profile is absent in my-leadership/', async () => {
      seed(PROFILE_PATH, { current_manager: '' });

      await expect(svc.setManager(CHEF, WORKSPACE)).rejects.toThrow(ValidationError);
      await expect(svc.setManager(CHEF, WORKSPACE)).rejects.toThrow(/not found in my-leadership/);
      // Nothing written to the self profile
      expect(dataOf(PROFILE_PATH)['current_manager']).toBe('');
    });

    it('throws ConfigurationError when no self profile exists', async () => {
      mockFS.listFiles.mockResolvedValue([]);
      seed(CHEF_PATH, { direct_reports: [] });

      await expect(svc.setManager(CHEF, WORKSPACE)).rejects.toThrow(ConfigurationError);
    });

    it('throws InvalidEmailError for a malformed email', async () => {
      await expect(svc.setManager('not-an-email', WORKSPACE)).rejects.toThrow(InvalidEmailError);
    });
  });
});
