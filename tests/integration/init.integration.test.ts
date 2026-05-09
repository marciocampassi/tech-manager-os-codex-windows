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
const { applyInitPromptFixture, FIXTURE_DATA } = await import('../fixtures/init-prompts.js');

// ── Convenience aliases ───────────────────────────────────────────────────────

const WORKSPACE = FIXTURE_DATA.WORKSPACE;
const USER_EMAIL = FIXTURE_DATA.USER_EMAIL;
const USER_NAME = FIXTURE_DATA.USER_NAME;
const USER_ROLE = FIXTURE_DATA.USER_ROLE;
const USER_COMPANY = FIXTURE_DATA.USER_COMPANY;
const LEADER_EMAIL = FIXTURE_DATA.LEADER_EMAIL;
const TEAM_1_SLUG = 'backend-team';
const TEAM_2_SLUG = 'frontend-team';

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('InitCommand integration (Story 2.2 — profile + leader + teams)', () => {
  beforeAll(async () => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      applyInitPromptFixture(
        'happy-path',
        mockPrompt as jest.MockedFunction<() => Promise<Record<string, unknown>>>,
      );
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

  // Story 2.1: InitService.scaffold() creates exactly 12 VAULT_DIRS.
  // Removed from old workspace-builder (config/, assessments/, feedbacks/, branding-guidelines/,
  // security/) are now out of scope for init. .obsidian/** is handled by obsidianPluginService.
  describe('directory structure — template directories (AC: 2)', () => {
    it('creates inbox/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.endsWith('inbox'))).toBe(true);
    });

    it('creates archive/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.endsWith('archive'))).toBe(true);
    });

    it('creates my-tasks/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.endsWith('my-tasks'))).toBe(true);
    });

    it('creates my-career/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.endsWith('my-career'))).toBe(true);
    });

    it('creates my-company/members/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.includes('my-company/members'))).toBe(true);
    });

    it('creates my-teams/members/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.includes('my-teams/members'))).toBe(true);
    });

    it('does NOT create my-teams/feedback-templates/ directory (Story 2.1 AC3)', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.includes('my-teams/feedback-templates'))).toBe(false);
    });

    it('creates .claude/skills/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.includes('.claude/skills'))).toBe(true);
    });

    it('creates .cursor/rules/tmr/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.includes('.cursor/rules/tmr'))).toBe(true);
    });

    it('creates my-teams/teams/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.includes('my-teams/teams'))).toBe(true);
    });

    it('creates knowledge-base/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.endsWith('knowledge-base'))).toBe(true);
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

  describe('user profile (AC: 1 — INIT-UNIT-004)', () => {
    it('writes my-career/<email>/<email>.md', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(paths.some((p) => p.includes(`my-career/${USER_EMAIL}/${USER_EMAIL}.md`))).toBe(true);
    });

    it('user profile contains the user email in frontmatter', () => {
      const profilePath = `${WORKSPACE}/my-career/${USER_EMAIL}/${USER_EMAIL}.md`;
      const content = writtenFiles.get(profilePath);
      expect(content).toBeDefined();
      expect(content).toContain(USER_EMAIL);
    });

    it('user profile contains the user name', () => {
      const profilePath = `${WORKSPACE}/my-career/${USER_EMAIL}/${USER_EMAIL}.md`;
      const content = writtenFiles.get(profilePath);
      expect(content).toContain(USER_NAME);
    });

    it('user profile contains the user role', () => {
      const profilePath = `${WORKSPACE}/my-career/${USER_EMAIL}/${USER_EMAIL}.md`;
      const content = writtenFiles.get(profilePath);
      expect(content).toContain(USER_ROLE);
    });
  });

  describe('leader profile (AC: 2 — INIT-UNIT-005)', () => {
    it('writes my-leadership/<email>/<email>.md', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(
        paths.some((p) => p.includes(`my-leadership/${LEADER_EMAIL}/${LEADER_EMAIL}.md`)),
      ).toBe(true);
    });

    it('leader profile contains the leader email', () => {
      const leaderPath = `${WORKSPACE}/my-leadership/${LEADER_EMAIL}/${LEADER_EMAIL}.md`;
      const content = writtenFiles.get(leaderPath);
      expect(content).toBeDefined();
      expect(content).toContain(LEADER_EMAIL);
    });
  });

  describe('team files (AC: 4, 5 — INIT-INT-009)', () => {
    it('writes team context file for team 1 (slug: backend-team)', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(paths.some((p) => p.includes(`my-teams/teams/${TEAM_1_SLUG}`))).toBe(true);
    });

    it('writes team context file for team 2 (slug: frontend-team)', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(paths.some((p) => p.includes(`my-teams/teams/${TEAM_2_SLUG}`))).toBe(true);
    });
  });

  describe('prompt call count', () => {
    it('uses exactly 6 prompt calls — workspace + onboarding + leader + count + 2 team names', () => {
      expect(mockPrompt).toHaveBeenCalledTimes(6);
    });
  });
});
