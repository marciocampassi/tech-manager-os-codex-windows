/**
 * Domain interfaces for member file management (Epic 2, Story 2.2).
 */

/** Supported file types that can be added to a member's directory. */
export type FileType = '1on1' | 'feedback' | 'assessment' | 'performance-review';

/** Static config per file type — subdirectory, filename suffix, and profile section. */
export interface ISectionConfig {
  subDir: string;
  fileSuffix: string;
  sectionName: string;
}

/** Maps each FileType to its directory/naming/section configuration. */
export const FILE_TYPE_CONFIG: Readonly<Record<FileType, ISectionConfig>> = {
  '1on1': {
    subDir: '1on1s',
    fileSuffix: '1on1',
    sectionName: '1on1s',
  },
  feedback: {
    subDir: 'feedbacks',
    fileSuffix: 'feedback', // kept for structural consistency — filename builder overrides for feedback type
    sectionName: 'Feedbacks',
  },
  assessment: {
    subDir: 'assessments',
    fileSuffix: 'assessment',
    sectionName: 'Assessments',
  },
  'performance-review': {
    subDir: 'performance-reviews',
    fileSuffix: 'performance-review',
    sectionName: 'Performance Reviews',
  },
};

/** Options accepted by MemberService.createMemberFile(). */
export interface ICreateFileOptions {
  date?: string;
  noEdit?: boolean;
  /** Reviewer email for feedback files. Resolved from my-career/ when omitted at the command layer. */
  fromEmail?: string;
}

/**
 * Pre-computed wiki-link strings embedded in a dated file's frontmatter (Story 9.31).
 * Services build these via `formatWikiLink` and pass them to the template — keeping
 * templates free of path arithmetic.
 *
 * - `subject`: the person the artifact is about
 * - `with`: the other participant (1on1/assessment/performance-review — usually "me")
 * - `from`: the reviewer (feedback only)
 */
export interface IDatedFileLinks {
  subject: string;
  with?: string;
  from?: string;
}

/** Frontmatter recency scalar key for each dated file type (Story 9.31). */
export const LAST_SCALAR_KEY: Readonly<
  Record<FileType, 'last_1on1' | 'last_feedback' | 'last_assessment' | 'last_performance_review'>
> = {
  '1on1': 'last_1on1',
  feedback: 'last_feedback',
  assessment: 'last_assessment',
  'performance-review': 'last_performance_review',
};

/** Options accepted by MemberService.addMember(). */
export interface IAddMemberOptions {
  team?: string;
  location?: string;
  name?: string;
  role?: string;
  gender?: string;
  /** When true, routes the profile to my-company/contractors/<email>/<email>.md */
  contractor?: boolean;
}

/** Result returned by MemberService.createMemberFile(). */
export interface ICreateFileResult {
  filePath: string;
  profilePath: string;
  wikiLink: string;
  /**
   * Set only when a feedback `--from` reviewer profile was auto-created during this run
   * (the reviewer didn't exist in any scope). Lets the command surface the side effect.
   */
  createdReviewer?: { email: string; path: string };
}
