import path from 'node:path';
import { FileSystemService, fileSystemService } from './file-system.service.js';
import { SectionParserService, sectionParserService } from './section-parser.service.js';
import { TemplateService, templateService } from './template.service.js';
import { configService } from './config.service.js';
import {
  FILE_TYPE_CONFIG,
  type FileType,
  type ICreateFileOptions,
  type ICreateFileResult,
} from '../types/member.types.js';

// ── Path helpers ──────────────────────────────────────────────────────────────

function membersRoot(ws: string): string {
  return path.join(ws, 'my-teams', '_members');
}

function memberDir(ws: string, email: string): string {
  return path.join(membersRoot(ws), email);
}

function memberProfilePath(ws: string, email: string): string {
  return path.join(memberDir(ws, email), `${email}.md`);
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0] as string;
}

// ── MemberService ─────────────────────────────────────────────────────────────

export class MemberService {
  constructor(
    private readonly _fs: FileSystemService,
    private readonly _sectionParser: SectionParserService,
    private readonly _template: TemplateService,
  ) {}

  getWorkspaceRoot(): string {
    return configService.getWorkspacePath() ?? process.cwd();
  }

  /**
   * Returns the member profile path if the member exists, null otherwise.
   */
  async findMember(email: string, workspaceRoot: string): Promise<string | null> {
    const profilePath = memberProfilePath(workspaceRoot, email.toLowerCase());
    const exists = await this._fs.exists(profilePath);
    return exists ? profilePath : null;
  }

  /**
   * Creates a dated member file (1on1, feedback, assessment, performance-review),
   * then appends its wiki-link to the corresponding section in the member profile.
   */
  async createMemberFile(
    email: string,
    type: FileType,
    options: ICreateFileOptions,
    workspaceRoot: string,
  ): Promise<ICreateFileResult> {
    const normalizedEmail = email.toLowerCase();
    const date = options.date ?? todayIso();
    const config = FILE_TYPE_CONFIG[type];

    const profilePath = memberProfilePath(workspaceRoot, normalizedEmail);
    const memberExists = await this._fs.exists(profilePath);
    if (!memberExists) {
      throw new Error(
        `Member '${normalizedEmail}' not found. Run 'tmr team add <team> ${normalizedEmail}' first.`,
      );
    }

    const subDirPath = path.join(memberDir(workspaceRoot, normalizedEmail), config.subDir);
    await this._fs.createDirectory(subDirPath);

    const fileName = `${date}-${normalizedEmail}-${config.fileSuffix}.md`;
    const filePath = path.join(subDirPath, fileName);

    const content = this._template.getTemplate(type, date, normalizedEmail);
    await this._fs.writeFile(filePath, content);

    const wikiLink = `- [[${config.subDir}/${fileName}]]`;
    await this._sectionParser.appendToFile(profilePath, config.sectionName, wikiLink);

    return { filePath, profilePath, wikiLink };
  }
}

export const memberService = new MemberService(
  fileSystemService,
  sectionParserService,
  templateService,
);
