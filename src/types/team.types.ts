/**
 * Domain interfaces for team management (Epic 2, Story 2.1).
 *
 * Directory layout (PRD authoritative — overrides data-models.md):
 *   my-teams/_members/{email}/         single canonical member location
 *   my-teams/_teams/{team-name}/       team metadata + wiki-link roster
 *   my-teams/_archived/{year}/{email}/ archived members
 */

/** Frontmatter written into _members/{email}/{email}.md */
export interface ITeamMemberFrontmatter {
  email: string;
  role: string;
  location: string;
  teams: string[];
  date_added: string;
  archived?: boolean;
  archived_date?: string;
  termination?: boolean;
  termination_date?: string;
}

/** Frontmatter written into _teams/{team-name}/{team-name}-context.md */
export interface ITeamContextFrontmatter {
  team: string;
  created: string;
}

/** Summary row returned by TeamService.listTeams() */
export interface ITeamSummary {
  teamName: string;
  memberCount: number;
}

/** Summary row returned by TeamService.listTeamMembers() */
export interface IMemberSummary {
  email: string;
  role: string;
  location: string;
  dateAdded: string;
}

/** Options accepted by TeamService.addMember() */
export interface IAddMemberOptions {
  role?: string;
  location?: string;
}

/** Options accepted by TeamService.archiveMember() */
export interface IArchiveOptions {
  from?: string;
  to?: string;
}

/** Location result from TeamService.findProfile() */
export type ProfileLocation = 'member' | 'archived' | 'leadership' | 'relationship';

export interface IProfileResult {
  location: ProfileLocation;
  filePath: string;
  content: string;
}
