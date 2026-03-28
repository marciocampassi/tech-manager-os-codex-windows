/**
 * Domain types for Epic 3 inbox scanning and file parsing.
 */

/** Supported file extensions that the InboxService will scan. */
export const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.json'] as const;

export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

/** Maximum file size allowed for parsing (10 MB). Files larger than this are rejected. */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Represents a parsed inbox file ready for downstream processing.
 * Content is always the raw UTF-8 string — semantic parsing (e.g. JSON.parse)
 * is the responsibility of the Categorization Service (Story 3.2).
 */
export interface InboxFile {
  /** Absolute path to the source file in the inbox directory. */
  filepath: string;
  /** Raw UTF-8 content of the file. */
  content: string;
  /** File last-modified time — used to sort by oldest-first. */
  timestamp: Date;
}
