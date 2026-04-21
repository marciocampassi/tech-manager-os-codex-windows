/**
 * Integration test for InitCommand (Story 4.1 pivot).
 *
 * Tests the full orchestration of the new minimal 4-question onboarding:
 * workspace path prompt → minimal onboarding → scaffold → tasks → CLAUDE.md → plugins.
 *
 * FileSystemService is mocked so no real disk I/O occurs; all writeFile calls
 * are captured in a Map to assert correct paths and content end-to-end.
 */
import { describe, it, expect, jest, afterAll, beforeAll } from '@jest/globals';

// ── Mock declarations (must precede dynamic imports) ──────────────────────────

const mockPrompt = jest.fn<() => Promise<Record<string, unknown>>>();

jest.unstable_mockModule('inquirer', () => ({
  default: { prompt: mockPrompt },
}));

jest.unstable_mockModule('ora', () => ({
  default: jest.fn(() => ({
    start: jest.fn(() => ({
      succeed: jest.fn(),
      fail: jest.fn(),
    })),
  })),
}));

jest.unstable_mockModule('boxen', () => ({
  default: jest.fn((_content: string) => '[banner]'),
}));

function makeBold(s: string): string {
  return s;
}
makeBold.cyan = (s: string) => s;
makeBold.green = (s: string) => s;

jest.unstable_mockModule('chalk', () => ({
  default: {
    bold: makeBold,
    gray: (s: string) => s,
    dim: (s: string) => s,
    cyan: (s: string) => s,
    green: (s: string) => s,
  },
}));

// Capture all writeFile calls to assert content without touching real disk
const writtenFiles = new Map<string, string>();
const mockCreateDirectory = jest.fn<(path: string) => Promise<void>>().mockResolvedValue(undefined);
const mockWriteFile = jest
  .fn<(path: string, content: string) => Promise<void>>()
  .mockImplementation(async (filePath, content) => {
    writtenFiles.set(filePath, content);
  });
const mockFsExists = jest.fn<(path: string) => Promise<boolean>>().mockResolvedValue(false);

jest.unstable_mockModule('../../src/services/file-system.service.js', () => ({
  fileSystemService: {
    createDirectory: mockCreateDirectory,
    writeFile: mockWriteFile,
    exists: mockFsExists,
  },
}));

const mockInstallPlugins = jest
  .fn<(workspacePath: string) => Promise<void>>()
  .mockResolvedValue(undefined);

jest.unstable_mockModule('../../src/services/obsidian-plugin.service.js', () => ({
  obsidianPluginService: { installPlugins: mockInstallPlugins },
}));

jest.unstable_mockModule('../../src/services/config.service.js', () => ({
  configService: {
    initialize: jest.fn<() => void>(),
    setWorkspacePath: jest.fn<(p: string) => void>(),
  },
}));

// ── Dynamic import (after all mocks) ─────────────────────────────────────────

const { InitCommand } = await import('../../src/commands/init.command.js');

// ── Test data ─────────────────────────────────────────────────────────────────

const WORKSPACE = '/tmp/integration-test-workspace';
const USER_NAME = 'Integration User';
const USER_EMAIL = 'integration@example.com';
const USER_ROLE = 'Senior Engineering Manager';
const USER_COMPANY = 'example.com';

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('InitCommand integration (Story 4.1 — minimal onboarding)', () => {
  beforeAll(async () => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      mockPrompt
        // promptWorkspacePath
        .mockResolvedValueOnce({ workspacePath: WORKSPACE })
        // promptMinimalOnboarding — single call returning all 4 fields
        .mockResolvedValueOnce({
          name: USER_NAME,
          email: USER_EMAIL,
          role: USER_ROLE,
          company: USER_COMPANY,
        });

      await new InitCommand().run();
    } catch (err) {
      jest.restoreAllMocks();
      throw err;
    }
  });

  afterAll(() => {
    jest.restoreAllMocks();
    writtenFiles.clear();
  });

  describe('directory structure — template directories (AC: 2)', () => {
    it('creates inbox/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.endsWith('inbox'))).toBe(true);
    });

    it('creates archive/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.endsWith('archive'))).toBe(true);
    });

    it('creates config/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.endsWith('config'))).toBe(true);
    });

    it('creates my-career/assessments/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.includes('my-career/assessments'))).toBe(true);
    });

    it('creates my-career/feedbacks/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.includes('my-career/feedbacks'))).toBe(true);
    });

    it('creates my-teams/members/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.includes('my-teams/members'))).toBe(true);
    });

    it('creates my-teams/feedback-templates/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.includes('my-teams/feedback-templates'))).toBe(true);
    });

    it('creates .claude/skills/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.includes('.claude/skills'))).toBe(true);
    });

    it('creates knowledge-base/branding-guidelines/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.includes('knowledge-base/branding-guidelines'))).toBe(true);
    });

    it('creates knowledge-base/security/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.includes('knowledge-base/security'))).toBe(true);
    });

    it('creates .obsidian/plugins/dataview/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.includes('.obsidian/plugins/dataview'))).toBe(true);
    });

    it('creates my-leadership/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.includes('my-leadership'))).toBe(true);
    });
  });

  describe('CLAUDE.md generation (AC: 4)', () => {
    it('writes CLAUDE.md at the vault root', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(paths.some((p) => p === `${WORKSPACE}/CLAUDE.md`)).toBe(true);
    });

    it('CLAUDE.md contains the identity block with user name', () => {
      const content = writtenFiles.get(`${WORKSPACE}/CLAUDE.md`);
      expect(content).toBeDefined();
      expect(content).toContain(USER_NAME);
    });

    it('CLAUDE.md contains the identity block with user email', () => {
      const content = writtenFiles.get(`${WORKSPACE}/CLAUDE.md`);
      expect(content).toContain(USER_EMAIL);
    });

    it('CLAUDE.md contains the identity block with user role', () => {
      const content = writtenFiles.get(`${WORKSPACE}/CLAUDE.md`);
      expect(content).toContain(USER_ROLE);
    });

    it('CLAUDE.md contains the identity block with company', () => {
      const content = writtenFiles.get(`${WORKSPACE}/CLAUDE.md`);
      expect(content).toContain(USER_COMPANY);
    });

    it('CLAUDE.md contains Vault Structure section', () => {
      const content = writtenFiles.get(`${WORKSPACE}/CLAUDE.md`);
      expect(content).toContain('## Vault Structure');
    });

    it('CLAUDE.md contains Communication Style section with placeholders', () => {
      const content = writtenFiles.get(`${WORKSPACE}/CLAUDE.md`);
      expect(content).toContain('## Communication Style');
      expect(content).toContain('Preferred tone');
    });

    it('CLAUDE.md contains pointer to my-company/', () => {
      const content = writtenFiles.get(`${WORKSPACE}/CLAUDE.md`);
      expect(content).toContain('my-company/');
    });
  });

  describe('task files (AC: 2)', () => {
    it('writes my-tasks/tasks.md', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(paths.some((p) => p.includes('my-tasks/tasks.md'))).toBe(true);
    });

    it('writes my-tasks/today.md', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(paths.some((p) => p.includes('my-tasks/today.md'))).toBe(true);
    });

    it('writes my-tasks/this-week.md', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(paths.some((p) => p.includes('my-tasks/this-week.md'))).toBe(true);
    });

    it('writes my-tasks/this-month.md', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(paths.some((p) => p.includes('my-tasks/this-month.md'))).toBe(true);
    });

    it('writes my-tasks/this-quarter.md', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(paths.some((p) => p.includes('my-tasks/this-quarter.md'))).toBe(true);
    });
  });

  describe('Obsidian plugin installation (AC: 3)', () => {
    it('calls obsidianPluginService.installPlugins with workspace path', () => {
      expect(mockInstallPlugins).toHaveBeenCalledWith(WORKSPACE);
    });
  });

  describe('no old onboarding data written (AC: 1, 6)', () => {
    it('does NOT write any my-career/{email}.md profile (removed in pivot)', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(
        paths.some((p) => p.includes('my-career/') && p.endsWith('.md') && p.includes('@')),
      ).toBe(false);
    });

    it('does NOT write any my-leadership/{email}.md profile (removed in pivot)', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(
        paths.some((p) => p.includes('my-leadership/') && p.endsWith('.md') && p.includes('@')),
      ).toBe(false);
    });

    it('uses exactly 2 prompt calls — workspace path + minimal onboarding (no API key prompts)', () => {
      expect(mockPrompt).toHaveBeenCalledTimes(2);
    });
  });
});
