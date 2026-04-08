/**
 * Domain types for Epic 3 Story 3.3 — Context summary updates via CLI injection.
 */

/**
 * The type of workspace entity whose context is being updated.
 * Determines which directory structure and context.md path are used.
 */
export type EntityType = 'member' | 'project' | 'leadership';

/**
 * Result returned from a successful context update operation.
 */
export interface ContextUpdateResult {
  /** Which entity category was updated. */
  entityType: EntityType;
  /** Email address (member/leadership) or project name slug. */
  identifier: string;
  /** Absolute path to the context.md file that was written. */
  contextFilePath: string;
  /** Number of insight strings appended (may be 0 for empty arrays). */
  insightsAppended: number;
  /** True when context.md did not previously exist and was created fresh. */
  created: boolean;
}

/** Markdown section name used for all context entries. */
export const CONTEXT_SECTION_NAME = 'Context Log';
