/**
 * Unit tests for loadCategorizationContext — mocked TeamService, ProjectService, FileSystemService.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { loadCategorizationContext } from '../../src/services/categorization-context.loader.js';
import type { TeamService } from '../../src/services/team.service.js';
import type { ProjectService } from '../../src/services/project.service.js';
import type { FileSystemService } from '../../src/services/file-system.service.js';
import type { ITeamSummary } from '../../src/types/team.types.js';
import type { IMemberSummary } from '../../src/types/team.types.js';
import type { IProjectSummary } from '../../src/types/project.types.js';

describe('loadCategorizationContext', () => {
  let teamService: {
    listTeams: jest.MockedFunction<TeamService['listTeams']>;
    listTeamMembers: jest.MockedFunction<TeamService['listTeamMembers']>;
  };
  let projectService: { listProjects: jest.MockedFunction<ProjectService['listProjects']> };
  let fs: { readFile: jest.MockedFunction<FileSystemService['readFile']> };

  beforeEach(() => {
    teamService = {
      listTeams: jest.fn(),
      listTeamMembers: jest.fn(),
    };
    projectService = {
      listProjects: jest.fn(),
    };
    fs = {
      readFile: jest.fn(),
    };
  });

  it('aggregates members (profile name) and projects (slug)', async () => {
    teamService.listTeams.mockResolvedValue([
      { teamName: 'alpha', memberCount: 1 },
    ] as ITeamSummary[]);
    teamService.listTeamMembers.mockResolvedValue([
      { email: 'alice@co.com', role: 'IC', location: '', dateAdded: '2026-01-01' },
    ] as IMemberSummary[]);
    fs.readFile.mockResolvedValue('---\nname: Alice Carrol\n---\n');

    projectService.listProjects.mockResolvedValue([
      { name: 'rocket-ship-project', memberCount: 0, stakeholderCount: 0 },
    ] as IProjectSummary[]);

    const r = await loadCategorizationContext(
      '/ws',
      teamService as unknown as TeamService,
      projectService as unknown as ProjectService,
      fs as unknown as FileSystemService,
    );

    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.members).toEqual([
      { email: 'alice@co.com', name: 'Alice Carrol', team: 'alpha' },
    ]);
    expect(r.data.projects).toEqual([{ name: 'rocket-ship', displayName: 'Rocket Ship' }]);
  });

  it('returns error when listTeams throws', async () => {
    teamService.listTeams.mockRejectedValue(new Error('disk'));

    const r = await loadCategorizationContext(
      '/ws',
      teamService as unknown as TeamService,
      projectService as unknown as ProjectService,
      fs as unknown as FileSystemService,
    );

    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error).toContain('disk');
  });
});
