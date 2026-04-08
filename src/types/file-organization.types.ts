/**
 * Domain types for Epic 3 Story 3.5 — file organization and movement.
 */

/** How the inbox file was placed in the workspace. */
export type OrganizationMode = 'moved' | 'copied' | 'archived';

/** Outcome of a successful `organizeFile` run. */
export interface OrganizationResult {
  /** Absolute paths where the file content was written or moved. */
  pathsWritten: string[];
  mode: OrganizationMode;
  /** Set when `mode === 'archived'` (same as sole entry in `pathsWritten`). */
  archivePath?: string;
}
