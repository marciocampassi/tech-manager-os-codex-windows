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

    // Wiki-link appended to profile
    const profileContent = fs.readFileSync(result.profilePath, 'utf8');
    expect(profileContent).toContain('[[1on1s/2026-03-07-john@co.com-1on1.md]]');
    expect(profileContent).toContain('## 1on1s');
  });

  // ── feedback ─────────────────────────────────────────────────────────────────

  it('AC2: creates feedback file and appends wiki-link to ## Feedbacks section', async () => {
    const result = await memberSvc.createMemberFile(
      'john@co.com',
      'feedback',
      { date: '2026-03-07', noEdit: true },
      workspace,
    );

    expect(fs.existsSync(result.filePath)).toBe(true);
    const fileContent = fs.readFileSync(result.filePath, 'utf8');
    expect(fileContent).toContain('type: feedback');
    expect(fileContent).toContain('## Situation');

    const profileContent = fs.readFileSync(result.profilePath, 'utf8');
    expect(profileContent).toContain('[[feedback/2026-03-07-john@co.com-feedback.md]]');
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
    const profileContent = fs.readFileSync(result.profilePath, 'utf8');
    expect(profileContent).toContain('[[assessments/2026-03-07-john@co.com-assessment.md]]');
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

    const profileContent = fs.readFileSync(result.profilePath, 'utf8');
    expect(profileContent).toContain('[[performance-reviews/2026-03-07-john@co.com-review.md]]');
  });

  // ── Error: member not found ───────────────────────────────────────────────────

  it('AC5: throws descriptive error when member does not exist', async () => {
    await expect(
      memberSvc.createMemberFile(
        'ghost@co.com',
        '1on1',
        { date: '2026-03-07', noEdit: true },
        workspace,
      ),
    ).rejects.toThrow(/not found.*tmr team add/i);
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
      '_members',
      'john@co.com',
      'john@co.com.md',
    );
    const profileContent = fs.readFileSync(profilePath, 'utf8');

    expect(profileContent).toContain('2026-03-01-john@co.com-1on1.md');
    expect(profileContent).toContain('2026-03-07-john@co.com-1on1.md');

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
});
