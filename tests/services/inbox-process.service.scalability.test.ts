/**
 * Scalability test: InboxProcessService.run() must handle 25+ inbox files
 * without degradation in the non-AI pipeline (O(n) scan, match, organize).
 *
 * All AI and filesystem dependencies are mocked so the test measures only the
 * pipeline orchestration overhead, which must stay well under 2 seconds.
 *
 * AC: Story 5.3 AC2 — tmr process handles 20+ inbox files without degradation
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import os from 'node:os';
import path from 'node:path';

const MOCK_WORKSPACE = path.join(os.tmpdir(), 'tmr-scalability-mock');

const FILE_COUNT = 25;

// ── ESM mocks (must precede dynamic imports) ─────────────────────────────────

const mockScanInbox = jest.fn<() => Promise<unknown>>();
const mockCategorize = jest.fn<() => Promise<unknown>>();
const mockUpdateContext = jest.fn<() => Promise<unknown>>();
const mockUpdateProjectContext = jest.fn<() => Promise<unknown>>();
const mockExtractTasks = jest.fn<() => Promise<unknown>>();
const mockOrganizeFile = jest.fn<() => Promise<unknown>>();
const mockLoadCategorizationContext = jest.fn<() => Promise<unknown>>();

jest.unstable_mockModule('../../src/services/inbox.service.js', () => ({
  InboxService: jest.fn().mockImplementation(() => ({
    scanInbox: mockScanInbox,
  })),
}));

jest.unstable_mockModule('../../src/services/categorization.service.js', () => ({
  CategorizationService: jest.fn().mockImplementation(() => ({
    categorize: mockCategorize,
  })),
}));

jest.unstable_mockModule('../../src/services/context.service.js', () => ({
  ContextService: jest.fn().mockImplementation(() => ({
    updateContext: mockUpdateContext,
    updateProjectContext: mockUpdateProjectContext,
  })),
}));

jest.unstable_mockModule('../../src/services/task.service.js', () => ({
  TaskService: jest.fn().mockImplementation(() => ({
    extractTasks: mockExtractTasks,
  })),
}));

jest.unstable_mockModule('../../src/services/file-organization.service.js', () => ({
  FileOrganizationService: jest.fn().mockImplementation(() => ({
    organizeFile: mockOrganizeFile,
  })),
}));

jest.unstable_mockModule('../../src/services/file-system.service.js', () => ({
  FileSystemService: jest.fn().mockImplementation(() => ({})),
  fileSystemService: {},
  FileSystemError: class FileSystemError extends Error {},
}));

jest.unstable_mockModule('../../src/services/team.service.js', () => ({
  TeamService: jest.fn().mockImplementation(() => ({})),
  teamService: {},
}));

jest.unstable_mockModule('../../src/services/project.service.js', () => ({
  ProjectService: jest.fn().mockImplementation(() => ({})),
  projectService: {},
}));

jest.unstable_mockModule('../../src/services/categorization-context.loader.js', () => ({
  loadCategorizationContext: mockLoadCategorizationContext,
}));

// ── Dynamic imports (after mocks) ────────────────────────────────────────────

const { InboxProcessService } = await import('../../src/services/inbox-process.service.js');
const { InboxService } = await import('../../src/services/inbox.service.js');
const { CategorizationService } = await import('../../src/services/categorization.service.js');
const { ContextService } = await import('../../src/services/context.service.js');
const { TaskService } = await import('../../src/services/task.service.js');
const { FileOrganizationService } = await import('../../src/services/file-organization.service.js');
const { FileSystemService, fileSystemService } =
  await import('../../src/services/file-system.service.js');
const { teamService } = await import('../../src/services/team.service.js');
const { projectService } = await import('../../src/services/project.service.js');

// ── Test helpers ──────────────────────────────────────────────────────────────

function buildService(): InstanceType<typeof InboxProcessService> {
  return new InboxProcessService(
    new InboxService(fileSystemService as never),
    new CategorizationService(null as never, 0.8),
    new ContextService(fileSystemService as never, null as never),
    new TaskService(null as never, fileSystemService as never),
    new FileOrganizationService(fileSystemService as never),
    teamService as never,
    projectService as never,
    fileSystemService as never,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('InboxProcessService — scalability (25 files, mocked pipeline)', () => {
  let svc: InstanceType<typeof InboxProcessService>;

  beforeEach(() => {
    jest.clearAllMocks();

    svc = buildService();

    // scanInbox returns 25 mock InboxFile entries (using os.tmpdir() for cross-platform compatibility)
    const mockFiles = Array.from({ length: FILE_COUNT }, (_, i) => ({
      filepath: path.join(MOCK_WORKSPACE, 'inbox', `meeting-${i}.md`),
      content: `# Meeting ${i}\nSome content about team member ${i}.`,
      timestamp: new Date(Date.now() - i * 60_000),
    }));
    mockScanInbox.mockResolvedValue({ success: true, data: mockFiles });

    // loadCategorizationContext returns empty context
    mockLoadCategorizationContext.mockResolvedValue({
      success: true,
      data: { members: [], projects: [], ownerEmail: 'owner@co.com', ownerName: 'Owner' },
    });

    // categorize resolves instantly with a clean result (no insights, no destinations)
    mockCategorize.mockResolvedValue({
      success: true,
      data: {
        type: 'general_note',
        destinations: [],
        insights: {},
        suggestedActions: [],
        needsReview: false,
        confidence: 0.85,
      },
    });

    // extractTasks resolves instantly
    mockExtractTasks.mockResolvedValue({
      success: true,
      data: { tasksAdded: 0, tasksMarkedDone: 0 },
    });

    // organizeFile resolves instantly
    mockOrganizeFile.mockResolvedValue({ success: true });
  });

  it('processes 25 files and reports correct counts', async () => {
    const result = await svc.run(MOCK_WORKSPACE, {
      dryRun: false,
      verbose: false,
      plain: true,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.filesScanned).toBe(FILE_COUNT);
    expect(result.data.filesCategorizedOk).toBe(FILE_COUNT);
    expect(result.data.categorizeErrors).toHaveLength(0);
    expect(result.data.filesOrganizedOk).toBe(FILE_COUNT);
    expect(result.data.organizeErrors).toHaveLength(0);
  });

  it('processes 25 files in dry-run mode (no organize or task calls)', async () => {
    const result = await svc.run(MOCK_WORKSPACE, {
      dryRun: true,
      verbose: false,
      plain: true,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.filesScanned).toBe(FILE_COUNT);
    expect(result.data.filesCategorizedOk).toBe(FILE_COUNT);
    expect(result.data.dryRun).toBe(true);
    // dry-run: organize and task extraction skipped
    expect(mockOrganizeFile).not.toHaveBeenCalled();
    expect(mockExtractTasks).not.toHaveBeenCalled();
  });

  it('completes the mocked 25-file pipeline within 2000ms', async () => {
    const start = Date.now();
    await svc.run(MOCK_WORKSPACE, {
      dryRun: true,
      verbose: false,
      plain: true,
    });
    const elapsed = Date.now() - start;

    // The mocked pipeline has zero real I/O — should complete in <100ms.
    // The 2000ms threshold is very conservative to avoid flakiness in CI.
    expect(elapsed).toBeLessThan(2000);
  });

  it('calls categorize exactly once per file', async () => {
    await svc.run(MOCK_WORKSPACE, {
      dryRun: false,
      verbose: false,
      plain: true,
    });

    expect(mockCategorize).toHaveBeenCalledTimes(FILE_COUNT);
  });

  it('calls organizeFile exactly once per successfully categorized file', async () => {
    await svc.run(MOCK_WORKSPACE, {
      dryRun: false,
      verbose: false,
      plain: true,
    });

    expect(mockOrganizeFile).toHaveBeenCalledTimes(FILE_COUNT);
  });

  it('handles 25 categorization failures gracefully (all fail)', async () => {
    mockCategorize.mockResolvedValue({ success: false, error: 'AI timeout' });

    const result = await svc.run(MOCK_WORKSPACE, {
      dryRun: false,
      verbose: false,
      plain: true,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.categorizeErrors).toHaveLength(FILE_COUNT);
    expect(result.data.filesCategorizedOk).toBe(0);
    // organize is never called when all categorizations fail
    expect(mockOrganizeFile).not.toHaveBeenCalled();
  });
});
