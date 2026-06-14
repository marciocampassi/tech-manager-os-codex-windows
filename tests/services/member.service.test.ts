import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import path from 'node:path';
import matter from 'gray-matter';
import { MemberService } from '../../src/services/member.service.js';
import { FILE_TYPE_CONFIG } from '../../src/types/member.types.js';
import { InvalidEmailError, ValidationError } from '../../src/errors/tmr-error.js';
import type { FileSystemService } from '../../src/services/file-system.service.js';
import type { SectionParserService } from '../../src/services/section-parser.service.js';
import type { EmailResolutionService } from '../../src/services/email-resolution.service.js';
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

// ── Mock EmailResolutionService ───────────────────────────────────────────────

type MockEmailResolver = {
  [K in keyof EmailResolutionService]: jest.MockedFunction<EmailResolutionService[K]>;
};

function createMockEmailResolver(): MockEmailResolver {
  return {
    resolve: jest.fn<EmailResolutionService['resolve']>().mockResolvedValue({
      type: 'team',
      absolutePath: PROFILE_PATH,
      created: false,
    }),
    validateEmail: jest.fn<EmailResolutionService['validateEmail']>().mockReturnValue(true),
    generateWikiLink: jest.fn<EmailResolutionService['generateWikiLink']>().mockReturnValue(''),
    clearCache: jest.fn<EmailResolutionService['clearCache']>().mockReturnValue(undefined),
    getWorkspaceRoot: jest.fn<EmailResolutionService['getWorkspaceRoot']>().mockReturnValue(''),
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
  let mockEmailResolver: MockEmailResolver;
  const realTemplate = new TemplateService();

  beforeEach(() => {
    mockFS = createMockFS();
    mockParser = createMockSectionParser();
    mockEmailResolver = createMockEmailResolver();
    svc = new MemberService(
      mockFS as unknown as FileSystemService,
      mockParser as unknown as SectionParserService,
      realTemplate,
      mockEmailResolver as unknown as EmailResolutionService,
    );
  });

  // ── findMember ───────────────────────────────────────────────────────────────

  describe('findMember', () => {
    it('returns nested profile path when member exists', async () => {
      mockFS.exists.mockResolvedValue(true);
      const result = await svc.findMember(EMAIL, WS);
      expect(result?.replace(/\\/g, '/')).toBe(PROFILE_PATH);
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
      // Default: resolver returns the nested team profile
      mockEmailResolver.resolve.mockResolvedValue({
        type: 'team',
        absolutePath: PROFILE_PATH,
        created: false,
      });
    });

    it('routes through EmailResolutionService.resolve() for profile lookup', async () => {
      await svc.createMemberFile(EMAIL, '1on1', { date: '2026-03-07' }, WS);
      expect(mockEmailResolver.resolve).toHaveBeenCalledWith(EMAIL, WS);
    });

    it('memberSubDirFromProfile: nested profile uses parentDir as subdir root', async () => {
      await svc.createMemberFile(EMAIL, '1on1', { date: '2026-01-15' }, WS);

      const dirCalls = (mockFS.createDirectory.mock.calls as [string][]).map(([p]) =>
        p.replace(/\\/g, '/'),
      );
      expect(dirCalls.some((p) => /my-teams\/members\/john@co\.com\/1on1s$/.test(p))).toBe(true);
    });

    it('auto-creates company-scoped profile when member does not exist (FR24)', async () => {
      mockEmailResolver.resolve.mockResolvedValue({
        type: 'relationship',
        absolutePath: `${WS}/my-company/members/john@co.com/john@co.com.md`,
        created: true,
      });

      await svc.createMemberFile(
        EMAIL,
        'feedback',
        { date: '2026-03-07', fromEmail: 'reviewer@co.com' },
        WS,
      );

      expect(mockParser.appendToFile).toHaveBeenCalledWith(
        expect.stringContaining('my-company/members/john@co.com/john@co.com.md'),
        'Feedbacks',
        expect.any(String),
      );
    });

    it('creates the 1on1 file at correct path (full date, suffix before email)', async () => {
      const opts = { date: '2026-03-07' };
      await svc.createMemberFile(EMAIL, '1on1', opts, WS);

      const [writtenPath, writtenContent] = mockFS.writeFile.mock.calls[0] as [string, string];
      expect(writtenPath.replace(/\\/g, '/')).toContain('1on1s/2026-03-07-1on1-john@co.com.md');
      expect(writtenContent).toContain('type: 1on1');
    });

    it('creates the feedback file at correct path (year-month, feedbacks/ subdir, reviewer email)', async () => {
      await svc.createMemberFile(
        EMAIL,
        'feedback',
        { date: '2026-03-07', fromEmail: 'reviewer@co.com' },
        WS,
      );

      const [writtenPath, writtenContent] = mockFS.writeFile.mock.calls[0] as [string, string];
      expect(writtenPath.replace(/\\/g, '/')).toContain(
        'feedbacks/2026-03-feedback-reviewer@co.com-john@co.com.md',
      );
      expect(writtenContent).toContain('type: feedback');
    });

    it('throws when fromEmail is omitted for feedback type', async () => {
      await expect(
        svc.createMemberFile(EMAIL, 'feedback', { date: '2026-03-07' }, WS),
      ).rejects.toThrow('fromEmail is required for feedback type');
    });

    it('creates the assessment file at correct path (year-month, suffix before email)', async () => {
      await svc.createMemberFile(EMAIL, 'assessment', { date: '2026-03-07' }, WS);

      expect(mockFS.createDirectory).toHaveBeenCalledWith(expect.stringContaining('assessments'));
      const [writtenPath, writtenContent] = mockFS.writeFile.mock.calls[0] as [string, string];
      expect(writtenPath.replace(/\\/g, '/')).toContain(
        'assessments/2026-03-assessment-john@co.com.md',
      );
      expect(writtenContent).toContain('type: assessment');
      expect(mockParser.appendToFile).toHaveBeenCalledWith(
        PROFILE_PATH,
        'Assessments',
        expect.stringContaining('[[assessments/2026-03-assessment-john@co.com.md]]'),
      );
    });

    it('creates the performance-review file with year-month prefix and -performance-review suffix', async () => {
      await svc.createMemberFile(EMAIL, 'performance-review', { date: '2026-03-07' }, WS);

      expect(mockFS.createDirectory).toHaveBeenCalledWith(
        expect.stringContaining('performance-reviews'),
      );
      const [writtenPath, writtenContent] = mockFS.writeFile.mock.calls[0] as [string, string];
      expect(writtenPath.replace(/\\/g, '/')).toContain(
        'performance-reviews/2026-03-performance-review-john@co.com.md',
      );
      expect(writtenContent).toContain('type: performance-review');
      expect(mockParser.appendToFile).toHaveBeenCalledWith(
        PROFILE_PATH,
        'Performance Reviews',
        expect.stringContaining(
          '[[performance-reviews/2026-03-performance-review-john@co.com.md]]',
        ),
      );
    });

    // ── 9.10: assessment & performance-review auto-create tests ───────────────

    it('9.10: assessment — auto-creates profile when member does not exist', async () => {
      const newEmail = 'newuser@co.com';
      const autoCreatedProfile = `${WS}/my-company/members/${newEmail}/${newEmail}.md`;
      mockEmailResolver.resolve.mockResolvedValue({
        type: 'relationship',
        absolutePath: autoCreatedProfile,
        created: true,
      });

      await svc.createMemberFile(newEmail, 'assessment', {}, WS);

      expect(mockFS.createDirectory).toHaveBeenCalledWith(expect.stringContaining('assessments'));
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`-assessment-${newEmail}.md`),
        expect.stringContaining('type: assessment'),
      );
      expect(mockParser.appendToFile).toHaveBeenCalledWith(
        autoCreatedProfile,
        'Assessments',
        expect.stringContaining(`-assessment-${newEmail}.md`),
      );
    });

    it('9.10: performance-review — auto-creates profile when member does not exist', async () => {
      const newEmail = 'newuser@co.com';
      const autoCreatedProfile = `${WS}/my-company/members/${newEmail}/${newEmail}.md`;
      mockEmailResolver.resolve.mockResolvedValue({
        type: 'relationship',
        absolutePath: autoCreatedProfile,
        created: true,
      });

      await svc.createMemberFile(newEmail, 'performance-review', {}, WS);

      expect(mockFS.createDirectory).toHaveBeenCalledWith(
        expect.stringContaining('performance-reviews'),
      );
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`-performance-review-${newEmail}.md`),
        expect.stringContaining('type: performance-review'),
      );
      expect(mockParser.appendToFile).toHaveBeenCalledWith(
        autoCreatedProfile,
        'Performance Reviews',
        expect.stringContaining(`-performance-review-${newEmail}.md`),
      );
    });

    // ── 9.11: 1on1 tests ──────────────────────────────────────────────────────

    it('9.11: 1on1 — creates file at full-date path and wiki-links ## 1on1s (existing member)', async () => {
      await svc.createMemberFile(EMAIL, '1on1', { date: '2026-05-22' }, WS);

      expect(mockFS.createDirectory).toHaveBeenCalledWith(expect.stringContaining('1on1s'));
      const [writtenPath, writtenContent] = mockFS.writeFile.mock.calls[0] as [string, string];
      expect(writtenPath.replace(/\\/g, '/')).toContain('1on1s/2026-05-22-1on1-john@co.com.md');
      expect(writtenContent).toContain('type: 1on1');
      expect(mockParser.appendToFile).toHaveBeenCalledWith(
        PROFILE_PATH,
        '1on1s',
        expect.stringContaining('[[1on1s/2026-05-22-1on1-john@co.com.md]]'),
      );
    });

    it('9.11: 1on1 — auto-creates profile and creates 1on1 file (new member)', async () => {
      const newEmail = 'newuser@co.com';
      const autoCreatedProfile = `${WS}/my-company/members/${newEmail}/${newEmail}.md`;
      mockEmailResolver.resolve.mockResolvedValue({
        type: 'relationship',
        absolutePath: autoCreatedProfile,
        created: true,
      });

      await svc.createMemberFile(newEmail, '1on1', { date: '2026-05-22' }, WS);

      expect(mockFS.createDirectory).toHaveBeenCalledWith(expect.stringContaining('1on1s'));
      const [writtenPath, writtenContent] = mockFS.writeFile.mock.calls[0] as [string, string];
      expect(writtenPath.replace(/\\/g, '/')).toContain(`1on1s/2026-05-22-1on1-${newEmail}.md`);
      expect(writtenContent).toContain('type: 1on1');
      expect(mockParser.appendToFile).toHaveBeenCalledWith(
        autoCreatedProfile,
        '1on1s',
        expect.stringContaining(`[[1on1s/2026-05-22-1on1-${newEmail}.md]]`),
      );
    });

    it('calls appendToFile with correct section name for 1on1', async () => {
      await svc.createMemberFile(EMAIL, '1on1', { date: '2026-03-07' }, WS);

      expect(mockParser.appendToFile).toHaveBeenCalledWith(
        PROFILE_PATH,
        '1on1s',
        expect.stringContaining('[[1on1s/2026-03-07-1on1-john@co.com.md]]'),
      );
    });

    it('calls appendToFile with correct section name for Feedbacks', async () => {
      await svc.createMemberFile(
        EMAIL,
        'feedback',
        { date: '2026-03-07', fromEmail: 'reviewer@co.com' },
        WS,
      );

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

      expect(result.filePath).toContain('2026-03-07-1on1-john@co.com.md');
      expect(result.profilePath).toContain('john@co.com.md');
      expect(result.wikiLink).toContain('[[1on1s/2026-03-07-1on1-john@co.com.md]]');
    });

    it('normalizes email to lowercase', async () => {
      mockEmailResolver.resolve.mockResolvedValue({
        type: 'team',
        absolutePath: PROFILE_PATH,
        created: false,
      });
      const result = await svc.createMemberFile('JOHN@CO.COM', '1on1', { date: '2026-03-07' }, WS);
      expect(result.filePath).toContain('1on1-john@co.com.md');
    });

    // ── 9.31: dated-file frontmatter (subject/with/from) + last_<type> scalar ──

    it('9.31: 1on1 dated file carries subject wiki-link, not member:', async () => {
      mockFS.exists.mockResolvedValue(true);
      await svc.createMemberFile(EMAIL, '1on1', { date: '2026-03-07' }, WS);

      const writtenContent = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(writtenContent).toContain('type: 1on1');
      expect(writtenContent).toContain('subject:');
      expect(writtenContent).not.toContain('member: john@co.com');
    });

    it('9.31: omits with when self profile absent (AC7)', async () => {
      mockFS.exists.mockResolvedValue(true); // careerRoot exists...
      mockFS.listFiles.mockResolvedValue([]); // ...but no .md self profile
      await svc.createMemberFile(EMAIL, '1on1', { date: '2026-03-07' }, WS);

      const writtenContent = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(writtenContent).not.toContain('with:');
    });

    it('9.31: sets last_1on1 (full ISO date) scalar on the member profile', async () => {
      mockFS.exists.mockResolvedValue(true);
      await svc.createMemberFile(EMAIL, '1on1', { date: '2026-03-07' }, WS);

      const profileWrite = (mockFS.writeFile.mock.calls as [string, string][]).find(
        ([p]) => p === PROFILE_PATH,
      );
      expect(profileWrite).toBeDefined();
      expect(matter((profileWrite as [string, string])[1]).data['last_1on1']).toBe('2026-03-07');
    });

    it('9.31: sets last_feedback (year-month) scalar — value matches filePrefix (AC5)', async () => {
      mockFS.exists.mockResolvedValue(true);
      await svc.createMemberFile(
        EMAIL,
        'feedback',
        { date: '2026-03-07', fromEmail: 'reviewer@co.com' },
        WS,
      );

      const profileWrite = (mockFS.writeFile.mock.calls as [string, string][]).find(
        ([p]) => p === PROFILE_PATH,
      );
      expect(profileWrite).toBeDefined();
      expect(matter((profileWrite as [string, string])[1]).data['last_feedback']).toBe('2026-03');
    });

    it('9.31 (B5): feedback resolves the reviewer and emits a from wiki-link', async () => {
      mockFS.exists.mockResolvedValue(true);
      mockEmailResolver.resolve
        .mockResolvedValueOnce({ type: 'team', absolutePath: PROFILE_PATH, created: false })
        .mockResolvedValueOnce({
          type: 'relationship',
          absolutePath: `${WS}/my-company/members/reviewer@co.com/reviewer@co.com.md`,
          created: true,
        });

      await svc.createMemberFile(
        EMAIL,
        'feedback',
        { date: '2026-03-07', fromEmail: 'reviewer@co.com' },
        WS,
      );

      expect(mockEmailResolver.resolve).toHaveBeenCalledWith('reviewer@co.com', WS);
      const writtenContent = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(writtenContent).toContain('from:');
      expect(writtenContent).toContain('reviewer@co.com');
    });

    it('9.31: last_<type> is a single scalar (overwrite, not array) — compactness AC6', async () => {
      mockFS.exists.mockResolvedValue(true);
      mockFS.readFile.mockResolvedValue('---\nlast_1on1: 2026-01-01\n---\n');

      await svc.createMemberFile(EMAIL, '1on1', { date: '2026-03-07' }, WS);

      const profileWrite = (mockFS.writeFile.mock.calls as [string, string][]).find(
        ([p]) => p === PROFILE_PATH,
      );
      const content = (profileWrite as [string, string])[1];
      expect(matter(content).data['last_1on1']).toBe('2026-03-07');
      expect(content).not.toContain('2026-01-01');
      expect(content.match(/last_1on1:/g)).toHaveLength(1);
    });
  });

  // ── addMember ─────────────────────────────────────────────────────────────────

  describe('addMember', () => {
    beforeEach(() => {
      // Default: profile does not exist yet; careerRoot does not exist
      mockFS.exists.mockResolvedValue(false);
    });

    it('MEM-UNIT-001: company scope — writes to my-company/members/<email>/<email>.md', async () => {
      await svc.addMember('joao@company.com', {}, WS);

      const writtenPath = (mockFS.writeFile.mock.calls[0] as [string, string])[0];
      expect(writtenPath.replace(/\\/g, '/')).toBe(
        `${WS}/my-company/members/joao@company.com/joao@company.com.md`,
      );
    });

    it('MEM-UNIT-002: team scope — writes to my-teams/members/<email>/<email>.md', async () => {
      await svc.addMember('joao@company.com', { team: 'backend' }, WS);

      const writtenPath = (mockFS.writeFile.mock.calls[0] as [string, string])[0];
      expect(writtenPath.replace(/\\/g, '/')).toBe(
        `${WS}/my-teams/members/joao@company.com/joao@company.com.md`,
      );
    });

    it('MEM-UNIT-003: team scope — frontmatter contains manager wiki-link when career profile exists', async () => {
      // Path-based mock (order-independent): my-career/ exists, member profile does not.
      mockFS.exists.mockImplementation(async (p: string) =>
        p.replace(/\\/g, '/').includes('my-career'),
      );
      mockFS.listFiles.mockResolvedValue([`${WS}/my-career/boss@co.com.md`]);

      await svc.addMember('joao@company.com', { team: 'backend' }, WS);

      const writtenContent = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(writtenContent).toContain('current_manager:');
      expect(writtenContent).toMatch(/\[\[.*\|boss@co\.com\]\]/);
    });

    it('MEM-UNIT-004: location value is present in frontmatter when --location provided', async () => {
      await svc.addMember('joao@company.com', { location: 'Lisbon' }, WS);

      const writtenContent = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(writtenContent).toContain('Lisbon');
    });

    it('MEM-UNIT-005: location is empty string when no --location provided', async () => {
      await svc.addMember('joao@company.com', {}, WS);

      const writtenContent = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(writtenContent).toMatch(/location:\s*''/);
    });

    it('MEM-UNIT-009: throws InvalidEmailError before any file write for invalid email', async () => {
      await expect(svc.addMember('not-an-email', {}, WS)).rejects.toThrow(InvalidEmailError);
      expect(mockFS.writeFile).not.toHaveBeenCalled();
      expect(mockFS.createDirectory).not.toHaveBeenCalled();
    });

    it('MEM-UNIT-010: team-scoped manager value uses wiki-link format, not plain email string', async () => {
      mockFS.exists.mockImplementation(async (p: string) =>
        p.replace(/\\/g, '/').includes('my-career'),
      );
      mockFS.listFiles.mockResolvedValue([`${WS}/my-career/boss@co.com.md`]);

      await svc.addMember('joao@company.com', { team: 'backend' }, WS);

      const writtenContent = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(writtenContent).toMatch(/current_manager:.*\[\[/);
    });

    it('MEM-UNIT-011: manager is empty string when my-career/ directory does not exist', async () => {
      // First exists(): profile not found; second exists(): careerRoot missing
      mockFS.exists.mockResolvedValueOnce(false).mockResolvedValueOnce(false);

      await svc.addMember('joao@company.com', { team: 'backend' }, WS);

      const writtenContent = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(writtenContent).toMatch(/current_manager:\s*''/);
    });

    it('returns { created: false } when profile already exists', async () => {
      // Member profile exists; careerRoot has no self file (listFiles default []), so the
      // self-guard is inert and the existing-profile early-return is exercised.
      mockFS.exists.mockResolvedValue(true);

      const result = await svc.addMember('joao@company.com', {}, WS);

      expect(result.created).toBe(false);
      expect(mockFS.writeFile).not.toHaveBeenCalled();
    });

    it('normalizes email to lowercase', async () => {
      await svc.addMember('JOAO@COMPANY.COM', {}, WS);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('joao@company.com'),
        expect.any(String),
      );
    });

    it('MEM-UNIT-012: contractor flag routes to my-company/contractors/ path', async () => {
      await svc.addMember('ext@agency.com', { contractor: true }, WS);

      const writtenPath = (mockFS.writeFile.mock.calls[0] as [string, string])[0];
      expect(writtenPath.replace(/\\/g, '/')).toContain(
        'my-company/contractors/ext@agency.com/ext@agency.com.md',
      );
    });

    it('MEM-UNIT-013: contractor profile includes relationship: contractor', async () => {
      await svc.addMember('ext@agency.com', { contractor: true }, WS);

      const written = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(written).toContain('relationship: contractor');
    });

    it('9.5: contractor profile has no company field (removed in Story 9.5)', async () => {
      await svc.addMember('ext@agency.com', { contractor: true }, WS);

      const written = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(written).not.toContain('company:');
      expect(written).not.toContain('contractor: true');
    });

    it('9.5: team scope writes relationship: direct-report', async () => {
      mockFS.exists.mockResolvedValueOnce(false).mockResolvedValueOnce(false);
      await svc.addMember('joao@company.com', { team: 'backend' }, WS);

      const written = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(written).toContain('relationship: direct-report');
    });

    it('9.5: company scope writes relationship: company-member', async () => {
      await svc.addMember('joao@company.com', {}, WS);

      const written = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(written).toContain('relationship: company-member');
    });

    it('MEM-UNIT-014: company scope — creates four subdirs', async () => {
      await svc.addMember('joao@company.com', {}, WS);

      const entityDir = `${WS}/my-company/members/joao@company.com`;
      const dirCalls = (mockFS.createDirectory.mock.calls as [string][]).map(([p]) =>
        p.replace(/\\/g, '/'),
      );
      expect(dirCalls).toContain(`${entityDir}/1on1s`);
      expect(dirCalls).toContain(`${entityDir}/feedbacks`);
      expect(dirCalls).toContain(`${entityDir}/assessments`);
      expect(dirCalls).toContain(`${entityDir}/performance-reviews`);
    });

    it('MEM-UNIT-015: team scope — creates four subdirs plus <email>-shared', async () => {
      await svc.addMember('joao@company.com', { team: 'backend' }, WS);

      const entityDir = `${WS}/my-teams/members/joao@company.com`;
      const dirCalls = (mockFS.createDirectory.mock.calls as [string][]).map(([p]) =>
        p.replace(/\\/g, '/'),
      );
      expect(dirCalls).toContain(`${entityDir}/1on1s`);
      expect(dirCalls).toContain(`${entityDir}/feedbacks`);
      expect(dirCalls).toContain(`${entityDir}/assessments`);
      expect(dirCalls).toContain(`${entityDir}/performance-reviews`);
      expect(dirCalls).toContain(`${entityDir}/joao@company.com-shared`);
    });

    it('MEM-UNIT-016: contractor scope — creates four subdirs', async () => {
      await svc.addMember('ext@agency.com', { contractor: true }, WS);

      const entityDir = `${WS}/my-company/contractors/ext@agency.com`;
      const dirCalls = (mockFS.createDirectory.mock.calls as [string][]).map(([p]) =>
        p.replace(/\\/g, '/'),
      );
      expect(dirCalls).toContain(`${entityDir}/1on1s`);
      expect(dirCalls).toContain(`${entityDir}/feedbacks`);
      expect(dirCalls).toContain(`${entityDir}/assessments`);
      expect(dirCalls).toContain(`${entityDir}/performance-reviews`);
    });

    it('MEM-UNIT-017: team scope — adds member to team-members frontmatter when file exists', async () => {
      const teamMembersContent = '---\nmembers: []\n---\n\n# Team Members\n';

      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('backend-members.md')) return true;
        return false;
      });
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.includes('backend-members.md')) return teamMembersContent;
        return '';
      });

      await svc.addMember('jane@co.com', { team: 'backend' }, WS);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('backend-members.md'),
        expect.stringContaining('jane@co.com'),
      );
    });

    it('MEM-UNIT-018: team scope — skips team-members update when file does not exist', async () => {
      mockFS.exists.mockResolvedValue(false);

      await svc.addMember('jane@co.com', { team: 'backend' }, WS);

      const calls = mockFS.writeFile.mock.calls as [string, string][];
      expect(calls.some(([p]) => p.includes('-members.md'))).toBe(false);
    });

    it('MEM-UNIT-019: no-team scope — no team-members file is touched', async () => {
      mockFS.exists.mockResolvedValue(false);

      await svc.addMember('jane@co.com', {}, WS);

      const calls = mockFS.writeFile.mock.calls as [string, string][];
      expect(calls.some(([p]) => p.includes('-members.md'))).toBe(false);
    });

    it('MEM-UNIT-020: team scope — syncs team-members frontmatter when profile already exists', async () => {
      const teamMembersContent = '---\nmembers: []\n---\n\n# Team Members\n';
      const existingProfile = matter.stringify('\n## Performance Reviews\n\n## Feedbacks\n', {
        email: 'jane@co.com',
        name: '',
        role: '',
        relationship: 'direct-report',
      });

      mockFS.exists.mockImplementation(async (p: string) => {
        const n = p.replace(/\\/g, '/');
        if (n.includes('my-teams/members/jane@co.com/jane@co.com.md')) return true;
        if (n.includes('backend-members.md')) return true;
        return false;
      });
      mockFS.readFile.mockImplementation(async (p: string) => {
        const n = p.replace(/\\/g, '/');
        if (n.includes('backend-members.md')) return teamMembersContent;
        if (n.includes('jane@co.com/jane@co.com.md')) return existingProfile;
        return '';
      });

      const result = await svc.addMember('jane@co.com', { team: 'backend' }, WS);

      expect(result).toEqual({ created: false });
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('backend-members.md'),
        expect.stringContaining('jane@co.com'),
      );
    });

    it('MEM-UNIT-021: team scope — idempotent team-members frontmatter on re-run', async () => {
      let teamMembersContent = '---\nmembers: []\n---\n\n# Team Members\n';
      const existingProfile = matter.stringify('\n## Performance Reviews\n\n## Feedbacks\n', {
        email: 'jane@co.com',
        name: '',
        role: '',
        relationship: 'direct-report',
      });

      mockFS.exists.mockImplementation(async (p: string) => {
        const n = p.replace(/\\/g, '/');
        if (n.includes('my-teams/members/jane@co.com/jane@co.com.md')) return true;
        if (n.includes('backend-members.md')) return true;
        return false;
      });
      mockFS.readFile.mockImplementation(async (p: string) => {
        const n = p.replace(/\\/g, '/');
        if (n.includes('backend-members.md')) return teamMembersContent;
        if (n.includes('jane@co.com/jane@co.com.md')) return existingProfile;
        return '';
      });
      mockFS.writeFile.mockImplementation(async (p: string, content: string) => {
        if (p.replace(/\\/g, '/').includes('backend-members.md')) teamMembersContent = content;
      });

      await svc.addMember('jane@co.com', { team: 'backend' }, WS);
      await svc.addMember('jane@co.com', { team: 'backend' }, WS);

      const { data: parsedMembers } = matter(teamMembersContent);
      const membersList = Array.isArray(parsedMembers['members']) ? parsedMembers['members'] : [];
      expect(membersList).toHaveLength(1);
    });

    // ── 9.29 new tests ────────────────────────────────────────────────────────

    it('MEM-UNIT-022: team scope — frontmatter includes previous_manager, other_leaderships, start_date, projects', async () => {
      mockFS.exists.mockResolvedValue(false);

      await svc.addMember('joao@company.com', { team: 'backend' }, WS);

      const writtenContent = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      const { data } = matter(writtenContent);
      expect(data['previous_manager']).toEqual([]);
      expect(data['other_leaderships']).toEqual([]);
      expect(data['start_date']).toBe('');
      expect(data['projects']).toEqual([]);
    });

    it('MEM-UNIT-023: team scope — frontmatter includes teams array with team context wiki-link', async () => {
      mockFS.exists.mockResolvedValue(false);

      await svc.addMember('joao@company.com', { team: 'backend' }, WS);

      const writtenContent = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      const { data } = matter(writtenContent);
      expect(Array.isArray(data['teams'])).toBe(true);
      expect((data['teams'] as string[])[0]).toMatch(/\[\[.*backend-context\.md\|backend\]\]/);
    });

    it('MEM-UNIT-024: team scope — self-profile direct_reports updated when self profile found', async () => {
      const selfProfilePath = `${WS}/my-career/me@co.com.md`;
      mockFS.exists.mockImplementation(async (p: string) => {
        const n = p.replace(/\\/g, '/');
        if (n.includes('my-teams/members/jane@co.com/jane@co.com.md')) return false;
        if (n.includes('my-career')) return true;
        if (n.includes('backend-members.md')) return false;
        if (n.includes('me@co.com.md')) return true;
        return false;
      });
      mockFS.listFiles.mockResolvedValue([selfProfilePath]);
      mockFS.readFile.mockImplementation(async (p: string) => {
        if (p.replace(/\\/g, '/').includes('me@co.com.md')) return '---\ndirect_reports: []\n---\n';
        return '';
      });

      await svc.addMember('jane@co.com', { team: 'backend' }, WS);

      const selfWriteCall = (mockFS.writeFile.mock.calls as [string, string][]).find(([p]) =>
        p.replace(/\\/g, '/').includes('me@co.com.md'),
      );
      expect(selfWriteCall).toBeDefined();
      expect(selfWriteCall![1]).toContain('direct_reports');
      expect(selfWriteCall![1]).toContain('jane@co.com');
    });

    it('MEM-UNIT-025: team scope — direct_reports write skipped when my-career/ absent', async () => {
      mockFS.exists.mockResolvedValue(false);

      await svc.addMember('jane@co.com', { team: 'backend' }, WS);

      const calls = mockFS.writeFile.mock.calls as [string, string][];
      expect(calls.some(([p]) => p.replace(/\\/g, '/').includes('my-career'))).toBe(false);
    });

    it('MEM-UNIT-026: company scope — self-profile direct_reports NOT updated', async () => {
      mockFS.exists.mockResolvedValue(false);

      await svc.addMember('joao@company.com', {}, WS);

      const calls = mockFS.writeFile.mock.calls as [string, string][];
      expect(calls.some(([p]) => p.replace(/\\/g, '/').includes('my-career'))).toBe(false);
    });

    it('MEM-UNIT-027: contractor scope — self-profile direct_reports NOT updated', async () => {
      mockFS.exists.mockResolvedValue(false);

      await svc.addMember('ext@agency.com', { contractor: true }, WS);

      const calls = mockFS.writeFile.mock.calls as [string, string][];
      expect(calls.some(([p]) => p.replace(/\\/g, '/').includes('my-career'))).toBe(false);
    });

    it('MEM-UNIT-028: team scope — direct_reports synced even when profile already exists', async () => {
      const selfProfilePath = `${WS}/my-career/me@co.com.md`;
      const existingProfile = matter.stringify('\n## 1on1s\n\n## Feedbacks\n', {
        email: 'jane@co.com',
        relationship: 'direct-report',
      });

      mockFS.exists.mockImplementation(async (p: string) => {
        const n = p.replace(/\\/g, '/');
        if (n.includes('my-teams/members/jane@co.com/jane@co.com.md')) return true;
        if (n.includes('my-career')) return true;
        if (n.includes('backend-members.md')) return false;
        if (n.includes('me@co.com.md')) return true;
        return false;
      });
      mockFS.listFiles.mockResolvedValue([selfProfilePath]);
      mockFS.readFile.mockImplementation(async (p: string) => {
        const n = p.replace(/\\/g, '/');
        if (n.includes('me@co.com.md')) return '---\ndirect_reports: []\n---\n';
        if (n.includes('jane@co.com/jane@co.com.md')) return existingProfile;
        return '';
      });

      const result = await svc.addMember('jane@co.com', { team: 'backend' }, WS);

      expect(result).toEqual({ created: false });
      const selfWriteCall = (mockFS.writeFile.mock.calls as [string, string][]).find(([p]) =>
        p.replace(/\\/g, '/').includes('me@co.com.md'),
      );
      expect(selfWriteCall).toBeDefined();
      expect(selfWriteCall![1]).toContain('direct_reports');
      expect(selfWriteCall![1]).toContain('jane@co.com');
    });

    // ── Self-email guard ────────────────────────────────────────────────────────

    it('rejects adding the vault owner own (self) email: throws ValidationError, writes nothing', async () => {
      const selfProfilePath = `${WS}/my-career/me@co.com.md`;
      mockFS.exists.mockImplementation(async (p: string) =>
        p.replace(/\\/g, '/').includes('my-career'),
      );
      mockFS.listFiles.mockResolvedValue([selfProfilePath]);

      await expect(svc.addMember('ME@co.com', { team: 'backend' }, WS)).rejects.toBeInstanceOf(
        ValidationError,
      );
      expect(mockFS.writeFile).not.toHaveBeenCalled();
      expect(mockFS.createDirectory).not.toHaveBeenCalled();
    });

    it('allows a non-self email even when a different self profile exists', async () => {
      const selfProfilePath = `${WS}/my-career/me@co.com.md`;
      mockFS.exists.mockImplementation(async (p: string) =>
        p.replace(/\\/g, '/').includes('my-career'),
      );
      mockFS.listFiles.mockResolvedValue([selfProfilePath]);
      mockFS.readFile.mockResolvedValue('---\ndirect_reports: []\n---\n');

      const result = await svc.addMember('other@co.com', { team: 'backend' }, WS);

      expect(result).toEqual({ created: true });
      const wroteMember = (mockFS.writeFile.mock.calls as [string, string][]).some(([p]) =>
        p.replace(/\\/g, '/').includes('my-teams/members/other@co.com/other@co.com.md'),
      );
      expect(wroteMember).toBe(true);
    });

    it('rejects own (self) email for contractor scope as well', async () => {
      const selfProfilePath = `${WS}/my-career/me@co.com.md`;
      mockFS.exists.mockImplementation(async (p: string) =>
        p.replace(/\\/g, '/').includes('my-career'),
      );
      mockFS.listFiles.mockResolvedValue([selfProfilePath]);

      await expect(svc.addMember('me@co.com', { contractor: true }, WS)).rejects.toBeInstanceOf(
        ValidationError,
      );
      expect(mockFS.writeFile).not.toHaveBeenCalled();
    });

    it('rejects self by frontmatter email even when the profile filename differs', async () => {
      // Self profile stored as my-career/profile.md with frontmatter email: me@co.com.
      const selfProfilePath = `${WS}/my-career/profile.md`;
      mockFS.exists.mockImplementation(async (p: string) =>
        p.replace(/\\/g, '/').includes('my-career'),
      );
      mockFS.listFiles.mockResolvedValue([selfProfilePath]);
      mockFS.readFile.mockResolvedValue('---\nemail: me@co.com\n---\n');

      await expect(svc.addMember('me@co.com', { team: 'backend' }, WS)).rejects.toBeInstanceOf(
        ValidationError,
      );
      expect(mockFS.writeFile).not.toHaveBeenCalled();
    });
  });

  // ── getInternalDomains ────────────────────────────────────────────────────────

  describe('getInternalDomains', () => {
    it('returns [] when organization.yaml does not exist', async () => {
      mockFS.exists.mockResolvedValue(false);
      const result = await svc.getInternalDomains(WS);
      expect(result).toEqual([]);
    });

    it('parses single domain from organization.yaml', async () => {
      mockFS.exists.mockResolvedValue(true);
      mockFS.readFile.mockResolvedValue('internal_domains:\n  - gmail.com\n');
      const result = await svc.getInternalDomains(WS);
      expect(result).toEqual(['gmail.com']);
    });

    it('parses multiple domains from organization.yaml', async () => {
      mockFS.exists.mockResolvedValue(true);
      mockFS.readFile.mockResolvedValue(
        'internal_domains:\n  - gmail.com\n  - techcorp.com\n  - partner.io\n',
      );
      const result = await svc.getInternalDomains(WS);
      expect(result).toEqual(['gmail.com', 'techcorp.com', 'partner.io']);
    });

    it('returns [] when internal_domains list is empty', async () => {
      mockFS.exists.mockResolvedValue(true);
      mockFS.readFile.mockResolvedValue('internal_domains:\n');
      const result = await svc.getInternalDomains(WS);
      expect(result).toEqual([]);
    });

    it('stops parsing at next top-level key', async () => {
      mockFS.exists.mockResolvedValue(true);
      mockFS.readFile.mockResolvedValue(
        'internal_domains:\n  - gmail.com\nother_key:\n  - shouldNotAppear.com\n',
      );
      const result = await svc.getInternalDomains(WS);
      expect(result).toEqual(['gmail.com']);
    });

    it('normalizes domain entries to lowercase (RFC 5321)', async () => {
      mockFS.exists.mockResolvedValue(true);
      mockFS.readFile.mockResolvedValue('internal_domains:\n  - INTERNAL.COM\n  - Corp.IO\n');
      const result = await svc.getInternalDomains(WS);
      expect(result).toEqual(['internal.com', 'corp.io']);
    });
  });

  // ── appendInternalDomain ─────────────────────────────────────────────────────

  describe('appendInternalDomain', () => {
    it('creates organization.yaml with the domain when file does not exist', async () => {
      mockFS.exists.mockResolvedValue(false);
      await svc.appendInternalDomain('newdomain.com', WS);
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(path.join('config', 'organization.yaml')),
        expect.stringContaining('  - newdomain.com'),
      );
    });

    it('appends domain to existing file that has internal_domains key', async () => {
      mockFS.exists.mockResolvedValue(true);
      mockFS.readFile.mockResolvedValue('internal_domains:\n  - company.com\n');
      await svc.appendInternalDomain('partner.io', WS);
      const written = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(written).toContain('company.com');
      expect(written).toContain('partner.io');
    });

    it('is idempotent — does not write when domain already present', async () => {
      mockFS.exists.mockResolvedValue(true);
      mockFS.readFile.mockResolvedValue('internal_domains:\n  - company.com\n');
      await svc.appendInternalDomain('company.com', WS);
      expect(mockFS.writeFile).not.toHaveBeenCalled();
    });

    it('normalizes domain to lowercase before comparing and writing', async () => {
      mockFS.exists.mockResolvedValue(true);
      mockFS.readFile.mockResolvedValue('internal_domains:\n  - company.com\n');
      await svc.appendInternalDomain('NEW-PARTNER.IO', WS);
      const written = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(written).toContain('new-partner.io');
    });

    it('adds internal_domains key when file exists but key is absent', async () => {
      mockFS.exists.mockResolvedValue(true);
      mockFS.readFile.mockResolvedValue('other_key:\n  - value\n');
      await svc.appendInternalDomain('newdomain.com', WS);
      const written = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(written).toContain('internal_domains:');
      expect(written).toContain('  - newdomain.com');
    });
  });

  // ── createMemberFile — global email resolver (Story 3.3 / 9.1) ───────────────

  describe('createMemberFile — global email resolver', () => {
    it('MEM-UNIT-006: routes to nested team-scoped profile when it exists in my-teams/members/', async () => {
      mockEmailResolver.resolve.mockResolvedValue({
        type: 'team',
        absolutePath: `${WS}/my-teams/members/joao@company.com/joao@company.com.md`,
        created: false,
      });

      await svc.createMemberFile(
        'joao@company.com',
        'feedback',
        { date: '2026-01-15', fromEmail: 'reviewer@co.com' },
        WS,
      );

      expect(mockParser.appendToFile).toHaveBeenCalledWith(
        expect.stringContaining('my-teams/members/joao@company.com/joao@company.com.md'),
        'Feedbacks',
        expect.any(String),
      );
    });

    it('MEM-UNIT-007: routes to nested company-scoped profile when team absent', async () => {
      mockEmailResolver.resolve.mockResolvedValue({
        type: 'relationship',
        absolutePath: `${WS}/my-company/members/pedro@company.com/pedro@company.com.md`,
        created: false,
      });

      await svc.createMemberFile(
        'pedro@company.com',
        'feedback',
        { date: '2026-01-15', fromEmail: 'reviewer@co.com' },
        WS,
      );

      expect(mockParser.appendToFile).toHaveBeenCalledWith(
        expect.stringContaining('my-company/members/pedro@company.com/pedro@company.com.md'),
        'Feedbacks',
        expect.any(String),
      );
    });

    it('MEM-UNIT-008: auto-creates company profile and writes feedback when no profile found', async () => {
      const autoCreatedPath = `${WS}/my-company/members/unknown@company.com/unknown@company.com.md`;
      mockEmailResolver.resolve.mockResolvedValue({
        type: 'relationship',
        absolutePath: autoCreatedPath,
        created: true,
      });

      await svc.createMemberFile(
        'unknown@company.com',
        'feedback',
        { date: '2026-01-15', fromEmail: 'reviewer@co.com' },
        WS,
      );

      expect(mockParser.appendToFile).toHaveBeenCalledWith(
        expect.stringContaining('my-company/members/unknown@company.com/unknown@company.com.md'),
        'Feedbacks',
        expect.any(String),
      );
    });
  });
});

// ── P5: FILE_TYPE_CONFIG direct snapshot tests ────────────────────────────────

describe('FILE_TYPE_CONFIG', () => {
  it('assessment entry matches spec (subDir, fileSuffix, sectionName)', () => {
    expect(FILE_TYPE_CONFIG['assessment']).toEqual({
      subDir: 'assessments',
      fileSuffix: 'assessment',
      sectionName: 'Assessments',
    });
  });

  it('performance-review entry matches spec (subDir, fileSuffix, sectionName)', () => {
    expect(FILE_TYPE_CONFIG['performance-review']).toEqual({
      subDir: 'performance-reviews',
      fileSuffix: 'performance-review',
      sectionName: 'Performance Reviews',
    });
  });
});
