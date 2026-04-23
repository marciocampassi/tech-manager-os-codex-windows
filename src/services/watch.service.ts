import path from 'node:path';
import { EventEmitter } from 'node:events';
import chokidar from 'chokidar';
import type { FSWatcher } from 'chokidar';
import chalk from 'chalk';
import type { InboxProcessService } from './inbox-process.service.js';
import type { FileSystemService } from './file-system.service.js';

export interface WatchOptions {
  verbose: boolean;
  plain: boolean;
  /** Override debounce delay in ms — for testing only. Defaults to DEBOUNCE_MS (5000). */
  debounceMs?: number;
  /** Injectable watcher factory — for testing only. Defaults to chokidar.watch. */
  _watcherFactory?: (watchPath: string, opts: Record<string, unknown>) => FSWatcher;
  /** Called once all event handlers are registered and the service is ready — for testing only. */
  _onReady?: () => void;
}

const DEBOUNCE_MS = 5000;
const WATCHED_EXTENSIONS = ['.txt', '.md', '.json'];
const PID_RELATIVE_PATH = path.join('.system', 'watch.pid');

export class WatchService {
  constructor(
    private readonly _processSvc: InboxProcessService,
    private readonly _fs: FileSystemService,
  ) {}

  async start(workspaceRoot: string, opts: WatchOptions): Promise<void> {
    const pidPath = path.join(workspaceRoot, PID_RELATIVE_PATH);
    await this._fs.createDirectory(path.dirname(pidPath));
    await this._fs.writeFile(pidPath, String(process.pid));

    const inboxPath = path.join(workspaceRoot, 'inbox');

    const bold = opts.plain ? (t: string): string => t : (t: string): string => chalk.bold(t);
    const dim = opts.plain ? (t: string): string => t : (t: string): string => chalk.dim(t);
    const cyan = opts.plain ? (t: string): string => t : (t: string): string => chalk.cyan(t);
    const green = opts.plain ? (t: string): string => t : (t: string): string => chalk.green(t);

    const log = (msg: string): void => {
      process.stdout.write(`${msg}\n`);
    };

    log(bold('tmr watch'));
    log(dim(`Monitoring: ${inboxPath}`));
    log(dim('Waiting for new files (Ctrl+C to stop)…\n'));

    if (opts.verbose) {
      log(dim(`PID: ${process.pid} → ${pidPath}`));
    }

    const watcherFactory =
      opts._watcherFactory ??
      ((p: string, o: Record<string, unknown>): FSWatcher => chokidar.watch(p, o));
    const watcher: FSWatcher = watcherFactory(inboxPath, {
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 },
    });

    const debounceDelay = opts.debounceMs ?? DEBOUNCE_MS;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let pendingFiles: string[] = [];

    const triggerProcess = async (): Promise<void> => {
      const count = pendingFiles.length;
      pendingFiles = [];
      log(cyan(`\n[tmr watch] Running process (${count} new file(s) detected)…`));
      const result = await this._processSvc.run(workspaceRoot, {
        dryRun: false,
        verbose: opts.verbose,
        plain: opts.plain,
      });
      if (result.success) {
        log(green('[tmr watch] Process complete.'));
      } else {
        log(`[tmr watch] Process error: ${result.error}`);
      }
      log(dim('Watching for new files…\n'));
    };

    watcher.on('add', (filePath: string): void => {
      const ext = path.extname(filePath).toLowerCase();
      if (!WATCHED_EXTENSIONS.includes(ext)) return;

      const ts = new Date().toISOString();
      log(`${dim(ts)} ${cyan('+')} ${path.basename(filePath)}`);
      pendingFiles.push(filePath);

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout((): void => {
        void triggerProcess();
      }, debounceDelay);
    });

    watcher.on('error', (err: unknown): void => {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[tmr watch] Watcher error: ${msg}\n`);
    });

    const done = new EventEmitter();
    let cleaning = false;

    const cleanup = async (): Promise<void> => {
      if (cleaning) return;
      cleaning = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      await watcher.close();
      try {
        await this._fs.removeFile(pidPath);
      } catch {
        // PID file may already be gone
      }
      log('\n[tmr watch] Stopped.');
      done.emit('exit');
    };

    process.once('SIGINT', (): void => {
      void cleanup();
    });
    process.once('SIGTERM', (): void => {
      void cleanup();
    });

    opts._onReady?.();

    // Block until cleanup signals done, then delegate to process.exit.
    await new Promise<void>((resolve) => {
      done.once('exit', resolve);
    });
    process.exit(0);
  }
}
