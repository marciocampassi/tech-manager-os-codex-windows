import path from 'node:path';
import type { InboxFile } from '../types/inbox.types.js';
import type { OrganizationResult } from '../types/file-organization.types.js';
import { FileSystemService } from './file-system.service.js';

type Result<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Moves or copies inbox files into categorization destinations under the workspace.
 * See Story 3.5 — Epic 3 Process Intelligence Engine.
 */
export class FileOrganizationService {
  constructor(private readonly _fs: FileSystemService) {}

  /**
   * Returns true when `candidate` is equal to `parent` or is inside `parent` (no `..` escape).
   */
  private _isStrictlyInsideOrEqual(parent: string, candidate: string): boolean {
    const resolvedParent = path.resolve(parent);
    const resolved = path.resolve(candidate);
    const rel = path.relative(resolvedParent, resolved);
    return (rel === '' || !rel.startsWith('..')) && !path.isAbsolute(rel);
  }

  /**
   * Workspace-relative destination string → absolute directory path, or null if invalid / traversal.
   * Trailing slashes imply directories. A terminal segment with a dot (e.g. `foo.md`) is treated as a file path and reduced to its parent directory.
   */
  private _resolveDestDir(workspaceRoot: string, relativeDest: string): string | null {
    const trimmed = relativeDest.trim().replace(/\\/g, '/');
    if (!trimmed) return null;
    const normalized = trimmed.replace(/^\/+/, '').replace(/^\.\/+/, '');
    let resolved = path.resolve(workspaceRoot, normalized);
    const root = path.resolve(workspaceRoot);
    if (!this._isStrictlyInsideOrEqual(root, resolved)) return null;
    const last = path.basename(resolved);
    if (last.includes('.') && !trimmed.endsWith('/') && !trimmed.endsWith('\\')) {
      resolved = path.dirname(resolved);
    }
    return resolved;
  }

  private async _uniqueTargetPath(destDir: string, basename: string): Promise<string> {
    let target = path.join(destDir, basename);
    if (!(await this._fs.exists(target))) return target;
    const ext = path.extname(basename);
    const name = path.basename(basename, ext);
    target = path.join(destDir, `${name}-${Date.now()}${ext}`);
    return target;
  }

  private async _archiveUnprocessable(
    file: InboxFile,
    workspaceRoot: string,
    basename: string,
  ): Promise<Result<OrganizationResult>> {
    try {
      const archiveDir = path.join(workspaceRoot, 'archive');
      await this._fs.createDirectory(archiveDir);
      const target = await this._uniqueTargetPath(archiveDir, basename);
      await this._fs.moveFile(file.filepath, target);
      return {
        success: true,
        data: {
          pathsWritten: [target],
          mode: 'archived',
          archivePath: target,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async _moveToSingle(
    file: InboxFile,
    destDir: string,
    basename: string,
  ): Promise<Result<OrganizationResult>> {
    try {
      await this._fs.createDirectory(destDir);
      const target = await this._uniqueTargetPath(destDir, basename);
      await this._fs.moveFile(file.filepath, target);
      return {
        success: true,
        data: { pathsWritten: [target], mode: 'moved' },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async _copyToMany(
    file: InboxFile,
    destDirs: string[],
    basename: string,
  ): Promise<Result<OrganizationResult>> {
    const pathsWritten: string[] = [];
    try {
      for (const destDir of destDirs) {
        await this._fs.createDirectory(destDir);
        const target = await this._uniqueTargetPath(destDir, basename);
        await this._fs.writeFile(target, file.content);
        pathsWritten.push(target);
      }
      await this._fs.removeFile(file.filepath);
      return {
        success: true,
        data: { pathsWritten, mode: 'copied' },
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Places an inbox file into one or more workspace destinations, or archives it when unprocessable.
   *
   * @param file Parsed inbox file (`filepath` must be under `{workspaceRoot}/inbox`)
   * @param workspaceRoot Absolute or resolved workspace root
   * @param destinations Workspace-relative directory paths from categorization (may be empty)
   */
  async organizeFile(
    file: InboxFile,
    workspaceRoot: string,
    destinations: string[],
  ): Promise<Result<OrganizationResult>> {
    const root = path.resolve(workspaceRoot);
    const inboxRoot = path.resolve(path.join(root, 'inbox'));
    const resolvedFile = path.resolve(file.filepath);
    const relToInbox = path.relative(inboxRoot, resolvedFile);
    if (relToInbox === '' || relToInbox.startsWith('..')) {
      return {
        success: false,
        error: 'Source file must be a file inside the workspace inbox directory',
      };
    }

    const resolvedDirs: string[] = [];
    const seen = new Set<string>();
    for (const d of destinations) {
      const dir = this._resolveDestDir(root, d);
      if (dir) {
        const key = path.resolve(dir);
        if (!seen.has(key)) {
          seen.add(key);
          resolvedDirs.push(dir);
        }
      }
    }

    const basename = path.basename(file.filepath);

    if (resolvedDirs.length === 0) {
      return this._archiveUnprocessable(file, root, basename);
    }

    if (resolvedDirs.length === 1) {
      return this._moveToSingle(file, resolvedDirs[0], basename);
    }

    return this._copyToMany(file, resolvedDirs, basename);
  }
}
