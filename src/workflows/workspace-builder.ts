import { join } from 'node:path';
import { fileSystemService } from '../services/file-system.service.js';

const WORKSPACE_DIRS = [
  'inbox',
  'my-career',
  'my-leadership',
  'my-teams',
  'my-projects',
  'my-company/meetings',
  'my-company/relationships',
  'operations/hiring',
  'operations/finance',
  'knowledge-base/people',
  'knowledge-base/process',
  'knowledge-base/company',
  'knowledge-base/files',
  'my-tasks',
  'utils',
  'archive',
  '.cursor/rules/tmr',
  '.claude/agents',
  '.gemini/agents',
  // Architecture (source-tree.md) defines .tmr-core/ as the BMAD agent/skill directory
  '.tmr-core/agents',
  '.tmr-core/skills',
  '.tmr-core/tasks',
  '.tmr-core/templates',
  '.tmr-core/packs',
];

export async function buildWorkspaceStructure(workspacePath: string): Promise<void> {
  await Promise.all(
    WORKSPACE_DIRS.map((dir) => fileSystemService.createDirectory(join(workspacePath, dir))),
  );
}
