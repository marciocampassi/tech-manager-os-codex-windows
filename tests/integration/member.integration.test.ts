/**
 * Integration test: full member file management workflow on a real temp workspace.
 *
 * No mocks for FS. Uses real FileSystemService, SectionParserService, TemplateService,
 * and MemberService against a temp directory to validate the complete flow.
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock configService — workspace path is supplied directly in tests
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
    getWorkspacePath: jest.fn<() => undefined>().mockReturnValue(undefined),
  },
}));

const { TeamService } = await import('../../src/services/team.service.js');
const { FileSystemService } = await import('../../src/services/file-system.service.js');
const { SectionParserService } = await import('../../src/services/section-parser.service.js');
const { TemplateService } = await import('../../src/services/template.service.js');
const { MemberService } = await import('../../src/services/member.service.js');
const { runMemberAdd } = await import('../../src/commands/member.command.js');

describe('Member Integration', () => {
  let workspace: string;
  let teamSvc: InstanceType<typeof TeamService>;
  let memberSvc: InstanceType<typeof MemberService>;

  beforeEach(async () => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'tmr-member-test-'));
    const realFS = new FileSystemService();
    teamSvc = new TeamService(realFS);
    memberSvc = new MemberService(realFS, new SectionParserService(realFS), new TemplateService());

    // Seed: create team and add member so tests have a valid profile to work with
    await teamSvc.createTeam('alpha', workspace);
    await teamSvc.addMember(
      'alpha',
      'john@co.com',
      { role: 'Engineer', location: 'Remote' },
      workspace,
    );
  });

  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  // ── 1on1 ──────────────────────────────────────────────────────────────────────

  it('AC1: creates 1on1 file and appends wiki-link to ## 1on1s section', async () => {
    const result = await memberSvc.createMemberFile(
      'john@co.com',
      '1on1',
      { date: '2026-03-07', noEdit: true },
      workspace,
    );

    // File created on disk
    expect(fs.existsSync(result.filePath)).toBe(true);

    const fileContent = fs.readFileSync(result.filePath, 'utf8');
    expect(fileContent).toContain('type: 1on1');
    expect(fileContent).toContain('member: john@co.com');
    expect(fileContent).toContain('date: 2026-03-07');
    expect(fileContent).toContain('## Check-in');

    // Wiki-link uses full date for 1on1, suffix before email
    const profileContent = fs.readFileSync(result.profilePath, 'utf8');
    expect(profileContent).toContain('[[1on1s/2026-03-07-1on1-john@co.com.md]]');
    expect(profileContent).toContain('## 1on1s');
  });

  // ── feedback ─────────────────────────────────────────────────────────────────

  it('AC2: creates feedback file and appends wiki-link to ## Feedbacks section', async () => {
    const result = await memberSvc.createMemberFile(
      'john@co.com',
      'feedback',
      { date: '2026-03-07', noEdit: true, fromEmail: 'reviewer@co.com' },
      workspace,
    );

    expect(fs.existsSync(result.filePath)).toBe(true);
    const fileContent = fs.readFileSync(result.filePath, 'utf8');
    expect(fileContent).toContain('type: feedback');
    expect(fileContent).toContain('## Situation');

    // feedbacks/ subdir, year-month prefix, reviewer-email-member-email order
    const profileContent = fs.readFileSync(result.profilePath, 'utf8');
    expect(profileContent).toContain(
      '[[feedbacks/2026-03-feedback-reviewer@co.com-john@co.com.md]]',
    );
  });

  // ── assessment ───────────────────────────────────────────────────────────────

  it('AC3: creates assessment file and appends wiki-link to ## Assessments section', async () => {
    const result = await memberSvc.createMemberFile(
      'john@co.com',
      'assessment',
      { date: '2026-03-07', noEdit: true },
      workspace,
    );

    expect(fs.existsSync(result.filePath)).toBe(true);
    // Year-month prefix, suffix before email
    const profileContent = fs.readFileSync(result.profilePath, 'utf8');
    expect(profileContent).toContain('[[assessments/2026-03-assessment-john@co.com.md]]');
  });

  // ── performance-review ────────────────────────────────────────────────────────

  it('AC4: creates performance-review file and appends wiki-link to ## Performance Reviews', async () => {
    const result = await memberSvc.createMemberFile(
      'john@co.com',
      'performance-review',
      { date: '2026-03-07', noEdit: true },
      workspace,
    );

    expect(fs.existsSync(result.filePath)).toBe(true);
    const fileContent = fs.readFileSync(result.filePath, 'utf8');
    expect(fileContent).toContain('type: performance-review');
    expect(fileContent).toContain('## Accomplishments');

    // Year-month prefix, -review suffix before email
    const profileContent = fs.readFileSync(result.profilePath, 'utf8');
    expect(profileContent).toContain('[[performance-reviews/2026-03-review-john@co.com.md]]');
  });

  // ── Error: member not found → auto-create (Story 3.3) ───────────────────────

  it('AC5: auto-creates company profile and creates file for unknown member (Story 3.3)', async () => {
    const result = await memberSvc.createMemberFile(
      'ghost@co.com',
      'feedback',
      { date: '2026-03-07', noEdit: true, fromEmail: 'reviewer@co.com' },
      workspace,
    );

    // Profile auto-created at company scope (nested)
    expect(
      fs.existsSync(
        path.join(workspace, 'my-company', 'members', 'ghost@co.com', 'ghost@co.com.md'),
      ),
    ).toBe(true);
    // Dated feedback file created
    expect(fs.existsSync(result.filePath)).toBe(true);
    // Wiki-link appended to auto-created profile (feedbacks/ subdir)
    const profileContent = fs.readFileSync(result.profilePath, 'utf8');
    expect(profileContent).toContain('[[feedbacks/');
  });

  // ── Multiple files accumulate in section ──────────────────────────────────────

  it('AC9: multiple 1on1 files accumulate wiki-links in the ## 1on1s section', async () => {
    await memberSvc.createMemberFile(
      'john@co.com',
      '1on1',
      { date: '2026-03-01', noEdit: true },
      workspace,
    );
    await memberSvc.createMemberFile(
      'john@co.com',
      '1on1',
      { date: '2026-03-07', noEdit: true },
      workspace,
    );

    const profilePath = path.join(
      workspace,
      'my-teams',
      'members',
      'john@co.com',
      'john@co.com.md',
    );
    const profileContent = fs.readFileSync(profilePath, 'utf8');

    expect(profileContent).toContain('2026-03-01-1on1-john@co.com.md');
    expect(profileContent).toContain('2026-03-07-1on1-john@co.com.md');

    // Both links appear in the 1on1s section (before the next ##)
    const sectionStart = profileContent.indexOf('## 1on1s');
    const link1Pos = profileContent.indexOf('2026-03-01', sectionStart);
    const link2Pos = profileContent.indexOf('2026-03-07', sectionStart);
    expect(link1Pos).toBeGreaterThan(sectionStart);
    expect(link2Pos).toBeGreaterThan(sectionStart);
  });

  // ── Email normalization ───────────────────────────────────────────────────────

  it('AC5: accepts uppercase email and normalizes to lowercase', async () => {
    const result = await memberSvc.createMemberFile(
      'JOHN@CO.COM',
      '1on1',
      { date: '2026-03-07', noEdit: true },
      workspace,
    );
    expect(result.filePath).toContain('john@co.com');
    expect(fs.existsSync(result.filePath)).toBe(true);
  });

  // ── Global Email Resolver & Auto-create (Story 3.3) ──────────────────────────

  describe('Global Email Resolver & Auto-create (Story 3.3)', () => {
    it('MEM-INT-001: addMember without --team writes nested profile to my-company/members/<email>/<email>.md', async () => {
      await memberSvc.addMember('joao@company.com', {}, workspace);

      expect(
        fs.existsSync(
          path.join(workspace, 'my-company', 'members', 'joao@company.com', 'joao@company.com.md'),
        ),
      ).toBe(true);
    });

    it('MEM-INT-002: addMember with --team writes nested profile to my-teams/members/<email>/<email>.md with manager wiki-link', async () => {
      // Seed flat career profile so _resolveManagerLink resolves
      const careerDir = path.join(workspace, 'my-career');
      fs.mkdirSync(careerDir, { recursive: true });
      fs.writeFileSync(path.join(careerDir, 'boss@co.com.md'), '---\nemail: boss@co.com\n---\n');

      await memberSvc.addMember('joao@company.com', { team: 'backend' }, workspace);

      const profilePath = path.join(
        workspace,
        'my-teams',
        'members',
        'joao@company.com',
        'joao@company.com.md',
      );
      expect(fs.existsSync(profilePath)).toBe(true);
      const content = fs.readFileSync(profilePath, 'utf8');
      expect(content).toContain('manager:');
      // Verify the wiki-link actually points to the seeded manager, not just any [[
      expect(content).toContain('boss@co.com');
    });

    it('MEM-INT-003b: createMemberFile routes feedback to existing nested team-scoped profile', async () => {
      // Seed a nested team-scoped profile (addMember with --team)
      await memberSvc.addMember('joao@company.com', { team: 'backend' }, workspace);

      const result = await memberSvc.createMemberFile(
        'joao@company.com',
        'feedback',
        { date: '2026-01-15', noEdit: true, fromEmail: 'reviewer@co.com' },
        workspace,
      );

      expect(fs.existsSync(result.filePath)).toBe(true);
      // Routed to the nested team profile
      expect(result.profilePath).toContain('my-teams/members/joao@company.com/joao@company.com.md');
      const profileContent = fs.readFileSync(result.profilePath, 'utf8');
      expect(profileContent).toContain('[[feedbacks/');
    });

    it('MEM-INT-003: createMemberFile routes feedback to existing nested company-scoped profile', async () => {
      // Seed a nested company-scoped profile
      await memberSvc.addMember('joao@company.com', {}, workspace);

      const result = await memberSvc.createMemberFile(
        'joao@company.com',
        'feedback',
        { date: '2026-01-15', noEdit: true, fromEmail: 'reviewer@co.com' },
        workspace,
      );

      expect(fs.existsSync(result.filePath)).toBe(true);
      const profileContent = fs.readFileSync(result.profilePath, 'utf8');
      expect(profileContent).toContain('## Feedbacks');
      expect(profileContent).toContain('[[feedbacks/');
      expect(result.profilePath).toContain(
        'my-company/members/joao@company.com/joao@company.com.md',
      );
    });

    it('MEM-INT-004: createMemberFile auto-creates nested company profile for unknown email', async () => {
      const result = await memberSvc.createMemberFile(
        'unknown@company.com',
        'feedback',
        { date: '2026-01-15', noEdit: true, fromEmail: 'reviewer@co.com' },
        workspace,
      );

      // Profile auto-created at nested path
      expect(
        fs.existsSync(
          path.join(
            workspace,
            'my-company',
            'members',
            'unknown@company.com',
            'unknown@company.com.md',
          ),
        ),
      ).toBe(true);
      // Dated feedback file created
      expect(fs.existsSync(result.filePath)).toBe(true);
      // Wiki-link appended (feedbacks/ subdir)
      const profileContent = fs.readFileSync(result.profilePath, 'utf8');
      expect(profileContent).toContain('[[feedbacks/');
    });

    it('MEM-INT-005: case-insensitive lookup resolves to existing nested profile without duplicate', async () => {
      // Seed a nested company-scoped profile with lowercase email
      await memberSvc.addMember('joao@company.com', {}, workspace);

      const result = await memberSvc.createMemberFile(
        'JOAO@COMPANY.COM',
        'feedback',
        { date: '2026-01-15', noEdit: true, fromEmail: 'reviewer@co.com' },
        workspace,
      );

      // No duplicate created — the nested directory exists only for the lowercase email
      const membersDir = path.join(workspace, 'my-company', 'members');
      const entries = fs.readdirSync(membersDir);
      expect(entries).toContain('joao@company.com');
      expect(entries).not.toContain('JOAO@COMPANY.COM');
      // Feedback appended to the correct nested profile (feedbacks/ subdir)
      expect(result.profilePath).toContain('joao@company.com/joao@company.com.md');
      const profileContent = fs.readFileSync(result.profilePath, 'utf8');
      expect(profileContent).toContain('[[feedbacks/');
    });
  });

  // ── Story 9.7 — addMember: location, routing, remember-domain ────────────────

  describe('Story 9.7 — addMember routing and location', () => {
    it('9.7-INT-001: company-scoped member: nested path, 4 subdirs, relationship and location in frontmatter', async () => {
      await memberSvc.addMember('user@company.com', { location: 'Berlin' }, workspace);

      const profilePath = path.join(
        workspace,
        'my-company',
        'members',
        'user@company.com',
        'user@company.com.md',
      );
      expect(fs.existsSync(profilePath)).toBe(true);

      const entityDir = path.dirname(profilePath);
      for (const subDir of ['1on1s', 'feedbacks', 'assessments', 'performance-reviews']) {
        expect(fs.existsSync(path.join(entityDir, subDir))).toBe(true);
      }

      const content = fs.readFileSync(profilePath, 'utf8');
      expect(content).toContain('relationship: company-member');
      expect(content).toContain('location: Berlin');
    });

    it('9.7-INT-002: contractor routing — profile in my-company/contractors/, relationship: contractor, no manager field', async () => {
      await memberSvc.addMember(
        'ext@partner.com',
        { contractor: true, location: 'Berlin' },
        workspace,
      );

      const profilePath = path.join(
        workspace,
        'my-company',
        'contractors',
        'ext@partner.com',
        'ext@partner.com.md',
      );
      expect(fs.existsSync(profilePath)).toBe(true);

      const content = fs.readFileSync(profilePath, 'utf8');
      expect(content).toContain('relationship: contractor');
      expect(content).not.toContain('manager:');
      expect(content).toContain('location: Berlin');
    });

    it('9.7-INT-003: appendInternalDomain adds new domain to organization.yaml without removing existing ones', async () => {
      const configDir = path.join(workspace, 'config');
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(
        path.join(configDir, 'organization.yaml'),
        'internal_domains:\n  - company.com\n',
      );

      await memberSvc.appendInternalDomain('partner.com', workspace);

      const orgContent = fs.readFileSync(path.join(configDir, 'organization.yaml'), 'utf8');
      expect(orgContent).toContain('company.com');
      expect(orgContent).toContain('partner.com');
    });

    it('9.7-INT-004: team-scoped member: my-teams path, 4 subdirs + shared, relationship: direct-report', async () => {
      await memberSvc.addMember(
        'user@company.com',
        { team: 'backend', location: 'Berlin' },
        workspace,
      );

      const profilePath = path.join(
        workspace,
        'my-teams',
        'members',
        'user@company.com',
        'user@company.com.md',
      );
      expect(fs.existsSync(profilePath)).toBe(true);

      const entityDir = path.dirname(profilePath);
      for (const subDir of ['1on1s', 'feedbacks', 'assessments', 'performance-reviews']) {
        expect(fs.existsSync(path.join(entityDir, subDir))).toBe(true);
      }
      expect(fs.existsSync(path.join(entityDir, 'user@company.com-shared'))).toBe(true);

      const content = fs.readFileSync(profilePath, 'utf8');
      expect(content).toContain('relationship: direct-report');
      expect(content).toContain('location: Berlin');
    });
  });

  // ── 9.9: --from CLI path end-to-end ──────────────────────────────────────────

  describe('9.9-INT: --from flag wiring from command layer to file creation', () => {
    let stdoutSpy: ReturnType<typeof jest.spyOn>;
    let stderrSpy: ReturnType<typeof jest.spyOn>;

    beforeEach(() => {
      stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
      process.exitCode = undefined;
    });

    afterEach(() => {
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
      process.exitCode = undefined;
    });

    it('9.9-INT-001: --from flows from command opts through validation to feedbacks/ file with correct reviewer', async () => {
      const spy = jest.spyOn(memberSvc, 'getWorkspaceRoot').mockReturnValue(workspace);
      try {
        await runMemberAdd(memberSvc, 'feedback', 'john@co.com', {
          from: 'reviewer@co.com',
          date: '2026-03-15',
        });
      } finally {
        spy.mockRestore();
      }

      const feedbacksDir = path.join(workspace, 'my-teams', 'members', 'john@co.com', 'feedbacks');
      const files = fs.readdirSync(feedbacksDir);
      expect(files).toContain('2026-03-feedback-reviewer@co.com-john@co.com.md');
    });

    it('9.9-INT-002: --from with invalid email aborts without creating a file', async () => {
      const spy = jest.spyOn(memberSvc, 'getWorkspaceRoot').mockReturnValue(workspace);
      try {
        await runMemberAdd(memberSvc, 'feedback', 'john@co.com', {
          from: 'not-an-email',
          date: '2026-03-15',
        });
      } finally {
        spy.mockRestore();
      }

      const feedbacksDir = path.join(workspace, 'my-teams', 'members', 'john@co.com', 'feedbacks');
      const mdFiles = fs.existsSync(feedbacksDir)
        ? fs.readdirSync(feedbacksDir).filter((f: string) => f.endsWith('.md'))
        : [];
      expect(mdFiles.length).toBe(0);
      expect(process.exitCode).toBe(1);
    });
  });
});
