import { join } from 'node:path';
import { fileSystemService } from '../services/file-system.service.js';
import { logger } from '../utils/logger.js';

const WORKSPACE_DIRS = [
  'inbox',
  'archive',
  'config',
  'my-career',
  'my-career/assessments',
  'my-career/feedbacks',
  'my-leadership',
  'my-tasks',
  'my-teams/members',
  'my-teams/teams',
  'my-teams/archived',
  'my-teams/feedback-templates',
  'my-company/meetings',
  'my-company/members',
  'my-company/projects',
  'knowledge-base/branding-guidelines',
  'knowledge-base/company',
  'knowledge-base/people',
  'knowledge-base/process',
  'knowledge-base/security',
  'knowledge-base/files',
  'utils',
  '.cursor/rules/tmr',
  '.claude/agents',
  '.claude/skills',
  '.gemini/agents',
  '.tmr-core/agents',
  '.tmr-core/skills',
  '.tmr-core/tasks',
  '.tmr-core/templates',
  '.tmr-core/packs',
  '.obsidian/plugins/obsidian-git',
  '.obsidian/plugins/granola-sync',
  '.obsidian/plugins/terminal',
  '.obsidian/plugins/dataview',
];

export async function buildWorkspaceStructure(workspacePath: string): Promise<void> {
  const results = await Promise.allSettled(
    WORKSPACE_DIRS.map((dir) => fileSystemService.createDirectory(join(workspacePath, dir))),
  );
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      logger.warn(`Could not create directory ${WORKSPACE_DIRS[i]}: ${String(result.reason)}`);
    }
  });
}
