import * as fsNs from 'fs-extra';
import path from 'node:path';
import { FileSystemService, fileSystemService } from './file-system.service.js';
import { SUPPORTED_EXTENSIONS, MAX_FILE_SIZE_BYTES, type InboxFile } from '../types/inbox.types.js';

// CJS/ESM interop — mirrors the shim in file-system.service.ts.
const fs = (
  Object.prototype.hasOwnProperty.call(fsNs, 'default')
    ? (fsNs as unknown as { default: typeof fsNs }).default
    : fsNs
) as typeof fsNs;

type Result<T> = { success: true; data: T } | { success: false; error: string };

export class InboxService {
  constructor(private readonly _fs: FileSystemService) {}

  /**
   * Scans the workspace inbox directory and returns all supported files
   * sorted by timestamp ascending (oldest first).
   *
   * Returns `{ success: true, data: [] }` when the inbox is empty.
   * Returns `{ success: false, error }` only on unexpected I/O failure.
   */
  async scanInbox(workspaceRoot: string): Promise<Result<InboxFile[]>> {
    const inboxDir = path.join(workspaceRoot, 'inbox');
    const collected: InboxFile[] = [];

    for (const ext of SUPPORTED_EXTENSIONS) {
      let filePaths: string[];
      try {
        filePaths = await this._fs.listFiles(inboxDir, ext);
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : `Failed to list ${ext} files in inbox`,
        };
      }

      for (const filePath of filePaths) {
        const parsed = await this.parseFile(filePath);
        if (parsed.success) {
          collected.push(parsed.data);
        }
        // Unparseable files are silently skipped during a scan so the caller
        // still processes all valid files. Individual errors are surfaced
        // when parseFile is called directly.
      }
    }

    collected.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return { success: true, data: collected };
  }

  /**
   * Parses a single inbox file and returns its content and metadata.
   *
   * Rejects files larger than MAX_FILE_SIZE_BYTES.
   * Returns `{ success: false, error }` for I/O failures, stat errors, or oversized files.
   */
  async parseFile(filePath: string): Promise<Result<InboxFile>> {
    // Stat first to get size + mtime before reading content.
    let stat: { size: number; mtime: Date };
    try {
      stat = await fs.stat(filePath);
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : `Failed to stat file: ${filePath}`,
      };
    }

    if (stat.size > MAX_FILE_SIZE_BYTES) {
      return {
        success: false,
        error: `File too large: ${filePath} (${stat.size} bytes)`,
      };
    }

    let content: string;
    try {
      content = await this._fs.readFile(filePath);
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : `Failed to read file: ${filePath}`,
      };
    }

    return {
      success: true,
      data: {
        filepath: filePath,
        content,
        timestamp: stat.mtime,
      },
    };
  }
}

export const inboxService = new InboxService(fileSystemService);
