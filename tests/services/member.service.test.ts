import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { MemberService } from '../../src/services/member.service.js';
import { InvalidEmailError } from '../../src/errors/tmr-error.js';
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

  // ── findMemberGlobally ────────────────────────────────────────────────────────

  describe('findMemberGlobally', () => {
    beforeEach(() => {
      mockFS.exists.mockResolvedValue(false);
    });

    it('returns team-flat path when first candidate exists', async () => {
      mockFS.exists.mockResolvedValueOnce(true);
      const result = await svc.findMemberGlobally('john@co.com', WS);
      expect(result).toContain('my-teams/members/john@co.com.md');
    });

    it('returns company-flat path when team-flat absent', async () => {
      mockFS.exists.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      const result = await svc.findMemberGlobally('john@co.com', WS);
      expect(result).toContain('my-company/members/john@co.com.md');
    });

    it('returns contractor path when team-flat and company-flat absent', async () => {
      mockFS.exists
        .mockResolvedValueOnce(false) // team-flat absent
        .mockResolvedValueOnce(false) // company-flat absent
        .mockResolvedValueOnce(true); // contractor present
      const result = await svc.findMemberGlobally('john@co.com', WS);
      expect(result).toContain('my-company/contractors/john@co.com/john@co.com.md');
    });

    it('returns nested legacy path when first three candidates absent', async () => {
      mockFS.exists
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      const result = await svc.findMemberGlobally('john@co.com', WS);
      expect(result).toContain('my-teams/members/john@co.com/john@co.com.md');
    });

    it('returns null when all four candidates absent', async () => {
      mockFS.exists.mockResolvedValue(false);
      const result = await svc.findMemberGlobally('john@co.com', WS);
      expect(result).toBeNull();
    });

    it('normalizes email to lowercase before searching', async () => {
      mockFS.exists.mockResolvedValueOnce(true);
      const result = await svc.findMemberGlobally('JOHN@CO.COM', WS);
      expect(result).toContain('john@co.com');
    });
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
      // findMemberGlobally makes exactly 4 exists() calls in order:
      //   call 1 → team-flat (my-teams/members/<email>.md)
      //   call 2 → company-flat (my-company/members/<email>.md)
      //   call 3 → contractor (my-company/contractors/<email>/<email>.md)
      //   call 4 → nested legacy (my-teams/members/<email>/<email>.md)  ← PROFILE_PATH
      // Returning false/false/false/true routes all pre-existing tests through the nested-legacy
      // profile (PROFILE_PATH = '.../my-teams/members/john@co.com/john@co.com.md').
      // memberSubDirFromProfile uses path.dirname(PROFILE_PATH) = '.../my-teams/members/john@co.com'
      // because path.basename(dirname) === email → the nested branch.
      // IMPORTANT: if findMemberGlobally's candidate order changes, update this setup.
      mockFS.exists
        .mockResolvedValueOnce(false) // team-flat not found
        .mockResolvedValueOnce(false) // company-flat not found
        .mockResolvedValueOnce(false) // contractor not found
        .mockResolvedValue(true); // nested found + any further calls (e.g. createDirectory guards)
    });

    it('memberSubDirFromProfile: nested profile uses parentDir as subdir root', async () => {
      // beforeEach routes findMemberGlobally to PROFILE_PATH (nested legacy).
      // PROFILE_PATH = '.../my-teams/members/john@co.com/john@co.com.md'
      // memberSubDirFromProfile should return '.../my-teams/members/john@co.com' (not a sibling dir).
      await svc.createMemberFile(EMAIL, '1on1', { date: '2026-01-15' }, WS);

      expect(mockFS.createDirectory).toHaveBeenCalledWith(
        expect.stringMatching(/my-teams\/members\/john@co\.com\/1on1s$/),
      );
    });

    it('memberSubDirFromProfile: flat profile uses sibling dir as subdir root', async () => {
      // Override: team-flat found immediately → PROFILE_PATH is a flat file
      mockFS.exists.mockReset();
      mockFS.exists.mockResolvedValueOnce(true); // team-flat found
      // profilePath = '.../my-teams/members/john@co.com.md' (flat)
      // memberSubDirFromProfile should return '.../my-teams/members/john@co.com' (sibling dir)
      await svc.createMemberFile(EMAIL, '1on1', { date: '2026-01-15' }, WS);

      expect(mockFS.createDirectory).toHaveBeenCalledWith(
        expect.stringMatching(/my-teams\/members\/john@co\.com\/1on1s$/),
      );
    });

    it('auto-creates company-scoped profile when member does not exist (FR24)', async () => {
      // All exists() calls return false → triggers auto-create
      mockFS.exists.mockResolvedValue(false);

      await svc.createMemberFile(EMAIL, 'feedback', { date: '2026-03-07' }, WS);

      // Two writeFile calls: profile creation + dated feedback file
      expect(mockFS.writeFile).toHaveBeenCalledTimes(2);
      // First write is the auto-created company-scoped profile
      expect(mockFS.writeFile.mock.calls[0]![0]).toContain('my-company/members/john@co.com.md');
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

  // ── addMember ─────────────────────────────────────────────────────────────────

  describe('addMember', () => {
    beforeEach(() => {
      // Default: profile does not exist yet; careerRoot does not exist
      mockFS.exists.mockResolvedValue(false);
      mockFS.listDirectories.mockResolvedValue([]);
    });

    it('MEM-UNIT-001: company scope — writes to my-company/members/<email>.md', async () => {
      await svc.addMember('joao@company.com', {}, WS);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`my-company/members/joao@company.com.md`),
        expect.any(String),
      );
    });

    it('MEM-UNIT-002: team scope — writes to my-teams/members/<email>.md', async () => {
      await svc.addMember('joao@company.com', { team: 'backend' }, WS);

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(`my-teams/members/joao@company.com.md`),
        expect.any(String),
      );
    });

    it('MEM-UNIT-003: team scope — frontmatter contains manager wiki-link when career profile exists', async () => {
      // Sequence of exists() calls:
      // 1. profilePath (does not exist yet) → false
      // 2. careerRoot → true
      // 3. managerProfilePath → true
      mockFS.exists
        .mockResolvedValueOnce(false) // profile not yet created
        .mockResolvedValueOnce(true) // careerRoot exists
        .mockResolvedValueOnce(true); // managerProfilePath exists
      mockFS.listDirectories.mockResolvedValueOnce(['boss@co.com']);

      await svc.addMember('joao@company.com', { team: 'backend' }, WS);

      const writtenContent = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(writtenContent).toContain('manager:');
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
      mockFS.exists
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);
      mockFS.listDirectories.mockResolvedValueOnce(['boss@co.com']);

      await svc.addMember('joao@company.com', { team: 'backend' }, WS);

      const writtenContent = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      // Must use [[...]] wiki-link, not a bare email string
      expect(writtenContent).toMatch(/manager:.*\[\[/);
    });

    it('MEM-UNIT-011: manager is empty string when my-career/ directory does not exist', async () => {
      // First exists(): profile not found; second exists(): careerRoot missing
      mockFS.exists.mockResolvedValueOnce(false).mockResolvedValueOnce(false);

      await svc.addMember('joao@company.com', { team: 'backend' }, WS);

      const writtenContent = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      // manager field should be empty
      expect(writtenContent).toMatch(/manager:\s*''/);
    });

    it('returns { created: false } when profile already exists', async () => {
      mockFS.exists.mockResolvedValueOnce(true); // profile exists

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

      expect(mockFS.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('my-company/contractors/ext@agency.com/ext@agency.com.md'),
        expect.any(String),
      );
    });

    it('MEM-UNIT-013: contractor profile includes relationship: contractor', async () => {
      await svc.addMember('ext@agency.com', { contractor: true }, WS);

      const written = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(written).toContain('relationship: contractor');
    });

    it('FR42: contractor profile includes company field when opts.company provided', async () => {
      await svc.addMember('ext@agency.com', { contractor: true, company: 'Agency Corp' }, WS);

      const written = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(written).toContain('relationship: contractor');
      expect(written).toContain('company: Agency Corp');
    });

    it('FR42: contractor profile has no company field when opts.company is undefined', async () => {
      await svc.addMember('ext@agency.com', { contractor: true }, WS);

      const written = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(written).not.toContain('company:');
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

  // ── createMemberFile — global email resolver (Story 3.3) ──────────────────────

  describe('createMemberFile — global email resolver', () => {
    beforeEach(() => {
      mockFS.exists.mockResolvedValue(false);
    });

    it('MEM-UNIT-006: routes to flat team-scoped profile when it exists in my-teams/members/', async () => {
      // findMemberGlobally: team-flat → true (found immediately)
      mockFS.exists.mockResolvedValueOnce(true);

      await svc.createMemberFile('joao@company.com', 'feedback', { date: '2026-01-15' }, WS);

      // appendToFile must use the team-flat profile path
      expect(mockParser.appendToFile).toHaveBeenCalledWith(
        expect.stringContaining('my-teams/members/joao@company.com.md'),
        'Feedbacks',
        expect.any(String),
      );
    });

    it('MEM-UNIT-007: routes to flat company-scoped profile when team-flat absent', async () => {
      // findMemberGlobally: team-flat → false, company-flat → true
      mockFS.exists.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      await svc.createMemberFile('pedro@company.com', 'feedback', { date: '2026-01-15' }, WS);

      expect(mockParser.appendToFile).toHaveBeenCalledWith(
        expect.stringContaining('my-company/members/pedro@company.com.md'),
        'Feedbacks',
        expect.any(String),
      );
    });

    it('MEM-UNIT-008: auto-creates company profile and writes feedback when no profile found', async () => {
      // findMemberGlobally: all 3 → false; addMember idempotency check → false (creates)
      mockFS.exists.mockResolvedValue(false);

      await svc.createMemberFile('unknown@company.com', 'feedback', { date: '2026-01-15' }, WS);

      // writeFile called twice: addMember creates profile + createMemberFile writes dated file
      expect(mockFS.writeFile).toHaveBeenCalledTimes(2);
      // Profile auto-created at company scope
      expect(mockFS.writeFile.mock.calls[0]![0]).toContain(
        'my-company/members/unknown@company.com.md',
      );
      // Feedback wiki-link appended to the auto-created profile
      expect(mockParser.appendToFile).toHaveBeenCalledWith(
        expect.stringContaining('my-company/members/unknown@company.com.md'),
        'Feedbacks',
        expect.any(String),
      );
    });
  });
});
