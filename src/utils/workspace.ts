import { configService } from '../services/config.service.js';

/**
 * Returns the user-configured workspace root path.
 * Falls back to `process.cwd()` when the workspace has not been initialized.
 */
export function getWorkspaceRoot(): string {
  return configService.getWorkspacePath() ?? process.cwd();
}
