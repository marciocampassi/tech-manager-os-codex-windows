import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import path from 'node:path';
import { EmailResolutionService } from '../../src/services/email-resolution.service.js';
import type { FileSystemService } from '../../src/services/file-system.service.js';
import type { RelationshipService } from '../../src/services/relationship.service.js';

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

// ── Mock RelationshipService ──────────────────────────────────────────────────

type MockRelationship = {
  addRelationship: jest.MockedFunction<RelationshipService['addRelationship']>;
};

function createMockRelationship(): MockRelationship {
  return {
    addRelationship: jest
      .fn<RelationshipService['addRelationship']>()
      .mockResolvedValue({ created: true }),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const WS = '/fake/workspace';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('EmailResolutionService', () => {
  let svc: EmailResolutionService;
  let mockFS: MockFS;
  let mockRel: MockRelationship;

  beforeEach(() => {
    mockFS = createMockFS();
    mockRel = createMockRelationship();
    svc = new EmailResolutionService(
      mockFS as unknown as FileSystemService,
      mockRel as unknown as RelationshipService,
    );
  });

  // ── validateEmail ─────────────────────────────────────────────────────────

  describe('validateEmail', () => {
    it('returns true for a valid email', () => {
      expect(svc.validateEmail('user@example.com')).toBe(true);
    });

    it('returns true for emails with subdomains', () => {
      expect(svc.validateEmail('user@mail.example.co.uk')).toBe(true);
    });

    it('returns true for emails with + alias', () => {
      expect(svc.validateEmail('user+alias@example.com')).toBe(true);
    });

    it('returns false for empty string', () => {
      expect(svc.validateEmail('')).toBe(false);
    });

    it('returns false for string without @', () => {
      expect(svc.validateEmail('userexample.com')).toBe(false);
    });

    it('returns false for string with multiple @', () => {
      expect(svc.validateEmail('user@@example.com')).toBe(false);
    });

    it('returns false for missing domain part', () => {
      expect(svc.validateEmail('user@')).toBe(false);
    });

    it('returns false for missing username part', () => {
      expect(svc.validateEmail('@example.com')).toBe(false);
    });

    it('returns false for whitespace-only string', () => {
      expect(svc.validateEmail('   ')).toBe(false);
    });

    it('returns false for missing TLD', () => {
      expect(svc.validateEmail('user@example')).toBe(false);
    });
  });

  // ── resolve — hierarchy ───────────────────────────────────────────────────

  describe('resolve', () => {
    it('resolves to team when team profile exists', async () => {
      mockFS.exists.mockImplementation(async (p: string) => p.includes('my-teams/members'));

      const result = await svc.resolve('alice@co.com', WS);

      expect(result.type).toBe('team');
      expect(result.absolutePath).toContain('my-teams/members/alice@co.com/alice@co.com.md');
      expect(result.created).toBe(false);
    });

    it('resolves to leadership when leadership profile exists (no team)', async () => {
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('my-teams/members')) return false;
        return p.includes('my-leadership');
      });

      const result = await svc.resolve('boss@co.com', WS);

      expect(result.type).toBe('leadership');
      expect(result.absolutePath).toContain('my-leadership/boss@co.com/boss@co.com.md');
      expect(result.created).toBe(false);
    });

    it('resolves to self when career profile exists (no team/leadership)', async () => {
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('my-teams/members')) return false;
        if (p.includes('my-leadership')) return false;
        return p.includes('my-career');
      });

      const result = await svc.resolve('me@co.com', WS);

      expect(result.type).toBe('self');
      expect(result.absolutePath).toContain('my-career/me@co.com/me@co.com.md');
      expect(result.created).toBe(false);
    });

    it('resolves to relationship when relationship exists (no team/leadership/self)', async () => {
      mockFS.exists.mockImplementation(async (p: string) => {
        if (p.includes('my-teams/members')) return false;
        if (p.includes('my-leadership')) return false;
        if (p.includes('my-career')) return false;
        return p.includes('my-company/members');
      });

      const result = await svc.resolve('partner@co.com', WS);

      expect(result.type).toBe('relationship');
      expect(result.absolutePath).toContain('my-company/members/partner@co.com/partner@co.com.md');
      expect(result.created).toBe(false);
    });

    it('auto-creates relationship and returns created: true when email not found anywhere', async () => {
      mockFS.exists.mockResolvedValue(false);

      const result = await svc.resolve('newguy@co.com', WS);

      expect(mockRel.addRelationship).toHaveBeenCalledWith('newguy@co.com', {}, WS);
      expect(result.type).toBe('relationship');
      expect(result.absolutePath).toContain('my-company/members/newguy@co.com/newguy@co.com.md');
      expect(result.created).toBe(true);
    });

    it('throws Error with message matching /Invalid email/ for invalid email', async () => {
      await expect(svc.resolve('not-an-email', WS)).rejects.toThrow(/Invalid email/i);
    });

    it('throws for empty string email', async () => {
      await expect(svc.resolve('', WS)).rejects.toThrow(/Invalid email/i);
    });

    it('normalizes uppercase email to lowercase before resolution', async () => {
      mockFS.exists.mockImplementation(async (p: string) => p.includes('my-teams/members'));

      const result = await svc.resolve('ALICE@CO.COM', WS);

      expect(result.absolutePath).toContain('alice@co.com');
      expect(mockFS.exists).toHaveBeenCalledWith(expect.stringContaining('alice@co.com'));
    });

    it('returns consistent absolutePath using path.join (OS-native separators)', async () => {
      mockFS.exists.mockImplementation(async (p: string) => p.includes('my-teams/members'));

      const result = await svc.resolve('user@co.com', WS);
      const expected = path.join(WS, 'my-teams', 'members', 'user@co.com', 'user@co.com.md');
      expect(result.absolutePath).toBe(expected);
    });
  });

  // ── caching ───────────────────────────────────────────────────────────────

  describe('caching', () => {
    it('returns cached result on second call without hitting the filesystem', async () => {
      mockFS.exists.mockImplementation(async (p: string) => p.includes('my-teams/members'));

      await svc.resolve('alice@co.com', WS);
      mockFS.exists.mockClear();

      await svc.resolve('alice@co.com', WS);

      expect(mockFS.exists).not.toHaveBeenCalled();
    });

    it('caches result by email+ws key (different ws resolves separately)', async () => {
      mockFS.exists.mockImplementation(async (p: string) => p.includes('my-teams/members'));

      const r1 = await svc.resolve('alice@co.com', '/ws1');
      const r2 = await svc.resolve('alice@co.com', '/ws2');

      expect(r1.absolutePath).toContain('/ws1');
      expect(r2.absolutePath).toContain('/ws2');
    });

    it('clearCache() allows fresh resolution after clear', async () => {
      mockFS.exists.mockResolvedValue(false);
      await svc.resolve('alice@co.com', WS);

      svc.clearCache();
      mockFS.exists.mockClear();

      await svc.resolve('alice@co.com', WS);

      expect(mockFS.exists).toHaveBeenCalled();
    });

    it('clearCache() resets all cached entries', async () => {
      mockFS.exists.mockImplementation(async (p: string) => p.includes('my-teams/members'));
      await svc.resolve('a@co.com', WS);
      await svc.resolve('b@co.com', WS);

      svc.clearCache();
      mockFS.exists.mockClear();

      await svc.resolve('a@co.com', WS);
      await svc.resolve('b@co.com', WS);

      expect(mockFS.exists).toHaveBeenCalledTimes(2);
    });
  });

  // ── generateWikiLink ──────────────────────────────────────────────────────

  describe('generateWikiLink', () => {
    it('generates correct relative path for team member from project composition', () => {
      const resolvedPath = `${WS}/my-teams/members/user@co.com/user@co.com.md`;
      const fromPath = `${WS}/my-company/projects/platform-project/platform-project-composition.md`;

      const result = svc.generateWikiLink('user@co.com', resolvedPath, fromPath);

      expect(result).toBe('[[../../../my-teams/members/user@co.com/user@co.com.md|user@co.com]]');
    });

    it('generates correct relative path for leadership from project composition', () => {
      const resolvedPath = `${WS}/my-leadership/boss@co.com/boss@co.com.md`;
      const fromPath = `${WS}/my-company/projects/platform-project/platform-project-composition.md`;

      const result = svc.generateWikiLink('boss@co.com', resolvedPath, fromPath);

      expect(result).toBe('[[../../../my-leadership/boss@co.com/boss@co.com.md|boss@co.com]]');
    });

    it('generates correct relative path for relationship from project composition', () => {
      const resolvedPath = `${WS}/my-company/members/partner@co.com/partner@co.com.md`;
      const fromPath = `${WS}/my-company/projects/platform-project/platform-project-composition.md`;

      const result = svc.generateWikiLink('partner@co.com', resolvedPath, fromPath);

      expect(result).toBe('[[../../members/partner@co.com/partner@co.com.md|partner@co.com]]');
    });

    it('normalizes email to lowercase in the wiki-link label', () => {
      const resolvedPath = `${WS}/my-teams/members/alice@co.com/alice@co.com.md`;
      const fromPath = `${WS}/my-company/projects/platform-project/platform-project-composition.md`;

      const result = svc.generateWikiLink('ALICE@CO.COM', resolvedPath, fromPath);

      expect(result).toContain('|alice@co.com]]');
    });

    it('uses forward slashes in the path (cross-platform)', () => {
      const resolvedPath = `${WS}/my-teams/members/user@co.com/user@co.com.md`;
      const fromPath = `${WS}/my-company/projects/platform-project/platform-project-composition.md`;

      const result = svc.generateWikiLink('user@co.com', resolvedPath, fromPath);

      expect(result).not.toContain('\\');
    });

    it('returns string starting with [[ and ending with ]]', () => {
      const resolvedPath = `${WS}/my-teams/members/user@co.com/user@co.com.md`;
      const fromPath = `${WS}/my-company/projects/platform-project/platform-project-composition.md`;

      const result = svc.generateWikiLink('user@co.com', resolvedPath, fromPath);

      expect(result).toMatch(/^\[\[.*\]\]$/);
    });

    it('does NOT include a leading dash prefix', () => {
      const resolvedPath = `${WS}/my-teams/members/user@co.com/user@co.com.md`;
      const fromPath = `${WS}/my-company/projects/platform-project/platform-project-composition.md`;

      const result = svc.generateWikiLink('user@co.com', resolvedPath, fromPath);

      expect(result.startsWith('- ')).toBe(false);
    });
  });
});
