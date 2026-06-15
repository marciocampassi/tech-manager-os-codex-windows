import path from 'node:path';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ContextService } from '../../src/services/context.service.js';
import type { FileSystemService } from '../../src/services/file-system.service.js';
import type { SectionParserService } from '../../src/services/section-parser.service.js';
import { CONTEXT_SECTION_NAME } from '../../src/types/context.types.js';

// ── Mock helpers ──────────────────────────────────────────────────────────────

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

type MockSP = {
  [K in keyof SectionParserService]: jest.MockedFunction<SectionParserService[K]>;
};

function createMockSP(): MockSP {
  return {
    findSection: jest.fn<SectionParserService['findSection']>().mockReturnValue(false),
    appendToSection: jest.fn<SectionParserService['appendToSection']>().mockReturnValue(''),
    appendToFile: jest.fn<SectionParserService['appendToFile']>().mockResolvedValue(undefined),
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const WS = '/fake/workspace';
const MEMBER_EMAIL = 'john.doe@company.com';
const LEADER_EMAIL = 'boss@company.com';
const PROJECT_NAME = 'api-redesign';

// Build path fixtures with path.join so they match the OS-native separators
// produced by the service's path.join calls (backslashes on Windows).
const MEMBER_DIR = path.join(WS, 'my-teams', 'members', MEMBER_EMAIL);
const MEMBER_CTX = path.join(MEMBER_DIR, 'context.md');
const LEADER_DIR = path.join(WS, 'my-leadership', LEADER_EMAIL);
const LEADER_CTX = path.join(LEADER_DIR, 'context.md');
const PROJECT_CTX = path.join(
  WS,
  'my-company',
  'projects',
  `${PROJECT_NAME}-project`,
  'context.md',
);

const INSIGHTS = ['Career goal discussed', 'Needs PR review'];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ContextService', () => {
  let svc: ContextService;
  let mockFS: MockFS;
  let mockSP: MockSP;

  beforeEach(() => {
    mockFS = createMockFS();
    mockSP = createMockSP();
    svc = new ContextService(
      mockFS as unknown as FileSystemService,
      mockSP as unknown as SectionParserService,
    );
  });

  // ── updateContext — member ──────────────────────────────────────────────────

  describe('updateContext() — member entity', () => {
    beforeEach(() => {
      // Member directory exists → member type
      mockFS.exists.mockImplementation(async (p: string) => p === MEMBER_DIR);
    });

    it('should return success with entityType member', async () => {
      const result = await svc.updateContext(MEMBER_EMAIL, INSIGHTS, WS);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.entityType).toBe('member');
      expect(result.data.identifier).toBe(MEMBER_EMAIL);
      expect(result.data.contextFilePath).toBe(MEMBER_CTX);
      expect(result.data.insightsAppended).toBe(INSIGHTS.length);
    });

    it('should normalise email to lowercase', async () => {
      const result = await svc.updateContext('John.Doe@Company.com', INSIGHTS, WS);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.identifier).toBe('john.doe@company.com');
    });

    it('should set created:false when context.md already exists', async () => {
      // Both member dir and context.md exist
      mockFS.exists.mockImplementation(async (p: string) => p === MEMBER_DIR || p === MEMBER_CTX);
      const result = await svc.updateContext(MEMBER_EMAIL, INSIGHTS, WS);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.created).toBe(false);
    });

    it('should set created:true when context.md does not exist', async () => {
      // Member dir exists, context.md does not
      mockFS.exists.mockImplementation(async (p: string) => p === MEMBER_DIR);
      const result = await svc.updateContext(MEMBER_EMAIL, INSIGHTS, WS);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.created).toBe(true);
      expect(mockFS.writeFile).toHaveBeenCalledWith(
        MEMBER_CTX,
        expect.stringContaining(CONTEXT_SECTION_NAME),
      );
    });

    it('should call appendToFile with insight block when insights are non-empty', async () => {
      mockFS.exists.mockImplementation(async (p: string) => p === MEMBER_DIR || p === MEMBER_CTX);
      await svc.updateContext(MEMBER_EMAIL, INSIGHTS, WS);
      expect(mockSP.appendToFile).toHaveBeenCalledWith(
        MEMBER_CTX,
        CONTEXT_SECTION_NAME,
        expect.stringContaining('Career goal discussed'),
      );
    });

    it('should include each insight as a list item in the block', async () => {
      mockFS.exists.mockImplementation(async (p: string) => p === MEMBER_DIR || p === MEMBER_CTX);
      await svc.updateContext(MEMBER_EMAIL, INSIGHTS, WS);
      const [, , block] = mockSP.appendToFile.mock.calls[0] as [string, string, string];
      expect(block).toContain('- Career goal discussed');
      expect(block).toContain('- Needs PR review');
    });

    it('should include an ISO date header in the insight block', async () => {
      mockFS.exists.mockImplementation(async (p: string) => p === MEMBER_DIR || p === MEMBER_CTX);
      await svc.updateContext(MEMBER_EMAIL, INSIGHTS, WS);
      const [, , block] = mockSP.appendToFile.mock.calls[0] as [string, string, string];
      expect(block).toMatch(/### \d{4}-\d{2}-\d{2}/);
    });

    it('should prefix the insight block with a leading newline for block separation', async () => {
      mockFS.exists.mockImplementation(async (p: string) => p === MEMBER_DIR || p === MEMBER_CTX);
      await svc.updateContext(MEMBER_EMAIL, INSIGHTS, WS);
      const [, , block] = mockSP.appendToFile.mock.calls[0] as [string, string, string];
      expect(block).toMatch(/^\n### \d{4}-\d{2}-\d{2}/);
    });

    it('should not call appendToFile when insights array is empty', async () => {
      mockFS.exists.mockImplementation(async (p: string) => p === MEMBER_DIR || p === MEMBER_CTX);
      const result = await svc.updateContext(MEMBER_EMAIL, [], WS);
      expect(result.success).toBe(true);
      expect(mockSP.appendToFile).not.toHaveBeenCalled();
      if (!result.success) return;
      expect(result.data.insightsAppended).toBe(0);
    });
  });

  // ── updateContext — leadership entity ──────────────────────────────────────

  describe('updateContext() — leadership entity', () => {
    beforeEach(() => {
      // Member dir absent, leadership dir present
      mockFS.exists.mockImplementation(async (p: string) => p === LEADER_DIR);
    });

    it('should return success with entityType leadership', async () => {
      const result = await svc.updateContext(LEADER_EMAIL, INSIGHTS, WS);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.entityType).toBe('leadership');
      expect(result.data.contextFilePath).toBe(LEADER_CTX);
    });

    it('should set created:true when leadership context.md does not exist', async () => {
      mockFS.exists.mockImplementation(async (p: string) => p === LEADER_DIR);
      const result = await svc.updateContext(LEADER_EMAIL, INSIGHTS, WS);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.created).toBe(true);
    });
  });

  // ── updateContext — unknown entity ─────────────────────────────────────────

  describe('updateContext() — unknown entity', () => {
    it('should return failure when neither member nor leadership directory exists', async () => {
      mockFS.exists.mockResolvedValue(false);
      const result = await svc.updateContext('unknown@co.com', INSIGHTS, WS);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain('Entity not found');
    });

    it('should return failure when fs.exists throws', async () => {
      mockFS.exists.mockRejectedValue(new Error('Disk I/O failure'));
      const result = await svc.updateContext(MEMBER_EMAIL, INSIGHTS, WS);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain('Disk I/O failure');
    });
  });

  // ── updateContext — appendToFile throws ────────────────────────────────────

  describe('updateContext() — appendToFile throws', () => {
    it('should return failure when sectionParser.appendToFile throws', async () => {
      mockFS.exists.mockImplementation(async (p: string) => p === MEMBER_DIR || p === MEMBER_CTX);
      mockSP.appendToFile.mockRejectedValue(new Error('Write failed'));
      const result = await svc.updateContext(MEMBER_EMAIL, INSIGHTS, WS);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain('Write failed');
    });
  });

  // ── updateProjectContext ────────────────────────────────────────────────────

  describe('updateProjectContext()', () => {
    it('should return success with entityType project', async () => {
      mockFS.exists.mockResolvedValue(false); // context.md does not exist
      const result = await svc.updateProjectContext(PROJECT_NAME, INSIGHTS, WS);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.entityType).toBe('project');
      expect(result.data.identifier).toBe(PROJECT_NAME);
      expect(result.data.contextFilePath).toBe(PROJECT_CTX);
      expect(result.data.insightsAppended).toBe(INSIGHTS.length);
    });

    it('should set created:true when project context.md does not exist', async () => {
      mockFS.exists.mockResolvedValue(false);
      const result = await svc.updateProjectContext(PROJECT_NAME, INSIGHTS, WS);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.created).toBe(true);
    });

    it('should set created:false when project context.md already exists', async () => {
      mockFS.exists.mockResolvedValue(true);
      const result = await svc.updateProjectContext(PROJECT_NAME, INSIGHTS, WS);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.created).toBe(false);
    });

    it('should normalise project name by appending -project suffix', async () => {
      mockFS.exists.mockResolvedValue(false);
      const result = await svc.updateProjectContext('api-redesign', INSIGHTS, WS);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.contextFilePath).toContain('api-redesign-project');
    });

    it('should not double-append -project suffix if already present', async () => {
      mockFS.exists.mockResolvedValue(false);
      const result = await svc.updateProjectContext('api-redesign-project', INSIGHTS, WS);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.contextFilePath).not.toContain('api-redesign-project-project');
    });

    it('should not call appendToFile when insights array is empty', async () => {
      mockFS.exists.mockResolvedValue(false);
      const result = await svc.updateProjectContext(PROJECT_NAME, [], WS);
      expect(result.success).toBe(true);
      expect(mockSP.appendToFile).not.toHaveBeenCalled();
      if (!result.success) return;
      expect(result.data.insightsAppended).toBe(0);
    });

    it('should return failure when appendToFile throws', async () => {
      mockFS.exists.mockResolvedValue(false);
      mockSP.appendToFile.mockRejectedValue(new Error('Disk full'));
      const result = await svc.updateProjectContext(PROJECT_NAME, INSIGHTS, WS);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain('Disk full');
    });
  });

  // ── CONTEXT_SECTION_NAME constant ─────────────────────────────────────────

  describe('CONTEXT_SECTION_NAME', () => {
    it('should be "Context Log"', () => {
      expect(CONTEXT_SECTION_NAME).toBe('Context Log');
    });
  });
});
