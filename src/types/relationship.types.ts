/**
 * Domain interfaces for relationship management (Epic 2, Story 2.3).
 *
 * Directory layout:
 *   my-company/relationships/{email}/
 *     {email}.md        profile with frontmatter
 *     1on1s/            directory for 1on1 files
 */

/** Frontmatter written into relationships/{email}/{email}.md */
export interface IRelationshipFrontmatter {
  email: string;
  name: string;
  role: string;
  department: string;
  relationship_type: string;
  date_added: string;
}

/** Options accepted by RelationshipService.addRelationship() */
export interface IAddRelationshipOptions {
  name?: string;
  role?: string;
  department?: string;
  relationship_type?: string;
  date?: string;
  noEdit?: boolean;
}

/** Summary row returned by RelationshipService.listRelationships() */
export interface IRelationshipSummary {
  email: string;
  name: string;
  department: string;
  relationship_type: string;
  lastInteraction: string;
}

/** Result of a batch add operation */
export interface IBatchResult {
  created: number;
  existed: number;
}
