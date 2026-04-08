/**
 * Integration tests for TaskService.
 *
 * Uses a real temp filesystem (os.tmpdir()) with real FileSystemService and
 * MockAIProvider to validate that task files are created, appended, and
 * completed correctly.
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { TaskService } from '../../src/services/task.service.js';
import { MockAIProvider } from '../../src/providers/mock-provider.js';
import type { InboxFile } from '../../src/types/inbox.types.js';

const { fileSystemService } = await import('../../src/services/file-system.service.js');

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeFile(overrides: Partial<InboxFile> = {}): InboxFile {
  return {
    filepath: '/workspace/inbox/meeting.md',
    content: '# 1:1 with John\n\nReview PR ASAP. Schedule offsite this week.',
    timestamp: new Date('2026-04-07T09:00:00Z'),
    ...overrides,
  };
}

function makePayload(
  tasks: Array<{
    description: string;
    owner: string;
    urgencyReason: string;
    period: string;
    status: string;
    sourceFile?: string;
  }>,
  completedDescriptions: string[] = [],
): string {
  return JSON.stringify({ tasks, completedDescriptions });
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

let tmpDir: string;
let svc: TaskService;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tmr-task-test-'));
  await fs.ensureDir(path.join(tmpDir, 'my-tasks'));
});

afterEach(async () => {
  await fs.remove(tmpDir);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TaskService integration', () => {
  it('creates my-tasks/today.md with a task after extractTasks', async () => {
    const payload = makePayload([
      {
        description: 'Review PR before deployment',
        owner: 'john.doe@co.com',
        urgencyReason: 'ASAP',
        period: 'today',
        status: 'todo',
        sourceFile: '/workspace/inbox/meeting.md',
      },
    ]);
    svc = new TaskService(new MockAIProvider(() => payload), fileSystemService);

    const result = await svc.extractTasks([makeFile()], tmpDir);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.tasksAdded).toBe(1);

    const todayFile = path.join(tmpDir, 'my-tasks', 'today.md');
    expect(await fs.pathExists(todayFile)).toBe(true);

    const content = await fs.readFile(todayFile, 'utf8');
    expect(content).toContain('- [ ] **Review PR before deployment**');
    expect(content).toContain('— john.doe@co.com');
    expect(content).toContain('- Urgency: ASAP');
    expect(content).toContain('- Source: /workspace/inbox/meeting.md');
  });

  it('appends tasks on second call without overwriting existing ones', async () => {
    const payload1 = makePayload([
      {
        description: 'First task',
        owner: 'alice@co.com',
        urgencyReason: 'ASAP',
        period: 'today',
        status: 'todo',
        sourceFile: '/workspace/inbox/file1.md',
      },
    ]);
    const payload2 = makePayload([
      {
        description: 'Second task',
        owner: 'bob@co.com',
        urgencyReason: 'Due today',
        period: 'today',
        status: 'todo',
        sourceFile: '/workspace/inbox/file2.md',
      },
    ]);

    let call = 0;
    svc = new TaskService(
      new MockAIProvider(() => (call++ === 0 ? payload1 : payload2)),
      fileSystemService,
    );

    await svc.extractTasks([makeFile({ filepath: '/workspace/inbox/file1.md' })], tmpDir);
    await svc.extractTasks([makeFile({ filepath: '/workspace/inbox/file2.md' })], tmpDir);

    const content = await fs.readFile(path.join(tmpDir, 'my-tasks', 'today.md'), 'utf8');
    expect(content).toContain('First task');
    expect(content).toContain('Second task');
  });

  it('marks a completed task from - [ ] to - [x] and returns tasksMarkedDone: 1', async () => {
    // First: create the task
    const payload1 = makePayload([
      {
        description: 'Schedule team offsite',
        owner: 'alice@co.com',
        urgencyReason: 'This week',
        period: 'this-week',
        status: 'todo',
        sourceFile: '/workspace/inbox/file1.md',
      },
    ]);

    // Second run: same task mentioned as done
    const payload2 = makePayload([], ['Schedule team offsite']);

    let call = 0;
    svc = new TaskService(
      new MockAIProvider(() => (call++ === 0 ? payload1 : payload2)),
      fileSystemService,
    );

    const r1 = await svc.extractTasks(
      [makeFile({ filepath: '/workspace/inbox/file1.md' })],
      tmpDir,
    );
    expect(r1.success).toBe(true);

    const r2 = await svc.extractTasks(
      [makeFile({ filepath: '/workspace/inbox/file2.md' })],
      tmpDir,
    );
    expect(r2.success).toBe(true);
    if (!r2.success) return;
    expect(r2.data.tasksMarkedDone).toBe(1);

    const content = await fs.readFile(path.join(tmpDir, 'my-tasks', 'this-week.md'), 'utf8');
    expect(content).toContain('- [x] **Schedule team offsite**');
    expect(content).not.toContain('- [ ] **Schedule team offsite**');
  });

  it('distributes tasks across multiple period files in a single run', async () => {
    const payload = makePayload([
      {
        description: 'Urgent task',
        owner: 'alice@co.com',
        urgencyReason: 'ASAP',
        period: 'today',
        status: 'todo',
        sourceFile: '/workspace/inbox/meeting.md',
      },
      {
        description: 'Weekly review',
        owner: 'bob@co.com',
        urgencyReason: 'End of week',
        period: 'this-week',
        status: 'todo',
        sourceFile: '/workspace/inbox/meeting.md',
      },
      {
        description: 'Monthly report',
        owner: 'alice@co.com',
        urgencyReason: 'End of month',
        period: 'this-month',
        status: 'todo',
        sourceFile: '/workspace/inbox/meeting.md',
      },
      {
        description: 'Q2 strategy',
        owner: 'ceo@co.com',
        urgencyReason: 'Quarterly planning',
        period: 'this-quarter',
        status: 'todo',
        sourceFile: '/workspace/inbox/meeting.md',
      },
    ]);

    svc = new TaskService(new MockAIProvider(() => payload), fileSystemService);
    const result = await svc.extractTasks([makeFile()], tmpDir);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.tasksAdded).toBe(4);
    expect(result.data.filesUpdated).toHaveLength(4);

    const todayContent = await fs.readFile(path.join(tmpDir, 'my-tasks', 'today.md'), 'utf8');
    expect(todayContent).toContain('Urgent task');

    const weekContent = await fs.readFile(path.join(tmpDir, 'my-tasks', 'this-week.md'), 'utf8');
    expect(weekContent).toContain('Weekly review');

    const monthContent = await fs.readFile(path.join(tmpDir, 'my-tasks', 'this-month.md'), 'utf8');
    expect(monthContent).toContain('Monthly report');

    const quarterContent = await fs.readFile(
      path.join(tmpDir, 'my-tasks', 'this-quarter.md'),
      'utf8',
    );
    expect(quarterContent).toContain('Q2 strategy');
  });
});
