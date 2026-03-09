import * as fsNs from 'fs-extra';
import path from 'node:path';
import { FileSystemError } from '../errors/tmr-error.js';

export { FileSystemError } from '../errors/tmr-error.js';

// CJS/ESM interop: when bundled by tsup, fs-extra (CJS) lands under `.default`.
// Jest mocks expose named exports directly without a `.default` wrapper.
// The type cast is bounded to this single interop shim — no `any` escapes.
const fs = (
  Object.prototype.hasOwnProperty.call(fsNs, 'default')
    ? (fsNs as unknown as { default: typeof fsNs }).default
    : fsNs
) as typeof fsNs;

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

  // ─── Architecture-mandated additions (components.md § FileSystemService) ─

  /**
   * Append text to a file; creates the file + parent directories if absent.
   * NOTE: Unlike writeFile, appendFile is NOT atomic — there is no temp-file/rename
   * pattern for append semantics. Concurrent appenders may interleave their writes.
   */
  async appendFile(filePath: string, content: string): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(filePath));
      await fs.appendFile(filePath, content, 'utf8');
    } catch (err) {
      throw new FileSystemError(
        err instanceof Error ? err.message : 'appendFile failed',
        'appendFile',
        filePath,
        err,
      );
    }
  }

  /**
   * List files inside a directory (non-recursive — top level only).
   * Symbolic links are excluded (Dirent.isFile() returns false for symlinks).
   * @param extension Optional filter (e.g. '.md') — pass undefined for all files.
   * @returns Absolute file paths, alphabetically ordered by readdir.
   */
  async listFiles(dirPath: string, extension?: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries
        .filter((e) => e.isFile() && (!extension || e.name.endsWith(extension)))
        .map((e) => path.join(dirPath, e.name));
    } catch (err) {
      throw new FileSystemError(
        err instanceof Error ? err.message : 'listFiles failed',
        'listFiles',
        dirPath,
        err,
      );
    }
  }

  /**
   * List immediate child directories of a given path.
   * @returns Array of directory names (not full paths), alphabetically ordered.
   */
  async listDirectories(dirPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch (err) {
      throw new FileSystemError(
        err instanceof Error ? err.message : 'listDirectories failed',
        'listDirectories',
        dirPath,
        err,
      );
    }
  }
}

export const fileSystemService = new FileSystemService();
