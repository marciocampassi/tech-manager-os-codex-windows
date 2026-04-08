/**
 * Integration tests for ContextService.
 *
 * Uses a real temp filesystem with real FileSystemService and SectionParserService
 * to validate that context.md files are created and appended correctly.
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { ContextService } from '../../src/services/context.service.js';
import { CONTEXT_SECTION_NAME } from '../../src/types/context.types.js';

const { fileSystemService } = await import('../../src/services/file-system.service.js');
const { sectionParserService } = await import('../../src/services/section-parser.service.js');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MEMBER_EMAIL = 'john.doe@co.com';
const LEADER_EMAIL = 'boss@co.com';
const PROJECT_NAME = 'api-redesign';
const INSIGHTS_A = ['Career goal discussed', 'Needs PR review'];
const INSIGHTS_B = ['Promoted to senior', 'Onboarding new hire'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function memberDir(ws: string, email: string): string {
  return path.join(ws, 'my-teams', 'members', email);
}

function memberCtxPath(ws: string, email: string): string {
  return path.join(memberDir(ws, email), 'context.md');
}

function leaderDir(ws: string, email: string): string {
  return path.join(ws, 'my-leadership', email);
}

function leaderCtxPath(ws: string, email: string): string {
  return path.join(leaderDir(ws, email), 'context.md');
}

function projectCtxPath(ws: string, name: string): string {
  return path.join(ws, 'my-company', 'projects', `${name}-project`, 'context.md');
}

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('ContextService (integration)', () => {
  let tmpDir: string;
  let svc: ContextService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tmr-ctx-test-'));
    svc = new ContextService(fileSystemService, sectionParserService);
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  // ── Member context ──────────────────────────────────────────────────────────

  describe('Member context', () => {
    beforeEach(async () => {
      // Create the member directory structure (simulates tmr team add)
      await fs.ensureDir(memberDir(tmpDir, MEMBER_EMAIL));
      // Create a minimal profile file so the directory is recognisable
      await fs.writeFile(
        path.join(memberDir(tmpDir, MEMBER_EMAIL), `${MEMBER_EMAIL}.md`),
        '# Profile\n',
      );
    });

    it('should create context.md and write insights on first call', async () => {
      const result = await svc.updateContext(MEMBER_EMAIL, INSIGHTS_A, tmpDir);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.created).toBe(true);
      expect(result.data.entityType).toBe('member');
      expect(result.data.insightsAppended).toBe(INSIGHTS_A.length);

      const content = await fs.readFile(memberCtxPath(tmpDir, MEMBER_EMAIL), 'utf-8');
      expect(content).toContain(`## ${CONTEXT_SECTION_NAME}`);
      expect(content).toContain('Career goal discussed');
      expect(content).toContain('Needs PR review');
    });

    it('should append insights on second call without overwriting', async () => {
      await svc.updateContext(MEMBER_EMAIL, INSIGHTS_A, tmpDir);
      const result = await svc.updateContext(MEMBER_EMAIL, INSIGHTS_B, tmpDir);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.created).toBe(false);

      const content = await fs.readFile(memberCtxPath(tmpDir, MEMBER_EMAIL), 'utf-8');
      expect(content).toContain('Career goal discussed');
      expect(content).toContain('Promoted to senior');
      // Dated blocks should be separated by a blank line
      const firstIdx = content.indexOf('Career goal discussed');
      const secondIdx = content.indexOf('Promoted to senior');
      const between = content.slice(firstIdx, secondIdx);
      expect(between).toContain('\n\n');
    });

    it('should create context.md with just the header when insights are empty', async () => {
      const result = await svc.updateContext(MEMBER_EMAIL, [], tmpDir);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.created).toBe(true);
      expect(result.data.insightsAppended).toBe(0);

      const content = await fs.readFile(memberCtxPath(tmpDir, MEMBER_EMAIL), 'utf-8');
      expect(content).toContain(`## ${CONTEXT_SECTION_NAME}`);
    });
  });

  // ── Leadership context ─────────────────────────────────────────────────────

  describe('Leadership context', () => {
    beforeEach(async () => {
      // Create the leadership directory structure (simulates tmr leadership add)
      await fs.ensureDir(leaderDir(tmpDir, LEADER_EMAIL));
      await fs.writeFile(
        path.join(leaderDir(tmpDir, LEADER_EMAIL), `${LEADER_EMAIL}.md`),
        '# Leadership Profile\n',
      );
    });

    it('should detect leadership entity and create context.md', async () => {
      const result = await svc.updateContext(LEADER_EMAIL, INSIGHTS_A, tmpDir);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.entityType).toBe('leadership');
      expect(result.data.created).toBe(true);

      const content = await fs.readFile(leaderCtxPath(tmpDir, LEADER_EMAIL), 'utf-8');
      expect(content).toContain('Career goal discussed');
    });
  });

  // ── Project context ─────────────────────────────────────────────────────────

  describe('Project context', () => {
    beforeEach(async () => {
      // Create the project directory structure (simulates tmr project add)
      await fs.ensureDir(path.join(tmpDir, 'my-company', 'projects', `${PROJECT_NAME}-project`));
    });

    it('should create project context.md and write insights', async () => {
      const result = await svc.updateProjectContext(PROJECT_NAME, INSIGHTS_A, tmpDir);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.entityType).toBe('project');
      expect(result.data.created).toBe(true);
      expect(result.data.insightsAppended).toBe(INSIGHTS_A.length);

      const content = await fs.readFile(projectCtxPath(tmpDir, PROJECT_NAME), 'utf-8');
      expect(content).toContain(`## ${CONTEXT_SECTION_NAME}`);
      expect(content).toContain('Career goal discussed');
    });

    it('should append to project context.md on second call', async () => {
      await svc.updateProjectContext(PROJECT_NAME, INSIGHTS_A, tmpDir);
      await svc.updateProjectContext(PROJECT_NAME, INSIGHTS_B, tmpDir);

      const content = await fs.readFile(projectCtxPath(tmpDir, PROJECT_NAME), 'utf-8');
      expect(content).toContain('Career goal discussed');
      expect(content).toContain('Promoted to senior');
    });
  });

  // ── Unknown entity ─────────────────────────────────────────────────────────

  describe('Unknown entity', () => {
    it('should return failure when email does not match any entity directory', async () => {
      const result = await svc.updateContext('nobody@co.com', INSIGHTS_A, tmpDir);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toContain('Entity not found');
    });
  });

  // ── Member takes priority over leadership ──────────────────────────────────

  describe('Entity precedence', () => {
    it('should resolve as member when both member and leadership dirs exist for same email', async () => {
      // Create both directories (unusual but testing precedence rule)
      await fs.ensureDir(memberDir(tmpDir, MEMBER_EMAIL));
      await fs.ensureDir(leaderDir(tmpDir, MEMBER_EMAIL));

      const result = await svc.updateContext(MEMBER_EMAIL, INSIGHTS_A, tmpDir);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.entityType).toBe('member');
    });
  });
});
