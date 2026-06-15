/**
 * Typed vocabulary of frontmatter relationship fields for all entity profile shapes.
 * These are annotation/cast targets for gray-matter parsed frontmatter — pure interfaces,
 * no runtime code, no imports.
 *
 * Complements RelationKey / ScalarKey in src/utils/frontmatter-relations.ts (mutation keys).
 * Used by Wave 2 stories (9.28–9.34) when reading or writing frontmatter relationship fields.
 */

/**
 * Frontmatter shape shared by all entity profiles (team members, leaders, company members,
 * contractors, and self). Only `last_<type>` scalars appear here — dated artifact lists
 * (1on1s, feedbacks, assessments, performance reviews) stay in Markdown body sections.
 */
export interface IEntityRelations {
  current_manager?: string; // scalar wiki-link — who this entity reports to now
  previous_manager?: string[]; // array — historical managers (append-only)
  direct_reports?: string[]; // array — people reporting to this entity
  leadership?: string[]; // array — upward chain (skip-level, CTO, CEO)
  other_leaderships?: string[]; // array — matrix / co-managers / dotted-line
  teams?: string[]; // array — teams this entity belongs to
  projects?: string[]; // array — projects this entity is involved with
  start_date?: string; // YYYY-MM-DD — when they started in role (user-fillable)
  date_added?: string; // YYYY-MM-DD — profile creation date (auto-set)
  last_1on1?: string; // scalar YYYY-MM-DD — updated by member/leadership add 1on1
  last_feedback?: string; // scalar YYYY-MM — updated by member add feedback
  last_assessment?: string; // scalar YYYY-MM — updated by member add assessment
  last_performance_review?: string; // scalar YYYY-MM — updated by member/myself add performance-review
  archived?: boolean; // set on tmr team archive/fire
  archived_date?: string; // YYYY-MM-DD — set on archive/fire
  termination?: boolean; // set on tmr team fire only
  termination_date?: string; // YYYY-MM-DD
  termination_note?: string; // human note
}

/**
 * Frontmatter shape for team roster files (e.g. `platform-members.md`).
 */
export interface ITeamRelations {
  members?: string[]; // wiki-links to member profiles — used on <team>-members.md
}

/**
 * Frontmatter shape for project profile files.
 */
export interface IProjectRelations {
  members?: string[]; // wiki-links to entity profiles linked as members
  stakeholders?: string[]; // wiki-links to entity profiles linked as stakeholders
}

/**
 * Frontmatter shape for the self profile (`my-career/<email>.md`).
 * Extends IEntityRelations with task-shell scalar links.
 * No `goals` field — goals are expressed as the five individual task-shell scalars below.
 */
export interface ISelfRelations extends IEntityRelations {
  tasks?: string; // scalar wiki-link → my-tasks/tasks.md
  today?: string; // scalar wiki-link → my-tasks/today.md
  this_week?: string; // scalar wiki-link → my-tasks/this-week.md
  this_month?: string; // scalar wiki-link → my-tasks/this-month.md
  this_quarter?: string; // scalar wiki-link → my-tasks/this-quarter.md
}
