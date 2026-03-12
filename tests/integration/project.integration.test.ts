/**
 * Integration test: full project management workflow on a real temp workspace.
 * No filesystem mocks. Uses real FileSystemService, TemplateService,
 * RelationshipService, and ProjectService against a temp directory.
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
const { EmailResolutionService } = await import('../../src/services/email-resolution.service.js');
const { ProjectService } = await import('../../src/services/project.service.js');

describe('Project Integration', () => {
  let workspace: string;
  let svc: InstanceType<typeof ProjectService>;
  let relSvc: InstanceType<typeof RelationshipService>;

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'tmr-project-test-'));
    const realFS = new FileSystemService();
    const realTemplate = new TemplateService();
    const realSection = new SectionParserService(realFS);
    relSvc = new RelationshipService(realFS, realSection, realTemplate);
    const emailResolution = new EmailResolutionService(realFS, relSvc);
    svc = new ProjectService(realFS, realTemplate, emailResolution);
  });

  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  // ── AC1: addProject ───────────────────────────────────────────────────────────

  it('AC1: creates overview, composition, and all subdirectories', async () => {
    const result = await svc.addProject('platform', workspace);

    expect(result.created).toBe(true);

    const overviewPath = path.join(workspace, 'my-company', 'projects', 'platform-project.md');
    const compPath = path.join(workspace, 'my-projects', 'platform', 'platform-composition.md');
    const standupDir = path.join(workspace, 'my-projects', 'platform', 'standup');
    const discussionDir = path.join(workspace, 'my-projects', 'platform', 'discussion');
    const presentationDir = path.join(workspace, 'my-projects', 'platform', 'presentation');

    expect(fs.existsSync(overviewPath)).toBe(true);
    expect(fs.existsSync(compPath)).toBe(true);
    expect(fs.existsSync(standupDir)).toBe(true);
    expect(fs.existsSync(discussionDir)).toBe(true);
    expect(fs.existsSync(presentationDir)).toBe(true);

    const overviewContent = fs.readFileSync(overviewPath, 'utf8');
    const { data } = matter(overviewContent);
    expect(data['name']).toBe('platform');
    expect(data['type']).toBe('project');
    expect(overviewContent).toContain('## Overview');
    expect(overviewContent).toContain('## Goals');
    expect(overviewContent).toContain('## Timeline');

    const compContent = fs.readFileSync(compPath, 'utf8');
    expect(compContent).toContain('# Team Members');
    expect(compContent).toContain('# Stakeholders');
  });

  it('AC1: returns created: false when project already exists (idempotent)', async () => {
    await svc.addProject('platform', workspace);
    const second = await svc.addProject('platform', workspace);
    expect(second.created).toBe(false);
  });

  // ── AC2: addStandup ────────────────────────────────────────────────────────────

  it('AC2: creates standup file with correct content', async () => {
    await svc.addProject('platform', workspace);
    const result = await svc.addStandup('platform', { date: '2026-03-09' }, workspace);

    const expectedPath = path.join(
      workspace,
      'my-projects',
      'platform',
      'standup',
      '2026-03-09-platform-standup.md',
    );
    expect(result.filePath).toBe(expectedPath);
    expect(fs.existsSync(expectedPath)).toBe(true);

    const content = fs.readFileSync(expectedPath, 'utf8');
    expect(content).toContain('type: standup');
    expect(content).toContain('project: platform');
    expect(content).toContain('## Yesterday');
    expect(content).toContain('## Today');
    expect(content).toContain('## Blockers');
  });

  it('AC2: throws when project does not exist', async () => {
    await expect(svc.addStandup('nonexistent', {}, workspace)).rejects.toThrow(/not found/i);
  });

  // ── AC3: addDiscussion ────────────────────────────────────────────────────────

  it('AC3: creates discussion file with correct content', async () => {
    await svc.addProject('platform', workspace);
    const result = await svc.addDiscussion('platform', { date: '2026-03-09' }, workspace);

    expect(fs.existsSync(result.filePath)).toBe(true);
    const content = fs.readFileSync(result.filePath, 'utf8');
    expect(content).toContain('type: discussion');
    expect(content).toContain('## Topic');
    expect(content).toContain('## Attendees');
    expect(content).toContain('## Decisions');
    expect(content).toContain('## Action Items');
  });

  // ── AC4: addPresentation ──────────────────────────────────────────────────────

  it('AC4: creates presentation file with slugified topic', async () => {
    await svc.addProject('platform', workspace);
    const result = await svc.addPresentation(
      'platform',
      'Q1 Review',
      { date: '2026-03-09' },
      workspace,
    );

    const expectedPath = path.join(
      workspace,
      'my-projects',
      'platform',
      'presentation',
      '2026-03-09-platform-presentation-q1-review.md',
    );
    expect(result.filePath).toBe(expectedPath);
    expect(fs.existsSync(expectedPath)).toBe(true);

    const content = fs.readFileSync(expectedPath, 'utf8');
    expect(content).toContain('topic: Q1 Review');
    expect(content).toContain('# platform — Q1 Review');
    expect(content).toContain('## Slides Outline');
  });

  // ── AC5: linkMember (team member) ─────────────────────────────────────────────

  it('AC5: links an existing team member to composition Team Members section', async () => {
    await svc.addProject('platform', workspace);

    // Create a team member profile
    const memberDir = path.join(workspace, 'my-teams', '_members', 'alice@co.com');
    fs.ensureDirSync(memberDir);
    fs.writeFileSync(path.join(memberDir, 'alice@co.com.md'), '---\nemail: alice@co.com\n---\n');

    const result = await svc.linkMember('platform', 'alice@co.com', workspace);

    expect(result.created).toBe(false);
    expect(result.wikiLink).toContain('my-teams/_members/alice@co.com');

    const compPath = path.join(workspace, 'my-projects', 'platform', 'platform-composition.md');
    const content = fs.readFileSync(compPath, 'utf8');
    expect(content).toContain('alice@co.com');

    const teamMembersIdx = content.indexOf('# Team Members');
    const aliceIdx = content.indexOf('alice@co.com');
    expect(aliceIdx).toBeGreaterThan(teamMembersIdx);
  });

  it('AC5: auto-creates relationship profile for unknown email', async () => {
    await svc.addProject('platform', workspace);

    const result = await svc.linkMember('platform', 'unknown@co.com', workspace);

    expect(result.created).toBe(true);
    const relProfile = path.join(
      workspace,
      'my-company',
      'relationships',
      'unknown@co.com',
      'unknown@co.com.md',
    );
    expect(fs.existsSync(relProfile)).toBe(true);
  });

  // ── AC6: linkMembers ──────────────────────────────────────────────────────────

  it('AC6: batch-links multiple emails and returns correct counts', async () => {
    await svc.addProject('platform', workspace);

    // Pre-create one team member
    const memberDir = path.join(workspace, 'my-teams', '_members', 'alice@co.com');
    fs.ensureDirSync(memberDir);
    fs.writeFileSync(path.join(memberDir, 'alice@co.com.md'), '---\nemail: alice@co.com\n---\n');

    const result = await svc.linkMembers('platform', ['alice@co.com', 'new@co.com'], workspace);

    expect(result.linked).toBe(2);
    expect(result.created).toBe(1); // only new@co.com was auto-created
  });

  // ── AC7: linkStakeholder ──────────────────────────────────────────────────────

  it('AC7: links stakeholder to Stakeholders section', async () => {
    await svc.addProject('platform', workspace);

    // Pre-create relationship profile
    const relDir = path.join(workspace, 'my-company', 'relationships', 'vendor@co.com');
    fs.ensureDirSync(relDir);
    fs.writeFileSync(path.join(relDir, 'vendor@co.com.md'), '---\nemail: vendor@co.com\n---\n');

    const result = await svc.linkStakeholder('platform', 'vendor@co.com', workspace);

    expect(result.wikiLink).toContain('my-company/relationships/vendor@co.com');

    const compPath = path.join(workspace, 'my-projects', 'platform', 'platform-composition.md');
    const content = fs.readFileSync(compPath, 'utf8');

    const stakeholdersIdx = content.indexOf('# Stakeholders');
    const vendorIdx = content.indexOf('vendor@co.com');
    expect(vendorIdx).toBeGreaterThan(stakeholdersIdx);
  });

  // ── AC9: listProjects ─────────────────────────────────────────────────────────

  it('AC9: lists projects with correct member and stakeholder counts', async () => {
    await svc.addProject('platform', workspace);
    await svc.addProject('mobile', workspace);

    // Link members to platform
    const memberDir = path.join(workspace, 'my-teams', '_members', 'alice@co.com');
    fs.ensureDirSync(memberDir);
    fs.writeFileSync(path.join(memberDir, 'alice@co.com.md'), '---\nemail: alice@co.com\n---\n');

    await svc.linkMember('platform', 'alice@co.com', workspace);
    await svc.linkMember('platform', 'bob@co.com', workspace); // auto-creates relationship

    const relDir = path.join(workspace, 'my-company', 'relationships', 'stake@co.com');
    fs.ensureDirSync(relDir);
    fs.writeFileSync(path.join(relDir, 'stake@co.com.md'), '---\nemail: stake@co.com\n---\n');
    await svc.linkStakeholder('platform', 'stake@co.com', workspace);

    const rows = await svc.listProjects(workspace);

    const platformRow = rows.find((r) => r.name === 'platform');
    const mobileRow = rows.find((r) => r.name === 'mobile');

    expect(platformRow?.memberCount).toBe(2);
    expect(platformRow?.stakeholderCount).toBe(1);
    expect(mobileRow?.memberCount).toBe(0);
    expect(mobileRow?.stakeholderCount).toBe(0);
  });

  it('AC9: returns empty array when my-projects/ does not exist', async () => {
    const rows = await svc.listProjects(workspace);
    expect(rows).toEqual([]);
  });

  // ── Full workflow ─────────────────────────────────────────────────────────────

  it('full workflow: create → standup → discussion → presentation → link-member → link-stakeholder → list', async () => {
    // 1. Create project
    const createResult = await svc.addProject('alpha', workspace);
    expect(createResult.created).toBe(true);

    // 2. Add standup
    const standup = await svc.addStandup('alpha', { date: '2026-03-09' }, workspace);
    expect(fs.existsSync(standup.filePath)).toBe(true);

    // 3. Add discussion
    const discussion = await svc.addDiscussion('alpha', { date: '2026-03-09' }, workspace);
    expect(fs.existsSync(discussion.filePath)).toBe(true);

    // 4. Add presentation
    const presentation = await svc.addPresentation(
      'alpha',
      'Q1 Planning',
      { date: '2026-03-09' },
      workspace,
    );
    expect(fs.existsSync(presentation.filePath)).toBe(true);
    expect(presentation.filePath).toContain('q1-planning');

    // 5. Link team member (pre-create)
    const memberDir = path.join(workspace, 'my-teams', '_members', 'eng@co.com');
    fs.ensureDirSync(memberDir);
    fs.writeFileSync(path.join(memberDir, 'eng@co.com.md'), '---\nemail: eng@co.com\n---\n');

    const memberLink = await svc.linkMember('alpha', 'eng@co.com', workspace);
    expect(memberLink.created).toBe(false);
    expect(memberLink.wikiLink).toContain('my-teams/_members/eng@co.com');

    // 6. Link stakeholder (auto-creates)
    const stakeLink = await svc.linkStakeholder('alpha', 'pm@co.com', workspace);
    expect(stakeLink.created).toBe(true);

    // 7. List shows correct counts
    const rows = await svc.listProjects(workspace);
    const alphaRow = rows.find((r) => r.name === 'alpha');
    expect(alphaRow?.memberCount).toBe(1);
    expect(alphaRow?.stakeholderCount).toBe(1);
  });
});
