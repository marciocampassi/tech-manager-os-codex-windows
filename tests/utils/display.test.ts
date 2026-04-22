import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  printError,
  printSuccess,
  printWarning,
  printInfo,
  printJson,
  startSpinner,
} from '../../src/utils/display.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const ANSI_RE = /\x1b\[[0-9;]*m/g;

function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '');
}

function captureStdout(fn: () => void): string {
  const chunks: string[] = [];
  const spy = jest.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    chunks.push(String(chunk));
    return true;
  });
  try {
    fn();
  } finally {
    spy.mockRestore();
  }
  return chunks.join('');
}

function captureStderr(fn: () => void): string {
  const chunks: string[] = [];
  const spy = jest.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    chunks.push(String(chunk));
    return true;
  });
  try {
    fn();
  } finally {
    spy.mockRestore();
  }
  return chunks.join('');
}

// ── printSuccess ──────────────────────────────────────────────────────────────

describe('printSuccess()', () => {
  it('writes to stdout', () => {
    const out = captureStdout(() => printSuccess('all good', true));
    expect(out).toContain('all good');
  });

  it('includes a ✓ prefix', () => {
    const out = captureStdout(() => printSuccess('done', true));
    expect(out).toContain('✓');
  });

  it('plain mode: no ANSI escape codes', () => {
    const out = captureStdout(() => printSuccess('done', true));
    expect(ANSI_RE.test(out)).toBe(false);
  });

  it('color mode: output still contains the message text', () => {
    // chalk may strip ANSI in non-TTY environments — verify message is present
    const out = captureStdout(() => printSuccess('done', false));
    expect(out).toContain('done');
  });

  it('plain mode strips color but keeps message text', () => {
    const out = captureStdout(() => printSuccess('workspace created', true));
    expect(stripAnsi(out)).toContain('workspace created');
  });
});

// ── printWarning ──────────────────────────────────────────────────────────────

describe('printWarning()', () => {
  it('writes to stdout', () => {
    const out = captureStdout(() => printWarning('already installed', true));
    expect(out).toContain('already installed');
  });

  it('includes a ⚠ prefix', () => {
    const out = captureStdout(() => printWarning('already installed', true));
    expect(out).toContain('⚠');
  });

  it('plain mode: no ANSI escape codes', () => {
    const out = captureStdout(() => printWarning('notice', true));
    expect(ANSI_RE.test(out)).toBe(false);
  });
});

// ── printInfo ─────────────────────────────────────────────────────────────────

describe('printInfo()', () => {
  it('writes to stdout', () => {
    const out = captureStdout(() => printInfo('starting...', true));
    expect(out).toContain('starting...');
  });

  it('includes a ℹ prefix', () => {
    const out = captureStdout(() => printInfo('note', true));
    expect(out).toContain('ℹ');
  });

  it('plain mode: no ANSI escape codes', () => {
    const out = captureStdout(() => printInfo('note', true));
    expect(ANSI_RE.test(out)).toBe(false);
  });
});

// ── printError ────────────────────────────────────────────────────────────────

describe('printError()', () => {
  it('writes to stderr (not stdout)', () => {
    let stderrOutput = '';
    let stdoutOutput = '';
    const errSpy = jest.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
      stderrOutput += String(chunk);
      return true;
    });
    const outSpy = jest.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      stdoutOutput += String(chunk);
      return true;
    });

    printError('something failed', undefined, true);

    errSpy.mockRestore();
    outSpy.mockRestore();

    expect(stderrOutput).toContain('something failed');
    expect(stdoutOutput).toBe('');
  });

  it('includes a ✗ prefix', () => {
    const err = captureStderr(() => printError('oops', undefined, true));
    expect(err).toContain('✗');
  });

  it('includes the recovery suggestion when provided', () => {
    const err = captureStderr(() =>
      printError('API key missing', 'Run `tmr config` to set one up.', true),
    );
    expect(err).toContain('API key missing');
    expect(err).toContain('Run `tmr config` to set one up.');
  });

  it('does not write suggestion line when suggestion is undefined', () => {
    const err = captureStderr(() => printError('bad input', undefined, true));
    const lines = err.trim().split('\n');
    expect(lines).toHaveLength(1);
  });

  it('plain mode: no ANSI escape codes in error line', () => {
    const err = captureStderr(() => printError('fail', 'try again', true));
    expect(ANSI_RE.test(err)).toBe(false);
  });

  it('color mode: output still contains the error message', () => {
    // chalk may strip ANSI in test environments (no TTY) — just verify message present
    const err = captureStderr(() => printError('fail', undefined, false));
    expect(err).toContain('fail');
  });
});

// ── printJson ─────────────────────────────────────────────────────────────────

describe('printJson()', () => {
  it('emits valid parseable JSON to stdout', () => {
    const out = captureStdout(() => printJson({ status: 'ok', count: 3 }));
    const parsed = JSON.parse(out) as unknown;
    expect(parsed).toEqual({ status: 'ok', count: 3 });
  });

  it('emits valid JSON for arrays', () => {
    const out = captureStdout(() => printJson([{ skill: 'tmr-inbox', version: '1.0.0' }]));
    const parsed = JSON.parse(out) as unknown;
    expect(Array.isArray(parsed)).toBe(true);
    expect((parsed as { skill: string }[])[0].skill).toBe('tmr-inbox');
  });

  it('emits pretty-printed JSON (indented)', () => {
    const out = captureStdout(() => printJson({ a: 1 }));
    expect(out).toContain('\n');
    expect(out).toContain('  ');
  });

  it('does not emit ANSI codes', () => {
    const out = captureStdout(() => printJson({ x: 'test' }));
    expect(ANSI_RE.test(out)).toBe(false);
  });
});

// ── startSpinner ──────────────────────────────────────────────────────────────

describe('startSpinner() in plain mode', () => {
  it('writes a startup line to stdout', () => {
    const out = captureStdout(() => {
      startSpinner('Loading data', true);
    });
    expect(out).toContain('Loading data');
  });

  it('succeed() writes success line to stdout with elapsed time', () => {
    const out = captureStdout(() => {
      const s = startSpinner('Fetching', true);
      s.succeed('Done');
    });
    expect(out).toContain('Done');
    expect(out).toMatch(/\(\d+\.\d+s\)/);
  });

  it('fail() writes to stderr', () => {
    const err = captureStderr(() => {
      const s = startSpinner('Fetching', true);
      s.fail('Failed');
    });
    expect(err).toContain('Failed');
    expect(err).toMatch(/\(\d+\.\d+s\)/);
  });

  it('update() writes update line to stdout', () => {
    const out = captureStdout(() => {
      const s = startSpinner('Starting', true);
      s.update('Progressing');
    });
    expect(out).toContain('Progressing');
  });

  it('no ANSI codes in plain mode succeed()', () => {
    const out = captureStdout(() => {
      const s = startSpinner('Loading', true);
      s.succeed('All good');
    });
    expect(ANSI_RE.test(out)).toBe(false);
  });
});
