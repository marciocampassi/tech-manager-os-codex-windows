/**
 * Centralized display utilities for consistent CLI output.
 *
 * Color contract:
 *   green  → success / confirmation (✓)
 *   yellow → warning / non-critical notice
 *   blue   → informational messages
 *   red    → errors (✗)
 *
 * Branding exception: chalk.cyan / chalk.bold.cyan are reserved for
 * the `tmr init` welcome banner and product-name styling only.
 *
 * All functions accept a `plain` flag that disables ANSI color codes,
 * enabling accessible / CI-friendly output via `tmr --plain`.
 */

import chalk from 'chalk';
import ora from 'ora';

// ── Low-level color helpers ───────────────────────────────────────────────────

export function applyColor(text: string, colorFn: (t: string) => string, plain: boolean): string {
  return plain ? text : colorFn(text);
}

// ── High-level print functions ────────────────────────────────────────────────

/**
 * Print a success message (green ✓ prefix).
 * In --json mode, use printJson() instead.
 */
export function printSuccess(msg: string, plain = false): void {
  const prefix = plain ? '✓ ' : chalk.green('✓ ');
  process.stdout.write(`${prefix}${applyColor(msg, chalk.green, plain)}\n`);
}

/**
 * Print a warning message (yellow ⚠ prefix).
 */
export function printWarning(msg: string, plain = false): void {
  const prefix = plain ? '⚠ ' : chalk.yellow('⚠ ');
  process.stdout.write(`${prefix}${applyColor(msg, chalk.yellow, plain)}\n`);
}

/**
 * Print an informational message (blue ℹ prefix).
 */
export function printInfo(msg: string, plain = false): void {
  const prefix = plain ? 'ℹ ' : chalk.blue('ℹ ');
  process.stdout.write(`${prefix}${applyColor(msg, chalk.blue, plain)}\n`);
}

/**
 * Print an error message (red ✗ prefix) with an optional concrete recovery suggestion.
 *
 * @param msg        The error description.
 * @param suggestion Optional actionable recovery hint, e.g. "Run `tmr config` to set an API key."
 * @param plain      Disables ANSI codes when true.
 */
export function printError(msg: string, suggestion?: string, plain = false): void {
  const prefix = plain ? '✗ ' : chalk.red('✗ ');
  process.stderr.write(`${prefix}${applyColor(msg, chalk.red, plain)}\n`);
  if (suggestion) {
    const hint = plain ? `  → ${suggestion}` : chalk.dim(`  → ${suggestion}`);
    process.stderr.write(`${hint}\n`);
  }
}

/**
 * Emit machine-readable JSON to stdout.
 * Use this when the --json global flag is set.
 */
export function printJson(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

// ── Spinner ───────────────────────────────────────────────────────────────────

export interface SpinnerHandle {
  succeed(text?: string): void;
  fail(text?: string): void;
  update(text: string): void;
}

/**
 * Start a progress spinner that appends elapsed time on completion.
 *
 * In `--plain` mode the spinner is not rendered; a plain text prefix line is
 * written instead and elapsed time appears in the completion message.
 *
 * @param text  Initial spinner label.
 * @param plain Disables the interactive spinner when true.
 */
export function startSpinner(text: string, plain: boolean): SpinnerHandle {
  const startMs = Date.now();
  const elapsed = (): string => `(${((Date.now() - startMs) / 1000).toFixed(1)}s)`;

  if (plain) {
    process.stdout.write(`${text}...\n`);
    return {
      succeed: (t = text): void => {
        process.stdout.write(`✓ ${t} ${elapsed()}\n`);
      },
      fail: (t = text): void => {
        process.stderr.write(`✗ ${t} ${elapsed()}\n`);
      },
      update: (t: string): void => {
        process.stdout.write(`  ${t}...\n`);
      },
    };
  }

  const spinner = ora(text).start();
  return {
    succeed: (t = text): void => {
      spinner.succeed(`${t} ${elapsed()}`);
    },
    fail: (t = text): void => {
      spinner.fail(`${t} ${elapsed()}`);
    },
    update: (t: string): void => {
      spinner.text = t;
    },
  };
}
