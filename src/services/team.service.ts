import path from 'node:path';
import matter from 'gray-matter';
import { FileSystemService, fileSystemService } from './file-system.service.js';
import { getWorkspaceRoot as resolveWorkspaceRoot } from '../utils/workspace.js';
import type {
  IAddMemberOptions,
  IArchiveOptions,
  IMemberSummary,
  IProfileResult,
  ITeamMemberFrontmatter,
  ITeamSummary,
} from '../types/team.types.js';

// ── Path helpers ──────────────────────────────────────────────────────────────

function membersRoot(ws: string): string {
  return path.join(ws, 'my-teams', '_members');
}

function teamsRoot(ws: string): string {
  return path.join(ws, 'my-teams', '_teams');
}

function archivedRoot(ws: string): string {
  return path.join(ws, 'my-teams', '_archived');
}

function memberDir(ws: string, email: string): string {
  return path.join(membersRoot(ws), email);
}

function memberProfilePath(ws: string, email: string): string {
  return path.join(memberDir(ws, email), `${email}.md`);
}

function teamDir(ws: string, teamName: string): string {
  return path.join(teamsRoot(ws), teamName);
}

function teamContextPath(ws: string, teamName: string): string {
  return path.join(teamDir(ws, teamName), `${teamName}-context.md`);
}

function teamMembersPath(ws: string, teamName: string): string {
  return path.join(teamDir(ws, teamName), `${teamName}-members.md`);
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0] as string;
}

// ── Templates ─────────────────────────────────────────────────────────────────

function buildContextMd(teamName: string): string {
  const displayName = teamName.charAt(0).toUpperCase() + teamName.slice(1);
  return `---
team: ${teamName}
created: ${todayIso()}
---

# Team: ${displayName}

## Team Mission

## Team Goals

## Team Norms

## Notes
`;
}

function buildMembersMd(): string {
  return '# Team Members\n';
}

function buildMemberProfileMd(
  email: string,
  role: string,
  location: string,
  teams: string[],
  managerEmail: string | null,
): string {
  const teamsYaml = teams.map((t) => `  - ${t}`).join('\n');
  const managerLink = managerEmail ? `[[my-career/${managerEmail}.md]]` : '';

  return `---
email: ${email}
role: ${role}
location: ${location}
teams:
${teamsYaml}
date_added: ${todayIso()}
---

## Current Manager

${managerLink}

## Previous Managers

## Other Leaderships

## Previous Leaderships

## Performance Reviews

## 1on1s

## Assessments

## Feedbacks
`;
}

function buildWikiLink(email: string): string {
  return `- [[../../_members/${email}/${email}.md|${email}]]`;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class TeamService {
  constructor(private readonly _fs: FileSystemService) {}

  getWorkspaceRoot(): string {
    return resolveWorkspaceRoot();
  }

  async getManagerEmail(workspaceRoot: string): Promise<string | null> {
    const profilePath = path.join(workspaceRoot, 'my-career', 'profile.md');
    if (!(await this._fs.exists(profilePath))) return null;
    const content = await this._fs.readFile(profilePath);
    const { data } = matter(content);
    return (data['email'] as string | undefined) ?? null;
  }

  async createTeam(teamName: string, workspaceRoot: string): Promise<void> {
    const contextPath = teamContextPath(workspaceRoot, teamName);
    const membersPath = teamMembersPath(workspaceRoot, teamName);

    // Idempotent: skip if already exists
    if (await this._fs.exists(contextPath)) return;

    await this._fs.writeFile(contextPath, buildContextMd(teamName));
    await this._fs.writeFile(membersPath, buildMembersMd());
  }

  async addMember(
    teamName: string,
    email: string,
    options: IAddMemberOptions,
    workspaceRoot: string,
  ): Promise<void> {
    const normalizedEmail = email.toLowerCase();
    const role = options.role ?? '';
    const location = options.location ?? '';

    // Auto-create team if needed
    await this.createTeam(teamName, workspaceRoot);

    const profilePath = memberProfilePath(workspaceRoot, normalizedEmail);
    const memberExists = await this._fs.exists(profilePath);

    if (memberExists) {
      // Member already belongs to another team — append team to their list
      const content = await this._fs.readFile(profilePath);
      const parsed = matter(content);
      const existing = parsed.data as Partial<ITeamMemberFrontmatter>;
      const teams: string[] = Array.isArray(existing.teams) ? existing.teams : [];
      if (!teams.includes(teamName)) {
        teams.push(teamName);
        existing.teams = teams;
        const updated = matter.stringify(parsed.content, existing);
        await this._fs.writeFile(profilePath, updated);
      }
    } else {
      // New member — create full directory + profile
      const managerEmail = await this.getManagerEmail(workspaceRoot);
      const profileMd = buildMemberProfileMd(
        normalizedEmail,
        role,
        location,
        [teamName],
        managerEmail,
      );

      await this._fs.createDirectory(path.join(memberDir(workspaceRoot, normalizedEmail), '1on1s'));
      await this._fs.createDirectory(
        path.join(memberDir(workspaceRoot, normalizedEmail), 'feedback'),
      );
      await this._fs.createDirectory(
        path.join(memberDir(workspaceRoot, normalizedEmail), 'assessments'),
      );
      await this._fs.createDirectory(
        path.join(memberDir(workspaceRoot, normalizedEmail), 'performance-reviews'),
      );
      await this._fs.writeFile(profilePath, profileMd);
    }

    // Append wiki-link to team members file
    const membersPath = teamMembersPath(workspaceRoot, teamName);
    const wikiLink = buildWikiLink(normalizedEmail);
    const currentMembers = await this._fs.readFile(membersPath);

    // Avoid duplicate links
    if (!currentMembers.includes(wikiLink)) {
      await this._fs.appendFile(membersPath, `${wikiLink}\n`);
    }
  }

  async listTeams(workspaceRoot: string): Promise<ITeamSummary[]> {
    const root = teamsRoot(workspaceRoot);
    if (!(await this._fs.exists(root))) return [];

    const teamNames = await this._fs.listDirectories(root);

    const summaries: ITeamSummary[] = [];
    for (const teamName of teamNames) {
      const membersPath = teamMembersPath(workspaceRoot, teamName);
      let memberCount = 0;
      if (await this._fs.exists(membersPath)) {
        const content = await this._fs.readFile(membersPath);
        memberCount = (content.match(/^\s*-\s+\[\[/gm) ?? []).length;
      }
      summaries.push({ teamName, memberCount });
    }
    return summaries;
  }

  async listTeamMembers(teamName: string, workspaceRoot: string): Promise<IMemberSummary[]> {
    const membersPath = teamMembersPath(workspaceRoot, teamName);
    if (!(await this._fs.exists(membersPath))) return [];

    const content = await this._fs.readFile(membersPath);
    // Capture the display text after '|' which is the email address (no .md extension)
    const emailMatches = [...content.matchAll(/\[\[.*?\|([^\]]+)\]\]/g)];
    const emails = emailMatches.map((m) => m[1] as string);

    const summaries: IMemberSummary[] = [];
    for (const email of emails) {
      const profilePath = memberProfilePath(workspaceRoot, email);
      if (!(await this._fs.exists(profilePath))) continue;
      const profileContent = await this._fs.readFile(profilePath);
      const { data } = matter(profileContent);
      const fm = data as Partial<ITeamMemberFrontmatter>;
      summaries.push({
        email,
        role: fm.role ?? '',
        location: fm.location ?? '',
        dateAdded: fm.date_added ?? '',
      });
    }
    return summaries;
  }

  async archiveMember(
    teamName: string,
    email: string,
    options: IArchiveOptions,
    workspaceRoot: string,
  ): Promise<void> {
    const normalizedEmail = email.toLowerCase();
    const srcDir = memberDir(workspaceRoot, normalizedEmail);

    if (!(await this._fs.exists(srcDir))) {
      throw new Error(`Member ${normalizedEmail} not found in _members/`);
    }

    const year = new Date().getFullYear().toString();
    const destDir = path.join(archivedRoot(workspaceRoot), year, normalizedEmail);

    const hasDateFilter = options.from !== undefined || options.to !== undefined;

    if (hasDateFilter) {
      // Partial archive: move only files in subdirectories matching the date range
      // Use FileSystemService.listFiles() for each known subdirectory
      const subDirs = ['1on1s', 'feedback', 'assessments', 'performance-reviews'];
      for (const subDir of subDirs) {
        const subPath = path.join(srcDir, subDir);
        if (!(await this._fs.exists(subPath))) continue;

        const files = await this._fs.listFiles(subPath);
        for (const filePath of files) {
          const fileName = path.basename(filePath);
          const dateMatch = fileName.match(/^(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) {
            const fileDate = dateMatch[1] as string;
            if (options.from && fileDate < options.from) continue;
            if (options.to && fileDate > options.to) continue;
          }
          const rel = path.relative(srcDir, filePath);
          const fullDest = path.join(destDir, rel);
          await this._fs.moveFile(filePath, fullDest);
        }
      }
    } else {
      // Full archive: move entire directory
      await this._fs.moveFile(srcDir, destDir);
    }

    // Update frontmatter in the archived profile
    const archivedProfile = path.join(destDir, `${normalizedEmail}.md`);
    if (await this._fs.exists(archivedProfile)) {
      const content = await this._fs.readFile(archivedProfile);
      const parsed = matter(content);
      const fm = parsed.data as ITeamMemberFrontmatter;
      fm.archived = true;
      fm.archived_date = todayIso();
      await this._fs.writeFile(archivedProfile, matter.stringify(parsed.content, fm));
    }

    // Remove wiki-link from team members file
    await this._removeWikiLink(teamName, normalizedEmail, workspaceRoot);
  }

  async fireMember(teamName: string, email: string, workspaceRoot: string): Promise<void> {
    const normalizedEmail = email.toLowerCase();
    await this.archiveMember(teamName, normalizedEmail, {}, workspaceRoot);

    const year = new Date().getFullYear().toString();
    const archivedProfile = path.join(
      archivedRoot(workspaceRoot),
      year,
      normalizedEmail,
      `${normalizedEmail}.md`,
    );

    if (await this._fs.exists(archivedProfile)) {
      const content = await this._fs.readFile(archivedProfile);
      const parsed = matter(content);
      const fm = parsed.data as ITeamMemberFrontmatter;
      fm.termination = true;
      fm.termination_date = todayIso();
      await this._fs.writeFile(archivedProfile, matter.stringify(parsed.content, fm));
    }
  }

  async showProfile(email: string, workspaceRoot: string): Promise<IProfileResult | null> {
    const normalizedEmail = email.toLowerCase();

    // 1. Active team member
    const memberPath = memberProfilePath(workspaceRoot, normalizedEmail);
    if (await this._fs.exists(memberPath)) {
      return {
        location: 'member',
        filePath: memberPath,
        content: await this._fs.readFile(memberPath),
      };
    }

    // 2. Archived member (iterate year subdirectories via FileSystemService)
    const archRoot = archivedRoot(workspaceRoot);
    if (await this._fs.exists(archRoot)) {
      const years = await this._fs.listDirectories(archRoot);
      for (const year of years) {
        const archivedPath = path.join(archRoot, year, normalizedEmail, `${normalizedEmail}.md`);
        if (await this._fs.exists(archivedPath)) {
          return {
            location: 'archived',
            filePath: archivedPath,
            content: await this._fs.readFile(archivedPath),
          };
        }
      }
    }

    // 3. Leadership
    const leadershipPath = path.join(
      workspaceRoot,
      'my-leadership',
      normalizedEmail,
      `${normalizedEmail}.md`,
    );
    if (await this._fs.exists(leadershipPath)) {
      return {
        location: 'leadership',
        filePath: leadershipPath,
        content: await this._fs.readFile(leadershipPath),
      };
    }

    // 4. Relationship
    const relationshipPath = path.join(
      workspaceRoot,
      'my-company',
      'relationships',
      normalizedEmail,
      `${normalizedEmail}.md`,
    );
    if (await this._fs.exists(relationshipPath)) {
      return {
        location: 'relationship',
        filePath: relationshipPath,
        content: await this._fs.readFile(relationshipPath),
      };
    }

    return null;
  }

  private async _removeWikiLink(
    teamName: string,
    email: string,
    workspaceRoot: string,
  ): Promise<void> {
    const membersPath = teamMembersPath(workspaceRoot, teamName);
    if (!(await this._fs.exists(membersPath))) return;

    const content = await this._fs.readFile(membersPath);
    const wikiLink = buildWikiLink(email);
    const updated = content
      .split('\n')
      .filter((line) => line.trim() !== wikiLink.trim())
      .join('\n');
    await this._fs.writeFile(membersPath, updated);
  }
}

export const teamService = new TeamService(fileSystemService);
