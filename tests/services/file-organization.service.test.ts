import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { FileSystemService } from '../../src/services/file-system.service.js';
import type { InboxFile } from '../../src/types/inbox.types.js';
import { FileOrganizationService } from '../../src/services/file-organization.service.js';

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

const WS = '/fake/workspace';
const INBOX_FILE = `${WS}/inbox/note.md`;

function makeInboxFile(overrides: Partial<InboxFile> = {}): InboxFile {
  return {
    filepath: INBOX_FILE,
    content: '# Hello',
    timestamp: new Date('2026-04-08T12:00:00Z'),
    ...overrides,
  };
}

describe('FileOrganizationService', () => {
  let mockFS: MockFS;
  let svc: FileOrganizationService;

  beforeEach(() => {
    mockFS = createMockFS();
    svc = new FileOrganizationService(mockFS as unknown as FileSystemService);
  });

  it('rejects when source is not inside inbox', async () => {
    const file = makeInboxFile({ filepath: `${WS}/other/x.md` });
    const r = await svc.organizeFile(file, WS, ['my-teams/a']);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error).toContain('inbox');
    }
    expect(mockFS.moveFile).not.toHaveBeenCalled();
  });

  it('single destination: createDirectory, moveFile from inbox to dest', async () => {
    const file = makeInboxFile();
    const r = await svc.organizeFile(file, WS, ['my-teams/m1']);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.mode).toBe('moved');
    expect(mockFS.createDirectory).toHaveBeenCalledWith(`${WS}/my-teams/m1`);
    expect(mockFS.moveFile).toHaveBeenCalledWith(
      INBOX_FILE,
      expect.stringContaining(`${WS}/my-teams/m1`),
    );
    expect(mockFS.writeFile).not.toHaveBeenCalled();
  });

  it('multiple destinations: writeFile to each dest then removeFile inbox', async () => {
    const file = makeInboxFile();
    const r = await svc.organizeFile(file, WS, ['my-teams/a', 'my-teams/b']);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.mode).toBe('copied');
    expect(r.data.pathsWritten).toHaveLength(2);
    expect(mockFS.writeFile).toHaveBeenCalledTimes(2);
    expect(mockFS.writeFile).toHaveBeenCalledWith(
      expect.stringContaining(`${WS}/my-teams/a`),
      '# Hello',
    );
    expect(mockFS.writeFile).toHaveBeenCalledWith(
      expect.stringContaining(`${WS}/my-teams/b`),
      '# Hello',
    );
    expect(mockFS.removeFile).toHaveBeenCalledWith(INBOX_FILE);
    expect(mockFS.moveFile).not.toHaveBeenCalled();
  });

  it('empty destinations: archives to archive/', async () => {
    const file = makeInboxFile();
    const r = await svc.organizeFile(file, WS, []);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.mode).toBe('archived');
    expect(r.data.archivePath).toBeDefined();
    expect(mockFS.createDirectory).toHaveBeenCalledWith(`${WS}/archive`);
    expect(mockFS.moveFile).toHaveBeenCalledWith(INBOX_FILE, expect.any(String));
  });

  it('all invalid destinations (traversal): archives', async () => {
    const file = makeInboxFile();
    const r = await svc.organizeFile(file, WS, ['../outside']);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.mode).toBe('archived');
    expect(mockFS.moveFile).toHaveBeenCalled();
  });

  it('deduplicates identical destination dirs', async () => {
    const file = makeInboxFile();
    const r = await svc.organizeFile(file, WS, ['my-teams/x', 'my-teams/x/']);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.mode).toBe('moved');
    expect(mockFS.moveFile).toHaveBeenCalledTimes(1);
  });

  it('destination path ending with file segment uses parent directory', async () => {
    const file = makeInboxFile();
    const r = await svc.organizeFile(file, WS, ['my-teams/m1/notes.md']);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(mockFS.createDirectory).toHaveBeenCalledWith(`${WS}/my-teams/m1`);
  });
});
