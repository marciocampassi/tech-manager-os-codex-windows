import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// ── Mock declarations (must precede dynamic imports) ──────────────────────────

const mockGetWorkspaceRoot = jest.fn<() => string>().mockReturnValue('/fake/ws');
const mockAddRelationship = jest
  .fn<() => Promise<{ created: boolean }>>()
  .mockResolvedValue({ created: true });
const mockAddBatch = jest
  .fn<() => Promise<{ created: number; existed: number }>>()
  .mockResolvedValue({ created: 2, existed: 1 });
const mockAdd1on1 = jest
  .fn<() => Promise<{ filePath: string; profilePath: string; wikiLink: string }>>()
  .mockResolvedValue({
    filePath: '/fake/ws/my-company/members/alice@co.com/1on1s/2026-03-07-alice@co.com-1on1.md',
    profilePath: '/fake/ws/my-company/members/alice@co.com/alice@co.com.md',
    wikiLink: '- [[1on1s/2026-03-07-alice@co.com-1on1.md]]',
  });
const mockListRelationships = jest
  .fn<
    () => Promise<
      {
        email: string;
        name: string;
        department: string;
        relationship_type: string;
        lastInteraction: string;
      }[]
    >
  >()
  .mockResolvedValue([]);
const mockFindRelationship = jest.fn<() => Promise<null>>().mockResolvedValue(null);

const mockSvcInstance = {
  getWorkspaceRoot: mockGetWorkspaceRoot,
  addRelationship: mockAddRelationship,
  addBatch: mockAddBatch,
  add1on1: mockAdd1on1,
  listRelationships: mockListRelationships,
  findRelationship: mockFindRelationship,
};

jest.unstable_mockModule('../../src/services/relationship.service.js', () => ({
  RelationshipService: jest.fn(() => mockSvcInstance),
  relationshipService: mockSvcInstance,
}));

// Mock project service to avoid real file system calls from optional project linking
const mockAddProject = jest
  .fn<() => Promise<{ created: boolean }>>()
  .mockResolvedValue({ created: false });
const mockLinkMember = jest
  .fn<() => Promise<{ wikiLink: string; created: boolean }>>()
  .mockResolvedValue({ wikiLink: '[[fake]]', created: false });

jest.unstable_mockModule('../../src/services/project.service.js', () => ({
  ProjectService: jest.fn(),
  projectService: {
    addProject: mockAddProject,
    linkMember: mockLinkMember,
    getWorkspaceRoot: jest.fn(() => '/fake/ws'),
  },
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

// Dynamic imports after mocks
const { createRelationshipCommand, runRelationshipAdd, runRelationship1on1, runRelationshipList } =
  await import('../../src/commands/relationship.command.js');

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('relationship command', () => {
  let stdoutSpy: ReturnType<typeof jest.spyOn>;
  let stderrSpy: ReturnType<typeof jest.spyOn>;
  let exitCodeSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    exitCodeSpy = jest.spyOn(process, 'exitCode', 'set').mockImplementation(() => {});
    jest.clearAllMocks();
    mockGetWorkspaceRoot.mockReturnValue('/fake/ws');
    mockAddRelationship.mockResolvedValue({ created: true });
    // Default: no project linking (skip prompt)
    mockPrompt.mockResolvedValue({ projectName: '' });
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    exitCodeSpy.mockRestore();
  });

  // ── add — single ──────────────────────────────────────────────────────────────

  describe('tmr relationship add <email>', () => {
    it('calls addRelationship for a single email', async () => {
      mockPrompt.mockResolvedValue({ projectName: '' });

      const cmd = createRelationshipCommand();
      await cmd.parseAsync(['add', 'alice@co.com'], { from: 'user' });

      expect(mockAddRelationship).toHaveBeenCalledWith(
        'alice@co.com',
        expect.any(Object),
        '/fake/ws',
      );
    });

    it('prints created message when new', async () => {
      mockPrompt.mockResolvedValue({ projectName: '' });
      await runRelationshipAdd(mockSvcInstance as never, 'alice@co.com', {});
      const output = stdoutSpy.mock.calls.map((c: unknown[]) => c[0]).join('');
      expect(output).toContain('created');
    });

    it('prints already-exists message when not new', async () => {
      mockPrompt.mockResolvedValue({ projectName: '' });
      mockAddRelationship.mockResolvedValueOnce({ created: false });
      await runRelationshipAdd(mockSvcInstance as never, 'alice@co.com', {});
      const output = stdoutSpy.mock.calls.map((c: unknown[]) => c[0]).join('');
      expect(output).toContain('already exists');
    });

    it('passes --name and --type options to service', async () => {
      mockPrompt.mockResolvedValue({ projectName: '' });

      const cmd = createRelationshipCommand();
      await cmd.parseAsync(['add', 'alice@co.com', '--name', 'Alice', '--type', 'collaborator'], {
        from: 'user',
      });

      expect(mockAddRelationship).toHaveBeenCalledWith(
        'alice@co.com',
        expect.objectContaining({ name: 'Alice', relationship_type: 'collaborator' }),
        '/fake/ws',
      );
    });

    it('prompts for optional project linking and links when name provided', async () => {
      mockPrompt.mockResolvedValueOnce({ projectName: 'my-project' });

      await runRelationshipAdd(mockSvcInstance as never, 'alice@co.com', {});

      expect(mockAddProject).toHaveBeenCalled();
      expect(mockLinkMember).toHaveBeenCalled();
    });

    it('skips project linking when prompt is empty', async () => {
      mockPrompt.mockResolvedValue({ projectName: '' });

      await runRelationshipAdd(mockSvcInstance as never, 'alice@co.com', {});

      expect(mockAddProject).not.toHaveBeenCalled();
      expect(mockLinkMember).not.toHaveBeenCalled();
    });
  });

  // ── add — batch ───────────────────────────────────────────────────────────────

  describe('tmr relationship add <email-list> (batch)', () => {
    it('calls addBatch when comma-separated emails provided', async () => {
      await runRelationshipAdd(
        mockSvcInstance as never,
        'alice@co.com,bob@co.com,carol@co.com',
        {},
      );

      expect(mockAddBatch).toHaveBeenCalledWith(
        ['alice@co.com', 'bob@co.com', 'carol@co.com'],
        expect.any(Object),
        '/fake/ws',
      );
    });

    it('prints batch summary', async () => {
      mockAddBatch.mockResolvedValueOnce({ created: 2, existed: 1 });
      await runRelationshipAdd(
        mockSvcInstance as never,
        'alice@co.com,bob@co.com,carol@co.com',
        {},
      );
      const output = stdoutSpy.mock.calls.map((c: unknown[]) => c[0]).join('');
      expect(output).toContain('2 created');
      expect(output).toContain('1 already existed');
    });
  });

  // ── add — interactive ─────────────────────────────────────────────────────────

  describe('interactive mode', () => {
    it('prompts for email and metadata when no email provided', async () => {
      mockPrompt
        .mockResolvedValueOnce({
          email: 'alice@co.com',
          name: 'Alice',
          role: 'PM',
          department: 'Product',
          relationship_type: 'collaborator',
        } as Record<string, string>)
        .mockResolvedValueOnce({ projectName: '' });

      await runRelationshipAdd(mockSvcInstance as never, undefined, {});

      expect(mockPrompt).toHaveBeenCalled();
      expect(mockAddRelationship).toHaveBeenCalledWith(
        'alice@co.com',
        expect.any(Object),
        '/fake/ws',
      );
    });
  });

  // ── 1on1 ─────────────────────────────────────────────────────────────────────

  describe('tmr relationship 1on1 <email>', () => {
    it('calls add1on1 with email and options', async () => {
      const cmd = createRelationshipCommand();
      await cmd.parseAsync(['1on1', 'alice@co.com', '--date', '2026-03-07'], { from: 'user' });

      expect(mockAdd1on1).toHaveBeenCalledWith(
        'alice@co.com',
        expect.objectContaining({ date: '2026-03-07' }),
        '/fake/ws',
      );
    });

    it('prints success output', async () => {
      await runRelationship1on1(mockSvcInstance as never, 'alice@co.com', {});
      const output = stdoutSpy.mock.calls.map((c: unknown[]) => c[0]).join('');
      expect(output).toContain('Created:');
    });

    it('prints error and sets exitCode when relationship not found', async () => {
      mockAdd1on1.mockRejectedValueOnce(
        new Error(
          "Relationship 'alice@co.com' not found. Run 'tmr relationship add alice@co.com' first.",
        ),
      );
      await runRelationship1on1(mockSvcInstance as never, 'alice@co.com', {});

      const errOutput = stderrSpy.mock.calls.map((c: unknown[]) => c[0]).join('');
      expect(errOutput).toContain('not found');
      expect(exitCodeSpy).toHaveBeenCalledWith(1);
    });

    it('prompts for email when not provided', async () => {
      mockPrompt.mockResolvedValueOnce({ resolvedEmail: 'alice@co.com' } as Record<string, string>);
      await runRelationship1on1(mockSvcInstance as never, undefined, {});
      expect(mockPrompt).toHaveBeenCalled();
      expect(mockAdd1on1).toHaveBeenCalledWith('alice@co.com', expect.any(Object), '/fake/ws');
    });
  });

  // ── list ──────────────────────────────────────────────────────────────────────

  describe('tmr relationship list', () => {
    it('prints empty message when no relationships', async () => {
      mockListRelationships.mockResolvedValueOnce([]);
      await runRelationshipList(mockSvcInstance as never);
      const output = stdoutSpy.mock.calls.map((c: unknown[]) => c[0]).join('');
      expect(output).toContain('No relationships found');
    });

    it('prints table rows when relationships exist', async () => {
      mockListRelationships.mockResolvedValueOnce([
        {
          email: 'alice@co.com',
          name: 'Alice',
          department: 'Product',
          relationship_type: 'collaborator',
          lastInteraction: '2026-03-07',
        },
      ]);
      await runRelationshipList(mockSvcInstance as never);
      const output = stdoutSpy.mock.calls.map((c: unknown[]) => c[0]).join('');
      expect(output).toContain('alice@co.com');
      expect(output).toContain('2026-03-07');
    });
  });
});
