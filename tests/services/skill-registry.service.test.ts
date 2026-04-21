import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// ── Mock node:fs ──────────────────────────────────────────────────────────────

const mockExistsSync = jest.fn<(p: string) => boolean>(() => false);
const mockReadFileSync = jest.fn<(p: string, enc: string) => string>(() => '[]');
const mockWriteFileSync = jest.fn<(p: string, d: string, enc: string) => void>();
const mockMkdirSync = jest.fn<(p: string, opts?: { recursive?: boolean }) => void>();

jest.unstable_mockModule('node:fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  mkdirSync: mockMkdirSync,
}));

// ── Mock node:https ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockHttpsGet = jest.fn<(...args: any[]) => any>();

jest.unstable_mockModule('node:https', () => ({
  get: mockHttpsGet,
}));

// ── Dynamic import (after mocks) ──────────────────────────────────────────────

const { SkillRegistryService } = await import('../../src/services/skill-registry.service.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeHttpResponse(statusCode: number, body: string): void {
  mockHttpsGet.mockImplementation((_url: unknown, cb: (res: unknown) => void) => {
    const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
    const res = {
      statusCode,
      on(event: string, fn: (...args: unknown[]) => void) {
        listeners[event] = listeners[event] ?? [];
        listeners[event].push(fn);
        return res;
      },
    };

    cb(res);

    setTimeout(() => {
      const dataListeners = listeners['data'] ?? [];
      for (const fn of dataListeners) fn(Buffer.from(body));
      const endListeners = listeners['end'] ?? [];
      for (const fn of endListeners) fn();
    }, 0);

    const reqEmitter = {
      on(_event: string, _fn: unknown) {
        return reqEmitter;
      },
      setTimeout(_ms: number, _fn: unknown) {
        return reqEmitter;
      },
    };
    return reqEmitter;
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SkillRegistryService', () => {
  const workspaceRoot = '/test/vault';
  let service: InstanceType<typeof SkillRegistryService>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SkillRegistryService(workspaceRoot);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('fetchSkillContent', () => {
    it('Test A: happy path — returns content and parses version comment', async () => {
      const content = '<!-- version: 1.2.3 -->\n# tmr-inbox\n\nSkill content here.';
      makeHttpResponse(200, content);

      const result = await service.fetchSkillContent('tmr-inbox');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe('1.2.3');
        expect(result.data.content).toBe(content);
      }
    });

    it('Test B: 404 response — returns skill not found error', async () => {
      makeHttpResponse(404, 'Not Found');

      const result = await service.fetchSkillContent('nonexistent-skill');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('not found');
        expect(result.error).toContain('nonexistent-skill');
      }
    });

    it('returns version 0.0.0 when no version comment present', async () => {
      makeHttpResponse(200, '# Skill without version comment');

      const result = await service.fetchSkillContent('tmr-inbox');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe('0.0.0');
      }
    });
  });

  describe('isInstalled', () => {
    it('Test C: returns false when manifest does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      expect(service.isInstalled('tmr-inbox')).toBe(false);
    });

    it('returns true when manifest contains the skill', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify([
          { name: 'tmr-inbox', version: '1.0.0', installedAt: '2026-01-01T00:00:00.000Z' },
        ]),
      );

      expect(service.isInstalled('tmr-inbox')).toBe(true);
    });
  });

  describe('installSkill', () => {
    it('Test D: writes SKILL.md to correct path and upserts manifest', () => {
      mockExistsSync.mockReturnValue(false);

      service.installSkill('tmr-inbox', '<!-- version: 1.0.0 -->\n# Skill', '1.0.0');

      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining(`.claude/skills/tmr-inbox`),
        { recursive: true },
      );
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining('SKILL.md'),
        '<!-- version: 1.0.0 -->\n# Skill',
        'utf8',
      );
      const manifestCall = (mockWriteFileSync.mock.calls as unknown[][]).find((args) =>
        String(args[0]).endsWith('skill-manifest.json'),
      );
      expect(manifestCall).toBeDefined();
      const manifestData = JSON.parse(String(manifestCall![1])) as unknown[];
      expect(manifestData).toHaveLength(1);
      expect((manifestData[0] as Record<string, string>)['name']).toBe('tmr-inbox');
      expect((manifestData[0] as Record<string, string>)['version']).toBe('1.0.0');
    });
  });
});
