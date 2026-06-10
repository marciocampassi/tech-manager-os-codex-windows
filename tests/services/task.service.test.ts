import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { TaskService, TASK_EXTRACTION_SYSTEM_PROMPT } from '../../src/services/task.service.js';
import { MockAIProvider } from '../../src/providers/mock-provider.js';
import type { FileSystemService } from '../../src/services/file-system.service.js';
import { FileSystemError } from '../../src/services/file-system.service.js';
import type { InboxFile } from '../../src/types/inbox.types.js';

// ── Mock helpers ──────────────────────────────────────────────────────────────

type MockFS = {
  [K in keyof FileSystemService]: jest.MockedFunction<FileSystemService[K]>;
};

function createMockFS(): MockFS {
  return {
    createDirectory: jest.fn<FileSystemService['createDirectory']>().mockResolvedValue(undefined),
    writeFile: jest.fn<FileSystemService['writeFile']>().mockResolvedValue(undefined),
    readFile: jest
      .fn<FileSystemService['readFile']>()
      .mockRejectedValue(
        new FileSystemError('File not found', 'readFile', '/fake/path', undefined),
      ),
    moveFile: jest.fn<FileSystemService['moveFile']>().mockResolvedValue(undefined),
    exists: jest.fn<FileSystemService['exists']>().mockResolvedValue(false),
    appendFile: jest.fn<FileSystemService['appendFile']>().mockResolvedValue(undefined),
    listFiles: jest.fn<FileSystemService['listFiles']>().mockResolvedValue([]),
    listDirectories: jest.fn<FileSystemService['listDirectories']>().mockResolvedValue([]),
    removeFile: jest.fn<FileSystemService['removeFile']>().mockResolvedValue(undefined),
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const WS = '/fake/workspace';

function makeFile(overrides: Partial<InboxFile> = {}): InboxFile {
  return {
    filepath: '/workspace/inbox/meeting.md',
    content: '# 1:1 with John\n\nReview PR ASAP. Schedule offsite this week.',
    timestamp: new Date('2026-04-07T09:00:00Z'),
    ...overrides,
  };
}

function makeValidPayload(
  overrides: Partial<{
    tasks: unknown[];
    completedDescriptions: string[];
  }> = {},
): Record<string, unknown> {
  return {
    tasks: [
      {
        description: 'Review PR before deployment',
        owner: 'john.doe@company.com',
        urgencyReason: 'Explicitly marked ASAP in meeting',
        period: 'today',
        status: 'todo',
        sourceFile: '/workspace/inbox/meeting.md',
      },
    ],
    completedDescriptions: [],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TaskService', () => {
  let mockFS: MockFS;
  let svc: TaskService;

  beforeEach(() => {
    mockFS = createMockFS();
    svc = new TaskService(
      new MockAIProvider(() => JSON.stringify(makeValidPayload())),
      mockFS as FileSystemService,
    );
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('returns success with tasksAdded count for a valid AI response', async () => {
    const result = await svc.extractTasks([makeFile()], WS);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.tasksAdded).toBe(1);
    expect(result.data.tasks).toHaveLength(1);
    expect(result.data.tasksMarkedDone).toBe(0);
  });

  it('routes tasks to the correct period file', async () => {
    const payload = makeValidPayload({
      tasks: [
        {
          description: 'Urgent task',
          owner: 'alice@co.com',
          urgencyReason: 'ASAP',
          period: 'today',
          status: 'todo',
          sourceFile: '/workspace/inbox/meeting.md',
        },
        {
          description: 'Weekly task',
          owner: 'bob@co.com',
          urgencyReason: 'Due by Friday',
          period: 'this-week',
          status: 'todo',
          sourceFile: '/workspace/inbox/meeting.md',
        },
        {
          description: 'Monthly goal',
          owner: 'alice@co.com',
          urgencyReason: 'End of month deadline',
          period: 'this-month',
          status: 'todo',
          sourceFile: '/workspace/inbox/meeting.md',
        },
        {
          description: 'Quarterly objective',
          owner: 'bob@co.com',
          urgencyReason: 'Q2 goal',
          period: 'this-quarter',
          status: 'todo',
          sourceFile: '/workspace/inbox/meeting.md',
        },
      ],
    });
    svc = new TaskService(
      new MockAIProvider(() => JSON.stringify(payload)),
      mockFS as FileSystemService,
    );

    const result = await svc.extractTasks([makeFile()], WS);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.tasksAdded).toBe(4);
    expect(result.data.filesUpdated).toHaveLength(4);
    expect(result.data.filesUpdated).toContain('today');
    expect(result.data.filesUpdated).toContain('this-week');
    expect(result.data.filesUpdated).toContain('this-month');
    expect(result.data.filesUpdated).toContain('this-quarter');
  });

  it('appends tasks with the correct markdown format', async () => {
    const result = await svc.extractTasks([makeFile()], WS);
    expect(result.success).toBe(true);

    expect(mockFS.appendFile).toHaveBeenCalledTimes(1);
    const appendedContent = (
      mockFS.appendFile as jest.MockedFunction<FileSystemService['appendFile']>
    ).mock.calls[0]?.[1] as string;
    expect(appendedContent).toContain('- [ ] **Review PR before deployment**');
    expect(appendedContent).toContain('— john.doe@company.com');
    expect(appendedContent).toContain('- Urgency: Explicitly marked ASAP in meeting');
    expect(appendedContent).toContain('- Source: /workspace/inbox/meeting.md');
  });

  it('marks completed tasks — replaces - [ ] with - [x]', async () => {
    const existingContent = [
      '- [ ] **Schedule offsite meeting** — alice@co.com',
      '  - Urgency: This week',
      '  - Source: inbox/prev.md',
    ].join('\n');

    // Return existing content for this-week file on readFile
    mockFS.readFile = jest
      .fn<FileSystemService['readFile']>()
      .mockImplementation(async (filePath) => {
        if ((filePath as string).includes('this-week')) return existingContent;
        throw new FileSystemError('not found', 'readFile', filePath as string, undefined);
      });

    const payload = makeValidPayload({ completedDescriptions: ['Schedule offsite meeting'] });
    svc = new TaskService(
      new MockAIProvider(() => JSON.stringify(payload)),
      mockFS as FileSystemService,
    );

    const result = await svc.extractTasks([makeFile()], WS);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.tasksMarkedDone).toBe(1);
    // writeFile called with content containing [x]
    const writeCall = (
      mockFS.writeFile as jest.MockedFunction<FileSystemService['writeFile']>
    ).mock.calls.find(([, content]) =>
      (content as string).includes('- [x] **Schedule offsite meeting**'),
    );
    expect(writeCall).toBeDefined();
  });

  it('tasksMarkedDone is 0 when no completions mentioned', async () => {
    const result = await svc.extractTasks([makeFile()], WS);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.tasksMarkedDone).toBe(0);
  });

  it('filesUpdated only includes periods with changes', async () => {
    const result = await svc.extractTasks([makeFile()], WS);
    expect(result.success).toBe(true);
    if (!result.success) return;
    // Only 'today' was in the payload
    expect(result.data.filesUpdated).toEqual(['today']);
  });

  it('creates the task file when it does not exist', async () => {
    const result = await svc.extractTasks([makeFile()], WS);
    expect(result.success).toBe(true);
    const appendCall = (mockFS.appendFile.mock.calls as unknown[][]).find((args) =>
      String(args[0]).replace(/\\/g, '/').includes('my-tasks/today.md'),
    );
    expect(appendCall).toBeDefined();
    expect(String(appendCall![1])).toContain('- [ ] **Review PR before deployment**');
  });

  it('returns success with zero counts for an empty files array', async () => {
    const result = await svc.extractTasks([], WS);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.tasksAdded).toBe(0);
    expect(result.data.tasksMarkedDone).toBe(0);
    expect(result.data.filesUpdated).toHaveLength(0);
    expect(mockFS.appendFile).not.toHaveBeenCalled();
  });

  it('returns success with empty tasks when AI returns empty tasks array', async () => {
    const emptyPayload = { tasks: [], completedDescriptions: [] };
    svc = new TaskService(
      new MockAIProvider(() => JSON.stringify(emptyPayload)),
      mockFS as FileSystemService,
    );

    const result = await svc.extractTasks([makeFile()], WS);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.tasksAdded).toBe(0);
    expect(mockFS.appendFile).not.toHaveBeenCalled();
  });

  // ── Error handling ────────────────────────────────────────────────────────

  it('returns failure when AI returns invalid JSON', async () => {
    svc = new TaskService(new MockAIProvider(() => 'not-valid-json'), mockFS as FileSystemService);
    const result = await svc.extractTasks([makeFile()], WS);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/invalid JSON/i);
  });

  it('returns failure when AI response has invalid shape', async () => {
    svc = new TaskService(
      new MockAIProvider(() => JSON.stringify({ foo: 'bar' })),
      mockFS as FileSystemService,
    );
    const result = await svc.extractTasks([makeFile()], WS);
    expect(result.success).toBe(false);
  });

  it('returns failure when AI provider throws', async () => {
    const failingAI = new MockAIProvider(() => {
      throw new Error('API rate limit');
    });
    svc = new TaskService(failingAI, mockFS as FileSystemService);
    const result = await svc.extractTasks([makeFile()], WS);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('API rate limit');
  });

  it('returns failure when appendFile throws', async () => {
    mockFS.appendFile = jest
      .fn<FileSystemService['appendFile']>()
      .mockRejectedValue(new FileSystemError('Disk full', 'appendFile', '/fake/path', undefined));
    const result = await svc.extractTasks([makeFile()], WS);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('Disk full');
  });

  // ── _markCompletedInContent ───────────────────────────────────────────────

  it('completion matching is case-insensitive', async () => {
    const existingContent =
      '- [ ] **Review PR before deployment** — alice@co.com\n  - Urgency: ASAP';
    mockFS.readFile = jest
      .fn<FileSystemService['readFile']>()
      .mockImplementation(async (filePath) => {
        if ((filePath as string).includes('today')) return existingContent;
        throw new FileSystemError('not found', 'readFile', filePath as string, undefined);
      });

    const payload = { tasks: [], completedDescriptions: ['review pr before deployment'] };
    svc = new TaskService(
      new MockAIProvider(() => JSON.stringify(payload)),
      mockFS as FileSystemService,
    );

    const result = await svc.extractTasks([makeFile()], WS);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.tasksMarkedDone).toBe(1);
  });

  it('partial description matches the full task line', async () => {
    const existingContent =
      "- [ ] **Review John's PR before Friday** — bob@co.com\n  - Urgency: Soon";
    mockFS.readFile = jest
      .fn<FileSystemService['readFile']>()
      .mockImplementation(async (filePath) => {
        if ((filePath as string).includes('this-week')) return existingContent;
        throw new FileSystemError('not found', 'readFile', filePath as string, undefined);
      });

    const payload = { tasks: [], completedDescriptions: ["Review John's PR"] };
    svc = new TaskService(
      new MockAIProvider(() => JSON.stringify(payload)),
      mockFS as FileSystemService,
    );

    const result = await svc.extractTasks([makeFile()], WS);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.tasksMarkedDone).toBe(1);
  });

  // ── Prompt / system prompt ────────────────────────────────────────────────

  it('exports a non-empty TASK_EXTRACTION_SYSTEM_PROMPT string', () => {
    expect(typeof TASK_EXTRACTION_SYSTEM_PROMPT).toBe('string');
    expect(TASK_EXTRACTION_SYSTEM_PROMPT.length).toBeGreaterThan(100);
    expect(TASK_EXTRACTION_SYSTEM_PROMPT).toContain('today|this-week|this-month|this-quarter');
  });

  it('injects default sourceFile from first file when AI omits it', async () => {
    const payloadWithoutSource = {
      tasks: [
        {
          description: 'Send team update',
          owner: 'manager@co.com',
          urgencyReason: 'Promised this week',
          period: 'this-week',
          status: 'todo',
          // sourceFile intentionally omitted
        },
      ],
      completedDescriptions: [],
    };
    svc = new TaskService(
      new MockAIProvider(() => JSON.stringify(payloadWithoutSource)),
      mockFS as FileSystemService,
    );

    const file = makeFile({ filepath: '/workspace/inbox/notes.md' });
    const result = await svc.extractTasks([file], WS);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.tasks[0]?.sourceFile).toBe('/workspace/inbox/notes.md');
  });
});

// ── FileSystemService.appendFile (unit-level check) ──────────────────────────

describe('FileSystemService.appendFile integration via mock', () => {
  it('appendFile mock resolves without error', async () => {
    const mockFS = createMockFS();
    await expect(mockFS.appendFile('/some/path.md', 'content')).resolves.toBeUndefined();
  });
});
