import path from 'node:path';
import { FileSystemService, fileSystemService } from './file-system.service.js';
import { EmailResolutionService, emailResolutionService } from './email-resolution.service.js';
import { TemplateService, templateService } from './template.service.js';
import { SectionParserService, sectionParserService } from './section-parser.service.js';
import { getWorkspaceRoot as resolveWorkspaceRoot } from '../utils/workspace.js';
import { ConfigurationError, ValidationError } from '../errors/tmr-error.js';
import { logger } from '../utils/logger.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().split('T')[0] as string;
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

    const content = this._template.getTemplate('performance-review', datePrefix, ownEmail);
    await this._fs.writeFile(filePath, content);

    const wikiLink = `- [[performance-reviews/${fileName}]]`;
    await this._sectionParser.appendToFile(profilePath, 'Performance Reviews', wikiLink);

    return { filePath, profilePath };
  }
}

export const myselfService = new MyselfService(
  fileSystemService,
  emailResolutionService,
  templateService,
  sectionParserService,
);
