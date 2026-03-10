import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// ── Mock declarations (must precede dynamic imports) ──────────────────────────

const mockGetWorkspaceRoot = jest.fn<() => string>().mockReturnValue('/fake/ws');

const mockAddProject = jest
  .fn<() => Promise<{ created: boolean }>>()
  .mockResolvedValue({ created: true });

const mockAddStandup = jest
  .fn<() => Promise<{ filePath: string }>>()
  .mockResolvedValue({
    filePath: '/fake/ws/my-projects/platform/standup/2026-03-09-platform-standup.md',
  });

const mockAddDiscussion = jest
  .fn<() => Promise<{ filePath: string }>>()
  .mockResolvedValue({
    filePath: '/fake/ws/my-projects/platform/discussion/2026-03-09-platform-discussion.md',
  });

const mockAddPresentation = jest
  .fn<() => Promise<{ filePath: string }>>()
  .mockResolvedValue({
    filePath: '/fake/ws/my-projects/platform/presentation/2026-03-09-platform-presentation-q1.md',
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
  .fn<() => Promise<{ name: string; memberCount: number; stakeholderCount: number }[]>>()
  .mockResolvedValue([]);

const mockSvcInstance = {
  getWorkspaceRoot: mockGetWorkspaceRoot,
  addProject: mockAddProject,
  addStandup: mockAddStandup,
  addDiscussion: mockAddDiscussion,
  addPresentation: mockAddPresentation,
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
  },
}));

jest.unstable_mockModule('node:child_process', () => ({
  exec: jest.fn(),
}));

// ── Dynamic imports (after mocks) ─────────────────────────────────────────────

const {
  runProjectAdd,
  runProjectStandup,
  runProjectDiscussion,
  runProjectPresentation,
  runProjectLinkMember,
  runProjectLinkMembers,
  runProjectLinkStakeholder,
  runProjectLinkStakeholders,
  runProjectList,
} = await import('../../src/commands/project.command.js');

// ── Spy on stdout ─────────────────────────────────────────────────────────────

type SvcType = import('../../src/services/project.service.js').ProjectService;

let writeSpy: ReturnType<typeof jest.spyOn>;

beforeEach(() => {
  jest.clearAllMocks();
  writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
  writeSpy.mockRestore();
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
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
  });

  it('sets exitCode when no name provided', async () => {
    await runProjectStandup(mockSvcInstance as unknown as SvcType, undefined, {});
    expect(process.exitCode).toBe(1);
    expect(mockAddStandup).not.toHaveBeenCalled();
  });
});

describe('runProjectDiscussion', () => {
  it('calls addDiscussion and prints file path', async () => {
    await runProjectDiscussion(mockSvcInstance as unknown as SvcType, 'platform', { noEdit: true });
    expect(mockAddDiscussion).toHaveBeenCalledWith('platform', { noEdit: true }, '/fake/ws');
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('Created'));
  });

  it('sets exitCode when project not found', async () => {
    mockAddDiscussion.mockRejectedValueOnce(new Error("Project 'platform' not found"));
    await runProjectDiscussion(mockSvcInstance as unknown as SvcType, 'platform', {});
    expect(process.exitCode).toBe(1);
  });
});

describe('runProjectPresentation', () => {
  it('calls addPresentation with provided topic', async () => {
    await runProjectPresentation(mockSvcInstance as unknown as SvcType, 'platform', {
      topic: 'Q1 Review',
      noEdit: true,
    });
    expect(mockAddPresentation).toHaveBeenCalledWith(
      'platform',
      'Q1 Review',
      expect.any(Object),
      '/fake/ws',
    );
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('Created'));
  });

  it('prompts for topic when not provided', async () => {
    mockPrompt.mockResolvedValueOnce({ resolvedTopic: 'My Topic' });
    await runProjectPresentation(mockSvcInstance as unknown as SvcType, 'platform', {
      noEdit: true,
    });
    expect(mockPrompt).toHaveBeenCalled();
    expect(mockAddPresentation).toHaveBeenCalledWith(
      'platform',
      'My Topic',
      expect.any(Object),
      '/fake/ws',
    );
  });

  it('sets exitCode when project not found', async () => {
    mockAddPresentation.mockRejectedValueOnce(new Error("Project 'platform' not found"));
    await runProjectPresentation(mockSvcInstance as unknown as SvcType, 'platform', {
      topic: 'T',
      noEdit: true,
    });
    expect(process.exitCode).toBe(1);
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
});
