import { createLogger, format, transports } from 'winston';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

/**
 * Centralised structured logger — architecture mandates winston 3.x.
 * (error-handling-strategy.md § Logging Standards)
 *
 * Log levels: error | warn | info | debug
 * File:       ~/.config/tmr/logs/tmr.log  (JSON, append, skipped in test mode)
 * Console:    colorised single-line (info+ in production, debug in verbose mode)
 *             Silenced when NODE_ENV=test.
 *
 * Usage:
 *   import { logger } from '../utils/logger.js';
 *   logger.info('Processing inbox', { file: 'meeting.md', correlationId });
 *   logger.error('AI call failed', { error: err.message, provider: 'claude' });
 *
 * Never log API keys, tokens, or PII — sanitise before passing to logger.
 */

const LOG_DIR = join(homedir(), '.config', 'tmr', 'logs');
const LOG_FILE = join(LOG_DIR, 'tmr.log');
const IS_TEST = process.env.NODE_ENV === 'test';

const consoleFormat = format.combine(
  format.colorize({ all: true }),
  format.printf(({ level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[tmr] ${level}: ${String(message)}${metaStr}`;
  }),
);

const fileFormat = format.combine(format.timestamp(), format.json());

// Ensure the log directory exists before creating the File transport.
// Winston's File transport does NOT create parent directories automatically.
if (!IS_TEST) {
  try {
    mkdirSync(LOG_DIR, { recursive: true });
  } catch {
    // Non-fatal: if directory creation fails, file transport will emit errors.
    // Console transport remains functional and keeps the app running.
  }
}

export const logger = createLogger({
  level: process.env.TMR_LOG_LEVEL ?? 'info',
  transports: [
    new transports.Console({ format: consoleFormat, silent: IS_TEST }),
    // File transport is omitted entirely in test mode to prevent real filesystem
    // writes to ~/.config/tmr/logs/ from polluting the test environment.
    ...(!IS_TEST ? [new transports.File({ filename: LOG_FILE, format: fileFormat })] : []),
  ],
});
