/**
 * Integration test: InboxProcessService full pipeline with temp workspace and MockAIProvider.
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { InboxProcessService } from '../../src/services/inbox-process.service.js';
import { InboxService } from '../../src/services/inbox.service.js';
import { CategorizationService } from '../../src/services/categorization.service.js';
import { ContextService } from '../../src/services/context.service.js';
import { FileOrganizationService } from '../../src/services/file-organization.service.js';
import { TaskService } from '../../src/services/task.service.js';
import { TeamService } from '../../src/services/team.service.js';
import { ProjectService } from '../../src/services/project.service.js';
import { MockAIProvider } from '../../src/providers/mock-provider.js';
import { sectionParserService } from '../../src/services/section-parser.service.js';
import { templateService } from '../../src/services/template.service.js';
import { emailResolutionService } from '../../src/services/email-resolution.service.js';

const { FileSystemService } = await import('../../src/services/file-system.service.js');

function makeCategorizationJson(emailLocal: string): string {
  return JSON.stringify({
    type: '1on1_session',
    members: ['Jane Tester'],
    projects: [],
    insights: {
      'Jane Tester': ['Discussed roadmap'],
    },
    destinations: [`my-teams/alpha/${emailLocal}/1on1s/`],
    suggestedActions: ['Follow up next week'],
    confidence: 0.92,
  });
}

describe('InboxProcessService (integration)', () => {
  let tmpDir: string;
  let fsSvc: InstanceType<typeof FileSystemService>;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tmr-process-int-'));
    fsSvc = new FileSystemService();
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  it('runs scan → categorize → context → tasks → organize', async () => {
    const teamSvc = new TeamService(fsSvc);
    await teamSvc.createTeam('alpha', tmpDir);
    await teamSvc.addMember(
      'alpha',
      'jane@co.com',
      { name: 'Jane Tester', role: 'Engineer', location: 'Remote' },
      tmpDir,
    );

    const inboxDir = path.join(tmpDir, 'inbox');
    await fs.ensureDir(inboxDir);
    const notePath = path.join(inboxDir, 'note.md');
    await fs.writeFile(
      notePath,
      '---\ntitle: 1:1\n---\n\n# Chat with Jane\n\nRoadmap discussion.\n',
      'utf-8',
    );

    const ai = new MockAIProvider((prompt) => {
      if (prompt.includes('Existing tasks by period:')) {
        return JSON.stringify({ tasks: [], completedDescriptions: [] });
      }
      return makeCategorizationJson('jane@co.com');
    });

    const categorization = new CategorizationService(ai, 0.75);
    const inbox = new InboxService(fsSvc);
    const context = new ContextService(fsSvc, sectionParserService);
    const tasks = new TaskService(ai, fsSvc);
    const organize = new FileOrganizationService(fsSvc);
    const projectSvc = new ProjectService(fsSvc, templateService, emailResolutionService);

    const proc = new InboxProcessService(
      inbox,
      categorization,
      context,
      tasks,
      organize,
      teamSvc,
      projectSvc,
      fsSvc,
    );

    const result = await proc.run(tmpDir, { dryRun: false, verbose: false, plain: true });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.filesScanned).toBe(1);
    expect(result.data.filesCategorizedOk).toBe(1);
    expect(result.data.memberContextUpdates).toBe(1);
    expect(result.data.filesOrganizedOk).toBe(1);
    expect(result.data.suggestedActions).toContain('Follow up next week');

    const ctxPath = path.join(tmpDir, 'my-teams', 'members', 'jane@co.com', 'context.md');
    expect(await fs.pathExists(ctxPath)).toBe(true);
    const ctxContent = await fs.readFile(ctxPath, 'utf-8');
    expect(ctxContent).toContain('Discussed roadmap');

    expect(await fs.pathExists(notePath)).toBe(false);
  });

  it('dry-run does not write or move files', async () => {
    const teamSvc = new TeamService(fsSvc);
    await teamSvc.createTeam('beta', tmpDir);
    await teamSvc.addMember(
      'beta',
      'bob@co.com',
      { name: 'Bob Tester', role: 'Engineer', location: 'Remote' },
      tmpDir,
    );

    const inboxDir = path.join(tmpDir, 'inbox');
    await fs.ensureDir(inboxDir);
    const notePath = path.join(inboxDir, 'x.md');
    await fs.writeFile(notePath, '# Hi\n', 'utf-8');

    const ai = new MockAIProvider((prompt) => {
      if (prompt.includes('Existing tasks by period:')) {
        return JSON.stringify({ tasks: [], completedDescriptions: [] });
      }
      return JSON.stringify({
        type: 'general_note',
        members: [],
        projects: [],
        insights: {},
        destinations: ['my-teams/beta/bob@co.com/notes/'],
        suggestedActions: [],
        confidence: 0.9,
      });
    });

    const categorization = new CategorizationService(ai, 0.75);
    const inbox = new InboxService(fsSvc);
    const context = new ContextService(fsSvc, sectionParserService);
    const tasks = new TaskService(ai, fsSvc);
    const organize = new FileOrganizationService(fsSvc);
    const projectSvc = new ProjectService(fsSvc, templateService, emailResolutionService);

    const proc = new InboxProcessService(
      inbox,
      categorization,
      context,
      tasks,
      organize,
      teamSvc,
      projectSvc,
      fsSvc,
    );

    const result = await proc.run(tmpDir, { dryRun: true, verbose: false, plain: true });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.dryRun).toBe(true);
    expect(await fs.pathExists(notePath)).toBe(true);
  });
});
