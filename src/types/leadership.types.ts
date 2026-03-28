/**
 * Domain interfaces for leadership management (Epic 2, Story 2.4).
 *
 * Directory layout:
 *   my-leadership/{email}/
 *     {email}.md        profile with frontmatter
 *     1on1s/            directory for 1on1 files
 */

/** Frontmatter written into my-leadership/{email}/{email}.md */
export interface ILeadershipFrontmatter {
  email: string;
  name: string;
  role: string;
  gender?: string;
  areas_of_responsibility: string;
  date_added: string;
}

/** Options accepted by LeadershipService.addLeadership() and add1on1() */
export interface IAddLeadershipOptions {
  name?: string;
  role?: string;
  gender?: string;
  areas_of_responsibility?: string;
  date?: string;
  noEdit?: boolean;
}

/** Summary row returned by LeadershipService.listLeadership() */
export interface ILeadershipSummary {
  email: string;
  name: string;
  role: string;
  lastInteraction: string;
}
