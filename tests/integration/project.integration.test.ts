/**
 * Integration test: full project management workflow on a real temp workspace.
 * No filesystem mocks. Uses real FileSystemService, TemplateService,
 * and ProjectService against a temp directory.
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
const { TemplateService } = await import('../../src/services/template.service.js');
const { EmailResolutionService } = await import('../../src/services/email-resolution.service.js');
const { ProjectService } = await import('../../src/services/project.service.js');

describe('Project Integration', () => {
  let workspace: string;
  let svc: InstanceType<typeof ProjectService>;

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'tmr-project-test-'));
    const realFS = new FileSystemService();
    const realTemplate = new TemplateService();
    const emailResolution = new EmailResolutionService(realFS);
    svc = new ProjectService(realFS, realTemplate, emailResolution);
  });

  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  // ── AC1: addProject ───────────────────────────────────────────────────────────

  it('AC1: creates overview with members/stakeholders frontmatter, and standups/meetings directories', async () => {
    const result = await svc.addProject('platform', workspace);

    expect(result.created).toBe(true);

    const projectDir = path.join(workspace, 'my-company', 'projects', 'platform-project');
    const overviewPath = path.join(projectDir, 'platform-project.md');
    const standupsDir = path.join(projectDir, 'standups');
    const meetingsDir = path.join(projectDir, 'meetings');

    expect(fs.existsSync(overviewPath)).toBe(true);
    expect(fs.existsSync(standupsDir)).toBe(true);
    expect(fs.existsSync(meetingsDir)).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'deps.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, 'platform-project-composition.md'))).toBe(false);
    expect(fs.existsSync(path.join(projectDir, 'discussion'))).toBe(false);
    expect(fs.existsSync(path.join(projectDir, 'presentation'))).toBe(false);

    const overviewContent = fs.readFileSync(overviewPath, 'utf8');
    const { data } = matter(overviewContent);
    expect(data['name']).toBe('platform-project');
    expect(data['type']).toBe('project');
    expect(data['members']).toEqual([]);
    expect(data['stakeholders']).toEqual([]);
    expect(overviewContent).toContain('## Overview');
    expect(overviewContent).toContain('## Goals');
    expect(overviewContent).toContain('## Timeline');
    expect(overviewContent).not.toContain('# Team Members');
    expect(overviewContent).not.toContain('# Stakeholders');
  });

  it('AC1: returns created: false when project already exists (idempotent)', async () => {
    await svc.addProject('platform', workspace);
    const second = await svc.addProject('platform', workspace);
    expect(second.created).toBe(false);
  });

  it('AC1b: deps.yaml is created with correct content', async () => {
    await svc.addProject('platform', workspace);

    const depsPath = path.join(
      workspace,
      'my-company',
      'projects',
      'platform-project',
      'deps.yaml',
    );
    expect(fs.existsSync(depsPath)).toBe(true);

    const content = fs.readFileSync(depsPath, 'utf8');
    expect(content).toContain('sources: {}');
    expect(content).toContain('tmr-project-impact');
    expect(content).toContain('deps.yaml — project dependency manifest');
    expect(content).toContain('Do not edit manually unless you understand the schema.');
  });

  it('AC1c: deps.yaml is not re-written on second addProject call', async () => {
    await svc.addProject('platform', workspace);
    const depsPath = path.join(
      workspace,
      'my-company',
      'projects',
      'platform-project',
      'deps.yaml',
    );

    // Corrupt the file to prove it is not overwritten on second call
    fs.writeFileSync(depsPath, 'mutated');
    await svc.addProject('platform', workspace);

    expect(fs.readFileSync(depsPath, 'utf8')).toBe('mutated');
  });

  // ── AC2: addStandup ────────────────────────────────────────────────────────────

  it('AC2: creates standup file inside standups/ with correct content', async () => {
    await svc.addProject('platform', workspace);
    const result = await svc.addStandup('platform', { date: '2026-03-09' }, workspace);

    const expectedPath = path.join(
      workspace,
      'my-company',
      'projects',
      'platform-project',
      'standups',
      '2026-03-09-platform-project-standup.md',
    );
    expect(result.filePath).toBe(expectedPath);
    expect(fs.existsSync(expectedPath)).toBe(true);

    const content = fs.readFileSync(expectedPath, 'utf8');
    expect(content).toContain('type: standup');
    // 9.13: project field is a complete wiki-link one level up from standups/
    expect(content).toContain('project: "[[../platform-project.md|platform-project]]"');
    expect(content).toContain('## Yesterday');
    expect(content).toContain('## Today');
    expect(content).toContain('## Blockers');
  });

  it('AC2: throws when project does not exist', async () => {
    await expect(svc.addStandup('nonexistent', {}, workspace)).rejects.toThrow(/not found/i);
  });

  // ── AC5: linkMember (team member) ─────────────────────────────────────────────

  it('AC5: links an existing team member to members frontmatter + reciprocal projects array', async () => {
    await svc.addProject('platform', workspace);

    const memberDir = path.join(workspace, 'my-teams', 'members', 'alice@co.com');
    fs.ensureDirSync(memberDir);
    fs.writeFileSync(path.join(memberDir, 'alice@co.com.md'), '---\nemail: alice@co.com\n---\n');

    const result = await svc.linkMember('platform', 'alice@co.com', workspace);

    expect(result.created).toBe(false);
    expect(result.wikiLink).toContain('my-teams/members/alice@co.com');

    const overviewPath = path.join(
      workspace,
      'my-company',
      'projects',
      'platform-project',
      'platform-project.md',
    );
    const overview = matter(fs.readFileSync(overviewPath, 'utf8'));
    expect(overview.data['members']).toHaveLength(1);
    expect((overview.data['members'] as string[])[0]).toContain('alice@co.com');

    // Reciprocal: member profile gains a projects[] entry pointing back at the project
    const member = matter(fs.readFileSync(path.join(memberDir, 'alice@co.com.md'), 'utf8'));
    expect(Array.isArray(member.data['projects'])).toBe(true);
    expect((member.data['projects'] as string[])[0]).toContain('platform-project');
  });

  it('AC5: auto-creates relationship profile for unknown email', async () => {
    await svc.addProject('platform', workspace);

    const result = await svc.linkMember('platform', 'unknown@co.com', workspace);

    expect(result.created).toBe(true);
    const relProfile = path.join(
      workspace,
      'my-company',
      'members',
      'unknown@co.com',
      'unknown@co.com.md',
    );
    expect(fs.existsSync(relProfile)).toBe(true);
  });

  // ── AC6: linkMembers ──────────────────────────────────────────────────────────

  it('AC6: batch-links multiple emails and returns correct counts', async () => {
    await svc.addProject('platform', workspace);

    const memberDir = path.join(workspace, 'my-teams', 'members', 'alice@co.com');
    fs.ensureDirSync(memberDir);
    fs.writeFileSync(path.join(memberDir, 'alice@co.com.md'), '---\nemail: alice@co.com\n---\n');

    const result = await svc.linkMembers('platform', ['alice@co.com', 'new@co.com'], workspace);

    expect(result.linked).toBe(2);
    expect(result.created).toBe(1);
  });

  it('AC6: batch linkMembers writes reciprocal projects[] to each entity profile (AC5)', async () => {
    await svc.addProject('platform', workspace);

    const m1Dir = path.join(workspace, 'my-teams', 'members', 'batch1@co.com');
    fs.ensureDirSync(m1Dir);
    fs.writeFileSync(path.join(m1Dir, 'batch1@co.com.md'), '---\nemail: batch1@co.com\n---\n');

    const m2Dir = path.join(workspace, 'my-teams', 'members', 'batch2@co.com');
    fs.ensureDirSync(m2Dir);
    fs.writeFileSync(path.join(m2Dir, 'batch2@co.com.md'), '---\nemail: batch2@co.com\n---\n');

    await svc.linkMembers('platform', ['batch1@co.com', 'batch2@co.com'], workspace);

    const p1 = matter(fs.readFileSync(path.join(m1Dir, 'batch1@co.com.md'), 'utf8'));
    expect(Array.isArray(p1.data['projects'])).toBe(true);
    expect((p1.data['projects'] as string[])[0]).toContain('platform-project');

    const p2 = matter(fs.readFileSync(path.join(m2Dir, 'batch2@co.com.md'), 'utf8'));
    expect(Array.isArray(p2.data['projects'])).toBe(true);
    expect((p2.data['projects'] as string[])[0]).toContain('platform-project');
  });

  it('AC6: batch linkStakeholders writes stakeholders[] and reciprocal projects[] on both sides (AC5)', async () => {
    await svc.addProject('platform', workspace);

    const s1Dir = path.join(workspace, 'my-company', 'members', 'sstake1@co.com');
    fs.ensureDirSync(s1Dir);
    fs.writeFileSync(path.join(s1Dir, 'sstake1@co.com.md'), '---\nemail: sstake1@co.com\n---\n');

    const s2Dir = path.join(workspace, 'my-company', 'members', 'sstake2@co.com');
    fs.ensureDirSync(s2Dir);
    fs.writeFileSync(path.join(s2Dir, 'sstake2@co.com.md'), '---\nemail: sstake2@co.com\n---\n');

    const result = await svc.linkStakeholders(
      'platform',
      ['sstake1@co.com', 'sstake2@co.com'],
      workspace,
    );
    expect(result.linked).toBe(2);

    const overviewPath = path.join(
      workspace,
      'my-company',
      'projects',
      'platform-project',
      'platform-project.md',
    );
    const overview = matter(fs.readFileSync(overviewPath, 'utf8'));
    const stakeholders = overview.data['stakeholders'] as string[];
    expect(stakeholders.some((l) => l.includes('sstake1@co.com'))).toBe(true);
    expect(stakeholders.some((l) => l.includes('sstake2@co.com'))).toBe(true);

    const st1 = matter(fs.readFileSync(path.join(s1Dir, 'sstake1@co.com.md'), 'utf8'));
    expect((st1.data['projects'] as string[])[0]).toContain('platform-project');

    const st2 = matter(fs.readFileSync(path.join(s2Dir, 'sstake2@co.com.md'), 'utf8'));
    expect((st2.data['projects'] as string[])[0]).toContain('platform-project');
  });

  // ── AC7: linkStakeholder ──────────────────────────────────────────────────────

  it('AC7: links stakeholder to stakeholders frontmatter + reciprocal projects array', async () => {
    await svc.addProject('platform', workspace);

    const relDir = path.join(workspace, 'my-company', 'members', 'vendor@co.com');
    fs.ensureDirSync(relDir);
    fs.writeFileSync(path.join(relDir, 'vendor@co.com.md'), '---\nemail: vendor@co.com\n---\n');

    const result = await svc.linkStakeholder('platform', 'vendor@co.com', workspace);

    expect(result.wikiLink).toContain('vendor@co.com');

    const overviewPath = path.join(
      workspace,
      'my-company',
      'projects',
      'platform-project',
      'platform-project.md',
    );
    const overview = matter(fs.readFileSync(overviewPath, 'utf8'));
    expect(overview.data['stakeholders']).toHaveLength(1);
    expect((overview.data['stakeholders'] as string[])[0]).toContain('vendor@co.com');

    const vendor = matter(fs.readFileSync(path.join(relDir, 'vendor@co.com.md'), 'utf8'));
    expect((vendor.data['projects'] as string[])[0]).toContain('platform-project');
  });

  // ── AC9: listProjects ─────────────────────────────────────────────────────────

  it('AC9: lists projects with correct member and stakeholder counts', async () => {
    await svc.addProject('platform', workspace);
    await svc.addProject('mobile', workspace);

    const memberDir = path.join(workspace, 'my-teams', 'members', 'alice@co.com');
    fs.ensureDirSync(memberDir);
    fs.writeFileSync(path.join(memberDir, 'alice@co.com.md'), '---\nemail: alice@co.com\n---\n');

    await svc.linkMember('platform', 'alice@co.com', workspace);
    await svc.linkMember('platform', 'bob@co.com', workspace);

    const relDir = path.join(workspace, 'my-company', 'members', 'stake@co.com');
    fs.ensureDirSync(relDir);
    fs.writeFileSync(path.join(relDir, 'stake@co.com.md'), '---\nemail: stake@co.com\n---\n');
    await svc.linkStakeholder('platform', 'stake@co.com', workspace);

    const rows = await svc.listProjects(workspace);

    const platformRow = rows.find((r) => r.name === 'platform-project');
    const mobileRow = rows.find((r) => r.name === 'mobile-project');

    expect(platformRow?.memberCount).toBe(2);
    expect(platformRow?.stakeholderCount).toBe(1);
    expect(mobileRow?.memberCount).toBe(0);
    expect(mobileRow?.stakeholderCount).toBe(0);
  });

  it('AC9: returns empty array when my-company/projects/ does not exist', async () => {
    const rows = await svc.listProjects(workspace);
    expect(rows).toEqual([]);
  });

  // ── Full workflow ─────────────────────────────────────────────────────────────

  it('full workflow: create → standup → link-member → link-stakeholder → list', async () => {
    // 1. Create project
    const createResult = await svc.addProject('alpha', workspace);
    expect(createResult.created).toBe(true);

    // 2. Add standup
    const standup = await svc.addStandup('alpha', { date: '2026-03-09' }, workspace);
    expect(fs.existsSync(standup.filePath)).toBe(true);
    expect(standup.filePath).toContain('standups');

    // 3. Link team member (pre-create)
    const memberDir = path.join(workspace, 'my-teams', 'members', 'eng@co.com');
    fs.ensureDirSync(memberDir);
    fs.writeFileSync(path.join(memberDir, 'eng@co.com.md'), '---\nemail: eng@co.com\n---\n');

    const memberLink = await svc.linkMember('alpha', 'eng@co.com', workspace);
    expect(memberLink.created).toBe(false);
    expect(memberLink.wikiLink).toContain('my-teams/members/eng@co.com');

    // 4. Link stakeholder (auto-creates)
    const stakeLink = await svc.linkStakeholder('alpha', 'pm@co.com', workspace);
    expect(stakeLink.created).toBe(true);

    // 5. List shows correct counts
    const rows = await svc.listProjects(workspace);
    const alphaRow = rows.find((r) => r.name === 'alpha-project');
    expect(alphaRow?.memberCount).toBe(1);
    expect(alphaRow?.stakeholderCount).toBe(1);
  });
});
