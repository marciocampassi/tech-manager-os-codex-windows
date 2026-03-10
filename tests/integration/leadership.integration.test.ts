/**
 * Integration test: full leadership management workflow on a real temp workspace.
 * No filesystem mocks. Uses real FileSystemService, SectionParserService,
 * TemplateService, and LeadershipService against a temp directory.
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import matter from 'gray-matter';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

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

const { FileSystemService } = await import('../../src/services/file-system.service.js');
const { SectionParserService } = await import('../../src/services/section-parser.service.js');
const { TemplateService } = await import('../../src/services/template.service.js');
const { LeadershipService } = await import('../../src/services/leadership.service.js');

describe('Leadership Integration', () => {
  let workspace: string;
  let svc: InstanceType<typeof LeadershipService>;

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'tmr-leadership-test-'));
    const realFS = new FileSystemService();
    svc = new LeadershipService(realFS, new SectionParserService(realFS), new TemplateService());
  });

  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  // ── AC1: add leadership ───────────────────────────────────────────────────────

  it('AC1: creates profile and 1on1s/ directory for a new leadership contact', async () => {
    const result = await svc.addLeadership(
      'boss@co.com',
      { name: 'The Boss', role: 'VP Engineering', areas_of_responsibility: 'Platform' },
      workspace,
    );

    expect(result.created).toBe(true);

    const profilePath = path.join(workspace, 'my-leadership', 'boss@co.com', 'boss@co.com.md');
    const oneOnOneDir = path.join(workspace, 'my-leadership', 'boss@co.com', '1on1s');

    expect(fs.existsSync(profilePath)).toBe(true);
    expect(fs.existsSync(oneOnOneDir)).toBe(true);

    const content = fs.readFileSync(profilePath, 'utf8');
    const { data } = matter(content);
    expect(data['email']).toBe('boss@co.com');
    expect(data['name']).toBe('The Boss');
    expect(data['role']).toBe('VP Engineering');
    expect(data['areas_of_responsibility']).toBe('Platform');
    expect(content).toContain('## 1on1s');
    expect(content).toContain('## Notes');
  });

  it('AC1: returns created: false and does not overwrite when contact already exists', async () => {
    await svc.addLeadership('boss@co.com', { name: 'The Boss' }, workspace);

    const result = await svc.addLeadership('boss@co.com', { name: 'Renamed' }, workspace);

    expect(result.created).toBe(false);
    const profilePath = path.join(workspace, 'my-leadership', 'boss@co.com', 'boss@co.com.md');
    const content = fs.readFileSync(profilePath, 'utf8');
    expect(content).toContain('The Boss');
    expect(content).not.toContain('Renamed');
  });

  it('AC1: normalizes uppercase email to lowercase', async () => {
    await svc.addLeadership('BOSS@CO.COM', {}, workspace);

    const profilePath = path.join(workspace, 'my-leadership', 'boss@co.com', 'boss@co.com.md');
    expect(fs.existsSync(profilePath)).toBe(true);
  });

  // ── AC2: add 1on1 ────────────────────────────────────────────────────────────

  it('AC2: creates 1on1 file and appends wiki-link to ## 1on1s section', async () => {
    await svc.addLeadership('boss@co.com', {}, workspace);

    const result = await svc.add1on1('boss@co.com', { date: '2026-03-09' }, workspace);

    expect(fs.existsSync(result.filePath)).toBe(true);

    const fileContent = fs.readFileSync(result.filePath, 'utf8');
    expect(fileContent).toContain('type: leadership-1on1');
    expect(fileContent).toContain('member: boss@co.com');
    expect(fileContent).toContain('## Alignment Topics');
    expect(fileContent).toContain('## Support Needed');
    expect(fileContent).toContain('## Feedback Requested');
    expect(fileContent).toContain('## Notes');

    const profileContent = fs.readFileSync(result.profilePath, 'utf8');
    expect(profileContent).toContain('[[1on1s/2026-03-09-boss@co.com-1on1.md]]');
  });

  it('AC2: throws descriptive error when leadership contact not found', async () => {
    await expect(svc.add1on1('ghost@co.com', { date: '2026-03-09' }, workspace)).rejects.toThrow(
      /not found.*tmr leadership add/i,
    );
  });

  // ── AC3: list ─────────────────────────────────────────────────────────────────

  it('AC3: lists contacts sorted by most recent 1on1 first', async () => {
    await svc.addLeadership('alpha@co.com', { name: 'Alpha', role: 'CTO' }, workspace);
    await svc.addLeadership('beta@co.com', { name: 'Beta', role: 'VP' }, workspace);

    await svc.add1on1('alpha@co.com', { date: '2026-02-01' }, workspace);
    await svc.add1on1('beta@co.com', { date: '2026-03-09' }, workspace);

    const rows = await svc.listLeadership(workspace);

    expect(rows).toHaveLength(2);
    expect(rows[0]?.email).toBe('beta@co.com');
    expect(rows[0]?.lastInteraction).toBe('2026-03-09');
    expect(rows[1]?.email).toBe('alpha@co.com');
    expect(rows[1]?.lastInteraction).toBe('2026-02-01');
  });

  it('AC3: shows - for lastInteraction when no 1on1s exist', async () => {
    await svc.addLeadership('boss@co.com', {}, workspace);

    const rows = await svc.listLeadership(workspace);

    expect(rows[0]?.lastInteraction).toBe('-');
  });

  it('AC3: returns empty array when no leadership directory exists', async () => {
    const rows = await svc.listLeadership(workspace);
    expect(rows).toEqual([]);
  });

  // ── Full workflow: create → 1on1 → list ──────────────────────────────────────

  it('full workflow: create leadership → add 1on1 → verify list output', async () => {
    await svc.addLeadership('boss@co.com', { name: 'The Boss', role: 'VP Engineering' }, workspace);

    const { filePath, profilePath, wikiLink } = await svc.add1on1(
      'boss@co.com',
      { date: '2026-03-09' },
      workspace,
    );

    expect(fs.existsSync(filePath)).toBe(true);
    expect(wikiLink).toBe('- [[1on1s/2026-03-09-boss@co.com-1on1.md]]');
    expect(fs.readFileSync(profilePath, 'utf8')).toContain(
      '[[1on1s/2026-03-09-boss@co.com-1on1.md]]',
    );

    const rows = await svc.listLeadership(workspace);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe('boss@co.com');
    expect(rows[0]?.name).toBe('The Boss');
    expect(rows[0]?.role).toBe('VP Engineering');
    expect(rows[0]?.lastInteraction).toBe('2026-03-09');
  });

  // ── Multiple 1on1s accumulate ─────────────────────────────────────────────────

  it('multiple 1on1s accumulate wiki-links in the ## 1on1s section', async () => {
    await svc.addLeadership('boss@co.com', {}, workspace);
    await svc.add1on1('boss@co.com', { date: '2026-02-01' }, workspace);
    await svc.add1on1('boss@co.com', { date: '2026-03-09' }, workspace);

    const profilePath = path.join(workspace, 'my-leadership', 'boss@co.com', 'boss@co.com.md');
    const content = fs.readFileSync(profilePath, 'utf8');

    expect(content).toContain('2026-02-01-boss@co.com-1on1.md');
    expect(content).toContain('2026-03-09-boss@co.com-1on1.md');
  });
});
