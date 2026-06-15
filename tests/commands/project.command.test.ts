import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// ── Mock declarations (must precede dynamic imports) ──────────────────────────

const mockGetWorkspaceRoot = jest.fn<() => string>().mockReturnValue('/fake/ws');

const mockAddProject = jest
  .fn<() => Promise<{ created: boolean }>>()
  .mockResolvedValue({ created: true });

const mockAddStandup = jest.fn<() => Promise<{ filePath: string }>>().mockResolvedValue({
  filePath:
    '/fake/ws/my-company/projects/platform-project/standups/2026-03-09-platform-project-standup.md',
});

const mockLinkMember = jest
  .fn<() => Promise<{ wikiLink: string; created: boolean }>>()
  .mockResolvedValue({
    wikiLink: '- [[../../my-teams/_members/alice@co.com/alice@co.com.md|alice@co.com]]',
    created: false,
  });

const mockLinkMembers = jest
  .fn<() => Promise<{ linked: number; created: number }>>()
  .mockResolvedValue({ linked: 2, created: 0 });

const mockLinkStakeholder = jest
  .fn<() => Promise<{ wikiLink: string; created: boolean }>>()
  .mockResolvedValue({
    wikiLink: '- [[../../my-company/relationships/s@co.com/s@co.com.md|s@co.com]]',
    created: false,
  });

const mockLinkStakeholders = jest
  .fn<() => Promise<{ linked: number; created: number }>>()
  .mockResolvedValue({ linked: 1, created: 1 });

const mockListProjects = jest
  .fn<
    () => Promise<
      { name: string; memberCount: number; stakeholderCount: number; needsMigration?: boolean }[]
    >
  >()
  .mockResolvedValue([]);

const mockSvcInstance = {
  getWorkspaceRoot: mockGetWorkspaceRoot,
  addProject: mockAddProject,
  addStandup: mockAddStandup,
  linkMember: mockLinkMember,
  linkMembers: mockLinkMembers,
  linkStakeholder: mockLinkStakeholder,
  linkStakeholders: mockLinkStakeholders,
  listProjects: mockListProjects,
};

jest.unstable_mockModule('../../src/services/project.service.js', () => ({
  ProjectService: jest.fn(() => mockSvcInstance),
  projectService: mockSvcInstance,
}));

const mockPrompt = jest.fn<() => Promise<Record<string, string>>>();
jest.unstable_mockModule('inquirer', () => ({
  default: { prompt: mockPrompt },
}));

jest.unstable_mockModule('chalk', () => ({
  default: {
    bold: (s: string) => s,
    green: (s: string) => s,
    dim: (s: string) => s,
    red: (s: string) => s,
    yellow: (s: string) => s,
  },
}));

jest.unstable_mockModule('node:child_process', () => ({
  exec: jest.fn(),
}));

// ── Dynamic imports (after mocks) ─────────────────────────────────────────────

const {
  runProjectAdd,
  runProjectStandup,
  runProjectLinkMember,
  runProjectLinkMembers,
  runProjectLinkStakeholder,
  runProjectLinkStakeholders,
  runProjectList,
} = await import('../../src/commands/project.command.js');

// ── Spy on stdout ─────────────────────────────────────────────────────────────

type SvcType = import('../../src/services/project.service.js').ProjectService;

let writeSpy: ReturnType<typeof jest.spyOn>;
let stderrSpy: ReturnType<typeof jest.spyOn>;

beforeEach(() => {
  jest.clearAllMocks();
  writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  writeSpy.mockRestore();
  stderrSpy.mockRestore();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('runProjectAdd', () => {
  it('calls addProject with provided name', async () => {
    await runProjectAdd(mockSvcInstance as unknown as SvcType, 'platform', {});
    expect(mockAddProject).toHaveBeenCalledWith('platform', '/fake/ws');
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('created'));
  });

  it('prints already-exists message when created: false', async () => {
    mockAddProject.mockResolvedValueOnce({ created: false });
    await runProjectAdd(mockSvcInstance as unknown as SvcType, 'platform', {});
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('already exists'));
  });

  it('prompts interactively when no name provided', async () => {
    mockPrompt.mockResolvedValueOnce({ resolvedName: 'auto-project' });
    await runProjectAdd(mockSvcInstance as unknown as SvcType, undefined, {});
    expect(mockPrompt).toHaveBeenCalled();
    expect(mockAddProject).toHaveBeenCalledWith('auto-project', '/fake/ws');
  });
});

describe('runProjectStandup', () => {
  it('calls addStandup and prints file path', async () => {
    await runProjectStandup(mockSvcInstance as unknown as SvcType, 'platform', { noEdit: true });
    expect(mockAddStandup).toHaveBeenCalledWith('platform', { noEdit: true }, '/fake/ws');
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('Created'));
  });

  it('sets exitCode and prints error when project not found', async () => {
    mockAddStandup.mockRejectedValueOnce(new Error("Project 'platform' not found"));
    await runProjectStandup(mockSvcInstance as unknown as SvcType, 'platform', {});
    expect(process.exitCode).toBe(1);
    const errOutput = (stderrSpy.mock.calls as unknown[][]).map((c) => String(c[0])).join('');
    expect(errOutput).toContain('not found');
  });

  it('sets exitCode when no name provided', async () => {
    await runProjectStandup(mockSvcInstance as unknown as SvcType, undefined, {});
    expect(process.exitCode).toBe(1);
    expect(mockAddStandup).not.toHaveBeenCalled();
  });

  it('9.13: forwards --date option through to addStandup', async () => {
    await runProjectStandup(mockSvcInstance as unknown as SvcType, 'platform', {
      date: '2026-05-20',
    });
    expect(mockAddStandup).toHaveBeenCalledWith('platform', { date: '2026-05-20' }, '/fake/ws');
  });
});

describe('runProjectLinkMember', () => {
  it('calls linkMember and prints wiki-link', async () => {
    await runProjectLinkMember(mockSvcInstance as unknown as SvcType, 'platform', 'alice@co.com');
    expect(mockLinkMember).toHaveBeenCalledWith('platform', 'alice@co.com', '/fake/ws');
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('Linked'));
  });

  it('prints auto-created message when created: true', async () => {
    mockLinkMember.mockResolvedValueOnce({ wikiLink: '- [[...]]', created: true });
    await runProjectLinkMember(mockSvcInstance as unknown as SvcType, 'platform', 'new@co.com');
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('Auto-created'));
  });

  it('sets exitCode when missing email', async () => {
    await runProjectLinkMember(mockSvcInstance as unknown as SvcType, 'platform', undefined);
    expect(process.exitCode).toBe(1);
  });

  it('sets exitCode on service error', async () => {
    mockLinkMember.mockRejectedValueOnce(new Error('not found'));
    await runProjectLinkMember(mockSvcInstance as unknown as SvcType, 'platform', 'a@co.com');
    expect(process.exitCode).toBe(1);
  });
});

describe('runProjectLinkMembers', () => {
  it('calls linkMembers with parsed email list', async () => {
    await runProjectLinkMembers(
      mockSvcInstance as unknown as SvcType,
      'platform',
      'a@co.com,b@co.com',
    );
    expect(mockLinkMembers).toHaveBeenCalledWith('platform', ['a@co.com', 'b@co.com'], '/fake/ws');
  });

  it('prints summary counts', async () => {
    await runProjectLinkMembers(
      mockSvcInstance as unknown as SvcType,
      'platform',
      'a@co.com,b@co.com',
    );
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('2 linked'));
  });

  it('sets exitCode when empty email list', async () => {
    await runProjectLinkMembers(mockSvcInstance as unknown as SvcType, 'platform', '');
    expect(process.exitCode).toBe(1);
  });
});

describe('runProjectLinkStakeholder', () => {
  it('calls linkStakeholder and prints wiki-link', async () => {
    await runProjectLinkStakeholder(mockSvcInstance as unknown as SvcType, 'platform', 's@co.com');
    expect(mockLinkStakeholder).toHaveBeenCalledWith('platform', 's@co.com', '/fake/ws');
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('Linked stakeholder'));
  });

  it('prints auto-created message when created: true', async () => {
    mockLinkStakeholder.mockResolvedValueOnce({ wikiLink: '- [[...]]', created: true });
    await runProjectLinkStakeholder(
      mockSvcInstance as unknown as SvcType,
      'platform',
      'new@co.com',
    );
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('Auto-created'));
  });
});

describe('runProjectLinkStakeholders', () => {
  it('calls linkStakeholders and prints summary', async () => {
    await runProjectLinkStakeholders(mockSvcInstance as unknown as SvcType, 'platform', 'a@co.com');
    expect(mockLinkStakeholders).toHaveBeenCalledWith('platform', ['a@co.com'], '/fake/ws');
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('1 linked'));
  });
});

describe('runProjectList', () => {
  it('prints no-projects message when list is empty', async () => {
    mockListProjects.mockResolvedValueOnce([]);
    await runProjectList(mockSvcInstance as unknown as SvcType);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('No projects'));
  });

  it('prints table header and rows when projects exist', async () => {
    mockListProjects.mockResolvedValueOnce([
      { name: 'platform', memberCount: 3, stakeholderCount: 2 },
      { name: 'mobile', memberCount: 1, stakeholderCount: 0 },
    ]);

    await runProjectList(mockSvcInstance as unknown as SvcType);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('Project'));
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('Members'));
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('platform'));
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('mobile'));
  });

  it('AC8: prints migration warning when any project needs migration', async () => {
    mockListProjects.mockResolvedValueOnce([
      { name: 'platform', memberCount: 0, stakeholderCount: 0, needsMigration: true },
    ]);

    await runProjectList(mockSvcInstance as unknown as SvcType);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('--fix-frontmatter'));
  });

  it('AC8: does not print migration warning when all projects are migrated', async () => {
    mockListProjects.mockResolvedValueOnce([
      { name: 'platform', memberCount: 1, stakeholderCount: 0, needsMigration: false },
    ]);

    await runProjectList(mockSvcInstance as unknown as SvcType);
    const calls = writeSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(calls.some((s: string) => s.includes('--fix-frontmatter'))).toBe(false);
  });
});
