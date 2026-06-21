import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import matter from 'gray-matter';
import path from 'node:path';
import { homedir } from 'node:os';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { InitService } from '../../src/services/init.service.js';
import type { FileSystemService } from '../../src/services/file-system.service.js';
import type { LeadershipService } from '../../src/services/leadership.service.js';
import type { TeamService } from '../../src/services/team.service.js';
import type { SkillRegistryService } from '../../src/services/skill-registry.service.js';
import { logger } from '../../src/utils/logger.js';

// ── Mock factories ────────────────────────────────────────────────────────────

type MockFS = {
  createDirectory: jest.MockedFunction<FileSystemService['createDirectory']>;
  writeFile: jest.MockedFunction<FileSystemService['writeFile']>;
};

type MockSkillRegistry = {
  fetchSkillContent: jest.MockedFunction<SkillRegistryService['fetchSkillContent']>;
  installSkill: jest.MockedFunction<SkillRegistryService['installSkill']>;
};

function createMockSkillRegistry(): MockSkillRegistry {
  return {
    fetchSkillContent: jest
      .fn<SkillRegistryService['fetchSkillContent']>()
      .mockResolvedValue({ success: true, data: { content: '# skill', version: '1.0.0' } }),
    installSkill: jest.fn<SkillRegistryService['installSkill']>(),
  };
}

type MockLeadership = {
  addLeadership: jest.MockedFunction<LeadershipService['addLeadership']>;
};

type MockTeam = {
  createTeam: jest.MockedFunction<TeamService['createTeam']>;
  addMember: jest.MockedFunction<TeamService['addMember']>;
};

function createMockFS(): MockFS {
  return {
    createDirectory: jest.fn<FileSystemService['createDirectory']>().mockResolvedValue(undefined),
    writeFile: jest.fn<FileSystemService['writeFile']>().mockResolvedValue(undefined),
  };
}

function createMockLeadership(): MockLeadership {
  return {
    addLeadership: jest
      .fn<LeadershipService['addLeadership']>()
      .mockResolvedValue({ created: true }),
  };
}

function createMockTeam(): MockTeam {
  return {
    createTeam: jest.fn<TeamService['createTeam']>().mockResolvedValue(undefined),
    addMember: jest.fn<TeamService['addMember']>().mockResolvedValue(undefined),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const WS = '/fake/vault';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('InitService', () => {
  let svc: InitService;
  let mockFS: MockFS;
  let mockLeadership: MockLeadership;
  let mockTeam: MockTeam;

  beforeEach(() => {
    mockFS = createMockFS();
    mockLeadership = createMockLeadership();
    mockTeam = createMockTeam();
    svc = new InitService(
      mockFS as unknown as FileSystemService,
      mockLeadership as unknown as LeadershipService,
      mockTeam as unknown as TeamService,
    );
  });

  // ── resolveVaultPath ────────────────────────────────────────────────────────

  describe('resolveVaultPath', () => {
    it('returns process.cwd() when input is an empty string', () => {
      expect(svc.resolveVaultPath('')).toBe(process.cwd());
    });

    it('returns process.cwd() when input is whitespace-only', () => {
      expect(svc.resolveVaultPath('   ')).toBe(process.cwd());
    });

    it('expands ~/... paths to the OS home directory', () => {
      const result = svc.resolveVaultPath('~/my-vault');
      expect(result).toBe(path.join(homedir(), 'my-vault'));
    });

    it('returns absolute paths unchanged', () => {
      expect(svc.resolveVaultPath('/absolute/path/to/vault')).toBe('/absolute/path/to/vault');
    });

    it('returns relative paths unchanged (not expanded)', () => {
      expect(svc.resolveVaultPath('relative/path')).toBe('relative/path');
    });

    it('bare ~ expands to homedir (not left as literal ~)', () => {
      expect(svc.resolveVaultPath('~')).toBe(homedir());
    });
  });

  // ── scaffold ─────────────────────────────────────────────────────────────────

  describe('scaffold', () => {
    // ── INIT-UNIT-001 ──────────────────────────────────────────────────────────

    it('INIT-UNIT-001: creates all required directories (positive set)', async () => {
      await svc.scaffold(WS);

      const dirs = (mockFS.createDirectory.mock.calls as [string][]).map((c) =>
        path.relative(WS, c[0]),
      );

      const required = [
        'inbox',
        'archive',
        'my-tasks',
        path.join('my-teams', 'members'),
        path.join('my-teams', 'teams'),
        path.join('my-company', 'members'),
        path.join('my-company', 'projects'),
        'my-leadership',
        'my-career',
        path.join('my-career', 'performance-reviews'),
        'knowledge-base',
        path.join('.claude', 'skills'),
        path.join('.cursor', 'rules', 'tmr'),
      ];

      for (const dir of required) {
        expect(dirs).toContain(dir);
      }
    });

    it('INIT-UNIT-001-NEG1: does NOT create utils/', async () => {
      await svc.scaffold(WS);
      const dirs = (mockFS.createDirectory.mock.calls as [string][]).map((c) => c[0]);
      expect(dirs).not.toContain(path.join(WS, 'utils'));
    });

    it('INIT-UNIT-001-NEG2: does NOT create my-teams/feedback-templates/', async () => {
      await svc.scaffold(WS);
      const dirs = (mockFS.createDirectory.mock.calls as [string][]).map((c) => c[0]);
      expect(dirs).not.toContain(path.join(WS, 'my-teams', 'feedback-templates'));
    });

    it('creates exactly 15 directories — no extra ones', async () => {
      await svc.scaffold(WS);
      expect(mockFS.createDirectory).toHaveBeenCalledTimes(15);
    });

    // ── INIT-UNIT-007 ──────────────────────────────────────────────────────────

    it('INIT-UNIT-007: writes CLAUDE.md to the vault root', async () => {
      await svc.scaffold(WS);

      const writtenPaths = (mockFS.writeFile.mock.calls as [string, string][]).map((c) => c[0]);
      expect(writtenPaths).toContain(path.join(WS, 'CLAUDE.md'));
    });

    it('INIT-UNIT-007: CLAUDE.md content includes vault structure table', async () => {
      await svc.scaffold(WS);

      const claudeCall = (mockFS.writeFile.mock.calls as [string, string][]).find(([p]) =>
        p.endsWith('CLAUDE.md'),
      );
      expect(claudeCall).toBeDefined();
      expect(claudeCall![1]).toContain('Vault Structure');
      expect(claudeCall![1]).toContain('inbox/');
    });

    // ── Error handling ────────────────────────────────────────────────────────

    it('re-throws when createDirectory rejects', async () => {
      const err = new Error('disk full');
      mockFS.createDirectory.mockRejectedValueOnce(err);

      await expect(svc.scaffold(WS)).rejects.toThrow('disk full');
    });

    it('re-throws when writeFile (CLAUDE.md) rejects', async () => {
      const err = new Error('no space left');
      mockFS.writeFile.mockRejectedValueOnce(err);

      await expect(svc.scaffold(WS)).rejects.toThrow('no space left');
    });

    it('calls writeFile exactly twice (CLAUDE.md + .tmr sentinel) on happy path', async () => {
      await svc.scaffold(WS);
      expect(mockFS.writeFile).toHaveBeenCalledTimes(2);
    });
  });

  // ── writeUserProfile ──────────────────────────────────────────────────────

  describe('writeUserProfile', () => {
    const opts = { email: 'user@example.com', name: 'Test User', role: 'Manager' };

    it('INIT-UNIT-004: does NOT call createDirectory (my-career/ pre-exists from scaffold)', async () => {
      await svc.writeUserProfile(WS, opts);
      expect(mockFS.createDirectory).not.toHaveBeenCalled();
    });

    it('INIT-UNIT-004: writes my-career/<email>.md (flat — no subdirectory)', async () => {
      await svc.writeUserProfile(WS, opts);
      const paths = (mockFS.writeFile.mock.calls as [string, string][]).map((c) => c[0]);
      expect(paths).toContain(path.join(WS, 'my-career', 'user@example.com.md'));
    });

    it('INIT-UNIT-004: profile frontmatter contains email', async () => {
      await svc.writeUserProfile(WS, opts);
      const call = (mockFS.writeFile.mock.calls as [string, string][]).find(([p]) =>
        p.endsWith('user@example.com.md'),
      );
      expect(call).toBeDefined();
      expect(call![1]).toContain('user@example.com');
    });

    it('INIT-UNIT-004: profile frontmatter contains name', async () => {
      await svc.writeUserProfile(WS, opts);
      const call = (mockFS.writeFile.mock.calls as [string, string][]).find(([p]) =>
        p.endsWith('user@example.com.md'),
      );
      expect(call![1]).toContain('Test User');
    });

    it('INIT-UNIT-004: profile frontmatter contains role', async () => {
      await svc.writeUserProfile(WS, opts);
      const call = (mockFS.writeFile.mock.calls as [string, string][]).find(([p]) =>
        p.endsWith('user@example.com.md'),
      );
      expect(call![1]).toContain('Manager');
    });

    it('9.5: profile frontmatter contains relationship: self', async () => {
      await svc.writeUserProfile(WS, opts);
      const call = (mockFS.writeFile.mock.calls as [string, string][]).find(([p]) =>
        p.endsWith('user@example.com.md'),
      );
      expect(call![1]).toContain('relationship: self');
    });

    it('lowercases the email before writing', async () => {
      await svc.writeUserProfile(WS, { email: 'User@Example.COM', name: 'U', role: 'R' });
      const paths = (mockFS.writeFile.mock.calls as [string, string][]).map((c) => c[0]);
      expect(paths.some((p) => p.includes('user@example.com'))).toBe(true);
    });

    // ── 9.35: frontmatter-native self profile ─────────────────────────────────

    const selfWrite = (): string => {
      const call = (mockFS.writeFile.mock.calls as [string, string][]).find(([p]) =>
        p.endsWith('user@example.com.md'),
      );
      expect(call).toBeDefined();
      return call![1];
    };

    it('9.35: sets current_manager to leader wiki-link and leadership: [] when leaderEmail provided', async () => {
      await svc.writeUserProfile(WS, { ...opts, leaderEmail: 'boss@example.com' });
      const { data, content } = matter(selfWrite());
      expect(data['current_manager']).toContain('boss@example.com');
      expect(data['leadership']).toEqual([]);
      expect(content).not.toContain('## Leadership');
    });

    it('9.35: current_manager is empty string when leaderEmail is absent', async () => {
      await svc.writeUserProfile(WS, opts);
      const { data } = matter(selfWrite());
      expect(data['current_manager']).toBe('');
    });

    it('9.35: frontmatter contains all five task-graph scalars as my-tasks wiki-links', async () => {
      await svc.writeUserProfile(WS, opts);
      const { data } = matter(selfWrite());
      expect(data['tasks']).toBe('[[../my-tasks/tasks.md|tasks]]');
      expect(data['today']).toBe('[[../my-tasks/today.md|today]]');
      expect(data['this_week']).toBe('[[../my-tasks/this-week.md|this-week]]');
      expect(data['this_month']).toBe('[[../my-tasks/this-month.md|this-month]]');
      expect(data['this_quarter']).toBe('[[../my-tasks/this-quarter.md|this-quarter]]');
    });

    it('9.35: frontmatter contains empty-default relationship arrays and start_date', async () => {
      await svc.writeUserProfile(WS, opts);
      const { data } = matter(selfWrite());
      expect(data['start_date']).toBe('');
      expect(data['previous_manager']).toEqual([]);
      expect(data['leadership']).toEqual([]);
      expect(data['other_leaderships']).toEqual([]);
      expect(data['direct_reports']).toEqual([]);
      expect(data['projects']).toEqual([]);
    });

    it('9.35: body has ## Performance Reviews and no ## Goals section', async () => {
      await svc.writeUserProfile(WS, opts);
      const { content } = matter(selfWrite());
      expect(content).toContain('## Performance Reviews');
      expect(content).not.toContain('## Goals');
    });

    it('re-throws when writeFile rejects', async () => {
      mockFS.writeFile.mockRejectedValueOnce(new Error('disk full'));
      await expect(svc.writeUserProfile(WS, opts)).rejects.toThrow('disk full');
    });
  });

  // ── writeLeaderProfile ────────────────────────────────────────────────────

  describe('writeLeaderProfile', () => {
    const opts = { email: 'leader@example.com', name: 'The Leader', role: 'Director' };

    it('INIT-UNIT-005: delegates to LeadershipService.addLeadership', async () => {
      await svc.writeLeaderProfile(WS, opts);
      expect(mockLeadership.addLeadership).toHaveBeenCalledTimes(1);
    });

    it('INIT-UNIT-005: passes the correct email to addLeadership', async () => {
      await svc.writeLeaderProfile(WS, opts);
      const [email] = mockLeadership.addLeadership.mock.calls[0] as [string, ...unknown[]];
      expect(email).toBe('leader@example.com');
    });

    it('INIT-UNIT-005: passes name and role in opts to addLeadership', async () => {
      await svc.writeLeaderProfile(WS, opts);
      const [, leaderOpts] = mockLeadership.addLeadership.mock.calls[0] as [
        string,
        { name: string; role: string },
        string,
      ];
      expect(leaderOpts).toMatchObject({ name: 'The Leader', role: 'Director' });
    });

    it('INIT-UNIT-005: passes vaultPath as workspaceRoot to addLeadership', async () => {
      await svc.writeLeaderProfile(WS, opts);
      const [, , ws] = mockLeadership.addLeadership.mock.calls[0] as [string, unknown, string];
      expect(ws).toBe(WS);
    });

    it('re-throws when addLeadership rejects', async () => {
      mockLeadership.addLeadership.mockRejectedValueOnce(new Error('no space'));
      await expect(svc.writeLeaderProfile(WS, opts)).rejects.toThrow('no space');
    });
  });

  // ── createTeams ───────────────────────────────────────────────────────────

  describe('createTeams', () => {
    it('calls createTeam once per team name', async () => {
      await svc.createTeams(WS, ['Backend Team', 'Frontend Team']);
      expect(mockTeam.createTeam).toHaveBeenCalledTimes(2);
    });

    it('passes the raw team name and vault path to createTeam', async () => {
      await svc.createTeams(WS, ['Backend Team']);
      expect(mockTeam.createTeam).toHaveBeenCalledWith('Backend Team', WS);
    });

    it('does nothing when teamNames is empty', async () => {
      await svc.createTeams(WS, []);
      expect(mockTeam.createTeam).not.toHaveBeenCalled();
    });

    it('re-throws when createTeam rejects', async () => {
      mockTeam.createTeam.mockRejectedValueOnce(new Error('write failed'));
      await expect(svc.createTeams(WS, ['alpha'])).rejects.toThrow('write failed');
    });
  });

  // ── addMembersToTeam ──────────────────────────────────────────────────────

  describe('addMembersToTeam', () => {
    const members = [
      { email: 'alice@co.com', name: 'Alice', role: 'Engineer', gender: 'Female', location: 'SP' },
      { email: 'bob@co.com', name: 'Bob', role: 'Designer', gender: '', location: '' },
    ];

    it('calls addMember once per member', async () => {
      await svc.addMembersToTeam(WS, 'Backend', members);
      expect(mockTeam.addMember).toHaveBeenCalledTimes(2);
    });

    it('passes the raw team name (not normalized) and vault path', async () => {
      await svc.addMembersToTeam(WS, 'Backend Team', [members[0]!]);
      const [teamArg, , , wsArg] = mockTeam.addMember.mock.calls[0] as [
        string,
        string,
        unknown,
        string,
      ];
      expect(teamArg).toBe('Backend Team');
      expect(wsArg).toBe(WS);
    });

    it('passes correct email for each member', async () => {
      await svc.addMembersToTeam(WS, 'alpha', members);
      const emails = (mockTeam.addMember.mock.calls as [string, string, unknown, string][]).map(
        (c) => c[1],
      );
      expect(emails).toEqual(['alice@co.com', 'bob@co.com']);
    });

    it('passes name, role, gender and location in options', async () => {
      await svc.addMembersToTeam(WS, 'alpha', [members[0]!]);
      const opts = (
        mockTeam.addMember.mock.calls as [string, string, Record<string, string>, string][]
      )[0]![2];
      expect(opts).toMatchObject({
        name: 'Alice',
        role: 'Engineer',
        gender: 'Female',
        location: 'SP',
      });
    });

    it('does nothing when members array is empty', async () => {
      await svc.addMembersToTeam(WS, 'alpha', []);
      expect(mockTeam.addMember).not.toHaveBeenCalled();
    });

    it('re-throws when addMember rejects', async () => {
      mockTeam.addMember.mockRejectedValueOnce(new Error('disk full'));
      await expect(svc.addMembersToTeam(WS, 'alpha', [members[0]!])).rejects.toThrow('disk full');
    });

    it('logs a per-member warning before re-throwing on failure', async () => {
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => logger);
      mockTeam.addMember.mockRejectedValueOnce(new Error('write failed'));
      await expect(svc.addMembersToTeam(WS, 'Backend', [members[0]!])).rejects.toThrow();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('alice@co.com'));
      warnSpy.mockRestore();
    });
  });

  // ── copySampleInboxFiles ──────────────────────────────────────────────────

  describe('copySampleInboxFiles', () => {
    it('INIT-UNIT-003: writes 2026-04-10-Marlon-Alex.md to inbox/', async () => {
      await svc.copySampleInboxFiles(WS);
      const paths = (mockFS.writeFile.mock.calls as [string, string][]).map((c) => c[0]);
      expect(paths).toContain(path.join(WS, 'inbox', '2026-04-10-Marlon-Alex.md'));
    });

    it('INIT-UNIT-003: writes 2026-04-15-Team-Sync.md to inbox/', async () => {
      await svc.copySampleInboxFiles(WS);
      const paths = (mockFS.writeFile.mock.calls as [string, string][]).map((c) => c[0]);
      expect(paths).toContain(path.join(WS, 'inbox', '2026-04-15-Team-Sync.md'));
    });

    it('INIT-UNIT-003: sample files contain Granola frontmatter', async () => {
      await svc.copySampleInboxFiles(WS);
      const calls = mockFS.writeFile.mock.calls as [string, string][];
      const marlonAlex = calls.find(([p]) => p.endsWith('2026-04-10-Marlon-Alex.md'));
      expect(marlonAlex).toBeDefined();
      expect(marlonAlex![1]).toContain('granola_id:');
    });

    it('re-throws when writeFile rejects', async () => {
      mockFS.writeFile.mockRejectedValueOnce(new Error('no space'));
      await expect(svc.copySampleInboxFiles(WS)).rejects.toThrow('no space');
    });
  });

  // ── installDefaultSkill ───────────────────────────────────────────────────

  describe('installDefaultSkill', () => {
    let mockRegistry: MockSkillRegistry;
    let mockReadSkillFile: jest.MockedFunction<(p: string) => string>;
    let svcWithRegistry: InitService;

    beforeEach(() => {
      mockRegistry = createMockSkillRegistry();
      mockReadSkillFile = jest.fn<(p: string) => string>().mockReturnValue('# skill content');
      svcWithRegistry = new InitService(
        mockFS as unknown as FileSystemService,
        mockLeadership as unknown as LeadershipService,
        mockTeam as unknown as TeamService,
        () => mockRegistry as unknown as SkillRegistryService,
        mockReadSkillFile,
      );
    });

    it('reads bundled SKILL.md for all three default skills', async () => {
      await svcWithRegistry.installDefaultSkill(WS);
      expect(mockReadSkillFile).toHaveBeenCalledTimes(3);
      expect(mockReadSkillFile).toHaveBeenCalledWith(expect.stringContaining('tmr-inbox'));
      expect(mockReadSkillFile).toHaveBeenCalledWith(expect.stringContaining('tmr-project-impact'));
      expect(mockReadSkillFile).toHaveBeenCalledWith(expect.stringContaining('tmr-myself-config'));
    });

    it('calls installSkill for each skill when bundled file is readable', async () => {
      await svcWithRegistry.installDefaultSkill(WS);
      expect(mockRegistry.installSkill).toHaveBeenCalledWith(
        'tmr-inbox',
        '# skill content',
        '0.0.0',
      );
      expect(mockRegistry.installSkill).toHaveBeenCalledWith(
        'tmr-project-impact',
        '# skill content',
        '0.0.0',
      );
      expect(mockRegistry.installSkill).toHaveBeenCalledWith(
        'tmr-myself-config',
        '# skill content',
        '0.0.0',
      );
    });

    it('does NOT contact the registry when every bundled file is present (AC4: bundled-first)', async () => {
      await svcWithRegistry.installDefaultSkill(WS);
      expect(mockRegistry.fetchSkillContent).not.toHaveBeenCalled();
    });

    it('parses version comment when present', async () => {
      mockReadSkillFile.mockReturnValue('<!-- version: 2.1.0 -->\n# skill');
      await svcWithRegistry.installDefaultSkill(WS);
      expect(mockRegistry.installSkill).toHaveBeenCalledWith(
        'tmr-inbox',
        expect.any(String),
        '2.1.0',
      );
    });

    it('installs all skills (via registry fallback) even when one bundled read throws', async () => {
      // Registry mock resolves success by default → the failing-bundled skill falls back
      // and still installs, so all three skills end up installed.
      mockReadSkillFile
        .mockImplementationOnce(() => {
          throw new Error('ENOENT');
        })
        .mockReturnValue('# skill content');
      await expect(svcWithRegistry.installDefaultSkill(WS)).resolves.toBeUndefined();
      expect(mockRegistry.installSkill).toHaveBeenCalledTimes(3);
      expect(mockRegistry.fetchSkillContent).toHaveBeenCalledTimes(1);
      expect(mockRegistry.fetchSkillContent).toHaveBeenCalledWith('tmr-inbox');
    });

    it('calls logger.warn and does NOT throw when bundled read AND registry both fail', async () => {
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => logger);
      mockReadSkillFile.mockImplementationOnce(() => {
        throw new Error('ENOENT: no such file');
      });
      mockRegistry.fetchSkillContent.mockResolvedValueOnce({
        success: false,
        error: 'Network error',
      });
      await expect(svcWithRegistry.installDefaultSkill(WS)).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('registry fetch failed'));
      warnSpy.mockRestore();
    });

    it('falls back to registry and installs when a bundled file read throws', async () => {
      mockReadSkillFile
        .mockImplementationOnce(() => {
          throw new Error('ENOENT');
        })
        .mockReturnValue('# skill content');
      await svcWithRegistry.installDefaultSkill(WS);
      // Registry path uses the fetched content + version (not the bundled 0.0.0 default).
      expect(mockRegistry.installSkill).toHaveBeenCalledWith('tmr-inbox', '# skill', '1.0.0');
    });

    it('falls back to registry and installs when a bundled file is empty', async () => {
      mockReadSkillFile.mockReturnValueOnce('   ');
      await svcWithRegistry.installDefaultSkill(WS);
      expect(mockRegistry.fetchSkillContent).toHaveBeenCalledWith('tmr-inbox');
      expect(mockRegistry.installSkill).toHaveBeenCalledWith('tmr-inbox', '# skill', '1.0.0');
    });

    it('warns and skips a skill (without blocking others) when bundled missing AND registry fails', async () => {
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => logger);
      mockReadSkillFile.mockImplementationOnce(() => {
        throw new Error('ENOENT');
      });
      mockRegistry.fetchSkillContent.mockResolvedValueOnce({ success: false, error: 'not found' });
      await expect(svcWithRegistry.installDefaultSkill(WS)).resolves.toBeUndefined();
      // The failed skill is skipped; the other two bundled skills still install.
      expect(mockRegistry.installSkill).toHaveBeenCalledTimes(2);
      expect(mockRegistry.installSkill).not.toHaveBeenCalledWith(
        'tmr-inbox',
        expect.anything(),
        expect.anything(),
      );
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('skipped'));
      warnSpy.mockRestore();
    });
  });

  // ── writeOrgConfig ────────────────────────────────────────────────────────

  describe('writeOrgConfig', () => {
    it('writes config/organization.yaml at the correct path', async () => {
      await svc.writeOrgConfig(WS, 'alice@example.com');
      const paths = (mockFS.writeFile.mock.calls as [string, string][]).map((c) => c[0]);
      expect(paths.some((p) => p.endsWith(path.join('config', 'organization.yaml')))).toBe(true);
    });

    it('YAML content contains the domain extracted from the email', async () => {
      await svc.writeOrgConfig(WS, 'alice@example.com');
      const call = (mockFS.writeFile.mock.calls as [string, string][]).find(([p]) =>
        p.endsWith('organization.yaml'),
      );
      expect(call?.[1]).toContain('example.com');
    });

    it('uses the full domain string after @ as the domain', async () => {
      await svc.writeOrgConfig(WS, 'user@corp.internal.io');
      const call = (mockFS.writeFile.mock.calls as [string, string][]).find(([p]) =>
        p.endsWith('organization.yaml'),
      );
      expect(call?.[1]).toContain('corp.internal.io');
    });

    it('writes inferred domain plus all additional domains when supplied', async () => {
      await svc.writeOrgConfig(WS, 'alice@example.com', ['example-eu.com', 'subsidiary.io']);
      const call = (mockFS.writeFile.mock.calls as [string, string][]).find(([p]) =>
        p.endsWith('organization.yaml'),
      );
      expect(call?.[1]).toContain('example.com');
      expect(call?.[1]).toContain('example-eu.com');
      expect(call?.[1]).toContain('subsidiary.io');
    });

    it('deduplicates additional domains matching the inferred domain', async () => {
      await svc.writeOrgConfig(WS, 'alice@example.com', ['example.com', 'partner.io']);
      const call = (mockFS.writeFile.mock.calls as [string, string][]).find(([p]) =>
        p.endsWith('organization.yaml'),
      );
      const content = call?.[1] ?? '';
      const domainLines = content.split('\n').filter((l) => l.trim().startsWith('- '));
      expect(domainLines).toHaveLength(2); // example.com once + partner.io
    });

    it('re-throws when writeFile rejects', async () => {
      mockFS.writeFile.mockRejectedValueOnce(new Error('no space left'));
      await expect(svc.writeOrgConfig(WS, 'alice@example.com')).rejects.toThrow('no space left');
    });
  });

  // ── writeReadme ───────────────────────────────────────────────────────────

  describe('writeReadme', () => {
    it('INIT-UNIT-002: writes README.md at the vault root', async () => {
      await svc.writeReadme(WS);
      const paths = (mockFS.writeFile.mock.calls as [string, string][]).map((c) => c[0]);
      expect(paths).toContain(path.join(WS, 'README.md'));
    });

    it('re-throws when writeFile rejects', async () => {
      mockFS.writeFile.mockRejectedValueOnce(new Error('disk full'));
      await expect(svc.writeReadme(WS)).rejects.toThrow('disk full');
    });
  });

  // ── printPostInitSummary ──────────────────────────────────────────────────

  describe('printPostInitSummary', () => {
    let stdoutSpy: ReturnType<typeof jest.spyOn>;

    beforeEach(() => {
      stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    });

    afterEach(() => {
      stdoutSpy.mockRestore();
    });

    it('INIT-UNIT-006: writes to stdout at least once (printInfo called)', () => {
      svc.printPostInitSummary(WS, false);
      expect(stdoutSpy).toHaveBeenCalled();
    });

    it('INIT-UNIT-006: output contains "tmr --help"', () => {
      svc.printPostInitSummary(WS, false);
      const output = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      // `printPostInitSummary` lists `tmr --help` as the command-discovery next
      // step; the older `tmr project add` guidance now lives in the README only.
      expect(output).toContain('tmr --help');
    });

    it('INIT-UNIT-006: output contains "tmr-inbox"', () => {
      svc.printPostInitSummary(WS, false);
      const output = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(output).toContain('tmr-inbox');
    });

    it('INIT-UNIT-006: output contains "Workspace created at" (printSuccess called)', () => {
      svc.printPostInitSummary(WS, false);
      const output = (stdoutSpy.mock.calls as [string][]).map((c) => c[0]).join('');
      expect(output).toContain('Workspace created at');
    });
  });

  // ── scaffold + sentinel ───────────────────────────────────────────────────

  describe('scaffold — sentinel integration', () => {
    it('INIT-UNIT-010: scaffold writes .tmr sentinel file at vault root', async () => {
      await svc.scaffold(WS);
      const writtenPaths = (mockFS.writeFile.mock.calls as [string, string][]).map((c) => c[0]);
      expect(writtenPaths).toContain(path.join(WS, '.tmr'));
    });

    it('INIT-UNIT-010: .tmr sentinel content is valid JSON with version and created fields', async () => {
      await svc.scaffold(WS);
      const sentinelCall = (mockFS.writeFile.mock.calls as [string, string][]).find(([p]) =>
        p.endsWith('.tmr'),
      );
      expect(sentinelCall).toBeDefined();
      const parsed = JSON.parse(sentinelCall![1]) as Record<string, unknown>;
      expect(parsed).toHaveProperty('version', '1.0.0');
      expect(parsed).toHaveProperty('created');
      expect(typeof parsed['created']).toBe('string');
      expect(parsed['created']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  // ── writeSentinel ─────────────────────────────────────────────────────────

  describe('writeSentinel', () => {
    it('INIT-UNIT-011: writes .tmr at the vault root path', async () => {
      await svc.writeSentinel(WS);
      const writtenPaths = (mockFS.writeFile.mock.calls as [string, string][]).map((c) => c[0]);
      expect(writtenPaths).toContain(path.join(WS, '.tmr'));
    });

    it('INIT-UNIT-011: .tmr content has version 1.0.0', async () => {
      await svc.writeSentinel(WS);
      const call = (mockFS.writeFile.mock.calls as [string, string][]).find(([p]) =>
        p.endsWith('.tmr'),
      );
      const parsed = JSON.parse(call![1]) as Record<string, unknown>;
      expect(parsed['version']).toBe('1.0.0');
    });

    it('INIT-UNIT-011: re-throws when writeFile rejects', async () => {
      mockFS.writeFile.mockRejectedValueOnce(new Error('disk full'));
      await expect(svc.writeSentinel(WS)).rejects.toThrow('disk full');
    });
  });

  // ── findExistingVault ─────────────────────────────────────────────────────
  // Uses real temp directories — avoids ESM read-only property issues with jest.spyOn.

  describe('findExistingVault', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmr-sentinel-test-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('INIT-UNIT-012: returns the dir when .tmr exists in fromDir', () => {
      fs.writeFileSync(path.join(tmpDir, '.tmr'), '{}');
      expect(svc.findExistingVault(tmpDir)).toBe(tmpDir);
    });

    it('INIT-UNIT-012: returns parent dir when .tmr exists one level up', () => {
      const childDir = path.join(tmpDir, 'subdir');
      fs.mkdirSync(childDir);
      fs.writeFileSync(path.join(tmpDir, '.tmr'), '{}');
      expect(svc.findExistingVault(childDir)).toBe(tmpDir);
    });

    it('INIT-UNIT-012-NEG: returns null when no .tmr found anywhere', () => {
      const deepDir = path.join(tmpDir, 'a', 'b', 'c');
      fs.mkdirSync(deepDir, { recursive: true });
      expect(svc.findExistingVault(deepDir)).toBeNull();
    });
  });
});
