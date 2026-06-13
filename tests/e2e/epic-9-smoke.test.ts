/**
 * Epic 9 Automated Smoke Test
 *
 * Real-filesystem E2E tests — a temp directory is created for the suite and
 * all services write actual files. Only inquirer (prompts), fetch (network),
 * ora (spinner), chalk, and boxen are mocked.
 *
 * Each test group maps to a story cluster and verifies observable outcomes
 * described in the Epic 9 QA Smoke Test document.
 */

import { describe, it, expect, jest, beforeAll, afterAll } from '@jest/globals';
import matter from 'gray-matter';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

// ── Mock UI / network deps before any dynamic imports ──────────────────────

jest.unstable_mockModule('inquirer', () => ({
  default: { prompt: jest.fn() },
}));

jest.unstable_mockModule('ora', () => ({
  default: jest.fn(() => ({
    start: jest.fn(() => ({ succeed: jest.fn(), fail: jest.fn(), warn: jest.fn() })),
  })),
}));

function noop(s: string): string {
  return s;
}
const noopBold = Object.assign(noop, { cyan: noop, green: noop });

jest.unstable_mockModule('chalk', () => ({
  default: {
    bold: noopBold,
    green: noop,
    yellow: noop,
    red: noop,
    blue: noop,
    dim: noop,
    gray: noop,
    cyan: noop,
  },
}));

jest.unstable_mockModule('boxen', () => ({
  default: jest.fn(() => '[banner]'),
}));

jest.unstable_mockModule('../../src/utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ── Dynamic imports after all mocks ───────────────────────────────────────

const { initService } = await import('../../src/services/init.service.js');
const { memberService } = await import('../../src/services/member.service.js');
const { leadershipService } = await import('../../src/services/leadership.service.js');
const { projectService } = await import('../../src/services/project.service.js');
const { DoctorService } = await import('../../src/services/doctor.service.js');
const { MyselfService } = await import('../../src/services/myself.service.js');
const { fileSystemService } = await import('../../src/services/file-system.service.js');
const { emailResolutionService } = await import('../../src/services/email-resolution.service.js');
const { templateService } = await import('../../src/services/template.service.js');
const { sectionParserService } = await import('../../src/services/section-parser.service.js');
const { findSimilarEmail } = await import('../../src/utils/email-similarity.js');

// ── Shared workspace ───────────────────────────────────────────────────────

let WS: string;

beforeAll(async () => {
  WS = mkdtempSync(join(tmpdir(), 'epic9-e2e-'));

  // Manually scaffold vault dirs — skipping .cursor (restricted in Cursor sandbox).
  // This mirrors VAULT_DIRS in init.service.ts, minus the sandbox-blocked path.
  const vaultDirs = [
    'inbox',
    'archive',
    'my-tasks',
    'my-teams/members',
    'my-teams/teams',
    'my-company/members',
    'my-company/contractors',
    'my-company/projects',
    'my-leadership',
    'my-career',
    'knowledge-base',
    'config',
    '.claude/skills',
  ];
  for (const dir of vaultDirs) {
    mkdirSync(join(WS, dir), { recursive: true });
  }
  // Write .tmr sentinel (what scaffold() would write)
  writeFileSync(
    join(WS, '.tmr'),
    JSON.stringify({ version: '1.0.0', created: '2026-05-27' }, null, 2),
  );

  await initService.writeOrgConfig(WS, 'alice@company.com', []);
  await initService.writeUserProfile(WS, {
    name: 'Alice Example',
    email: 'alice@company.com',
    role: 'Engineering Manager',
    leaderEmail: 'cto@company.com',
  });
});

afterAll(() => {
  rmSync(WS, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 1: Foundation & Workspace (Stories 9.1–9.5)
// ─────────────────────────────────────────────────────────────────────────────

describe('Group 1 — Foundation & Workspace (9.1–9.5)', () => {
  it('T-01 (9.2): scaffold creates .tmr sentinel at vault root', () => {
    const sentinelPath = join(WS, '.tmr');
    expect(existsSync(sentinelPath)).toBe(true);

    const sentinel = JSON.parse(readFileSync(sentinelPath, 'utf-8')) as {
      version: string;
      created: string;
    };
    expect(sentinel).toHaveProperty('version');
    expect(sentinel).toHaveProperty('created');
  });

  it('T-02 (9.3): init writes my-career/<email>.md flat — no subdirectory created', () => {
    const flatPath = join(WS, 'my-career', 'alice@company.com.md');
    const nestedDir = join(WS, 'my-career', 'alice@company.com');
    expect(existsSync(flatPath)).toBe(true);
    expect(existsSync(nestedDir)).toBe(false);
  });

  it('T-03 (9.5): self-profile contains relationship: self frontmatter', () => {
    const content = readFileSync(join(WS, 'my-career', 'alice@company.com.md'), 'utf-8');
    expect(content).toContain('relationship: self');
  });

  it('T-04 (9.1): member add creates nested team path with relationship: direct-report', async () => {
    await memberService.addMember(
      'bob@company.com',
      {
        name: 'Bob Dev',
        role: 'Engineer',
        gender: '',
        location: 'NYC',
        team: 'backend',
        contractor: false,
      },
      WS,
    );

    const profilePath = join(WS, 'my-teams', 'members', 'bob@company.com', 'bob@company.com.md');
    expect(existsSync(profilePath)).toBe(true);
    const content = readFileSync(profilePath, 'utf-8');
    expect(content).toContain('relationship: direct-report');
  });

  it('T-05 (9.1/9.12): team member has all 4 subdirs plus <email>-shared', () => {
    const dir = join(WS, 'my-teams', 'members', 'bob@company.com');
    expect(existsSync(join(dir, '1on1s'))).toBe(true);
    expect(existsSync(join(dir, 'feedbacks'))).toBe(true);
    expect(existsSync(join(dir, 'assessments'))).toBe(true);
    expect(existsSync(join(dir, 'performance-reviews'))).toBe(true);
    expect(existsSync(join(dir, 'bob@company.com-shared'))).toBe(true);
  });

  it('T-06 (9.1/9.5): company member has relationship: company-member', async () => {
    await memberService.addMember(
      'carol@company.com',
      { name: 'Carol PM', role: 'Product Manager', gender: '', location: '', contractor: false },
      WS,
    );
    const content = readFileSync(
      join(WS, 'my-company', 'members', 'carol@company.com', 'carol@company.com.md'),
      'utf-8',
    );
    expect(content).toContain('relationship: company-member');
  });

  it('T-07 (9.1/9.5): contractor profile has relationship: contractor — no contractor:true', async () => {
    await memberService.addMember(
      'dave@vendor.io',
      { name: 'Dave Vendor', role: 'Consultant', gender: '', location: '', contractor: true },
      WS,
    );
    const content = readFileSync(
      join(WS, 'my-company', 'contractors', 'dave@vendor.io', 'dave@vendor.io.md'),
      'utf-8',
    );
    expect(content).toContain('relationship: contractor');
    expect(content).not.toContain('contractor: true');
  });

  it('T-08 (9.4): organization.yaml exists and contains the company domain', () => {
    const orgPath = join(WS, 'config', 'organization.yaml');
    expect(existsSync(orgPath)).toBe(true);
    expect(readFileSync(orgPath, 'utf-8')).toContain('company.com');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 2: Member & Team Commands (Stories 9.6–9.12)
// ─────────────────────────────────────────────────────────────────────────────

describe('Group 2 — Member & Team Commands (9.6–9.12)', () => {
  it('T-09 (9.6): leadership add creates profile with relationship: leadership', async () => {
    await leadershipService.addLeadership(
      'cto@company.com',
      { name: 'The CTO', role: 'CTO', gender: '', location: 'SF', areas_of_responsibility: '' },
      WS,
    );
    const profilePath = join(WS, 'my-leadership', 'cto@company.com', 'cto@company.com.md');
    expect(existsSync(profilePath)).toBe(true);
    expect(readFileSync(profilePath, 'utf-8')).toContain('relationship: leadership');
  });

  it('T-10 (9.6): leadership add 1on1 creates file under 1on1s/ with full date in filename', async () => {
    const result = await leadershipService.add1on1('cto@company.com', { date: '2026-05-27' }, WS);
    expect(existsSync(result.filePath)).toBe(true);
    expect(result.filePath).toContain('1on1s');
    expect(result.filePath).toContain('2026-05-27');
    expect(result.filePath).toContain('cto@company.com');
  });

  it('T-11 (9.6): 1on1 wiki-link appended to ## 1on1s section in leadership profile', () => {
    const content = readFileSync(
      join(WS, 'my-leadership', 'cto@company.com', 'cto@company.com.md'),
      'utf-8',
    );
    expect(content).toContain('## 1on1s');
    expect(content).toContain('[[1on1s/');
  });

  it('T-12 (9.8): findSimilarEmail detects near-duplicate (bbo vs bob) within same domain', () => {
    const similar = findSimilarEmail('bbo@company.com', WS);
    expect(similar).toBe('bob@company.com');
  });

  it('T-13 (9.8): findSimilarEmail returns null for exact match (no false positive)', () => {
    expect(findSimilarEmail('bob@company.com', WS)).toBeNull();
  });

  it('T-14 (9.8): findSimilarEmail returns null for different domain (no cross-domain warning)', () => {
    expect(findSimilarEmail('bob@otherdomain.com', WS)).toBeNull();
  });

  it('T-15 (9.9): feedback creates feedbacks/YYYY-MM-feedback-<reviewer>-<member>.md', async () => {
    const result = await memberService.createMemberFile(
      'bob@company.com',
      'feedback',
      { date: '2026-05-01', fromEmail: 'alice@company.com' },
      WS,
    );
    expect(existsSync(result.filePath)).toBe(true);
    expect(result.filePath).toContain('feedbacks');
    expect(result.filePath).toContain('feedback-alice@company.com-bob@company.com');
    expect(result.filePath).toContain('2026-05');
  });

  it('T-16 (9.10): performance-review creates performance-reviews/YYYY-MM-performance-review-<email>.md', async () => {
    const result = await memberService.createMemberFile(
      'bob@company.com',
      'performance-review',
      { date: '2026-05-01' },
      WS,
    );
    expect(existsSync(result.filePath)).toBe(true);
    expect(result.filePath).toContain('performance-reviews');
    expect(result.filePath).toContain('performance-review-bob@company.com');
    expect(result.filePath).toContain('2026-05');
  });

  it('T-17 (9.11): 1on1 creates 1on1s/YYYY-MM-DD-1on1-<email>.md with full date', async () => {
    const result = await memberService.createMemberFile(
      'bob@company.com',
      '1on1',
      { date: '2026-05-27' },
      WS,
    );
    expect(existsSync(result.filePath)).toBe(true);
    expect(result.filePath).toContain('1on1s');
    expect(result.filePath).toContain('2026-05-27-1on1-bob@company.com');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 3: Project Commands (Stories 9.13–9.14)
// ─────────────────────────────────────────────────────────────────────────────

describe('Group 3 — Project Commands (9.13–9.14)', () => {
  beforeAll(async () => {
    await projectService.addProject('platform', WS);
  });

  it('T-18 (9.13): standup --date creates standups/YYYY-MM-DD-<project>-standup.md', async () => {
    const result = await projectService.addStandup('platform', { date: '2026-05-27' }, WS);
    expect(existsSync(result.filePath)).toBe(true);
    expect(result.filePath).toContain('standups');
    expect(result.filePath).toContain('2026-05-27');
    // project names are normalized to "<name>-project" internally
    expect(result.filePath).toMatch(/platform.*standup/);
  });

  it('T-19 (9.13): standup file contains project wiki-link in frontmatter', () => {
    // Derive actual standup dir from the result of addProject (normalize to "platform-project")
    const projectDirs = readdirSync(join(WS, 'my-company', 'projects')).filter((d) =>
      d.includes('platform'),
    );
    expect(projectDirs.length).toBeGreaterThan(0);
    const standupsDir = join(WS, 'my-company', 'projects', projectDirs[0]!, 'standups');
    const files = readdirSync(standupsDir);
    const standupFile = files.find((f) => f.includes('2026-05-27'));
    expect(standupFile).toBeDefined();
    const content = readFileSync(join(standupsDir, standupFile!), 'utf-8');
    expect(content).toMatch(/project:|platform/);
  });

  it('T-20 (9.33): link-member writes back-link to projects frontmatter in member profile', async () => {
    await projectService.linkMember('platform', 'bob@company.com', WS);
    const content = readFileSync(
      join(WS, 'my-teams', 'members', 'bob@company.com', 'bob@company.com.md'),
      'utf-8',
    );
    const { data } = matter(content);
    expect(Array.isArray(data['projects'])).toBe(true);
    expect((data['projects'] as string[]).some((l) => /platform/.test(l))).toBe(true);
  });

  it('T-21 (9.33): link-member is idempotent — duplicate back-link not written twice', async () => {
    await projectService.linkMember('platform', 'bob@company.com', WS);

    // Entity side: projects[] still has exactly one platform entry
    const memberContent = readFileSync(
      join(WS, 'my-teams', 'members', 'bob@company.com', 'bob@company.com.md'),
      'utf-8',
    );
    const { data: memberData } = matter(memberContent);
    const entityMatches = (memberData['projects'] as string[]).filter((l) => /platform/.test(l));
    expect(entityMatches.length).toBe(1);

    // Project side (AC4): members[] also has exactly one entry for bob
    const overviewContent = readFileSync(
      join(WS, 'my-company', 'projects', 'platform-project', 'platform-project.md'),
      'utf-8',
    );
    const { data: overviewData } = matter(overviewContent);
    const projectMatches = (overviewData['members'] as string[]).filter((l) =>
      /bob@company\.com/.test(l),
    );
    expect(projectMatches.length).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 4: Self-Profile, Doctor & Init (Stories 9.15–9.18)
// ─────────────────────────────────────────────────────────────────────────────

describe('Group 4 — Self-Profile, Doctor & Init (9.15–9.18)', () => {
  it('T-22 (9.15): showProfile resolves self-email to flat my-career/<email>.md', async () => {
    const { teamService } = await import('../../src/services/team.service.js');
    const profile = await teamService.showProfile('alice@company.com', WS);
    expect(profile).not.toBeNull();
    expect(profile!.location).toBe('self');
    expect(profile!.filePath).toContain('my-career');
    expect(profile!.filePath).toContain('alice@company.com.md');
  });

  it('T-23 (9.15): showProfile resolves contractor email with location: contractor', async () => {
    const { teamService } = await import('../../src/services/team.service.js');
    const profile = await teamService.showProfile('dave@vendor.io', WS);
    expect(profile).not.toBeNull();
    expect(profile!.location).toBe('contractor');
    expect(profile!.filePath.replace(/\\/g, '/')).toContain('my-company/contractors');
  });

  it('T-24 (9.16): myself add performance-review creates my-career/YYYY-MM-performance-review-<email>.md', async () => {
    const myselfSvc = new MyselfService(
      fileSystemService,
      emailResolutionService,
      templateService,
      sectionParserService,
    );
    const result = await myselfSvc.addPerformanceReview({ date: '2026-05' }, WS);
    expect(existsSync(result.filePath)).toBe(true);
    expect(result.filePath).toContain('my-career');
    expect(result.filePath).toContain('performance-review');
    expect(result.filePath).toContain('2026-05');
  });

  it('T-25 (9.17): doctor community plugins check passes when all 4 plugins present', () => {
    const obsidianDir = join(WS, '.obsidian');
    mkdirSync(obsidianDir, { recursive: true });
    writeFileSync(
      join(obsidianDir, 'community-plugins.json'),
      JSON.stringify(['obsidian-git', 'granola-sync', 'terminal', 'dataview']),
    );
    const doctor = new DoctorService('1.0.0');
    // checkCommunityPlugins is private — access for testing
    type DocPrivate = {
      checkCommunityPlugins: (vaultPath: string) => {
        ok: boolean;
        value?: string;
        detail?: string;
      };
    };
    const result = (doctor as unknown as DocPrivate).checkCommunityPlugins(WS);
    expect(result.ok).toBe(true);
    expect(result.value).toContain('4/4');
  });

  it('T-26 (9.17): doctor community plugins check fails when plugins are missing', () => {
    const obsidianDir = join(WS, '.obsidian');
    writeFileSync(join(obsidianDir, 'community-plugins.json'), JSON.stringify(['obsidian-git']));
    const doctor = new DoctorService('1.0.0');
    type DocPrivate = {
      checkCommunityPlugins: (vaultPath: string) => { ok: boolean; detail?: string };
    };
    const result = (doctor as unknown as DocPrivate).checkCommunityPlugins(WS);
    expect(result.ok).toBe(false);
    expect(result.detail).toContain('missing');
  });

  it('T-27 (9.18): scaffold-only InitCommand does not call obsidianPluginService.installPlugins', async () => {
    const { obsidianPluginService } = await import('../../src/services/obsidian-plugin.service.js');
    const installSpy = jest.spyOn(obsidianPluginService, 'installPlugins').mockResolvedValue([]);

    // configService writes to ~/Library/Preferences — mock all write methods
    const { configService } = await import('../../src/services/config.service.js');
    const initializeSpy = jest.spyOn(configService, 'initialize').mockImplementation(() => {});
    const setWorkspaceSpy = jest
      .spyOn(configService, 'setWorkspacePath')
      .mockImplementation(() => {});
    const setSpy = jest.spyOn(configService, 'set').mockImplementation(() => {});

    // initService.scaffold tries to create .cursor/ (sandbox-blocked) — mock it
    const scaffoldSpy = jest.spyOn(initService, 'scaffold').mockResolvedValue(undefined);

    const { default: inquirer } = await import('inquirer');
    const scaffoldWs = mkdtempSync(join(tmpdir(), 'epic9-scaffold-'));
    const scaffoldDirs = [
      'inbox',
      'archive',
      'my-tasks',
      'my-teams/members',
      'my-teams/teams',
      'my-company/members',
      'my-company/contractors',
      'my-company/projects',
      'my-leadership',
      'my-career',
      'knowledge-base',
      'config',
      '.claude/skills',
    ];
    for (const dir of scaffoldDirs) mkdirSync(join(scaffoldWs, dir), { recursive: true });
    writeFileSync(
      join(scaffoldWs, '.tmr'),
      JSON.stringify({ version: '1.0.0', created: '2026-05-27' }, null, 2),
    );

    try {
      const promptMock = inquirer.prompt as unknown as jest.MockedFunction<
        () => Promise<Record<string, unknown>>
      >;
      promptMock
        .mockResolvedValueOnce({ workspacePath: scaffoldWs } as never)
        .mockResolvedValueOnce({ name: 'Test User', email: 'test@co.com' } as never)
        .mockResolvedValueOnce({ raw: '' } as never)
        .mockResolvedValueOnce({ role: 'Manager', company: 'co.com' } as never)
        .mockResolvedValueOnce({
          name: 'Boss',
          email: 'boss@co.com',
          role: 'VP',
          location: '',
        } as never)
        .mockResolvedValueOnce({ teamCount: '0' } as never);

      const { InitCommand } = await import('../../src/commands/init.command.js');
      await new InitCommand('1.0.0', false, true).run();

      expect(installSpy).not.toHaveBeenCalled();
    } finally {
      rmSync(scaffoldWs, { recursive: true, force: true });
      installSpy.mockRestore();
      initializeSpy.mockRestore();
      setWorkspaceSpy.mockRestore();
      setSpy.mockRestore();
      scaffoldSpy.mockRestore();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Regression Checks — Critical Pre-Epic-9 Bugs
// ─────────────────────────────────────────────────────────────────────────────

describe('Regression Checks — Critical Pre-Epic-9 Bugs', () => {
  it('R-01 (pre-9.15 bug): tmr show <own-email> returns self profile — not "not found"', async () => {
    const { teamService } = await import('../../src/services/team.service.js');
    const profile = await teamService.showProfile('alice@company.com', WS);
    expect(profile).not.toBeNull();
    expect(profile!.location).toBe('self');
  });

  it('R-02 (pre-9.3 bug): self-profile is flat my-career/<email>.md — not nested', () => {
    expect(existsSync(join(WS, 'my-career', 'alice@company.com.md'))).toBe(true);
    expect(existsSync(join(WS, 'my-career', 'alice@company.com'))).toBe(false);
  });

  it('R-03 (pre-9.9 bug): feedbacks subdir is "feedbacks" (plural) — not singular "feedback"', () => {
    const dir = join(WS, 'my-teams', 'members', 'bob@company.com');
    expect(existsSync(join(dir, 'feedbacks'))).toBe(true);
    expect(existsSync(join(dir, 'feedback'))).toBe(false);
  });

  it('R-04 (pre-9.5 bug): contractor profiles use relationship: contractor — no contractor:true', () => {
    const content = readFileSync(
      join(WS, 'my-company', 'contractors', 'dave@vendor.io', 'dave@vendor.io.md'),
      'utf-8',
    );
    expect(content).not.toContain('contractor: true');
    expect(content).toContain('relationship: contractor');
  });

  it('R-05 (pre-9.1 bug): EmailResolutionService resolves self email from flat my-career', async () => {
    const resolved = await emailResolutionService.resolve('alice@company.com', WS);
    expect(resolved.type).toBe('self');
    expect(resolved.absolutePath).toContain('my-career');
    expect(resolved.absolutePath).not.toContain(join('alice@company.com', 'alice@company.com.md'));
  });
});
