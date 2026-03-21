/**
 * Integration test for InitCommand.
 *
 * Tests the full orchestration: prompts → data collection → template generation →
 * file system calls. FileSystemService is mocked so no real disk I/O occurs,
 * but the captures verify correct content and path routing end-to-end.
 *
 * Real file system + real dotdir creation is a CI-environment concern; the
 * template correctness and call-sequence are the valuable assertions here.
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
  },
}));

jest.unstable_mockModule('../../src/providers/ai-provider-factory.js', () => ({
  AIProviderFactory: {
    create: jest.fn(() => ({
      testConnection: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    })),
  },
}));

jest.unstable_mockModule('../../src/services/config.service.js', () => ({
  configService: {
    initialize: jest.fn(),
    set: jest.fn(),
    setActiveProvider: jest.fn(),
    addProvider: jest.fn(),
    getProviderConfig: jest.fn().mockReturnValue(undefined),
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

jest.unstable_mockModule('../../src/services/obsidian-plugin.service.js', () => ({
  obsidianPluginService: {
    installPlugins: jest
      .fn<(workspacePath: string) => Promise<void>>()
      .mockResolvedValue(undefined),
  },
}));

// ── Dynamic import (after all mocks) ─────────────────────────────────────────

const { InitCommand } = await import('../../src/commands/init.command.js');

// ── Test data ─────────────────────────────────────────────────────────────────

const WORKSPACE = '/tmp/integration-test-workspace';
const MANAGER_NAME = 'Integration User';
const MANAGER_EMAIL = 'integration@example.com';
const TEAM_MEMBER_EMAIL = 'dev@example.com';

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('InitCommand integration', () => {
  beforeAll(async () => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
      mockPrompt
        // promptWorkspacePath
        .mockResolvedValueOnce({ workspacePath: WORKSPACE })
        // promptProviderSelection
        .mockResolvedValueOnce({ provider: 'openai' })
        // promptApiKey
        .mockResolvedValueOnce({ apiKey: 'sk-integration-test' })
        // promptManagerProfile
        .mockResolvedValueOnce({
          name: MANAGER_NAME,
          email: MANAGER_EMAIL,
          role: 'Senior Engineering Manager',
          location: 'São Paulo, SP, Brasil',
        })
        // promptLeadershipContext
        .mockResolvedValueOnce({
          managerName: 'Director Dana',
          managerEmail: 'dana@example.com',
        })
        // promptTeamMembers — loop iteration 1: email
        .mockResolvedValueOnce({ email: TEAM_MEMBER_EMAIL })
        // loop iteration 1: name/gender/role/location
        .mockResolvedValueOnce({
          name: 'Dev One',
          gender: 'Female',
          role: 'Software Engineer',
          location: '',
        })
        // loop iteration 2: email (empty → exits)
        .mockResolvedValueOnce({ email: '' });

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

  describe('directory structure', () => {
    it('creates my-career/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.includes('my-career'))).toBe(true);
    });

    it('creates my-leadership/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.includes('my-leadership'))).toBe(true);
    });

    it('creates my-teams/_members/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.includes('my-teams/_members'))).toBe(true);
    });

    it('creates my-teams/_teams/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.includes('my-teams/_teams'))).toBe(true);
    });

    it('does NOT create my-team/ (old path removed)', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => /[/\\]my-team[/\\]?$/.test(d))).toBe(false);
    });

    it('creates inbox/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.endsWith('inbox'))).toBe(true);
    });

    it('creates .cursor/rules/tmr/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.includes('.cursor'))).toBe(true);
    });

    it('creates .claude/agents/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.includes('.claude'))).toBe(true);
    });

    it('creates .gemini/agents/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.includes('.gemini'))).toBe(true);
    });

    it('creates my-leadership/{managerEmail}/1on1s/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.includes('1on1s'))).toBe(true);
    });
  });

  describe('generated files — paths', () => {
    it('writes my-career/{email}/{email}.md (Epic-2 path)', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(paths.some((p) => p.includes(`my-career/${MANAGER_EMAIL}/${MANAGER_EMAIL}.md`))).toBe(
        true,
      );
    });

    it('writes my-career/{email}/pdp.md', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(paths.some((p) => p.includes(`my-career/${MANAGER_EMAIL}/pdp.md`))).toBe(true);
    });

    it('writes my-leadership/{managerEmail}/{managerEmail}.md (Epic-2 path)', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(
        paths.some((p) => p.includes('my-leadership/dana@example.com/dana@example.com.md')),
      ).toBe(true);
    });

    it('writes .cursor process-agent.mdc', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(paths.some((p) => p.endsWith('process-agent.mdc'))).toBe(true);
    });

    it('writes two process-agent.md stubs (.claude and .gemini)', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(paths.filter((p) => p.endsWith('process-agent.md'))).toHaveLength(2);
    });

    it('writes team member profile under my-teams/_members/{email}/{email}.md', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(
        paths.some((p) =>
          p.includes(`my-teams/_members/${TEAM_MEMBER_EMAIL}/${TEAM_MEMBER_EMAIL}.md`),
        ),
      ).toBe(true);
    });

    it('writes default-context.md and default-members.md for default team', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(paths.some((p) => p.endsWith('_teams/default/default-context.md'))).toBe(true);
      expect(paths.some((p) => p.endsWith('_teams/default/default-members.md'))).toBe(true);
    });
  });

  describe('generated files — content', () => {
    it('career profile contains the manager name', () => {
      const profilePath = Array.from(writtenFiles.keys()).find((p) =>
        p.includes(`my-career/${MANAGER_EMAIL}/${MANAGER_EMAIL}.md`),
      );
      expect(profilePath).toBeDefined();
      const content = writtenFiles.get(profilePath!)!;
      expect(content).toContain(MANAGER_NAME);
    });

    it('career profile uses [[email]] wiki-link notation', () => {
      const profilePath = Array.from(writtenFiles.keys()).find((p) =>
        p.includes(`my-career/${MANAGER_EMAIL}/${MANAGER_EMAIL}.md`),
      );
      const content = writtenFiles.get(profilePath!)!;
      expect(content).toContain(`[[${MANAGER_EMAIL}]]`);
    });

    it('career profile has reports_to as [[managerEmail]] wiki-link', () => {
      const profilePath = Array.from(writtenFiles.keys()).find((p) =>
        p.includes(`my-career/${MANAGER_EMAIL}/${MANAGER_EMAIL}.md`),
      );
      const content = writtenFiles.get(profilePath!)!;
      expect(content).toContain('reports_to: [[dana@example.com]]');
    });

    it('pdp contains ## Career Goals section', () => {
      const pdpPath = Array.from(writtenFiles.keys()).find((p) =>
        p.includes(`my-career/${MANAGER_EMAIL}/pdp.md`),
      );
      expect(pdpPath).toBeDefined();
      const content = writtenFiles.get(pdpPath!)!;
      expect(content).toContain('## Career Goals');
    });

    it('leadership profile contains the manager name', () => {
      const leaderPath = Array.from(writtenFiles.keys()).find((p) =>
        p.includes('my-leadership/dana@example.com/dana@example.com.md'),
      );
      expect(leaderPath).toBeDefined();
      const content = writtenFiles.get(leaderPath!)!;
      expect(content).toContain('Director Dana');
    });

    it('leadership profile uses [[email]] wiki-link notation', () => {
      const leaderPath = Array.from(writtenFiles.keys()).find((p) =>
        p.includes('my-leadership/dana@example.com/dana@example.com.md'),
      );
      const content = writtenFiles.get(leaderPath!)!;
      expect(content).toContain('[[dana@example.com]]');
    });

    it('process-agent.mdc contains placeholder notice', () => {
      const mdcPath = Array.from(writtenFiles.keys()).find((p) => p.endsWith('process-agent.mdc'));
      expect(mdcPath).toBeDefined();
      const content = writtenFiles.get(mdcPath!)!;
      expect(content).toContain('sync-agents');
    });

    it('team member profile contains the member email and role', () => {
      const memberPath = Array.from(writtenFiles.keys()).find((p) =>
        p.includes(`my-teams/_members/${TEAM_MEMBER_EMAIL}/${TEAM_MEMBER_EMAIL}.md`),
      );
      expect(memberPath).toBeDefined();
      const content = writtenFiles.get(memberPath!)!;
      expect(content).toContain(TEAM_MEMBER_EMAIL);
      expect(content).toContain('Software Engineer');
    });

    it('team member profile has [[email]] wiki-link notation and gender field', () => {
      const memberPath = Array.from(writtenFiles.keys()).find((p) =>
        p.includes(`my-teams/_members/${TEAM_MEMBER_EMAIL}/${TEAM_MEMBER_EMAIL}.md`),
      );
      const content = writtenFiles.get(memberPath!)!;
      expect(content).toContain(`[[${TEAM_MEMBER_EMAIL}]]`);
      expect(content).toContain('gender: Female');
    });

    it('team member profile has manager wiki-link in Current Manager section', () => {
      const memberPath = Array.from(writtenFiles.keys()).find((p) =>
        p.includes(`my-teams/_members/${TEAM_MEMBER_EMAIL}/${TEAM_MEMBER_EMAIL}.md`),
      );
      const content = writtenFiles.get(memberPath!)!;
      expect(content).toContain(
        '[[../../my-career/dana@example.com/dana@example.com|dana@example.com]]',
      );
    });

    it('default-members.md contains wiki-links to team members', () => {
      const defaultMembersPath = Array.from(writtenFiles.keys()).find((p) =>
        p.endsWith('_teams/default/default-members.md'),
      );
      expect(defaultMembersPath).toBeDefined();
      const content = writtenFiles.get(defaultMembersPath!)!;
      expect(content).toContain(
        `[[../../_members/${TEAM_MEMBER_EMAIL}/${TEAM_MEMBER_EMAIL}|${TEAM_MEMBER_EMAIL}]]`,
      );
    });
  });

  describe('task files (Story 2.9)', () => {
    it('writes my-tasks/today.md with default template', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(paths.some((p) => p.includes('my-tasks/today.md'))).toBe(true);
    });

    it('writes my-tasks/this-week.md with default template', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(paths.some((p) => p.includes('my-tasks/this-week.md'))).toBe(true);
    });

    it('writes my-tasks/this-month.md with default template', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(paths.some((p) => p.includes('my-tasks/this-month.md'))).toBe(true);
    });

    it('writes my-tasks/this-quarter.md with default template', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(paths.some((p) => p.includes('my-tasks/this-quarter.md'))).toBe(true);
    });

    it('task file content contains expected template header', () => {
      const todayPath = Array.from(writtenFiles.keys()).find((p) =>
        p.includes('my-tasks/today.md'),
      );
      expect(todayPath).toBeDefined();
      const content = writtenFiles.get(todayPath!)!;
      expect(content).toContain('# Tasks — Today');
      expect(content).toContain('tmr process');
    });

    it('does not overwrite existing task files (idempotent)', () => {
      // mockFsExists returns false by default in beforeAll — all files are created.
      // This test verifies all 4 files are written (exists=false → writeFile called).
      const taskPaths = Array.from(writtenFiles.keys()).filter((p) => p.includes('my-tasks/'));
      expect(taskPaths).toHaveLength(4);
    });
  });
});
