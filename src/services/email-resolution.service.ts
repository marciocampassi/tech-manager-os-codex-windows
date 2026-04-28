import path from 'node:path';
import { FileSystemService, fileSystemService } from './file-system.service.js';
import { RelationshipService, relationshipService } from './relationship.service.js';
import { getWorkspaceRoot as resolveWorkspaceRoot } from '../utils/workspace.js';
import { InvalidEmailError } from '../errors/tmr-error.js';
import { validateEmail as validateEmailUtil } from '../utils/validation.js';
import type { IEntityLocation } from '../types/email-resolution.types.js';

// ── EmailResolutionService ────────────────────────────────────────────────────

export class EmailResolutionService {
  private readonly _cache: Map<string, IEntityLocation> = new Map();

  constructor(
    private readonly _fs: FileSystemService,
    private readonly _relationship: RelationshipService,
  ) {}

  getWorkspaceRoot(): string {
    return resolveWorkspaceRoot();
  }

  /**
   * Returns true when `email` is a syntactically valid email address.
   * Delegates to the shared `validateEmail` utility in `src/utils/validation.ts`
   * rather than containing its own inline regex.
   */
  validateEmail(email: string): boolean {
    try {
      validateEmailUtil(email);
      return true;
    } catch (err) {
      if (err instanceof InvalidEmailError) return false;
      throw err;
    }
  }

  /**
   * Resolves an email address to its location in the workspace using the
   * 4-step hierarchy: team → leadership → relationship → auto-create.
   *
   * Email is normalized to lowercase before resolution. Results are cached
   * in-memory (keyed by `email:ws`) so repeated calls avoid redundant FS checks.
   *
   * @throws {InvalidEmailError} if `email` fails format validation (TMR_E103)
   */
  async resolve(email: string, ws: string): Promise<IEntityLocation> {
    const e = email.toLowerCase().trim();
    validateEmailUtil(e); // throws InvalidEmailError (TMR_E103) if invalid
    const key = `${e}:${ws}`;
    const cached = this._cache.get(key);
    if (cached !== undefined) return cached;
    const result = await this._doResolve(e, ws);
    this._cache.set(key, result);
    return result;
  }

  /**
   * Generates an Obsidian-compatible wiki-link string (without the leading `- `).
   * The relative path is computed from `fromPath`'s directory to `resolvedPath`,
   * with path separators normalized to `/` for cross-platform compatibility.
   *
   * Callers prepend `- ` when appending to a section, e.g.:
   *   `- ${generateWikiLink(email, resolved.absolutePath, compPath)}`
   */
  generateWikiLink(email: string, resolvedPath: string, fromPath: string): string {
    const rel = path.relative(path.dirname(fromPath), resolvedPath);
    const normalizedRel = rel.split(path.sep).join('/');
    return `[[${normalizedRel}|${email.toLowerCase()}]]`;
  }

  /**
   * Clears the in-memory resolution cache.
   * Useful in tests to ensure fresh filesystem checks between assertions.
   */
  clearCache(): void {
    this._cache.clear();
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async _doResolve(email: string, ws: string): Promise<IEntityLocation> {
    // 1. Team member
    const teamProfile = path.join(ws, 'my-teams', 'members', email, `${email}.md`);
    if (await this._fs.exists(teamProfile)) {
      return { type: 'team', absolutePath: teamProfile, created: false };
    }

    // 2. Leadership
    const leaderProfile = path.join(ws, 'my-leadership', email, `${email}.md`);
    if (await this._fs.exists(leaderProfile)) {
      return { type: 'leadership', absolutePath: leaderProfile, created: false };
    }

    // 2.5. Self (system user's own career profile — prevents auto-creating a relationship for self)
    const selfProfile = path.join(ws, 'my-career', email, `${email}.md`);
    if (await this._fs.exists(selfProfile)) {
      return { type: 'self', absolutePath: selfProfile, created: false };
    }

    // 3. Relationship (already exists)
    const relProfile = path.join(ws, 'my-company', 'members', email, `${email}.md`);
    if (await this._fs.exists(relProfile)) {
      return { type: 'relationship', absolutePath: relProfile, created: false };
    }

    // 4. Not found — auto-create as relationship
    await this._relationship.addRelationship(email, {}, ws);
    return { type: 'relationship', absolutePath: relProfile, created: true };
  }
}

export const emailResolutionService = new EmailResolutionService(
  fileSystemService,
  relationshipService,
);
