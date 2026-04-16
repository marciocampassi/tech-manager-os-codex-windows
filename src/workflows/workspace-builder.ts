import { join } from 'node:path';
import { fileSystemService } from '../services/file-system.service.js';

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
  'operations/hiring',
  'operations/finance',
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
  '.obsidian/plugins/obsidian-granola-sync',
  '.obsidian/plugins/obsidian-terminal',
  '.obsidian/plugins/dataview',
];

export async function buildWorkspaceStructure(workspacePath: string): Promise<void> {
  await Promise.all(
    WORKSPACE_DIRS.map((dir) => fileSystemService.createDirectory(join(workspacePath, dir))),
  );
}
