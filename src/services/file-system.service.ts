import * as fs from 'fs-extra';
import path from 'node:path';

export class FileSystemError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly path: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'FileSystemError';
    Object.setPrototypeOf(this, FileSystemError.prototype);
  }
}

export class FileSystemService {
  async createDirectory(dirPath: string): Promise<void> {
    try {
      await fs.ensureDir(dirPath);
    } catch (err) {
      throw new FileSystemError(
        err instanceof Error ? err.message : 'createDirectory failed',
        'createDirectory',
        dirPath,
        err,
      );
    }
  }

  // Atomic write: write to a temp file then rename so partial writes are never observable.
  // The temp file lives in the same directory as the target to guarantee same-filesystem
  // rename semantics (POSIX rename is atomic on same FS).
  async writeFile(filePath: string, content: string): Promise<void> {
    const tmpPath = `${filePath}.${process.pid}.tmp`;
    try {
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeFile(tmpPath, content, 'utf8');
      await fs.rename(tmpPath, filePath);
    } catch (err) {
      await fs.remove(tmpPath).catch(() => {});
      throw new FileSystemError(
        err instanceof Error ? err.message : 'writeFile failed',
        'writeFile',
        filePath,
        err,
      );
    }
  }

  async readFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch (err) {
      throw new FileSystemError(
        err instanceof Error ? err.message : 'readFile failed',
        'readFile',
        filePath,
        err,
      );
    }
  }

  async moveFile(
    srcPath: string,
    destPath: string,
    options?: { overwrite?: boolean },
  ): Promise<void> {
    try {
      await fs.move(srcPath, destPath, { overwrite: options?.overwrite ?? false });
    } catch (err) {
      throw new FileSystemError(
        err instanceof Error ? err.message : 'moveFile failed',
        'moveFile',
        srcPath,
        err,
      );
    }
  }

  async exists(targetPath: string): Promise<boolean> {
    return fs.pathExists(targetPath);
  }
}

export const fileSystemService = new FileSystemService();
