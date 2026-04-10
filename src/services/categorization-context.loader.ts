import path from 'node:path';
import matter from 'gray-matter';
import type { CategorizationContext } from '../types/categorization.types.js';
import type { ITeamMemberFrontmatter } from '../types/team.types.js';
import type { FileSystemService } from './file-system.service.js';
import type { ProjectService } from './project.service.js';
import type { TeamService } from './team.service.js';

type Result<T> = { success: true; data: T } | { success: false; error: string };

function humanizeSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Builds lightweight `CategorizationContext` for AI prompts from workspace
 * team/project metadata (no full context file reads).
 */
export async function loadCategorizationContext(
  workspaceRoot: string,
  teamService: TeamService,
  projectService: ProjectService,
  fs: FileSystemService,
): Promise<Result<CategorizationContext>> {
  try {
    const teams = await teamService.listTeams(workspaceRoot);
    const byEmail = new Map<string, { email: string; name: string; team: string }>();

    for (const { teamName } of teams) {
      const members = await teamService.listTeamMembers(teamName, workspaceRoot);
      for (const m of members) {
        const email = m.email.toLowerCase();
        if (byEmail.has(email)) continue;

        const profilePath = path.join(workspaceRoot, 'my-teams', 'members', email, `${email}.md`);
        let displayName = email.split('@')[0] ?? email;
        try {
          const raw = await fs.readFile(profilePath);
          const { data } = matter(raw);
          const fm = data as Partial<ITeamMemberFrontmatter>;
          if (fm.name !== undefined && String(fm.name).trim().length > 0) {
            displayName = String(fm.name).trim();
          }
        } catch {
          // Missing profile — keep fallback name
        }

        byEmail.set(email, {
          email,
          name: displayName,
          team: teamName,
        });
      }
    }

    const projSummaries = await projectService.listProjects(workspaceRoot);
    const projects = projSummaries.map((p) => {
      const slug = p.name.replace(/-project$/i, '');
      return {
        name: slug,
        displayName: humanizeSlug(slug),
      };
    });

    return {
      success: true,
      data: {
        members: [...byEmail.values()],
        projects,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
