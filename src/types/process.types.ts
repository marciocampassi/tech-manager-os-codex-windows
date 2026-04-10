/**
 * Epic 3 Story 3.6 — `tmr process` orchestration types.
 */

export interface ProcessRunOptions {
  dryRun: boolean;
  verbose: boolean;
  plain: boolean;
}

/**
 * Aggregated outcome of a full process run (stdout summary + tests).
 */
export interface ProcessSummary {
  filesScanned: number;
  filesCategorizedOk: number;
  categorizeErrors: string[];
  memberContextUpdates: number;
  projectContextUpdates: number;
  contextErrors: string[];
  tasksAdded: number;
  tasksMarkedDone: number;
  taskError: string | null;
  filesOrganizedOk: number;
  organizeErrors: string[];
  needsReviewCount: number;
  suggestedActions: string[];
  dryRun: boolean;
}
