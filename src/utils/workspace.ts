import * as fs from 'node:fs';
import path from 'node:path';
import { configService } from '../services/config.service.js';
import { printError } from './display.js';

/**
 * Returns the vault root path, determined by:
 * 1. Walking up from `process.cwd()` until a `.tmr` sentinel file is found.
 * 2. Falling back to the config-stored path **only** when `process.cwd()` is inside
 *    that configured vault (backward compat for pre-sentinel vaults; blocks accidental
 *    writes to a different vault from an unrelated directory).
 * 3. Printing an error and returning `process.cwd()` if neither is found.
 *
 * Must remain synchronous — called from constructor-level expressions across many services.
 */
export function getWorkspaceRoot(): string {
  const cwd = process.cwd();

  // 1. Walk up from cwd looking for .tmr sentinel
  let dir = cwd;
  while (true) {
    if (fs.existsSync(path.join(dir, '.tmr'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }

  // 2. Fall back to config-stored path only when CWD is inside the configured vault.
  // This preserves backward compat for legacy vaults (no .tmr sentinel) while
  // blocking accidental writes to a different vault from an unrelated directory.
  // path.normalize() guards against trailing separators or `..` segments in the stored path.
  const configured = configService.getWorkspacePath();
  if (configured) {
    const normalizedConfigured = path.normalize(configured);
    if (cwd === normalizedConfigured || cwd.startsWith(normalizedConfigured + path.sep)) {
      return normalizedConfigured;
    }
    printError(
      'No tmr vault found in this directory or any parent.',
      `Your configured vault is at ${normalizedConfigured} — cd into it, or run 'tmr init' to create a vault here.`,
    );
    process.exitCode = 1;
    return cwd;
  }

  // 3. No vault found anywhere (no config stored)
  printError(
    'No tmr vault found in this directory or any parent.',
    "Run 'tmr init' to create one.",
  );
  process.exitCode = 1;
  return cwd;
}
