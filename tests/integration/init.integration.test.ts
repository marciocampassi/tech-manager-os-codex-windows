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

function makeBold(s: string): string { return s; }
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

jest.unstable_mockModule('../../src/services/file-system.service.js', () => ({
  fileSystemService: {
    createDirectory: mockCreateDirectory,
    writeFile: mockWriteFile,
  },
}));

// ── Dynamic import (after all mocks) ─────────────────────────────────────────

const { InitCommand } = await import('../../src/commands/init.command.js');

// ── Test data ─────────────────────────────────────────────────────────────────

const WORKSPACE = '/tmp/integration-test-workspace';
const MANAGER_NAME = 'Integration User';
const MANAGER_EMAIL = 'integration@example.com';

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('InitCommand integration', () => {
  beforeAll(async () => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    try {
    mockPrompt
      .mockResolvedValueOnce({ workspacePath: WORKSPACE })
      .mockResolvedValueOnce({ provider: 'openai' })
      .mockResolvedValueOnce({ apiKey: 'sk-integration-test' })
      .mockResolvedValueOnce({
        name: MANAGER_NAME,
        email: MANAGER_EMAIL,
        role: 'Senior Engineering Manager',
        experienceYears: 7,
        managementStyle: 'Servant',
        strengths: 'Empathy, Coaching, Communication',
        developmentAreas: 'Executive presence, Delegation',
      })
      .mockResolvedValueOnce({
        shortTerm: 'Build high-performing teams',
        longTerm: 'Become VP of Engineering',
        targetRole: 'VP of Engineering',
      })
      .mockResolvedValueOnce({
        managerName: 'Director Dana',
        managerEmail: 'dana@example.com',
        expectations: 'Scale engineering capability and delivery speed',
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

  describe('directory structure', () => {
    it('creates my-career/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.endsWith('my-career'))).toBe(true);
    });

    it('creates my-leadership/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.endsWith('my-leadership'))).toBe(true);
    });

    it('creates my-teams/ directory', () => {
      const dirs = mockCreateDirectory.mock.calls.map((c) => c[0]);
      expect(dirs.some((d) => d.endsWith('my-teams'))).toBe(true);
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
  });

  describe('generated files — paths', () => {
    it('writes my-career/profile.md', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(paths.some((p) => p.endsWith('my-career/profile.md'))).toBe(true);
    });

    it('writes my-career/pdp.md', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(paths.some((p) => p.endsWith('my-career/pdp.md'))).toBe(true);
    });

    it('writes my-leadership/profile.md', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(paths.some((p) => p.endsWith('my-leadership/profile.md'))).toBe(true);
    });

    it('writes .cursor cycle-agent.mdc', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(paths.some((p) => p.endsWith('cycle-agent.mdc'))).toBe(true);
    });

    it('writes two cycle-agent.md stubs (.claude and .gemini)', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(paths.filter((p) => p.endsWith('cycle-agent.md'))).toHaveLength(2);
    });
  });

  describe('generated files — content', () => {
    it('my-career/profile.md contains the manager name', () => {
      const profilePath = Array.from(writtenFiles.keys()).find((p) =>
        p.endsWith('my-career/profile.md'),
      );
      expect(profilePath).toBeDefined();
      const content = writtenFiles.get(profilePath!)!;
      expect(content).toContain(MANAGER_NAME);
    });

    it('my-career/profile.md contains the manager email', () => {
      const profilePath = Array.from(writtenFiles.keys()).find((p) =>
        p.endsWith('my-career/profile.md'),
      );
      const content = writtenFiles.get(profilePath!)!;
      expect(content).toContain(MANAGER_EMAIL);
    });

    it('my-career/profile.md has YAML frontmatter with strengths list', () => {
      const profilePath = Array.from(writtenFiles.keys()).find((p) =>
        p.endsWith('my-career/profile.md'),
      );
      const content = writtenFiles.get(profilePath!)!;
      expect(content).toContain('strengths:');
      expect(content).toContain('- Empathy');
    });

    it('my-career/pdp.md contains ## Career Goals section', () => {
      const pdpPath = Array.from(writtenFiles.keys()).find((p) =>
        p.endsWith('my-career/pdp.md'),
      );
      expect(pdpPath).toBeDefined();
      const content = writtenFiles.get(pdpPath!)!;
      expect(content).toContain('## Career Goals');
    });

    it('my-career/pdp.md contains the short-term goal', () => {
      const pdpPath = Array.from(writtenFiles.keys()).find((p) =>
        p.endsWith('my-career/pdp.md'),
      );
      const content = writtenFiles.get(pdpPath!)!;
      expect(content).toContain('Build high-performing teams');
    });

    it('my-leadership/profile.md contains the manager name', () => {
      const leaderPath = Array.from(writtenFiles.keys()).find((p) =>
        p.endsWith('my-leadership/profile.md'),
      );
      expect(leaderPath).toBeDefined();
      const content = writtenFiles.get(leaderPath!)!;
      expect(content).toContain('Director Dana');
    });

    it('cycle-agent.mdc contains placeholder notice', () => {
      const mdcPath = Array.from(writtenFiles.keys()).find((p) =>
        p.endsWith('cycle-agent.mdc'),
      );
      expect(mdcPath).toBeDefined();
      const content = writtenFiles.get(mdcPath!)!;
      expect(content).toContain('sync-agents');
    });
  });
});
