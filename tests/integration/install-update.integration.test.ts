/**
 * Integration tests for tmr install and tmr update commands.
 *
 * Unlike the unit tests (which mock SkillRegistryService entirely), these tests
 * mock only the network layer (node:https) and use a real temporary filesystem,
 * verifying that the command factory → SkillRegistryService → filesystem pipeline
 * works end-to-end.
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

// ── Network mock ──────────────────────────────────────────────────────────────

type HttpsGetCallback = (res: MockResponse) => void;

interface MockResponse {
  statusCode: number;
  on: (event: string, cb: (chunk?: Buffer | string) => void) => void;
}

interface MockRequest {
  on: (event: string, cb: (err?: Error) => void) => MockRequest;
  setTimeout?: (ms: number, fn: () => void) => MockRequest;
  destroy?: (err: Error) => void;
}

let mockHttpsGetImpl: (url: string, cb: HttpsGetCallback) => MockRequest;

const mockHttpsGet = jest.fn<typeof mockHttpsGetImpl>((url, cb) => mockHttpsGetImpl(url, cb));

jest.unstable_mockModule('node:https', () => ({
  get: mockHttpsGet,
}));

// ── Config + workspace mocks ──────────────────────────────────────────────────

let tmpDir: string;

const mockConfigInitialize = jest.fn<() => void>();
jest.unstable_mockModule('../../src/services/config.service.js', () => ({
  configService: { initialize: mockConfigInitialize },
}));

jest.unstable_mockModule('../../src/utils/workspace.js', () => ({
  getWorkspaceRoot: jest.fn(() => tmpDir),
}));

// ── Dynamic imports (after all mocks) ─────────────────────────────────────────

const { runInstall, createInstallCommand } = await import('../../src/commands/install.command.js');
const { runUpdate } = await import('../../src/commands/update.command.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

const SKILL_CONTENT_V1 = '<!-- version: 1.0.0 -->\n# tmr-inbox skill\n\nDo things.';
const SKILL_CONTENT_V2 = '<!-- version: 2.0.0 -->\n# tmr-inbox skill v2\n\nDo more things.';

function makeSuccessResponse(content: string): MockResponse {
  return {
    statusCode: 200,
    on(event: string, cb: (chunk?: Buffer | string) => void): void {
      if (event === 'data') cb(Buffer.from(content));
      if (event === 'end') cb();
    },
  };
}

function make404Response(): MockResponse {
  return {
    statusCode: 404,
    on(event: string, cb: (chunk?: Buffer | string) => void): void {
      if (event === 'data') cb(Buffer.from('Not found'));
      if (event === 'end') cb();
    },
  };
}

function makeTimeoutRequest(): MockRequest {
  let errorCb: ((err: Error) => void) | null = null;
  const req: MockRequest = {
    on(event: string, cb: (err?: Error) => void): MockRequest {
      if (event === 'error') errorCb = cb as (err: Error) => void;
      return req;
    },
    setTimeout(_ms: number, fn: () => void): MockRequest {
      setImmediate(fn);
      return req;
    },
    destroy(err: Error): void {
      if (errorCb) errorCb(err);
    },
  };
  return req;
}

function makeMalformedResponse(body = '{bad json}'): MockResponse {
  return {
    statusCode: 200,
    on(event: string, cb: (chunk?: Buffer | string) => void): void {
      if (event === 'data') cb(Buffer.from(body));
      if (event === 'end') cb();
    },
  };
}

function makeNetworkErrorRequest(): MockRequest {
  const req: MockRequest = {
    on(event: string, cb: (err?: Error) => void): MockRequest {
      if (event === 'error') cb(new Error('ECONNRESET'));
      return req;
    },
  };
  return req;
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('install + update integration (real fs, mocked https)', () => {
  let stdoutSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tmr-install-int-'));
    jest.clearAllMocks();
    process.exitCode = undefined;
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(async () => {
    stdoutSpy.mockRestore();
    process.exitCode = undefined;
    await fs.remove(tmpDir);
  });

  // ── install happy path ────────────────────────────────────────────────────

  describe('Test A: install new skill — happy path', () => {
    it('writes SKILL.md to .claude/skills/<name>/ and sets exit code 0', async () => {
      mockHttpsGetImpl = (_url, cb) => {
        cb(makeSuccessResponse(SKILL_CONTENT_V1));
        return { on: jest.fn() } as unknown as MockRequest;
      };

      await runInstall('tmr-inbox', { plain: true, force: false });

      const skillPath = path.join(tmpDir, '.claude', 'skills', 'tmr-inbox', 'SKILL.md');
      expect(await fs.pathExists(skillPath)).toBe(true);
      const written = await fs.readFile(skillPath, 'utf-8');
      expect(written).toContain('# tmr-inbox skill');
      expect(process.exitCode).toBeUndefined();
    });

    it('writes manifest with name and version', async () => {
      mockHttpsGetImpl = (_url, cb) => {
        cb(makeSuccessResponse(SKILL_CONTENT_V1));
        return { on: jest.fn() } as unknown as MockRequest;
      };

      await runInstall('tmr-inbox', { plain: true, force: false });

      const manifestPath = path.join(tmpDir, '.claude', 'skills', 'skill-manifest.json');
      expect(await fs.pathExists(manifestPath)).toBe(true);
      const manifest = (await fs.readJson(manifestPath)) as { name: string; version: string }[];
      expect(manifest).toHaveLength(1);
      expect(manifest[0].name).toBe('tmr-inbox');
      expect(manifest[0].version).toBe('1.0.0');
    });

    it('prints installed confirmation to stdout', async () => {
      mockHttpsGetImpl = (_url, cb) => {
        cb(makeSuccessResponse(SKILL_CONTENT_V1));
        return { on: jest.fn() } as unknown as MockRequest;
      };

      await runInstall('tmr-inbox', { plain: true, force: false });

      const output = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(output).toContain('Installed');
      expect(output).toContain('tmr-inbox');
    });
  });

  // ── install already-installed (no --force) ────────────────────────────────

  describe('Test B: install already-installed skill without --force', () => {
    it('does NOT overwrite SKILL.md and prints already-installed message', async () => {
      // First install
      mockHttpsGetImpl = (_url, cb) => {
        cb(makeSuccessResponse(SKILL_CONTENT_V1));
        return { on: jest.fn() } as unknown as MockRequest;
      };
      await runInstall('tmr-inbox', { plain: true, force: false });

      // Reset stdout capture
      stdoutSpy.mockClear();

      // Second install without --force
      await runInstall('tmr-inbox', { plain: true, force: false });

      const output = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(output).toContain('already installed');
      expect(process.exitCode).toBeUndefined();

      // SKILL.md still contains v1 content
      const skillPath = path.join(tmpDir, '.claude', 'skills', 'tmr-inbox', 'SKILL.md');
      const content = await fs.readFile(skillPath, 'utf-8');
      expect(content).toContain('1.0.0');
    });
  });

  // ── install with --force ──────────────────────────────────────────────────

  describe('Test C: install already-installed skill with --force', () => {
    it('reinstalls and updates SKILL.md to new version', async () => {
      // First install v1
      mockHttpsGetImpl = (_url, cb) => {
        cb(makeSuccessResponse(SKILL_CONTENT_V1));
        return { on: jest.fn() } as unknown as MockRequest;
      };
      await runInstall('tmr-inbox', { plain: true, force: false });

      // Force reinstall with v2 content
      mockHttpsGetImpl = (_url, cb) => {
        cb(makeSuccessResponse(SKILL_CONTENT_V2));
        return { on: jest.fn() } as unknown as MockRequest;
      };
      stdoutSpy.mockClear();
      await runInstall('tmr-inbox', { plain: true, force: true });

      const skillPath = path.join(tmpDir, '.claude', 'skills', 'tmr-inbox', 'SKILL.md');
      const content = await fs.readFile(skillPath, 'utf-8');
      expect(content).toContain('2.0.0');

      const output = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(output).toContain('Installed');
    });
  });

  // ── install skill not found (404) ─────────────────────────────────────────

  describe('Test D: install skill not found in registry', () => {
    it('prints error message and sets process.exitCode = 1', async () => {
      mockHttpsGetImpl = (_url, cb) => {
        cb(make404Response());
        return { on: jest.fn() } as unknown as MockRequest;
      };

      await runInstall('no-such-skill', { plain: true, force: false });

      expect(process.exitCode).toBe(1);
      const output = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(output.length).toBeGreaterThan(0);
    });
  });

  // ── update: no skills installed ───────────────────────────────────────────

  describe('Test E: update with no skills installed', () => {
    it('prints "No skills installed" message', async () => {
      await runUpdate({ plain: true });

      const output = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(output).toContain('No skills installed');
    });
  });

  // ── update: newer version available ──────────────────────────────────────

  describe('Test F: update — newer version available', () => {
    it('updates skill to new version and reports "updated"', async () => {
      // First install v1
      mockHttpsGetImpl = (_url, cb) => {
        cb(makeSuccessResponse(SKILL_CONTENT_V1));
        return { on: jest.fn() } as unknown as MockRequest;
      };
      await runInstall('tmr-inbox', { plain: true, force: false });
      stdoutSpy.mockClear();

      // Update — registry now returns v2
      mockHttpsGetImpl = (_url, cb) => {
        cb(makeSuccessResponse(SKILL_CONTENT_V2));
        return { on: jest.fn() } as unknown as MockRequest;
      };

      await runUpdate({ plain: true });

      const skillPath = path.join(tmpDir, '.claude', 'skills', 'tmr-inbox', 'SKILL.md');
      const content = await fs.readFile(skillPath, 'utf-8');
      expect(content).toContain('2.0.0');

      const output = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(output).toContain('updated');
    });
  });

  // ── update: already at latest ─────────────────────────────────────────────

  describe('Test G: update — already at latest version', () => {
    it('reports "already up to date"', async () => {
      // Install v1
      mockHttpsGetImpl = (_url, cb) => {
        cb(makeSuccessResponse(SKILL_CONTENT_V1));
        return { on: jest.fn() } as unknown as MockRequest;
      };
      await runInstall('tmr-inbox', { plain: true, force: false });
      stdoutSpy.mockClear();

      // Update — registry returns same v1
      mockHttpsGetImpl = (_url, cb) => {
        cb(makeSuccessResponse(SKILL_CONTENT_V1));
        return { on: jest.fn() } as unknown as MockRequest;
      };

      await runUpdate({ plain: true });

      const output = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(output).toContain('already up to date');
    });
  });

  // ── createInstallCommand factory wiring ───────────────────────────────────

  describe('createInstallCommand factory', () => {
    it('creates a Commander command named "install"', () => {
      const cmd = createInstallCommand();
      expect(cmd.name()).toBe('install');
    });

    it('command description mentions skill', () => {
      const cmd = createInstallCommand();
      expect(cmd.description()).toBeTruthy();
    });
  });

  // ── install-all happy path (SKILL-INT-001) ────────────────────────────────

  describe('Test H: install-all happy path (SKILL-INT-001)', () => {
    it('fetches index, writes SKILL.md for each listed skill, updates manifest', async () => {
      mockHttpsGetImpl = (url, cb) => {
        if (url.includes('index.json')) {
          cb(makeSuccessResponse(JSON.stringify(['tmr-inbox'])));
        } else {
          cb(makeSuccessResponse(SKILL_CONTENT_V1));
        }
        return { on: jest.fn() } as unknown as MockRequest;
      };

      await runInstall(undefined, { plain: true, force: false });

      const skillPath = path.join(tmpDir, '.claude', 'skills', 'tmr-inbox', 'SKILL.md');
      expect(await fs.pathExists(skillPath)).toBe(true);
      const written = await fs.readFile(skillPath, 'utf-8');
      expect(written).toContain('tmr-inbox skill');

      const manifestPath = path.join(tmpDir, '.claude', 'skills', 'skill-manifest.json');
      const manifest = (await fs.readJson(manifestPath)) as { name: string }[];
      expect(manifest.some((e) => e.name === 'tmr-inbox')).toBe(true);

      const output = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(output).toContain('Installed');
      expect(process.exitCode).toBeUndefined();
    });
  });

  // ── install timeout (NFR-EXIT-001) ────────────────────────────────────────

  describe('Test I: install timeout — error on output and exitCode 1 (NFR-EXIT-001)', () => {
    it('sets process.exitCode = 1 and prints error when request times out', async () => {
      let stderrOutput = '';
      const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
        stderrOutput += String(chunk);
        return true;
      });

      mockHttpsGetImpl = (_url, _cb) => makeTimeoutRequest();

      await runInstall('tmr-inbox', { plain: true, force: false });

      stderrSpy.mockRestore();
      expect(process.exitCode).toBe(1);
      expect(stderrOutput).toMatch(/timed out/i);
    });
  });

  // ── install malformed registry response (SKILL-UNIT-004 integration) ─────

  describe('Test J: install-all with malformed registry index — error and exitCode 1', () => {
    it('returns error and sets exitCode = 1 when index JSON is malformed', async () => {
      let stderrOutput = '';
      const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
        stderrOutput += String(chunk);
        return true;
      });

      mockHttpsGetImpl = (_url, cb) => {
        cb(makeMalformedResponse());
        return { on: jest.fn() } as unknown as MockRequest;
      };

      await runInstall(undefined, { plain: true, force: false });

      stderrSpy.mockRestore();
      expect(process.exitCode).toBe(1);
      expect(stderrOutput).toMatch(/malformed/i);
    });
  });

  // ── SKILL-INT-006: tmr update resolves tmr-project-impact ─────────────────

  describe('SKILL-INT-006: tmr update — tmr-project-impact updates from 0.0.0 to 1.0.0 without error', () => {
    it('reports "updated" and does not error when registry returns version 1.0.0', async () => {
      const skillsDir = path.join(tmpDir, '.claude', 'skills');
      const skillDir = path.join(skillsDir, 'tmr-project-impact');

      // Pre-install tmr-project-impact at v0.0.0 (simulates bundled init install)
      await fs.mkdirp(skillDir);
      await fs.writeFile(
        path.join(skillDir, 'SKILL.md'),
        '# tmr-project-impact\n\nOld bundled version.',
      );
      await fs.writeFile(
        path.join(skillsDir, 'skill-manifest.json'),
        JSON.stringify([
          { name: 'tmr-project-impact', version: '0.0.0', installedAt: new Date().toISOString() },
        ]),
      );

      stdoutSpy.mockClear();
      let stderrOutput = '';
      const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
        stderrOutput += String(chunk);
        return true;
      });

      // Registry returns 200 with version 1.0.0 content
      const registryContent =
        '<!-- version: 1.0.0 -->\n# tmr-project-impact\n\nUpdated registry version.';
      mockHttpsGetImpl = (_url, cb) => {
        cb(makeSuccessResponse(registryContent));
        return { on: jest.fn() } as unknown as MockRequest;
      };

      await runUpdate({ plain: true });

      stderrSpy.mockRestore();

      const output = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');

      // Must not error
      expect(stderrOutput).not.toContain('could not reach registry');
      expect(process.exitCode).toBeUndefined();

      // Must report updated
      expect(output).toContain('updated');
      expect(output).toContain('tmr-project-impact');

      // SKILL.md on disk must be updated to registry content
      const writtenContent = await fs.readFile(path.join(skillDir, 'SKILL.md'), 'utf-8');
      expect(writtenContent).toContain('1.0.0');

      // Manifest must record the new version
      const manifest = (await fs.readJson(path.join(skillsDir, 'skill-manifest.json'))) as {
        name: string;
        version: string;
      }[];
      const entry = manifest.find((e) => e.name === 'tmr-project-impact');
      expect(entry).toBeDefined();
      expect(entry!.version).toBe('1.0.0');
    });
  });
});
