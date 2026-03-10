/**
 * Domain interfaces for the centralized email resolution service (Epic 2, Story 2.6).
 *
 * EmailResolutionService searches the workspace in order:
 *   1. my-teams/_members/{email}/      → type: 'team'
 *   2. my-leadership/{email}/          → type: 'leadership'
 *   3. my-company/relationships/{email}/ → type: 'relationship'
 *   4. Not found → auto-creates as relationship, created: true
 */

/** Location of an email profile resolved within the workspace */
export interface IEntityLocation {
  /** Which section of the workspace contains this profile */
  type: 'team' | 'leadership' | 'relationship';
  /** Absolute filesystem path to the profile .md file */
  absolutePath: string;
  /** True when the profile was auto-created during this resolution (step 4) */
  created: boolean;
}
