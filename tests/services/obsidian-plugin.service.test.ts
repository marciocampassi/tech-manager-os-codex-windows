import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { join } from 'node:path';

// ── Mock declarations (must precede dynamic imports) ──────────────────────────

const mockWriteFile = jest.fn<(path: string, content: string) => Promise<void>>();
const mockExists = jest.fn<(path: string) => Promise<boolean>>();

jest.unstable_mockModule('../../src/services/file-system.service.js', () => ({
  fileSystemService: { writeFile: mockWriteFile, exists: mockExists },
}));

jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ── Dynamic import (after all mocks) ─────────────────────────────────────────

const { ObsidianPluginService } = await import('../../src/services/obsidian-plugin.service.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockFetchOk(text = 'plugin content'): typeof globalThis.fetch {
  const m = jest.fn<() => Promise<unknown>>();
  m.mockResolvedValue({
    ok: true,
    arrayBuffer: async () => Buffer.from(text).buffer,
  });
  return m as unknown as typeof globalThis.fetch;
}

function mockFetch404(): typeof globalThis.fetch {
  const m = jest.fn<() => Promise<unknown>>();
  m.mockResolvedValue({ ok: false, status: 404 });
  return m as unknown as typeof globalThis.fetch;
}

function mockFetchThrows(error: Error = new Error('Network error')): typeof globalThis.fetch {
  const m = jest.fn<() => Promise<unknown>>();
  m.mockRejectedValue(error);
  return m as unknown as typeof globalThis.fetch;
}

const WORKSPACE = '/tmp/test-workspace';
const PLUGIN_DIR = join(WORKSPACE, '.obsidian', 'plugins', 'obsidian-git');
const FILE_URL = 'https://github.com/Vinzent03/obsidian-git/releases/latest/download/main.js';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ObsidianPluginService', () => {
  let service: InstanceType<typeof ObsidianPluginService>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteFile.mockResolvedValue(undefined);
    mockExists.mockResolvedValue(false);
    originalFetch = globalThis.fetch;
    service = new ObsidianPluginService();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ── downloadPluginFile ──────────────────────────────────────────────────────

  describe('downloadPluginFile', () => {
    it('returns true and writes file on successful download', async () => {
      globalThis.fetch = mockFetchOk('// plugin source');

      const result = await service.downloadPluginFile(PLUGIN_DIR, FILE_URL, 'main.js');

      expect(result).toBe(true);
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      expect(mockWriteFile).toHaveBeenCalledWith(join(PLUGIN_DIR, 'main.js'), expect.any(String));
    });

    it('returns false and does not write file when response is 404', async () => {
      globalThis.fetch = mockFetch404();

      const result = await service.downloadPluginFile(PLUGIN_DIR, FILE_URL, 'main.js');

      expect(result).toBe(false);
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('returns false and does not throw when fetch throws a network error', async () => {
      globalThis.fetch = mockFetchThrows(new Error('Network unavailable'));

      const result = await service.downloadPluginFile(PLUGIN_DIR, FILE_URL, 'main.js');

      expect(result).toBe(false);
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('returns false and does not throw on AbortError (timeout)', async () => {
      const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' });
      globalThis.fetch = mockFetchThrows(abortErr);

      const result = await service.downloadPluginFile(PLUGIN_DIR, FILE_URL, 'main.js');

      expect(result).toBe(false);
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it('logs a warning via logger.warn when fetch throws a network error', async () => {
      const { logger } = await import('../../src/utils/logger.js');
      globalThis.fetch = mockFetchThrows(new Error('ECONNREFUSED'));

      await service.downloadPluginFile(PLUGIN_DIR, FILE_URL, 'main.js');

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'));
    });
  });

  // ── installPlugins ──────────────────────────────────────────────────────────

  describe('installPlugins', () => {
    it('calls fetch for all 3 plugins × 3 files = 9 fetch calls', async () => {
      const fetchMock = jest.fn<() => Promise<unknown>>();
      fetchMock.mockResolvedValue({ ok: true, arrayBuffer: async () => Buffer.from('x').buffer });
      globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

      await service.installPlugins(WORKSPACE);

      expect(fetchMock).toHaveBeenCalledTimes(9);
    });

    it('writes community-plugins.json with the three plugin ids', async () => {
      globalThis.fetch = mockFetchOk();

      await service.installPlugins(WORKSPACE);

      const communityPluginsPath = join(WORKSPACE, '.obsidian', 'community-plugins.json');
      const communityPluginsCall = mockWriteFile.mock.calls.find(
        ([p]) => p === communityPluginsPath,
      ) as [string, string] | undefined;
      expect(communityPluginsCall).toBeDefined();
      expect(JSON.parse(communityPluginsCall![1])).toEqual([
        'obsidian-git',
        'obsidian-granola-sync',
        'obsidian-terminal',
      ]);
    });

    it('writes app.json with {} when it does not exist', async () => {
      globalThis.fetch = mockFetchOk();
      mockExists.mockResolvedValue(false);

      await service.installPlugins(WORKSPACE);

      const appJsonPath = join(WORKSPACE, '.obsidian', 'app.json');
      const appJsonCall = mockWriteFile.mock.calls.find(([p]) => p === appJsonPath) as
        | [string, string]
        | undefined;
      expect(appJsonCall).toBeDefined();
      expect(appJsonCall![1]).toBe('{}');
    });

    it('does not write app.json when it already exists', async () => {
      globalThis.fetch = mockFetchOk();
      mockExists.mockResolvedValue(true);

      await service.installPlugins(WORKSPACE);

      const appJsonPath = join(WORKSPACE, '.obsidian', 'app.json');
      const appJsonCall = mockWriteFile.mock.calls.find(([p]) => p === appJsonPath);
      expect(appJsonCall).toBeUndefined();
    });

    it('completes without throwing when all downloads fail (network unavailable)', async () => {
      globalThis.fetch = mockFetchThrows();

      await expect(service.installPlugins(WORKSPACE)).resolves.toBeUndefined();
    });

    it('still writes community-plugins.json and app.json even when all downloads fail', async () => {
      globalThis.fetch = mockFetchThrows();

      await service.installPlugins(WORKSPACE);

      const writtenPaths = mockWriteFile.mock.calls.map(([p]) => p);
      expect(writtenPaths).toContain(join(WORKSPACE, '.obsidian', 'community-plugins.json'));
      expect(writtenPaths).toContain(join(WORKSPACE, '.obsidian', 'app.json'));
    });

    it('runs downloads concurrently (all 9 fetch calls initiated before any resolve)', async () => {
      let concurrentCount = 0;
      let maxConcurrent = 0;

      const concurrentMock = jest.fn<() => Promise<unknown>>();
      concurrentMock.mockImplementation(async () => {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);
        await new Promise<void>((resolve) => setImmediate(resolve));
        concurrentCount--;
        return { ok: false, status: 404 };
      });
      const concurrentFetch = concurrentMock as unknown as typeof globalThis.fetch;

      globalThis.fetch = concurrentFetch;

      await service.installPlugins(WORKSPACE);

      expect(maxConcurrent).toBeGreaterThan(1);
      expect(concurrentMock).toHaveBeenCalledTimes(9);
    });
  });
});
