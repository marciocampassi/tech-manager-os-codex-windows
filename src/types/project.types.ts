/**
 * Domain interfaces for project management (Epic 2, Story 2.5).
 *
 * Directory layout:
 *   my-company/projects/{name}-project/
 *     {name}-project.md    project overview (frontmatter: members[], stakeholders[])
 *     standups/            standup notes
 *     meetings/            meeting notes
 */

/** Frontmatter written into my-company/projects/{name}-project.md (as of Story 9.33) */
export interface IProjectFrontmatter {
  name: string;
  type: 'project';
  date_created: string;
  /** Wiki-links to entity profiles linked as team members */
  members: string[];
  /** Wiki-links to entity profiles linked as stakeholders */
  stakeholders: string[];
}

/** Options for project-level file creation (standup, discussion, presentation) */
export interface IProjectFileOptions {
  date?: string;
  noEdit?: boolean;
  topic?: string;
}

/** Summary row returned by ProjectService.listProjects() */
export interface IProjectSummary {
  name: string;
  memberCount: number;
  stakeholderCount: number;
  /** True when the overview lacks `members`/`stakeholders` frontmatter (pre-9.33 format) */
  needsMigration?: boolean;
}

/**
 * @deprecated Since Story 2.6. Use `IEntityLocation` from `email-resolution.types.ts` instead.
 * Kept for backwards compatibility — no longer used internally by ProjectService.
 */
export interface IEmailLocation {
  type: 'team' | 'leadership' | 'relationship';
  /** Path relative from my-projects/{project-name}/ to the profile file */
  relativePath: string;
}

/** Result of linking a single email to a project section */
export interface ILinkResult {
  wikiLink: string;
  /** True when the email did not exist and was auto-created as a relationship */
  created: boolean;
}

/** Result of a batch link operation */
export interface IBatchLinkResult {
  linked: number;
  created: number;
}
