/**
 * Integration test: full team management workflow on a real temp workspace.
 *
 * This test uses the actual FileSystemService (fs-extra) against a temp
 * directory — no mocks. It validates the complete create → add → list → archive
 * workflow end-to-end.
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import matter from 'gray-matter';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock configService so workspace_path returns our temp dir
jest.unstable_mockModule('../../src/services/config.service.js', () => ({
  configService: {
    get: jest.fn<() => undefined>().mockReturnValue(undefined),
    set: jest.fn(),
    has: jest.fn(),
    delete: jest.fn(),
    initialize: jest.fn(),
    getActiveProvider: jest.fn(),
    setActiveProvider: jest.fn(),
    addProvider: jest.fn(),
    getProviderConfig: jest.fn(),
  },
}));

const { TeamService } = await import('../../src/services/team.service.js');
const { FileSystemService } = await import('../../src/services/file-system.service.js');

describe('Team Integration', () => {
  let workspace: string;
  let svc: InstanceType<typeof TeamService>;

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'tmr-team-test-'));
    svc = new TeamService(new FileSystemService());
  });

  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  it('full workflow: create team → add member → list → archive', async () => {
    // 1. Create team
    await svc.createTeam('alpha', workspace);

    const contextPath = path.join(workspace, 'my-teams', '_teams', 'alpha', 'alpha-context.md');
    const membersPath = path.join(workspace, 'my-teams', '_teams', 'alpha', 'alpha-members.md');
    expect(fs.existsSync(contextPath)).toBe(true);
    expect(fs.existsSync(membersPath)).toBe(true);

    const contextContent = fs.readFileSync(contextPath, 'utf8');
    expect(contextContent).toContain('team: alpha');

    // 2. Add member
    await svc.addMember(
      'alpha',
      'John@Co.Com',
      { role: 'Engineer', location: 'Remote' },
      workspace,
    );

    const memberProfilePath = path.join(
      workspace,
      'my-teams',
      '_members',
      'john@co.com',
      'john@co.com.md',
    );
    expect(fs.existsSync(memberProfilePath)).toBe(true);

    const profileContent = fs.readFileSync(memberProfilePath, 'utf8');
    const { data } = matter(profileContent);
    expect(data['email']).toBe('john@co.com');
    expect(data['role']).toBe('Engineer');
    expect(data['teams']).toContain('alpha');

    // Subdirectories created
    expect(
      fs.existsSync(path.join(workspace, 'my-teams', '_members', 'john@co.com', '1on1s')),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(workspace, 'my-teams', '_members', 'john@co.com', 'feedback')),
    ).toBe(true);

    // Wiki-link in members file
    const membersContent = fs.readFileSync(membersPath, 'utf8');
    expect(membersContent).toContain('john@co.com');

    // 3. List teams
    const teams = await svc.listTeams(workspace);
    expect(teams).toHaveLength(1);
    expect(teams[0]).toMatchObject({ teamName: 'alpha', memberCount: 1 });

    // 4. List team members
    const members = await svc.listTeamMembers('alpha', workspace);
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ email: 'john@co.com', role: 'Engineer' });

    // 5. showProfile — finds active member
    const profile = await svc.showProfile('john@co.com', workspace);
    expect(profile?.location).toBe('member');

    // 6. Archive member
    await svc.archiveMember('alpha', 'john@co.com', {}, workspace);

    const year = new Date().getFullYear().toString();
    const archivedPath = path.join(
      workspace,
      'my-teams',
      '_archived',
      year,
      'john@co.com',
      'john@co.com.md',
    );
    expect(fs.existsSync(archivedPath)).toBe(true);

    const archivedContent = fs.readFileSync(archivedPath, 'utf8');
    const { data: archivedData } = matter(archivedContent);
    expect(archivedData['archived']).toBe(true);
    expect(archivedData['archived_date']).toBeDefined();

    // Member no longer in active _members
    expect(fs.existsSync(memberProfilePath)).toBe(false);

    // Wiki-link removed from team members file
    const updatedMembers = fs.readFileSync(membersPath, 'utf8');
    expect(updatedMembers).not.toContain('[[../../_members/john@co.com');

    // showProfile now finds archived
    const archivedProfile = await svc.showProfile('john@co.com', workspace);
    expect(archivedProfile?.location).toBe('archived');
  });

  it('adds a member to multiple teams (multi-team support)', async () => {
    await svc.createTeam('alpha', workspace);
    await svc.createTeam('beta', workspace);
    await svc.addMember('alpha', 'shared@co.com', { role: 'Lead' }, workspace);
    await svc.addMember('beta', 'shared@co.com', {}, workspace);

    const profilePath = path.join(
      workspace,
      'my-teams',
      '_members',
      'shared@co.com',
      'shared@co.com.md',
    );
    const { data } = matter(fs.readFileSync(profilePath, 'utf8'));
    expect((data['teams'] as string[]).sort()).toEqual(['alpha', 'beta']);
  });

  it('fire adds termination fields in addition to archive', async () => {
    await svc.addMember('alpha', 'fired@co.com', { role: 'Intern' }, workspace);
    await svc.fireMember('alpha', 'fired@co.com', workspace);

    const year = new Date().getFullYear().toString();
    const firedPath = path.join(
      workspace,
      'my-teams',
      '_archived',
      year,
      'fired@co.com',
      'fired@co.com.md',
    );
    const { data } = matter(fs.readFileSync(firedPath, 'utf8'));
    expect(data['termination']).toBeTruthy();
    expect(data['termination_date']).toBeDefined();
  });

  it('date-range archive (AC5): only moves files within date range', async () => {
    await svc.addMember('alpha', 'ranged@co.com', { role: 'PM' }, workspace);

    const memberBase = path.join(workspace, 'my-teams', '_members', 'ranged@co.com');

    // Create dated files in the 1on1s subdirectory
    fs.writeFileSync(path.join(memberBase, '1on1s', '2026-01-15.md'), '# Jan 1:1');
    fs.writeFileSync(path.join(memberBase, '1on1s', '2026-02-20.md'), '# Feb 1:1');
    fs.writeFileSync(path.join(memberBase, '1on1s', '2026-03-05.md'), '# Mar 1:1');

    // Archive only February files
    await svc.archiveMember(
      'alpha',
      'ranged@co.com',
      { from: '2026-02-01', to: '2026-02-28' },
      workspace,
    );

    const year = new Date().getFullYear().toString();
    const archBase = path.join(workspace, 'my-teams', '_archived', year, 'ranged@co.com', '1on1s');

    // Feb file moved
    expect(fs.existsSync(path.join(archBase, '2026-02-20.md'))).toBe(true);
    // Jan and Mar files remain in original location
    expect(fs.existsSync(path.join(memberBase, '1on1s', '2026-01-15.md'))).toBe(true);
    expect(fs.existsSync(path.join(memberBase, '1on1s', '2026-03-05.md'))).toBe(true);
  });

  it('showProfile finds profile in my-leadership (AC7)', async () => {
    // Create a leadership profile directly
    const leaderPath = path.join(workspace, 'my-leadership', 'vp@co.com', 'vp@co.com.md');
    fs.ensureDirSync(path.dirname(leaderPath));
    fs.writeFileSync(leaderPath, '---\nemail: vp@co.com\nrole: VP\n---\n# VP Profile');

    const result = await svc.showProfile('vp@co.com', workspace);

    expect(result).not.toBeNull();
    expect(result?.location).toBe('leadership');
    expect(result?.content).toContain('VP Profile');
  });
});
