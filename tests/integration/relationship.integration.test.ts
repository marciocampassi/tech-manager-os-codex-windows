/**
 * Integration test: full relationship management workflow on a real temp workspace.
 * No filesystem mocks. Uses real FileSystemService, SectionParserService,
 * TemplateService, and RelationshipService against a temp directory.
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
const { RelationshipService } = await import('../../src/services/relationship.service.js');

describe('Relationship Integration', () => {
  let workspace: string;
  let svc: InstanceType<typeof RelationshipService>;

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'tmr-relationship-test-'));
    const realFS = new FileSystemService();
    svc = new RelationshipService(realFS, new SectionParserService(realFS), new TemplateService());
  });

  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  // ── AC1: add single relationship ─────────────────────────────────────────────

  it('AC1: creates profile and 1on1s/ directory for a new relationship', async () => {
    const result = await svc.addRelationship(
      'alice@co.com',
      { name: 'Alice', department: 'Product', relationship_type: 'collaborator' },
      workspace,
    );

    expect(result.created).toBe(true);

    const profilePath = path.join(
      workspace,
      'my-company',
      'members',
      'alice@co.com',
      'alice@co.com.md',
    );
    const oneOnOneDir = path.join(workspace, 'my-company', 'members', 'alice@co.com', '1on1s');

    expect(fs.existsSync(profilePath)).toBe(true);
    expect(fs.existsSync(oneOnOneDir)).toBe(true);

    const content = fs.readFileSync(profilePath, 'utf8');
    const { data } = matter(content);
    expect(data['email']).toBe('alice@co.com');
    expect(data['name']).toBe('Alice');
    expect(data['department']).toBe('Product');
    expect(data['relationship_type']).toBe('collaborator');
    expect(content).toContain('## 1on1s');
    expect(content).toContain('## Notes');
  });

  it('AC1: returns created: false and does not overwrite when relationship exists', async () => {
    await svc.addRelationship('alice@co.com', { name: 'Alice' }, workspace);

    const result = await svc.addRelationship('alice@co.com', { name: 'NewName' }, workspace);

    expect(result.created).toBe(false);
    const profilePath = path.join(
      workspace,
      'my-company',
      'members',
      'alice@co.com',
      'alice@co.com.md',
    );
    const content = fs.readFileSync(profilePath, 'utf8');
    expect(content).toContain('Alice');
    expect(content).not.toContain('NewName');
  });

  it('AC1: normalizes uppercase email to lowercase', async () => {
    await svc.addRelationship('ALICE@CO.COM', {}, workspace);

    const profilePath = path.join(
      workspace,
      'my-company',
      'members',
      'alice@co.com',
      'alice@co.com.md',
    );
    expect(fs.existsSync(profilePath)).toBe(true);
  });

  // ── AC2: batch add ────────────────────────────────────────────────────────────

  it('AC2: batch creates multiple relationships and returns correct counts', async () => {
    await svc.addRelationship('alice@co.com', {}, workspace);

    const result = await svc.addBatch(
      ['alice@co.com', 'bob@co.com', 'carol@co.com'],
      {},
      workspace,
    );

    expect(result.created).toBe(2);
    expect(result.existed).toBe(1);

    const bobPath = path.join(workspace, 'my-company', 'members', 'bob@co.com', 'bob@co.com.md');
    expect(fs.existsSync(bobPath)).toBe(true);
  });

  // ── AC3: add 1on1 ────────────────────────────────────────────────────────────

  it('AC3: creates 1on1 file and appends wiki-link to ## 1on1s section', async () => {
    await svc.addRelationship('alice@co.com', {}, workspace);

    const result = await svc.add1on1('alice@co.com', { date: '2026-03-07' }, workspace);

    expect(fs.existsSync(result.filePath)).toBe(true);

    const fileContent = fs.readFileSync(result.filePath, 'utf8');
    expect(fileContent).toContain('type: 1on1');
    expect(fileContent).toContain('member: alice@co.com');
    expect(fileContent).toContain('## Alignment Topics');
    expect(fileContent).toContain('## Support Needed');
    expect(fileContent).toContain('## Feedback Requested');

    const profileContent = fs.readFileSync(result.profilePath, 'utf8');
    expect(profileContent).toContain('[[1on1s/2026-03-07-alice@co.com-1on1.md]]');
  });

  it('AC3: throws descriptive error when relationship not found', async () => {
    await expect(svc.add1on1('ghost@co.com', { date: '2026-03-07' }, workspace)).rejects.toThrow(
      /not found.*tmr relationship add/i,
    );
  });

  // ── AC4: list ─────────────────────────────────────────────────────────────────

  it('AC4: lists relationships sorted by most recent 1on1 first', async () => {
    await svc.addRelationship('alice@co.com', { name: 'Alice', department: 'Eng' }, workspace);
    await svc.addRelationship('bob@co.com', { name: 'Bob', department: 'Product' }, workspace);

    await svc.add1on1('alice@co.com', { date: '2026-03-01' }, workspace);
    await svc.add1on1('bob@co.com', { date: '2026-03-07' }, workspace);

    const rows = await svc.listRelationships(workspace);

    expect(rows).toHaveLength(2);
    expect(rows[0]?.email).toBe('bob@co.com');
    expect(rows[0]?.lastInteraction).toBe('2026-03-07');
    expect(rows[1]?.email).toBe('alice@co.com');
    expect(rows[1]?.lastInteraction).toBe('2026-03-01');
  });

  it('AC4: shows - for lastInteraction when no 1on1s exist', async () => {
    await svc.addRelationship('alice@co.com', {}, workspace);

    const rows = await svc.listRelationships(workspace);

    expect(rows[0]?.lastInteraction).toBe('-');
  });

  it('AC4: returns empty array when no relationships directory exists', async () => {
    const rows = await svc.listRelationships(workspace);
    expect(rows).toEqual([]);
  });

  // ── Multiple 1on1s accumulate ─────────────────────────────────────────────────

  it('multiple 1on1s accumulate wiki-links in the ## 1on1s section', async () => {
    await svc.addRelationship('alice@co.com', {}, workspace);
    await svc.add1on1('alice@co.com', { date: '2026-02-01' }, workspace);
    await svc.add1on1('alice@co.com', { date: '2026-03-07' }, workspace);

    const profilePath = path.join(
      workspace,
      'my-company',
      'members',
      'alice@co.com',
      'alice@co.com.md',
    );
    const content = fs.readFileSync(profilePath, 'utf8');

    expect(content).toContain('2026-02-01-alice@co.com-1on1.md');
    expect(content).toContain('2026-03-07-alice@co.com-1on1.md');
  });
});
