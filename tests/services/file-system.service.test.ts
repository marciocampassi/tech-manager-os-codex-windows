import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockEnsureDir = jest.fn<() => Promise<void>>();
const mockWriteFile = jest.fn<() => Promise<void>>();
const mockReadFile = jest.fn<() => Promise<unknown>>();
const mockRename = jest.fn<() => Promise<void>>();
const mockRemove = jest.fn<() => Promise<void>>();
const mockMove = jest.fn<() => Promise<void>>();
const mockPathExists = jest.fn<() => Promise<unknown>>();
const mockAppendFile = jest.fn<() => Promise<void>>();
const mockReaddir = jest.fn<() => Promise<unknown>>();
const mockUnlink = jest.fn<() => Promise<void>>();

jest.unstable_mockModule('fs-extra', () => ({
  ensureDir: mockEnsureDir,
  writeFile: mockWriteFile,
  readFile: mockReadFile,
  rename: mockRename,
  remove: mockRemove,
  move: mockMove,
  pathExists: mockPathExists,
  appendFile: mockAppendFile,
  readdir: mockReaddir,
  unlink: mockUnlink,
}));

const { FileSystemService, FileSystemError } =
  await import('../../src/services/file-system.service.js');

let service: InstanceType<typeof FileSystemService>;

beforeEach(() => {
  service = new FileSystemService();
  mockEnsureDir.mockReset();
  mockWriteFile.mockReset();
  mockReadFile.mockReset();
  mockRename.mockReset();
  mockRemove.mockReset();
  mockMove.mockReset();
  mockPathExists.mockReset();
  mockAppendFile.mockReset();
  mockReaddir.mockReset();
  mockUnlink.mockReset();
});

// ─── FileSystemError ─────────────────────────────────────────────────────────

describe('FileSystemError', () => {
  it('instanceof check works', () => {
    const err = new FileSystemError('msg', 'writeFile', '/some/path');
    expect(err).toBeInstanceOf(FileSystemError);
    expect(err).toBeInstanceOf(Error);
  });

  it('sets name to "FileSystemError"', () => {
    const err = new FileSystemError('msg', 'readFile', '/a/b');
    expect(err.name).toBe('FileSystemError');
  });

  it('exposes operation and path fields', () => {
    const err = new FileSystemError('disk full', 'createDirectory', '/tmp/dir');
    expect(err.operation).toBe('createDirectory');
    expect(err.path).toBe('/tmp/dir');
    expect(err.message).toBe('disk full');
  });

  it('exposes optional cause field', () => {
    const root = new Error('ENOSPC');
    const err = new FileSystemError('disk full', 'writeFile', '/tmp/f', root);
    expect(err.cause).toBe(root);
  });

  it('cause is undefined when not provided', () => {
    const err = new FileSystemError('msg', 'exists', '/x');
    expect(err.cause).toBeUndefined();
  });
});

// ─── createDirectory ─────────────────────────────────────────────────────────

describe('FileSystemService — createDirectory', () => {
  it('calls fs.ensureDir with the given path', async () => {
    mockEnsureDir.mockResolvedValue(undefined);
    await service.createDirectory('/tmp/mydir');
    expect(mockEnsureDir).toHaveBeenCalledWith('/tmp/mydir');
  });

  it('throws FileSystemError when ensureDir fails', async () => {
    mockEnsureDir.mockRejectedValue(new Error('EACCES: permission denied'));
    await expect(service.createDirectory('/root/dir')).rejects.toBeInstanceOf(FileSystemError);
  });

  it('FileSystemError has correct operation, path, and cause', async () => {
    const root = new Error('EACCES');
    mockEnsureDir.mockRejectedValue(root);
    await expect(service.createDirectory('/root/dir')).rejects.toMatchObject({
      operation: 'createDirectory',
      path: '/root/dir',
      cause: root,
    });
  });
});

// ─── writeFile ───────────────────────────────────────────────────────────────

describe('FileSystemService — writeFile', () => {
  it('calls ensureDir, writeFile, rename in order', async () => {
    const calls: string[] = [];
    mockEnsureDir.mockImplementation(async () => {
      calls.push('ensureDir');
    });
    mockWriteFile.mockImplementation(async () => {
      calls.push('writeFile');
    });
    mockRename.mockImplementation(async () => {
      calls.push('rename');
    });

    await service.writeFile('/some/dir/file.txt', 'hello');
    expect(calls).toEqual(['ensureDir', 'writeFile', 'rename']);
  });

  it('calls ensureDir with the parent directory', async () => {
    mockEnsureDir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);

    await service.writeFile('/some/dir/file.txt', 'content');
    expect(mockEnsureDir).toHaveBeenCalledWith('/some/dir');
  });

  it('passes content and utf8 encoding to fs.writeFile', async () => {
    mockEnsureDir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);

    await service.writeFile('/file.txt', 'my content');
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('/file.txt'),
      'my content',
      'utf8',
    );
  });

  it('temp path is derived from the target path', async () => {
    mockEnsureDir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);

    await service.writeFile('/tmp/out.txt', '');
    const tmpArg = (mockWriteFile.mock.calls[0] as string[])[0];
    expect(tmpArg).toMatch(/^\/tmp\/out\.txt\.\d+\.tmp$/);
  });

  it('renames temp to final path', async () => {
    mockEnsureDir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);

    await service.writeFile('/final/file.txt', '');
    const [, finalPath] = mockRename.mock.calls[0] as string[];
    expect(finalPath).toBe('/final/file.txt');
  });

  it('cleans up temp file and throws FileSystemError when writeFile fails', async () => {
    mockEnsureDir.mockResolvedValue(undefined);
    mockWriteFile.mockRejectedValue(new Error('disk full'));
    mockRemove.mockResolvedValue(undefined);

    await expect(service.writeFile('/tmp/out.txt', 'x')).rejects.toBeInstanceOf(FileSystemError);
    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(mockRename).not.toHaveBeenCalled();
  });

  it('cleans up temp file and throws FileSystemError when rename fails', async () => {
    mockEnsureDir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockRejectedValue(new Error('EXDEV'));
    mockRemove.mockResolvedValue(undefined);

    await expect(service.writeFile('/tmp/out.txt', 'x')).rejects.toBeInstanceOf(FileSystemError);
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it('FileSystemError has operation "writeFile", correct path, and cause', async () => {
    const root = new Error('ENOSPC');
    mockEnsureDir.mockResolvedValue(undefined);
    mockWriteFile.mockRejectedValue(root);
    mockRemove.mockResolvedValue(undefined);

    await expect(service.writeFile('/tmp/f.txt', '')).rejects.toMatchObject({
      operation: 'writeFile',
      path: '/tmp/f.txt',
      cause: root,
    });
  });

  it('proceeds even if remove cleanup fails', async () => {
    mockEnsureDir.mockResolvedValue(undefined);
    mockWriteFile.mockRejectedValue(new Error('disk full'));
    mockRemove.mockRejectedValue(new Error('already gone'));

    await expect(service.writeFile('/tmp/out.txt', 'x')).rejects.toBeInstanceOf(FileSystemError);
  });
});

// ─── readFile ────────────────────────────────────────────────────────────────

describe('FileSystemService — readFile', () => {
  it('returns file content as string', async () => {
    mockReadFile.mockResolvedValue('file contents here');
    const result = await service.readFile('/some/file.txt');
    expect(result).toBe('file contents here');
    expect(mockReadFile).toHaveBeenCalledWith('/some/file.txt', 'utf8');
  });

  it('throws FileSystemError when readFile fails', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT: no such file'));
    await expect(service.readFile('/missing.txt')).rejects.toBeInstanceOf(FileSystemError);
  });

  it('FileSystemError has operation "readFile", correct path, and cause', async () => {
    const root = new Error('ENOENT');
    mockReadFile.mockRejectedValue(root);
    await expect(service.readFile('/missing.txt')).rejects.toMatchObject({
      operation: 'readFile',
      path: '/missing.txt',
      cause: root,
    });
  });
});

// ─── moveFile ────────────────────────────────────────────────────────────────

describe('FileSystemService — moveFile', () => {
  it('calls fs.move with overwrite: false by default', async () => {
    mockMove.mockResolvedValue(undefined);
    await service.moveFile('/src/a.txt', '/dest/a.txt');
    expect(mockMove).toHaveBeenCalledWith('/src/a.txt', '/dest/a.txt', { overwrite: false });
  });

  it('calls fs.move with overwrite: true when specified', async () => {
    mockMove.mockResolvedValue(undefined);
    await service.moveFile('/src/a.txt', '/dest/a.txt', { overwrite: true });
    expect(mockMove).toHaveBeenCalledWith('/src/a.txt', '/dest/a.txt', { overwrite: true });
  });

  it('throws FileSystemError when move fails', async () => {
    mockMove.mockRejectedValue(new Error('ENOENT'));
    await expect(service.moveFile('/src/a.txt', '/dest/a.txt')).rejects.toBeInstanceOf(
      FileSystemError,
    );
  });

  it('FileSystemError has operation "moveFile", src as path, and cause', async () => {
    const root = new Error('ENOENT');
    mockMove.mockRejectedValue(root);
    await expect(service.moveFile('/src/a.txt', '/dest/a.txt')).rejects.toMatchObject({
      operation: 'moveFile',
      path: '/src/a.txt',
      cause: root,
    });
  });
});

// ─── exists ──────────────────────────────────────────────────────────────────

describe('FileSystemService — exists', () => {
  it('returns true when pathExists resolves true', async () => {
    mockPathExists.mockResolvedValue(true);
    expect(await service.exists('/some/path')).toBe(true);
  });

  it('returns false when pathExists resolves false', async () => {
    mockPathExists.mockResolvedValue(false);
    expect(await service.exists('/missing/path')).toBe(false);
  });

  it('calls pathExists with the given path', async () => {
    mockPathExists.mockResolvedValue(true);
    await service.exists('/check/me');
    expect(mockPathExists).toHaveBeenCalledWith('/check/me');
  });
});

// ─── appendFile ──────────────────────────────────────────────────────────────

describe('FileSystemService — appendFile', () => {
  it('calls ensureDir then appendFile', async () => {
    const calls: string[] = [];
    mockEnsureDir.mockImplementation(async () => {
      calls.push('ensureDir');
    });
    mockAppendFile.mockImplementation(async () => {
      calls.push('appendFile');
    });

    await service.appendFile('/some/dir/file.txt', 'more content');
    expect(calls).toEqual(['ensureDir', 'appendFile']);
  });

  it('calls ensureDir with the parent directory', async () => {
    mockEnsureDir.mockResolvedValue(undefined);
    mockAppendFile.mockResolvedValue(undefined);
    await service.appendFile('/logs/app.log', 'line\n');
    expect(mockEnsureDir).toHaveBeenCalledWith('/logs');
  });

  it('passes content and utf8 to fs.appendFile', async () => {
    mockEnsureDir.mockResolvedValue(undefined);
    mockAppendFile.mockResolvedValue(undefined);
    await service.appendFile('/logs/app.log', 'test line\n');
    expect(mockAppendFile).toHaveBeenCalledWith('/logs/app.log', 'test line\n', 'utf8');
  });

  it('throws FileSystemError when appendFile fails', async () => {
    mockEnsureDir.mockResolvedValue(undefined);
    mockAppendFile.mockRejectedValue(new Error('EACCES'));
    await expect(service.appendFile('/logs/app.log', 'x')).rejects.toBeInstanceOf(FileSystemError);
  });

  it('FileSystemError has operation "appendFile", correct path, and cause', async () => {
    const root = new Error('EACCES');
    mockEnsureDir.mockResolvedValue(undefined);
    mockAppendFile.mockRejectedValue(root);
    await expect(service.appendFile('/logs/app.log', 'x')).rejects.toMatchObject({
      operation: 'appendFile',
      path: '/logs/app.log',
      cause: root,
    });
  });
});

// ─── removeFile ────────────────────────────────────────────────────────────────

describe('FileSystemService — removeFile', () => {
  it('calls fs.unlink with the given path', async () => {
    mockUnlink.mockResolvedValue(undefined);
    await service.removeFile('/tmp/delete-me.txt');
    expect(mockUnlink).toHaveBeenCalledWith('/tmp/delete-me.txt');
  });

  it('throws FileSystemError when unlink fails', async () => {
    mockUnlink.mockRejectedValue(new Error('ENOENT'));
    await expect(service.removeFile('/missing.txt')).rejects.toBeInstanceOf(FileSystemError);
  });

  it('FileSystemError has operation "removeFile", correct path, and cause', async () => {
    const root = new Error('ENOENT');
    mockUnlink.mockRejectedValue(root);
    await expect(service.removeFile('/missing.txt')).rejects.toMatchObject({
      operation: 'removeFile',
      path: '/missing.txt',
      cause: root,
    });
  });
});

// ─── listFiles ───────────────────────────────────────────────────────────────

const makeDirent = (name: string, isFile = true) => ({
  name,
  isFile: () => isFile,
});

describe('FileSystemService — listFiles', () => {
  it('returns absolute paths for all files in the directory', async () => {
    mockReaddir.mockResolvedValue([makeDirent('a.md'), makeDirent('b.md')]);
    const result = await service.listFiles('/inbox');
    expect(result).toEqual(['/inbox/a.md', '/inbox/b.md']);
  });

  it('filters by extension when provided', async () => {
    mockReaddir.mockResolvedValue([
      makeDirent('note.md'),
      makeDirent('image.png'),
      makeDirent('other.md'),
    ]);
    const result = await service.listFiles('/inbox', '.md');
    expect(result).toEqual(['/inbox/note.md', '/inbox/other.md']);
  });

  it('excludes directories from results', async () => {
    mockReaddir.mockResolvedValue([makeDirent('file.md', true), makeDirent('subdir', false)]);
    const result = await service.listFiles('/inbox');
    expect(result).toEqual(['/inbox/file.md']);
  });

  it('passes { withFileTypes: true } to readdir', async () => {
    mockReaddir.mockResolvedValue([]);
    await service.listFiles('/inbox');
    expect(mockReaddir).toHaveBeenCalledWith('/inbox', { withFileTypes: true });
  });

  it('returns empty array when directory is empty', async () => {
    mockReaddir.mockResolvedValue([]);
    expect(await service.listFiles('/empty')).toEqual([]);
  });

  it('throws FileSystemError when readdir fails', async () => {
    mockReaddir.mockRejectedValue(new Error('ENOENT'));
    await expect(service.listFiles('/missing')).rejects.toBeInstanceOf(FileSystemError);
  });

  it('FileSystemError has operation "listFiles", correct path, and cause', async () => {
    const root = new Error('ENOENT');
    mockReaddir.mockRejectedValue(root);
    await expect(service.listFiles('/missing')).rejects.toMatchObject({
      operation: 'listFiles',
      path: '/missing',
      cause: root,
    });
  });
});
