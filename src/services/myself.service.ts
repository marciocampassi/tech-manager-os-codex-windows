import path from 'node:path';
import matter from 'gray-matter';
import { FileSystemService, fileSystemService } from './file-system.service.js';
import { EmailResolutionService, emailResolutionService } from './email-resolution.service.js';
import { TemplateService, templateService } from './template.service.js';
import { SectionParserService, sectionParserService } from './section-parser.service.js';
import { getWorkspaceRoot as resolveWorkspaceRoot } from '../utils/workspace.js';
import { ConfigurationError, ValidationError } from '../errors/tmr-error.js';
import { logger } from '../utils/logger.js';
import { addRelation, removeRelation, setScalar } from '../utils/frontmatter-relations.js';
import { formatWikiLink } from '../utils/wiki-link.js';
import { validateEmail } from '../utils/validation.js';
import type { IDatedFileLinks } from '../types/member.types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().split('T')[0] as string;
}

/** Extracts the target path from a frontmatter wiki-link value (`[[target|display]]`). */
function wikiLinkTarget(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = value.match(/^\s*\[\[([^\]]+?)\]\]\s*$/);
  if (!m) return null;
  const inner = m[1] as string;
  const pipe = inner.indexOf('|');
  const target = (pipe === -1 ? inner : inner.slice(0, pipe)).trim();
  return target === '' ? null : target;
}

/** Result of a `tmr myself set-manager` run. */
export interface ISetManagerResult {
  selfPath: string;
  leaderPath: string;
  newManagerEmail: string;
  /** Email of the manager moved into `previous_manager[]`, or null if there was none. */
  previousManagerEmail: string | null;
  /** False when the email was already the current manager (no-op). */
  changed: boolean;
}

// ── MyselfService ─────────────────────────────────────────────────────────────

export class MyselfService {
  constructor(
    private readonly _fs: FileSystemService,
    private readonly _emailResolution: EmailResolutionService,
    private readonly _template: TemplateService,
    private readonly _sectionParser: SectionParserService,
  ) {}

  getWorkspaceRoot(): string {
    return resolveWorkspaceRoot();
  }

  /**
   * Creates a dated performance-review file for the current user's self-profile.
   *
   * Discovers the user's email by listing `.md` files in `my-career/` (flat layout),
   * then validates the email and gets the canonical profile path via EmailResolutionService.
   * Writes `my-career/YYYY-MM-performance-review-<email>.md` and appends a wiki-link
   * to the `## Performance Reviews` section of the self-profile.
   *
   * @throws {ConfigurationError} if no self-profile is found in `my-career/`.
   * @throws {ValidationError} if `opts.date` is not in YYYY-MM or YYYY-MM-DD format.
   * @throws {InvalidEmailError} if the discovered profile filename is not a valid email.
   */
  async addPerformanceReview(
    opts: { date?: string },
    workspaceRoot: string,
  ): Promise<{ filePath: string; profilePath: string }> {
    const careerRoot = path.join(workspaceRoot, 'my-career');
    const files = await this._fs.listFiles(careerRoot, '.md');

    // Identify non-dated files — the self-profile lives flat (no YYYY-MM- prefix)
    const nonDatedFiles = files.filter((f) => !path.basename(f).match(/^\d{4}-\d{2}-/));
    if (nonDatedFiles.length > 1) {
      logger.warn(
        `addPerformanceReview: found ${nonDatedFiles.length} non-dated .md files in my-career/ — expected 1. Using "${path.basename(nonDatedFiles[0] as string)}" as profile.`,
      );
    }
    const profileFile = nonDatedFiles[0];

    if (!profileFile) {
      throw new ConfigurationError('No self-profile found in my-career/. Run tmr init first.');
    }

    const ownEmail = path.basename(profileFile, '.md');

    // Validate email format and resolve canonical path via EmailResolutionService
    const resolved = await this._emailResolution.resolve(ownEmail, workspaceRoot);
    const profilePath = resolved.absolutePath;

    // Validate and normalise --date to YYYY-MM
    const rawDate = opts.date?.trim() || todayIso();
    if (opts.date && !/^\d{4}-\d{2}(-\d{2})?$/.test(rawDate)) {
      throw new ValidationError(`Invalid date format "${opts.date}". Use YYYY-MM or YYYY-MM-DD.`);
    }
    const datePrefix = rawDate.slice(0, 7);

    const fileName = `${datePrefix}-performance-review-${ownEmail}.md`;
    const filePath = path.join(careerRoot, 'performance-reviews', fileName);

    // ── Build dated-file links (D-9.32-1, D-9.32-3) ──────────────────────────
    const subjectLink = formatWikiLink(profilePath, filePath, ownEmail);
    const links: IDatedFileLinks = { subject: subjectLink };

    const content = this._template.getTemplate('performance-review', datePrefix, ownEmail, links);
    await this._fs.writeFile(filePath, content);

    const wikiLink = `- [[performance-reviews/${fileName}]]`;
    await this._sectionParser.appendToFile(profilePath, 'Performance Reviews', wikiLink);

    await setScalar(profilePath, 'last_performance_review', datePrefix, this._fs);

    return { filePath, profilePath };
  }

  /**
   * Changes the vault owner's `current_manager` to `newManagerEmail`, atomically and
   * reciprocally:
   * - moves the previous `current_manager` (if any, and different) into `previous_manager[]`
   * - removes the new manager from `leadership[]` if present (promotion)
   * - sets `current_manager` to the new leader
   * - adds self to the new manager's `direct_reports[]`
   * - removes self from the old manager's `direct_reports[]`
   *
   * @throws {ConfigurationError} if no self-profile exists in `my-career/`.
   * @throws {InvalidEmailError} if `newManagerEmail` is not a valid email.
   * @throws {ValidationError} if the new manager profile is absent in `my-leadership/`.
   */
  async setManager(newManagerEmail: string, workspaceRoot: string): Promise<ISetManagerResult> {
    validateEmail(newManagerEmail);
    const normalizedManager = newManagerEmail.trim().toLowerCase();

    // ── Resolve the self profile (flat in my-career/) ──────────────────────────
    const careerRoot = path.join(workspaceRoot, 'my-career');
    const files = await this._fs.listFiles(careerRoot, '.md');
    const nonDatedFiles = files.filter((f) => !path.basename(f).match(/^\d{4}-\d{2}-/));
    const selfPath = nonDatedFiles[0];
    if (!selfPath) {
      throw new ConfigurationError('No self-profile found in my-career/. Run tmr init first.');
    }
    if (nonDatedFiles.length > 1) {
      logger.warn(
        `setManager: found ${nonDatedFiles.length} non-dated .md files in my-career/ — expected 1. Using "${path.basename(selfPath)}".`,
      );
    }
    const selfEmail = path.basename(selfPath, '.md');

    // ── Require the new manager profile to exist (decision: reject, do not create) ──
    const leaderPath = path.join(
      workspaceRoot,
      'my-leadership',
      normalizedManager,
      `${normalizedManager}.md`,
    );
    if (!(await this._fs.exists(leaderPath))) {
      throw new ValidationError(
        `Leader "${normalizedManager}" not found in my-leadership/. Add them first with \`tmr leadership add ${normalizedManager}\`, then set them as your manager.`,
      );
    }

    const newManagerLinkOnSelf = formatWikiLink(leaderPath, selfPath, normalizedManager);

    // ── Inspect the existing current_manager ───────────────────────────────────
    const selfFm = matter(await this._fs.readFile(selfPath)).data as Record<string, unknown>;
    const currentManager = selfFm['current_manager'];

    if (currentManager === newManagerLinkOnSelf) {
      // Already the current manager — nothing to change.
      return {
        selfPath,
        leaderPath,
        newManagerEmail: normalizedManager,
        previousManagerEmail: null,
        changed: false,
      };
    }

    // ── Demote the previous manager (if any) ───────────────────────────────────
    let previousManagerEmail: string | null = null;
    const oldTarget = wikiLinkTarget(currentManager);
    if (typeof currentManager === 'string' && currentManager.trim() !== '') {
      await addRelation(selfPath, 'previous_manager', currentManager, this._fs);
      if (oldTarget) {
        const oldManagerPath = path.resolve(path.dirname(selfPath), oldTarget);
        previousManagerEmail = path.basename(oldManagerPath, '.md');
        // Reciprocal cleanup on the old manager (no-op if the file is already gone).
        const selfLinkOnOldManager = formatWikiLink(selfPath, oldManagerPath, selfEmail);
        await removeRelation(oldManagerPath, 'direct_reports', selfLinkOnOldManager, this._fs);
      }
    }

    // ── Promote the new manager out of leadership[] (if listed there) ──────────
    await removeRelation(selfPath, 'leadership', newManagerLinkOnSelf, this._fs);

    // ── Set the new current_manager + reciprocal direct_reports ────────────────
    await setScalar(selfPath, 'current_manager', newManagerLinkOnSelf, this._fs);
    const selfLinkOnNewManager = formatWikiLink(selfPath, leaderPath, selfEmail);
    await addRelation(leaderPath, 'direct_reports', selfLinkOnNewManager, this._fs);

    return {
      selfPath,
      leaderPath,
      newManagerEmail: normalizedManager,
      previousManagerEmail,
      changed: true,
    };
  }
}

export const myselfService = new MyselfService(
  fileSystemService,
  emailResolutionService,
  templateService,
  sectionParserService,
);
