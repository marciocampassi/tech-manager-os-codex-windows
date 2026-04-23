/**
 * Integration test: WatchService — real FileSystemService + mock chokidar watcher.
 *
 * Strategy:
 * - Use a real temp directory for workspace and inbox (real PID file I/O).
 * - Inject a mock chokidar watcher so tests control when 'add' events fire.
 * - Use debounceMs=50 to avoid the 5-second production wait.
 * - Mock process.exit to prevent the process from actually exiting.
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import fs from 'fs-extra';

import { WatchService } from '../../src/services/watch.service.js';
import { FileSystemService } from '../../src/services/file-system.service.js';
import type { ProcessRunOptions, ProcessSummary } from '../../src/types/process.types.js';
import type { FSWatcher } from 'chokidar';

type Result<T> = { success: true; data: T } | { success: false; error: string };

function makeSummary(): ProcessSummary {
  return {
    filesScanned: 0,
    filesCategorizedOk: 0,
    categorizeErrors: [],
    memberContextUpdates: 0,
    projectContextUpdates: 0,
    contextErrors: [],
    tasksAdded: 0,
    tasksMarkedDone: 0,
    taskError: null,
    filesOrganizedOk: 0,
    organizeErrors: [],
    needsReviewCount: 0,
    suggestedActions: [],
    dryRun: false,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Creates a fake FSWatcher that lets tests emit events on demand. */
function createMockWatcher(): FSWatcher & { _emit: (event: string, ...args: unknown[]) => void } {
  const emitter = new EventEmitter();
  const watcher = {
    on: (event: string, listener: (...args: unknown[]) => void): FSWatcher => {
      emitter.on(event, listener);
      return watcher as unknown as FSWatcher;
    },
    close: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    _emit: (event: string, ...args: unknown[]): void => {
      emitter.emit(event, ...args);
    },
  } as unknown as FSWatcher & { _emit: (event: string, ...args: unknown[]) => void };
  return watcher;
}

describe('WatchService (integration)', () => {
  let tmpDir: string;
  let fsSvc: FileSystemService;
  let mockRun: jest.MockedFunction<
    (workspaceRoot: string, options: ProcessRunOptions) => Promise<Result<ProcessSummary>>
  >;
  let mockProcessSvc: { run: typeof mockRun };
  let mockWatcher: ReturnType<typeof createMockWatcher>;
  let watchSvc: WatchService;
  let exitSpy: jest.SpiedFunction<typeof process.exit>;
  let stdoutSpy: jest.SpiedFunction<typeof process.stdout.write>;
  // Collected SIGINT/SIGTERM listeners registered by WatchService.
  const signalListeners: Map<string, (() => void)[]> = new Map();
  const originalProcessOn = process.on.bind(process);

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tmr-watch-test-'));
    await fs.ensureDir(path.join(tmpDir, 'inbox'));

    fsSvc = new FileSystemService();
    mockRun = jest
      .fn<(workspaceRoot: string, options: ProcessRunOptions) => Promise<Result<ProcessSummary>>>()
      .mockResolvedValue({ success: true, data: makeSummary() });
    mockProcessSvc = { run: mockRun };
    mockWatcher = createMockWatcher();

    signalListeners.clear();
    jest.spyOn(process, 'once').mockImplementation((event, listener) => {
      if (event === 'SIGINT' || event === 'SIGTERM') {
        const list = signalListeners.get(event as string) ?? [];
        list.push(listener as () => void);
        signalListeners.set(event as string, list);
        return process;
      }
      return originalProcessOn(event as string, listener as (...args: unknown[]) => void);
    });

    exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((_code?: string | number | null | undefined) => {
        return undefined as never;
      });

    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    watchSvc = new WatchService(
      mockProcessSvc as unknown as import('../../src/services/inbox-process.service.js').InboxProcessService,
      fsSvc,
    );
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    signalListeners.clear();
    await fs.remove(tmpDir).catch(() => {});
  });

  function triggerSignal(signal: 'SIGINT' | 'SIGTERM'): void {
    const listeners = signalListeners.get(signal) ?? [];
    for (const l of listeners) l();
  }

  function startWatcher(): Promise<void> {
    return new Promise<void>((resolve) => {
      void watchSvc.start(tmpDir, {
        verbose: false,
        plain: true,
        debounceMs: 50,
        _watcherFactory: () => mockWatcher as FSWatcher,
        _onReady: resolve,
      });
    });
  }

  it('writes PID file to .system/watch.pid on start', async () => {
    await startWatcher();

    const pidPath = path.join(tmpDir, '.system', 'watch.pid');
    expect(await fs.pathExists(pidPath)).toBe(true);
    const content = await fs.readFile(pidPath, 'utf8');
    expect(Number(content)).toBe(process.pid);
  });

  it('calls InboxProcessService.run after debounce when a .md file is added', async () => {
    await startWatcher();

    mockWatcher._emit('add', path.join(tmpDir, 'inbox', 'meeting-note.md'));

    // Wait for debounce (50ms) + processing margin.
    await sleep(200);

    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockRun).toHaveBeenCalledWith(tmpDir, {
      dryRun: false,
      verbose: false,
      plain: true,
    });
  });

  it('calls InboxProcessService.run when a .txt file is added', async () => {
    await startWatcher();

    mockWatcher._emit('add', path.join(tmpDir, 'inbox', 'note.txt'));
    await sleep(200);

    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it('calls InboxProcessService.run when a .json file is added', async () => {
    await startWatcher();

    mockWatcher._emit('add', path.join(tmpDir, 'inbox', 'data.json'));
    await sleep(200);

    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it('ignores files with unsupported extensions (.pdf, .docx)', async () => {
    await startWatcher();

    mockWatcher._emit('add', path.join(tmpDir, 'inbox', 'report.pdf'));
    mockWatcher._emit('add', path.join(tmpDir, 'inbox', 'doc.docx'));

    await sleep(200);

    expect(mockRun).not.toHaveBeenCalled();
  });

  it('removes PID file and calls process.exit(0) on SIGINT', async () => {
    await startWatcher();

    const pidPath = path.join(tmpDir, '.system', 'watch.pid');
    expect(await fs.pathExists(pidPath)).toBe(true);

    triggerSignal('SIGINT');
    await sleep(200);

    expect(await fs.pathExists(pidPath)).toBe(false);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('removes PID file and calls process.exit(0) on SIGTERM', async () => {
    await startWatcher();

    const pidPath = path.join(tmpDir, '.system', 'watch.pid');
    triggerSignal('SIGTERM');
    await sleep(200);

    expect(await fs.pathExists(pidPath)).toBe(false);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('debounces multiple rapid file additions into a single process run', async () => {
    await startWatcher();

    mockWatcher._emit('add', path.join(tmpDir, 'inbox', 'file1.md'));
    await sleep(20);
    mockWatcher._emit('add', path.join(tmpDir, 'inbox', 'file2.txt'));
    await sleep(20);
    mockWatcher._emit('add', path.join(tmpDir, 'inbox', 'file3.json'));

    // Wait for debounce (50ms from last event) + margin.
    await sleep(300);

    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it('runs process again if new file added after first debounce completes', async () => {
    await startWatcher();

    mockWatcher._emit('add', path.join(tmpDir, 'inbox', 'first.md'));
    await sleep(200); // let first debounce fire

    mockWatcher._emit('add', path.join(tmpDir, 'inbox', 'second.md'));
    await sleep(200); // let second debounce fire

    expect(mockRun).toHaveBeenCalledTimes(2);
  });

  it('prints banner on start', async () => {
    await startWatcher();

    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('tmr watch'));
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('Monitoring:'));
  });

  it('logs file name when a watched file is added', async () => {
    await startWatcher();

    mockWatcher._emit('add', path.join(tmpDir, 'inbox', 'note.md'));
    await sleep(100);

    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('note.md'));
  });
});
