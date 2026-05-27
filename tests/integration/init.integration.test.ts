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
    blue: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
  },
}));

// Capture all writeFile / appendFile calls to assert content without touching real disk
const writtenFiles = new Map<string, string>();
const appendedContent = new Map<string, string[]>();

const mockCreateDirectory = jest.fn<(path: string) => Promise<void>>().mockResolvedValue(undefined);
const mockWriteFile = jest
  .fn<(path: string, content: string) => Promise<void>>()
  .mockImplementation(async (filePath, content) => {
    writtenFiles.set(filePath, content);
  });
const mockFsExists = jest.fn<(path: string) => Promise<boolean>>().mockResolvedValue(false);
const mockReadFile = jest
  .fn<(path: string) => Promise<string>>()
  .mockResolvedValue('# Team Members\n');
const mockAppendFile = jest
  .fn<(path: string, content: string) => Promise<void>>()
  .mockImplementation(async (filePath, content) => {
    const existing = appendedContent.get(filePath) ?? [];
    existing.push(content);
    appendedContent.set(filePath, existing);
  });
const mockListDirectories = jest.fn<(path: string) => Promise<string[]>>().mockResolvedValue([]);

jest.unstable_mockModule('../../src/services/file-system.service.js', () => ({
  fileSystemService: {
    createDirectory: mockCreateDirectory,
    writeFile: mockWriteFile,
    exists: mockFsExists,
    readFile: mockReadFile,
    appendFile: mockAppendFile,
    listDirectories: mockListDirectories,
  },
}));

const mockInstallPlugins = jest
  .fn<(workspacePath: string) => Promise<string[]>>()
  .mockResolvedValue([]);

jest.unstable_mockModule('../../src/services/obsidian-plugin.service.js', () => ({
  obsidianPluginService: { installPlugins: mockInstallPlugins },
}));

jest.unstable_mockModule('../../src/services/config.service.js', () => ({
  configService: {
    initialize: jest.fn<() => void>(),
    setWorkspacePath: jest.fn<(p: string) => void>(),
    set: jest.fn<(key: string, value: unknown) => void>(),
  },
}));

const mockFetchSkillContent = jest
  .fn<() => Promise<{ success: true; data: { content: string; version: string } }>>()
  .mockResolvedValue({ success: true, data: { content: '# tmr-inbox skill', version: '1.0.0' } });
const mockInstallSkillFn = jest.fn<() => void>();

jest.unstable_mockModule('../../src/services/skill-registry.service.js', () => ({
  SkillRegistryService: jest.fn().mockImplementation(() => ({
    fetchSkillContent: mockFetchSkillContent,
    installSkill: mockInstallSkillFn,
  })),
}));

jest.unstable_mockModule('node:fs', () => ({
  default: {
    mkdirSync: jest.fn(),
    readFileSync: jest.fn().mockReturnValue('# bundled skill content'),
    writeFileSync: jest.fn(),
    existsSync: jest.fn().mockReturnValue(false),
    readdirSync: jest.fn().mockReturnValue([]),
  },
  mkdirSync: jest.fn(),
  readFileSync: jest.fn().mockReturnValue('# bundled skill content'),
  writeFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(false),
  readdirSync: jest.fn().mockReturnValue([]),
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
const MEMBER_1_EMAIL = FIXTURE_DATA.MEMBER_1_EMAIL;
const MEMBER_1_NAME = FIXTURE_DATA.MEMBER_1_NAME;
const MEMBER_1_ROLE = FIXTURE_DATA.MEMBER_1_ROLE;
const MEMBER_1_GENDER = FIXTURE_DATA.MEMBER_1_GENDER;
const MEMBER_1_LOCATION = FIXTURE_DATA.MEMBER_1_LOCATION;

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('InitCommand integration (Story 2.3 — member collection loop)', () => {
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
    appendedContent.clear();
    mockReadFile.mockClear();
    mockAppendFile.mockClear();
    mockListDirectories.mockClear();
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
    it('writes my-career/<email>.md (flat — no subdirectory)', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(paths.some((p) => p.endsWith(`my-career/${USER_EMAIL}.md`))).toBe(true);
    });

    it('user profile contains the user email in frontmatter', () => {
      const profilePath = `${WORKSPACE}/my-career/${USER_EMAIL}.md`;
      const content = writtenFiles.get(profilePath);
      expect(content).toBeDefined();
      expect(content).toContain(USER_EMAIL);
    });

    it('user profile contains the user name', () => {
      const profilePath = `${WORKSPACE}/my-career/${USER_EMAIL}.md`;
      const content = writtenFiles.get(profilePath);
      expect(content).toContain(USER_NAME);
    });

    it('user profile contains the user role', () => {
      const profilePath = `${WORKSPACE}/my-career/${USER_EMAIL}.md`;
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
    it('uses exactly 12 prompt calls — workspace + nameEmail + additionalDomains + roleCompany + leader + count + 2 names + member loop', () => {
      expect(mockPrompt).toHaveBeenCalledTimes(12);
    });
  });

  describe('member files (AC: 1, 2 — INIT-INT-003)', () => {
    it('writes member profile at my-teams/members/<email>/<email>.md', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(
        paths.some((p) => p.includes(`my-teams/members/${MEMBER_1_EMAIL}/${MEMBER_1_EMAIL}.md`)),
      ).toBe(true);
    });

    it('member profile contains correct email in frontmatter', () => {
      const profilePath = `${WORKSPACE}/my-teams/members/${MEMBER_1_EMAIL}/${MEMBER_1_EMAIL}.md`;
      const content = writtenFiles.get(profilePath);
      expect(content).toBeDefined();
      expect(content).toContain(MEMBER_1_EMAIL);
    });

    it('member profile contains correct name', () => {
      const profilePath = `${WORKSPACE}/my-teams/members/${MEMBER_1_EMAIL}/${MEMBER_1_EMAIL}.md`;
      const content = writtenFiles.get(profilePath);
      expect(content).toContain(MEMBER_1_NAME);
    });

    it('member profile contains correct role', () => {
      const profilePath = `${WORKSPACE}/my-teams/members/${MEMBER_1_EMAIL}/${MEMBER_1_EMAIL}.md`;
      const content = writtenFiles.get(profilePath);
      expect(content).toContain(MEMBER_1_ROLE);
    });

    it('member profile contains gender in frontmatter (AC2/INIT-INT-003)', () => {
      const profilePath = `${WORKSPACE}/my-teams/members/${MEMBER_1_EMAIL}/${MEMBER_1_EMAIL}.md`;
      const content = writtenFiles.get(profilePath);
      expect(content).toContain(MEMBER_1_GENDER);
    });

    it('member profile contains location in frontmatter', () => {
      const profilePath = `${WORKSPACE}/my-teams/members/${MEMBER_1_EMAIL}/${MEMBER_1_EMAIL}.md`;
      const content = writtenFiles.get(profilePath);
      expect(content).toContain(MEMBER_1_LOCATION);
    });

    it('appends wiki-link to team 1 members file (AC: 5 — INIT-INT-013)', () => {
      const membersFilePath = `${WORKSPACE}/my-teams/teams/${TEAM_1_SLUG}/${TEAM_1_SLUG}-members.md`;
      const appended = appendedContent.get(membersFilePath);
      expect(appended).toBeDefined();
      expect(appended?.join('')).toContain(
        `[[../../members/${MEMBER_1_EMAIL}/${MEMBER_1_EMAIL}.md|${MEMBER_1_EMAIL}]]`,
      );
    });
  });

  describe('member loop sentinel — Team 2 gets no members (AC: 4 — INIT-INT-008)', () => {
    it('no member profile file is written for Team 2 (empty sentinel ends loop immediately)', () => {
      const paths = Array.from(writtenFiles.keys());
      const team2MemberProfiles = paths.filter(
        (p) => p.includes('my-teams/members/') && !p.includes(MEMBER_1_EMAIL),
      );
      expect(team2MemberProfiles).toHaveLength(0);
    });

    it('no wiki-link is appended to the Team 2 members file', () => {
      const membersFilePath = `${WORKSPACE}/my-teams/teams/${TEAM_2_SLUG}/${TEAM_2_SLUG}-members.md`;
      const appended = appendedContent.get(membersFilePath) ?? [];
      expect(appended).toHaveLength(0);
    });
  });

  // ── README generation (AC: 3 — INIT-INT-012) ─────────────────────────────

  describe('README generation (AC: 3 — INIT-INT-012)', () => {
    it('README.md is written to the vault root', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(paths.some((p) => p === `${WORKSPACE}/README.md`)).toBe(true);
    });

    it('README.md content contains "tmr project add"', () => {
      const content = writtenFiles.get(`${WORKSPACE}/README.md`);
      expect(content).toBeDefined();
      expect(content).toContain('tmr project add');
    });
  });

  // ── sample inbox files (AC: 1 — FR11) ────────────────────────────────────

  describe('sample inbox files (AC: 1 — FR11)', () => {
    it('inbox/2026-04-10-Marlon-Alex.md is written', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(paths.some((p) => p === `${WORKSPACE}/inbox/2026-04-10-Marlon-Alex.md`)).toBe(true);
    });

    it('inbox/2026-04-15-Team-Sync.md is written', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(paths.some((p) => p === `${WORKSPACE}/inbox/2026-04-15-Team-Sync.md`)).toBe(true);
    });
  });

  // ── skill installs (AC: 5) ─────────────────────────────────────────────────

  describe('skill installs (AC: 5)', () => {
    it('installSkill called for tmr-inbox', () => {
      expect(mockInstallSkillFn).toHaveBeenCalledWith(
        'tmr-inbox',
        expect.any(String),
        expect.any(String),
      );
    });

    it('installSkill called for tmr-project-impact', () => {
      expect(mockInstallSkillFn).toHaveBeenCalledWith(
        'tmr-project-impact',
        expect.any(String),
        expect.any(String),
      );
    });

    it('installSkill called for tmr-myself-config', () => {
      expect(mockInstallSkillFn).toHaveBeenCalledWith(
        'tmr-myself-config',
        expect.any(String),
        expect.any(String),
      );
    });
  });

  // ── full happy path — INIT-INT-001 ────────────────────────────────────────

  describe('full happy path — INIT-INT-001', () => {
    it('README, sample files, and member profile are all present', () => {
      const paths = Array.from(writtenFiles.keys());
      expect(paths.some((p) => p === `${WORKSPACE}/README.md`)).toBe(true);
      expect(paths.some((p) => p === `${WORKSPACE}/inbox/2026-04-10-Marlon-Alex.md`)).toBe(true);
      expect(paths.some((p) => p === `${WORKSPACE}/inbox/2026-04-15-Team-Sync.md`)).toBe(true);
      expect(
        paths.some((p) => p.includes(`my-teams/members/${MEMBER_1_EMAIL}/${MEMBER_1_EMAIL}.md`)),
      ).toBe(true);
    });

    it('career profile contains leadership wiki-link', () => {
      const careerPath = `${WORKSPACE}/my-career/${USER_EMAIL}.md`;
      const content = writtenFiles.get(careerPath);
      expect(content).toBeDefined();
      expect(content).toContain(LEADER_EMAIL);
    });
  });
});

// ── skill install failure — INIT-INT-010 ─────────────────────────────────────

describe('InitCommand integration — skill install failure (INIT-INT-010)', () => {
  const writtenFiles2 = new Map<string, string>();

  beforeAll(async () => {
    mockPrompt.mockReset();
    // Simulate installSkill throwing — init must still complete despite skill registry error
    mockInstallSkillFn.mockImplementationOnce(() => {
      throw new Error('simulated registry error');
    });

    mockWriteFile.mockReset();
    mockWriteFile.mockImplementation(async (filePath: string, content: string) => {
      writtenFiles2.set(filePath, content);
    });
    mockCreateDirectory.mockReset().mockResolvedValue(undefined);
    mockFsExists.mockReset().mockResolvedValue(false);
    mockReadFile.mockReset().mockResolvedValue('# Team Members\n');
    mockAppendFile.mockReset();
    mockListDirectories.mockReset().mockResolvedValue([]);
    mockInstallPlugins.mockReset().mockResolvedValue([]);

    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    applyInitPromptFixture(
      'happy-path',
      mockPrompt as jest.MockedFunction<() => Promise<Record<string, unknown>>>,
    );

    try {
      await new InitCommand().run();
    } catch {
      // init should NOT throw on skill failure
    }
  });

  afterAll(() => {
    jest.restoreAllMocks();
    writtenFiles2.clear();
  });

  it('init completes: README.md is written even when skill install fails', () => {
    expect(writtenFiles2.has(`${WORKSPACE}/README.md`)).toBe(true);
  });

  it('init completes: CLAUDE.md is written even when skill install fails', () => {
    expect(writtenFiles2.has(`${WORKSPACE}/CLAUDE.md`)).toBe(true);
  });

  it('init completes: inbox/2026-04-10-Marlon-Alex.md is written even when skill install fails', () => {
    expect(writtenFiles2.has(`${WORKSPACE}/inbox/2026-04-10-Marlon-Alex.md`)).toBe(true);
  });
});

// ── INIT-INT-007: member loop state preservation (multi-member team) ──────────

describe('InitCommand integration — multi-member team (INIT-INT-007)', () => {
  const writtenFiles3 = new Map<string, string>();
  const appendedFiles3 = new Map<string, string[]>();

  beforeAll(async () => {
    mockPrompt.mockReset();
    mockPrompt
      // 1. workspace
      .mockResolvedValueOnce({ workspacePath: WORKSPACE })
      // 2. promptNameAndEmail
      .mockResolvedValueOnce({ name: FIXTURE_DATA.USER_NAME, email: FIXTURE_DATA.USER_EMAIL })
      // 3. promptAdditionalDomains — skip
      .mockResolvedValueOnce({ raw: '' })
      // 4. promptRoleAndCompany
      .mockResolvedValueOnce({ role: FIXTURE_DATA.USER_ROLE, company: FIXTURE_DATA.USER_COMPANY })
      // 5. leader
      .mockResolvedValueOnce({
        name: FIXTURE_DATA.LEADER_NAME,
        email: FIXTURE_DATA.LEADER_EMAIL,
        role: FIXTURE_DATA.LEADER_ROLE,
        location: '',
      })
      // 6. team count = 2
      .mockResolvedValueOnce({ teamCount: '2' })
      // 7–8. team names
      .mockResolvedValueOnce({ teamName: FIXTURE_DATA.TEAM_1 })
      .mockResolvedValueOnce({ teamName: FIXTURE_DATA.TEAM_2 })
      // 9–10. Team 1 member 1
      .mockResolvedValueOnce({ memberEmail: MEMBER_1_EMAIL })
      .mockResolvedValueOnce({
        name: MEMBER_1_NAME,
        role: MEMBER_1_ROLE,
        gender: MEMBER_1_GENDER,
        location: MEMBER_1_LOCATION,
      })
      // 11–12. Team 1 member 2 (added after member 1 — validates state is preserved)
      .mockResolvedValueOnce({ memberEmail: 'second-member@example.com' })
      .mockResolvedValueOnce({ name: 'Second Member', role: 'Designer', gender: '', location: '' })
      // 13. Team 1 end loop
      .mockResolvedValueOnce({ memberEmail: '' })
      // 14. Team 2 end loop
      .mockResolvedValueOnce({ memberEmail: '' });

    mockWriteFile.mockReset().mockImplementation(async (filePath: string, content: string) => {
      writtenFiles3.set(filePath, content);
    });
    mockCreateDirectory.mockReset().mockResolvedValue(undefined);
    mockFsExists.mockReset().mockResolvedValue(false);
    mockReadFile.mockReset().mockResolvedValue('# Team Members\n');
    mockAppendFile.mockReset().mockImplementation(async (filePath: string, content: string) => {
      const existing = appendedFiles3.get(filePath) ?? [];
      existing.push(content);
      appendedFiles3.set(filePath, existing);
    });
    mockListDirectories.mockReset().mockResolvedValue([]);
    mockInstallPlugins.mockReset().mockResolvedValue([]);
    mockFetchSkillContent.mockReset().mockResolvedValue({
      success: true,
      data: { content: '# skill', version: '1.0.0' },
    });

    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await new InitCommand().run();
  });

  afterAll(() => {
    jest.restoreAllMocks();
    writtenFiles3.clear();
    appendedFiles3.clear();
  });

  it('INIT-INT-007: first member profile is written', () => {
    const paths = Array.from(writtenFiles3.keys());
    expect(
      paths.some((p) => p.includes(`my-teams/members/${MEMBER_1_EMAIL}/${MEMBER_1_EMAIL}.md`)),
    ).toBe(true);
  });

  it('INIT-INT-007: second member profile is also written — first member not lost', () => {
    const paths = Array.from(writtenFiles3.keys());
    expect(paths.some((p) => p.includes('my-teams/members/second-member@example.com'))).toBe(true);
  });

  it('INIT-INT-007: both members appear in team 1 members file', () => {
    const membersFilePath = `${WORKSPACE}/my-teams/teams/${TEAM_1_SLUG}/${TEAM_1_SLUG}-members.md`;
    const appended = appendedFiles3.get(membersFilePath)?.join('') ?? '';
    expect(appended).toContain(MEMBER_1_EMAIL);
    expect(appended).toContain('second-member@example.com');
  });
});

// ── INIT-INT-011: writeFile throws mid-flow (sample files) ───────────────────

describe('InitCommand integration — copySampleInboxFiles throws (INIT-INT-011)', () => {
  let stderrOutput = '';

  beforeAll(async () => {
    mockPrompt.mockReset();
    applyInitPromptFixture(
      'happy-path',
      mockPrompt as jest.MockedFunction<() => Promise<Record<string, unknown>>>,
    );

    mockWriteFile.mockReset().mockImplementation(async (filePath: string) => {
      if (filePath.includes('inbox/2026-04-10-Marlon-Alex.md')) {
        throw new Error('disk quota exceeded');
      }
    });
    mockCreateDirectory.mockReset().mockResolvedValue(undefined);
    mockFsExists.mockReset().mockResolvedValue(false);
    mockReadFile.mockReset().mockResolvedValue('# Team Members\n');
    mockAppendFile.mockReset();
    mockListDirectories.mockReset().mockResolvedValue([]);
    mockInstallPlugins.mockReset().mockResolvedValue([]);
    mockFetchSkillContent.mockReset().mockResolvedValue({
      success: true,
      data: { content: '# skill', version: '1.0.0' },
    });

    stderrOutput = '';
    jest.spyOn(process.stderr, 'write').mockImplementation((msg) => {
      stderrOutput += String(msg);
      return true;
    });
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await new InitCommand().run();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('INIT-INT-011: printError fires to stderr with the error message', () => {
    expect(stderrOutput).toContain('Failed to copy sample files');
  });

  it('INIT-INT-011: README.md is NOT written when sample file copy aborts init', () => {
    const writeCalls = (mockWriteFile.mock.calls as [string, string][]).map((c) => c[0]);
    expect(writeCalls.some((p) => p.endsWith('README.md'))).toBe(false);
  });
});
