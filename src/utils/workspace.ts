import * as fs from 'node:fs';
import path from 'node:path';
import { configService } from '../services/config.service.js';
import { printError } from './display.js';

/**
 * Returns the vault root path, determined by:
 * 1. Walking up from `process.cwd()` until a `.tmr` sentinel file is found.
 * 2. Falling back to the config-stored path (backward compat for pre-sentinel vaults).
 * 3. Printing an error and returning `process.cwd()` if neither is found.
 *
 * Must remain synchronous — called from constructor-level expressions across many services.
 */
export function getWorkspaceRoot(): string {
  // 1. Walk up from cwd looking for .tmr sentinel
  let dir = process.cwd();
  while (true) {
    if (fs.existsSync(path.join(dir, '.tmr'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }

  // 2. Fall back to config-stored path (backward compat for vaults without .tmr)
  const configured = configService.getWorkspacePath();
  if (configured) return configured;

  // 3. No vault found anywhere
  printError(
    'No tmr vault found in this directory or any parent.',
    "Run 'tmr init' to create one.",
  );
  process.exitCode = 1;
  return process.cwd();
}
