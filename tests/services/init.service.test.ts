import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import path from 'node:path';
import { homedir } from 'node:os';
import { InitService } from '../../src/services/init.service.js';
import type { FileSystemService } from '../../src/services/file-system.service.js';

// ── Mock FileSystemService ────────────────────────────────────────────────────

type MockFS = {
  createDirectory: jest.MockedFunction<FileSystemService['createDirectory']>;
  writeFile: jest.MockedFunction<FileSystemService['writeFile']>;
};

function createMockFS(): MockFS {
  return {
    createDirectory: jest.fn<FileSystemService['createDirectory']>().mockResolvedValue(undefined),
    writeFile: jest.fn<FileSystemService['writeFile']>().mockResolvedValue(undefined),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const WS = '/fake/vault';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('InitService', () => {
  let svc: InitService;
  let mockFS: MockFS;

  beforeEach(() => {
    mockFS = createMockFS();
    svc = new InitService(mockFS as unknown as FileSystemService);
  });

  // ── resolveVaultPath ────────────────────────────────────────────────────────

  describe('resolveVaultPath', () => {
    it('returns process.cwd() when input is an empty string', () => {
      expect(svc.resolveVaultPath('')).toBe(process.cwd());
    });

    it('returns process.cwd() when input is whitespace-only', () => {
      expect(svc.resolveVaultPath('   ')).toBe(process.cwd());
    });

    it('expands ~/... paths to the OS home directory', () => {
      const result = svc.resolveVaultPath('~/my-vault');
      expect(result).toBe(path.join(homedir(), 'my-vault'));
    });

    it('returns absolute paths unchanged', () => {
      expect(svc.resolveVaultPath('/absolute/path/to/vault')).toBe('/absolute/path/to/vault');
    });

    it('returns relative paths unchanged (not expanded)', () => {
      expect(svc.resolveVaultPath('relative/path')).toBe('relative/path');
    });

    it('bare ~ expands to homedir (not left as literal ~)', () => {
      expect(svc.resolveVaultPath('~')).toBe(homedir());
    });
  });

  // ── scaffold ─────────────────────────────────────────────────────────────────

  describe('scaffold', () => {
    // ── INIT-UNIT-001 ──────────────────────────────────────────────────────────

    it('INIT-UNIT-001: creates all 12 required directories (positive set)', async () => {
      await svc.scaffold(WS);

      const dirs = (mockFS.createDirectory.mock.calls as [string][]).map((c) =>
        path.relative(WS, c[0]),
      );

      const required = [
        'inbox',
        'archive',
        'my-tasks',
        path.join('my-teams', 'members'),
        path.join('my-teams', 'teams'),
        path.join('my-company', 'members'),
        path.join('my-company', 'projects'),
        'my-leadership',
        'my-career',
        'knowledge-base',
        path.join('.claude', 'skills'),
        path.join('.cursor', 'rules', 'tmr'),
      ];

      for (const dir of required) {
        expect(dirs).toContain(dir);
      }
    });

    it('INIT-UNIT-001-NEG1: does NOT create utils/', async () => {
      await svc.scaffold(WS);
      const dirs = (mockFS.createDirectory.mock.calls as [string][]).map((c) => c[0]);
      expect(dirs).not.toContain(path.join(WS, 'utils'));
    });

    it('INIT-UNIT-001-NEG2: does NOT create my-teams/feedback-templates/', async () => {
      await svc.scaffold(WS);
      const dirs = (mockFS.createDirectory.mock.calls as [string][]).map((c) => c[0]);
      expect(dirs).not.toContain(path.join(WS, 'my-teams', 'feedback-templates'));
    });

    it('creates exactly 12 directories — no extra ones', async () => {
      await svc.scaffold(WS);
      expect(mockFS.createDirectory).toHaveBeenCalledTimes(12);
    });

    // ── INIT-UNIT-007 ──────────────────────────────────────────────────────────

    it('INIT-UNIT-007: writes CLAUDE.md to the vault root', async () => {
      await svc.scaffold(WS);

      const writtenPaths = (mockFS.writeFile.mock.calls as [string, string][]).map((c) => c[0]);
      expect(writtenPaths).toContain(path.join(WS, 'CLAUDE.md'));
    });

    it('INIT-UNIT-007: CLAUDE.md content includes vault structure table', async () => {
      await svc.scaffold(WS);

      const claudeCall = (mockFS.writeFile.mock.calls as [string, string][]).find(([p]) =>
        p.endsWith('CLAUDE.md'),
      );
      expect(claudeCall).toBeDefined();
      expect(claudeCall![1]).toContain('Vault Structure');
      expect(claudeCall![1]).toContain('inbox/');
    });

    // ── Error handling ────────────────────────────────────────────────────────

    it('re-throws when createDirectory rejects', async () => {
      const err = new Error('disk full');
      mockFS.createDirectory.mockRejectedValueOnce(err);

      await expect(svc.scaffold(WS)).rejects.toThrow('disk full');
    });

    it('re-throws when writeFile (CLAUDE.md) rejects', async () => {
      const err = new Error('no space left');
      mockFS.writeFile.mockRejectedValueOnce(err);

      await expect(svc.scaffold(WS)).rejects.toThrow('no space left');
    });

    it('calls writeFile exactly once (for CLAUDE.md) on happy path', async () => {
      await svc.scaffold(WS);
      expect(mockFS.writeFile).toHaveBeenCalledTimes(1);
    });
  });
});
