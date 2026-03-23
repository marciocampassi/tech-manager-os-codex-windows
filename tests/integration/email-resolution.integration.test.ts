/**
 * Integration test: EmailResolutionService against a real temp workspace.
 * No filesystem mocks. Uses real FileSystemService, RelationshipService,
 * and EmailResolutionService against a temp directory.
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
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
const { EmailResolutionService } = await import('../../src/services/email-resolution.service.js');

describe('EmailResolutionService Integration', () => {
  let workspace: string;
  let svc: InstanceType<typeof EmailResolutionService>;
  let relSvc: InstanceType<typeof RelationshipService>;

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'tmr-email-res-test-'));
    const realFS = new FileSystemService();
    const realTemplate = new TemplateService();
    const realSection = new SectionParserService(realFS);
    relSvc = new RelationshipService(realFS, realSection, realTemplate);
    svc = new EmailResolutionService(realFS, relSvc);
  });

  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
    svc.clearCache();
  });

  // ── resolve: hierarchy ────────────────────────────────────────────────────────

  it('resolves to team when team profile exists', async () => {
    const email = 'alice@co.com';
    const profilePath = path.join(workspace, 'my-teams', 'members', email, `${email}.md`);
    await fs.ensureDir(path.dirname(profilePath));
    await fs.writeFile(profilePath, `# ${email}`);

    const result = await svc.resolve(email, workspace);

    expect(result.type).toBe('team');
    expect(result.absolutePath).toBe(profilePath);
    expect(result.created).toBe(false);
  });

  it('resolves to leadership when leadership profile exists (no team)', async () => {
    const email = 'boss@co.com';
    const profilePath = path.join(workspace, 'my-leadership', email, `${email}.md`);
    await fs.ensureDir(path.dirname(profilePath));
    await fs.writeFile(profilePath, `# ${email}`);

    const result = await svc.resolve(email, workspace);

    expect(result.type).toBe('leadership');
    expect(result.absolutePath).toBe(profilePath);
    expect(result.created).toBe(false);
  });

  it('resolves to relationship when relationship profile exists (no team/leadership)', async () => {
    const email = 'partner@co.com';
    const profilePath = path.join(workspace, 'my-company', 'members', email, `${email}.md`);
    await fs.ensureDir(path.dirname(profilePath));
    await fs.writeFile(profilePath, `# ${email}`);

    const result = await svc.resolve(email, workspace);

    expect(result.type).toBe('relationship');
    expect(result.absolutePath).toBe(profilePath);
    expect(result.created).toBe(false);
  });

  it('auto-creates relationship and returns created: true when email not found', async () => {
    const email = 'newguy@co.com';

    const result = await svc.resolve(email, workspace);

    expect(result.type).toBe('relationship');
    expect(result.created).toBe(true);

    const expectedProfilePath = path.join(workspace, 'my-company', 'members', email, `${email}.md`);
    expect(result.absolutePath).toBe(expectedProfilePath);
    expect(fs.existsSync(expectedProfilePath)).toBe(true);
  });

  it('prefers team over leadership over relationship when multiple exist', async () => {
    const email = 'multi@co.com';

    const teamProfile = path.join(workspace, 'my-teams', 'members', email, `${email}.md`);
    const leaderProfile = path.join(workspace, 'my-leadership', email, `${email}.md`);
    const relProfile = path.join(workspace, 'my-company', 'members', email, `${email}.md`);

    await fs.ensureDir(path.dirname(teamProfile));
    await fs.writeFile(teamProfile, `# ${email}`);
    await fs.ensureDir(path.dirname(leaderProfile));
    await fs.writeFile(leaderProfile, `# ${email}`);
    await fs.ensureDir(path.dirname(relProfile));
    await fs.writeFile(relProfile, `# ${email}`);

    const result = await svc.resolve(email, workspace);

    expect(result.type).toBe('team');
  });

  // ── caching ───────────────────────────────────────────────────────────────────

  it('returns identical result object on second call (cached)', async () => {
    const email = 'cached@co.com';
    const profilePath = path.join(workspace, 'my-teams', 'members', email, `${email}.md`);
    await fs.ensureDir(path.dirname(profilePath));
    await fs.writeFile(profilePath, `# ${email}`);

    const r1 = await svc.resolve(email, workspace);
    const r2 = await svc.resolve(email, workspace);

    expect(r1).toBe(r2);
  });

  it('clearCache() forces a fresh resolution', async () => {
    const email = 'fresh@co.com';

    const r1 = await svc.resolve(email, workspace);
    expect(r1.created).toBe(true);

    svc.clearCache();

    const r2 = await svc.resolve(email, workspace);
    expect(r2.created).toBe(false);
  });

  // ── generateWikiLink ──────────────────────────────────────────────────────────

  it('generateWikiLink produces correct relative path from project composition', async () => {
    const email = 'user@co.com';
    const resolvedPath = path.join(workspace, 'my-teams', 'members', email, `${email}.md`);
    const fromPath = path.join(
      workspace,
      'my-company',
      'projects',
      'platform-project',
      'platform-project-composition.md',
    );

    const link = svc.generateWikiLink(email, resolvedPath, fromPath);

    expect(link).toContain('my-teams/members/user@co.com/user@co.com.md');
    expect(link).toContain('|user@co.com]]');
    expect(link).not.toContain('\\');
  });

  it('generateWikiLink + resolve produces a complete wiki-link line for team member', async () => {
    const email = 'wikiuser@co.com';
    const profilePath = path.join(workspace, 'my-teams', 'members', email, `${email}.md`);
    await fs.ensureDir(path.dirname(profilePath));
    await fs.writeFile(profilePath, `# ${email}`);

    const resolved = await svc.resolve(email, workspace);
    const fromPath = path.join(
      workspace,
      'my-company',
      'projects',
      'platform-project',
      'platform-project-composition.md',
    );
    const link = svc.generateWikiLink(email, resolved.absolutePath, fromPath);

    expect(link).toContain(`my-teams/members/${email}/${email}.md`);
    expect(link).toContain(`|${email}]]`);
  });
});
