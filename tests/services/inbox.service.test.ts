import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { FileSystemService } from '../../src/services/file-system.service.js';
import { FileSystemError } from '../../src/services/file-system.service.js';

// ── Mock fs-extra (needed for the internal fs.stat call in InboxService) ──────

const mockStat = jest.fn<() => Promise<unknown>>();

jest.unstable_mockModule('fs-extra', () => ({
  stat: mockStat,
  // Provide the rest of the fs-extra surface so the CJS/ESM interop shim
  // in file-system.service.ts and inbox.service.ts resolves correctly.
  ensureDir: jest.fn<() => Promise<void>>(),
  writeFile: jest.fn<() => Promise<void>>(),
  readFile: jest.fn<() => Promise<unknown>>(),
  rename: jest.fn<() => Promise<void>>(),
  remove: jest.fn<() => Promise<void>>(),
  move: jest.fn<() => Promise<void>>(),
  pathExists: jest.fn<() => Promise<unknown>>(),
  appendFile: jest.fn<() => Promise<void>>(),
  readdir: jest.fn<() => Promise<unknown>>(),
}));

// Dynamic import AFTER mock registration so the module picks up the mock.
const { InboxService } = await import('../../src/services/inbox.service.js');
const { MAX_FILE_SIZE_BYTES } = await import('../../src/types/inbox.types.js');

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

// ── Helpers ───────────────────────────────────────────────────────────────────

const WS = '/fake/workspace';
const INBOX = `${WS}/inbox`;

function makeStat(overrides: Partial<{ size: number; mtime: Date }> = {}): {
  size: number;
  mtime: Date;
} {
  return {
    size: 100,
    mtime: new Date('2026-01-15T10:00:00Z'),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('InboxService', () => {
  let svc: InstanceType<typeof InboxService>;
  let mockFS: MockFS;

  beforeEach(() => {
    mockFS = createMockFS();
    svc = new InboxService(mockFS as unknown as FileSystemService);
    mockStat.mockReset();
  });

  // ── scanInbox ─────────────────────────────────────────────────────────────

  describe('scanInbox', () => {
    it('returns empty array when inbox has no files', async () => {
      mockFS.listFiles.mockResolvedValue([]);

      const result = await svc.scanInbox(WS);

      expect(result).toEqual({ success: true, data: [] });
    });

    it('returns only .txt, .md, .json files', async () => {
      const mdFile = `${INBOX}/note.md`;
      const txtFile = `${INBOX}/log.txt`;
      const jsonFile = `${INBOX}/data.json`;

      mockFS.listFiles
        .mockResolvedValueOnce([txtFile]) // .txt call
        .mockResolvedValueOnce([mdFile]) // .md call
        .mockResolvedValueOnce([jsonFile]); // .json call

      const mtime = new Date('2026-01-15T10:00:00Z');
      mockStat
        .mockResolvedValueOnce(makeStat({ mtime }))
        .mockResolvedValueOnce(makeStat({ mtime }))
        .mockResolvedValueOnce(makeStat({ mtime }));

      mockFS.readFile
        .mockResolvedValueOnce('txt content')
        .mockResolvedValueOnce('md content')
        .mockResolvedValueOnce('{"key":"value"}');

      const result = await svc.scanInbox(WS);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toHaveLength(3);
      const paths = result.data.map((f) => f.filepath);
      expect(paths).toContain(txtFile);
      expect(paths).toContain(mdFile);
      expect(paths).toContain(jsonFile);
    });

    it('sorts results by timestamp ascending (oldest first)', async () => {
      const older = `${INBOX}/old.md`;
      const newer = `${INBOX}/new.md`;

      // Return newer first in the list to verify sort works
      mockFS.listFiles
        .mockResolvedValueOnce([]) // .txt
        .mockResolvedValueOnce([newer, older]) // .md
        .mockResolvedValueOnce([]); // .json

      const oldMtime = new Date('2026-01-10T08:00:00Z');
      const newMtime = new Date('2026-01-20T08:00:00Z');

      mockStat
        .mockResolvedValueOnce(makeStat({ mtime: newMtime }))
        .mockResolvedValueOnce(makeStat({ mtime: oldMtime }));

      mockFS.readFile.mockResolvedValue('content');

      const result = await svc.scanInbox(WS);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data[0]?.filepath).toBe(older);
      expect(result.data[1]?.filepath).toBe(newer);
    });

    it('returns error result when listFiles throws', async () => {
      mockFS.listFiles.mockRejectedValue(
        new FileSystemError('Directory not found', 'listFiles', INBOX),
      );

      const result = await svc.scanInbox(WS);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain('Directory not found');
    });

    it('skips unparseable files and returns remaining valid ones', async () => {
      const good = `${INBOX}/good.md`;
      const bad = `${INBOX}/bad.md`;

      mockFS.listFiles
        .mockResolvedValueOnce([]) // .txt
        .mockResolvedValueOnce([good, bad]) // .md
        .mockResolvedValueOnce([]); // .json

      // good file: stat ok
      mockStat
        .mockResolvedValueOnce(makeStat())
        .mockRejectedValueOnce(new Error('Permission denied')); // bad file: stat fails

      mockFS.readFile.mockResolvedValueOnce('good content');

      const result = await svc.scanInbox(WS);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.filepath).toBe(good);
    });
  });

  // ── parseFile ─────────────────────────────────────────────────────────────

  describe('parseFile', () => {
    it('parses a .md file successfully', async () => {
      const filePath = `${INBOX}/meeting.md`;
      const mtime = new Date('2026-02-01T09:00:00Z');
      mockStat.mockResolvedValue(makeStat({ mtime }));
      mockFS.readFile.mockResolvedValue('# Meeting Notes\n\nDiscussed roadmap.');

      const result = await svc.parseFile(filePath);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.filepath).toBe(filePath);
      expect(result.data.content).toBe('# Meeting Notes\n\nDiscussed roadmap.');
      expect(result.data.timestamp).toEqual(mtime);
    });

    it('parses a .txt file successfully', async () => {
      const filePath = `${INBOX}/log.txt`;
      const mtime = new Date('2026-02-05T12:00:00Z');
      mockStat.mockResolvedValue(makeStat({ mtime }));
      mockFS.readFile.mockResolvedValue('plain text content');

      const result = await svc.parseFile(filePath);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.content).toBe('plain text content');
    });

    it('parses a .json file as raw string (no semantic parsing)', async () => {
      const filePath = `${INBOX}/data.json`;
      const mtime = new Date('2026-02-10T15:00:00Z');
      const rawJson = '{"key": "value", "count": 42}';
      mockStat.mockResolvedValue(makeStat({ mtime }));
      mockFS.readFile.mockResolvedValue(rawJson);

      const result = await svc.parseFile(filePath);

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.content).toBe(rawJson);
    });

    it('returns error when file exceeds MAX_FILE_SIZE_BYTES', async () => {
      const filePath = `${INBOX}/huge.md`;
      const oversize = MAX_FILE_SIZE_BYTES + 1;
      mockStat.mockResolvedValue(makeStat({ size: oversize }));

      const result = await svc.parseFile(filePath);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain('File too large');
      expect(result.error).toContain(filePath);
    });

    it('returns error when stat fails', async () => {
      const filePath = `${INBOX}/mystery.md`;
      mockStat.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const result = await svc.parseFile(filePath);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain('ENOENT');
    });

    it('returns error when readFile throws a FileSystemError', async () => {
      const filePath = `${INBOX}/locked.md`;
      mockStat.mockResolvedValue(makeStat());
      mockFS.readFile.mockRejectedValue(
        new FileSystemError('Permission denied', 'readFile', filePath),
      );

      const result = await svc.parseFile(filePath);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain('Permission denied');
    });

    it('returns error for non-Error stat rejection', async () => {
      const filePath = `${INBOX}/weird.md`;
      mockStat.mockRejectedValue('a string error');

      const result = await svc.parseFile(filePath);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain(`Failed to stat file: ${filePath}`);
    });

    it('returns error for non-Error readFile rejection', async () => {
      const filePath = `${INBOX}/bad.md`;
      mockStat.mockResolvedValue(makeStat());
      mockFS.readFile.mockRejectedValue('raw string rejection');

      const result = await svc.parseFile(filePath);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain(`Failed to read file: ${filePath}`);
    });
  });
});
