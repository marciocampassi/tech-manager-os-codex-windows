/**
 * Domain types for Epic 3 Story 3.2 — AI-powered categorization.
 */

/**
 * All valid note-type classifications the AI may assign to an inbox file.
 * Matches the 10 values defined in epic-3-process-intelligence-engine.md#story-32.
 */
export type NoteType =
  | '1on1_session'
  | 'feedback_positive'
  | 'feedback_constructive'
  | 'pip_concern'
  | 'project_status'
  | 'project_risk'
  | 'team_meeting'
  | 'leadership_meeting'
  | 'candidate_interview'
  | 'general_note';

/** Set of all valid NoteType values used for runtime validation of AI responses. */
export const NOTE_TYPES: ReadonlySet<NoteType> = new Set<NoteType>([
  '1on1_session',
  'feedback_positive',
  'feedback_constructive',
  'pip_concern',
  'project_status',
  'project_risk',
  'team_meeting',
  'leadership_meeting',
  'candidate_interview',
  'general_note',
]);

/**
 * Lightweight identity context injected into the AI prompt.
 * Contains only the minimum information needed for routing decisions —
 * full context files are NOT read during categorization (O(1) token cost).
 */
export interface CategorizationContext {
  /** Known team members with enough info to construct destination paths. */
  members: Array<{
    email: string;
    name: string;
    team: string;
  }>;
  /** Known projects with slug (for path construction) and display name (for AI recognition). */
  projects: Array<{
    name: string;
    displayName: string;
  }>;
}

/**
 * The full categorization result produced by `CategorizationService.categorize()`.
 * All array fields may be empty but must be present.
 */
export interface CategorizationResult {
  /** Classification of the note type. */
  type: NoteType;
  /** Names of team members explicitly mentioned in the note. */
  members: string[];
  /** Project names explicitly mentioned in the note. */
  projects: string[];
  /**
   * Key insights keyed by entity name (member name or project name).
   * e.g. { "John Doe": ["career goal discussed", "needs PR review"] }
   */
  insights: Record<string, string[]>;
  /**
   * Workspace-relative paths where this note should be filed.
   * e.g. ["my-teams/alpha/john.doe@co.com/1on1s/"]
   */
  destinations: string[];
  /** Suggested follow-up action items for the manager. */
  suggestedActions: string[];
  /** AI confidence score in range [0, 1]. */
  confidence: number;
  /**
   * Set by the service (not the AI). True when confidence is below the
   * configured threshold — signals that human review is recommended before
   * the file is automatically routed.
   */
  needsReview: boolean;
}

/**
 * Default confidence threshold below which a categorization is flagged for human review.
 * Matches CONFIG_DEFAULTS.confidence_threshold in config.types.ts.
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.75;
