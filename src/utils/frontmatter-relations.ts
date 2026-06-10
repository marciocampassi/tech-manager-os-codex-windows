import matter from 'gray-matter';
import type { FileSystemService } from '../services/file-system.service.js';

// ── Types ──

export type RelationKey =
  | 'current_manager' // scalar — the manager this entity reports to right now
  | 'previous_manager' // array  — historical managers
  | 'direct_reports' // array  — people who report to this entity
  | 'leadership' // array  — upward chain (skip-level, CTO, CEO)
  | 'other_leaderships' // array  — matrix / dotted-line
  | 'teams' // array  — teams this entity belongs to
  | 'projects' // array  — projects this entity is on
  | 'members' // array  — members of a team (used on team-members file)
  | 'stakeholders' // array  — stakeholders of a project
  | 'tasks' // scalar — wiki-link to my-tasks/tasks.md (self profile only)
  | 'today' // scalar — wiki-link to my-tasks/today.md
  | 'this_week' // scalar — wiki-link to my-tasks/this-week.md
  | 'this_month' // scalar — wiki-link to my-tasks/this-month.md
  | 'this_quarter'; // scalar — wiki-link to my-tasks/this-quarter.md

export type ScalarKey =
  | 'last_1on1'
  | 'last_feedback'
  | 'last_assessment'
  | 'last_performance_review'
  | 'archived'
  | 'archived_date'
  | 'termination'
  | 'termination_date'
  | 'termination_note'
  | 'current_manager' // also settable directly (e.g. rotate manager on archive)
  | 'start_date'
  | 'date_added';

// ── Constants ──

const SCALAR_KEYS: ReadonlySet<RelationKey> = new Set([
  'current_manager',
  'tasks',
  'today',
  'this_week',
  'this_month',
  'this_quarter',
]);

// ── Exported Functions ──

/**
 * Appends `wikiLink` to an array frontmatter field (idempotent), or overwrites
 * a scalar field. Throws if `filePath` does not exist.
 */
export async function addRelation(
  filePath: string,
  key: RelationKey,
  wikiLink: string,
  fs: FileSystemService,
): Promise<void> {
  if (!(await fs.exists(filePath))) {
    throw new Error(`Cannot add relation to missing file: ${filePath}`);
  }
  const content = await fs.readFile(filePath);
  const parsed = matter(content);
  const data = parsed.data as Record<string, unknown>;

  if (SCALAR_KEYS.has(key)) {
    data[key] = wikiLink;
  } else {
    const existing = Array.isArray(data[key]) ? (data[key] as string[]) : [];
    if (!existing.includes(wikiLink)) existing.push(wikiLink);
    data[key] = existing;
  }
  await fs.writeFile(filePath, matter.stringify(parsed.content, data));
}

/**
 * Removes `wikiLink` from an array frontmatter field (leaving the key as `[]`),
 * or clears a scalar field if it matches. Silent no-op if the file is missing.
 */
export async function removeRelation(
  filePath: string,
  key: RelationKey,
  wikiLink: string,
  fs: FileSystemService,
): Promise<void> {
  if (!(await fs.exists(filePath))) return;
  const content = await fs.readFile(filePath);
  const parsed = matter(content);
  const data = parsed.data as Record<string, unknown>;

  if (SCALAR_KEYS.has(key)) {
    if (data[key] === wikiLink) delete data[key];
  } else {
    const existing = Array.isArray(data[key]) ? (data[key] as string[]) : [];
    data[key] = existing.filter((v) => v !== wikiLink);
  }
  await fs.writeFile(filePath, matter.stringify(parsed.content, data));
}

/**
 * Sets a scalar frontmatter field to `value`. Silent no-op if the file is missing.
 */
export async function setScalar(
  filePath: string,
  key: ScalarKey,
  value: string | boolean,
  fs: FileSystemService,
): Promise<void> {
  if (!(await fs.exists(filePath))) return;
  const content = await fs.readFile(filePath);
  const parsed = matter(content);
  const data = parsed.data as Record<string, unknown>;
  data[key] = value;
  await fs.writeFile(filePath, matter.stringify(parsed.content, data));
}
