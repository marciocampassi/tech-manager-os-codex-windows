import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { CheckResult } from '../../src/services/doctor.service.js';

// ── Mock declarations ─────────────────────────────────────────────────────────

const mockRunChecks = jest.fn<() => Promise<CheckResult[]>>();
jest.unstable_mockModule('../../src/services/doctor.service.js', () => ({
  DoctorService: jest.fn(() => ({ runChecks: mockRunChecks })),
  doctorService: { runChecks: mockRunChecks },
}));

// ── Dynamic imports (after mocks) ─────────────────────────────────────────────

const { runDoctor } = await import('../../src/commands/doctor.command.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

const ANSI_RE = /\x1b\[[0-9;]*m/g;

function strip(s: string): string {
  return s.replace(ANSI_RE, '');
}

function allPassing(): CheckResult[] {
  return [
    // P5: value is clean version string; command layer adds "(required ≥ 18)" annotation
    { key: 'nodejs', label: 'Node.js', ok: true, value: 'v20.12.0' },
    { key: 'tmr', label: 'tmr', ok: true, value: 'v1.2.3' },
    { key: 'vault', label: 'Vault', ok: true, value: '/users/marlon/vault' },
    { key: 'obsidian', label: 'Obsidian', ok: true, value: 'installed' },
    { key: 'granola', label: 'Granola', ok: true, value: 'installed' },
    { key: 'google_drive', label: 'Google Drive', ok: true, value: 'detected' },
    {
      key: 'granola_sync',
      label: 'Granola Sync',
      ok: true,
      value: 'plugin config present (inbox/)',
    },
  ];
}

function withFailures(): CheckResult[] {
  return [
    { key: 'nodejs', label: 'Node.js', ok: true, value: 'v20.12.0' },
    { key: 'tmr', label: 'tmr', ok: true, value: 'v1.2.3' },
    {
      key: 'vault',
      label: 'Vault',
      ok: false,
      detail: 'not configured',
      fix: 'tmr init',
    },
    {
      key: 'obsidian',
      label: 'Obsidian',
      ok: false,
      detail: 'not found',
      fix: 'brew install --cask obsidian',
    },
    { key: 'granola', label: 'Granola', ok: false, info: true, detail: 'not available on Linux' },
    { key: 'google_drive', label: 'Google Drive', ok: true, value: 'detected' },
    {
      // P3+P4: remediation embedded in detail; no separate fix field
      key: 'granola_sync',
      label: 'Granola Sync',
      ok: false,
      detail: 'plugin config missing or misconfigured — re-run tmr init to repair',
    },
  ];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('runDoctor', () => {
  let stdoutSpy: ReturnType<typeof jest.spyOn>;
  let stderrSpy: ReturnType<typeof jest.spyOn>;
  let stdoutOutput: string;
  let stderrOutput: string;

  beforeEach(() => {
    jest.clearAllMocks();
    process.exitCode = undefined;
    stdoutOutput = '';
    stderrOutput = '';
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      stdoutOutput += String(chunk);
      return true;
    });
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      stderrOutput += String(chunk);
      return true;
    });
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    process.exitCode = undefined;
  });

  // ── All pass ─────────────────────────────────────────────────────────────────

  it('exits with code 0 when all checks pass', async () => {
    mockRunChecks.mockResolvedValue(allPassing());
    await runDoctor({ plain: false, json: false });
    expect(process.exitCode).toBeUndefined();
  });

  it('prints ✓ lines for each passing check', async () => {
    mockRunChecks.mockResolvedValue(allPassing());
    await runDoctor({ plain: true, json: false });
    const out = strip(stdoutOutput);
    expect(out).toContain('✓');
    expect(out).toContain('Node.js');
    expect(out).toContain('v20.12.0');
    expect(out).toContain('Vault');
    expect(out).toContain('Granola Sync');
    expect(out).toContain('plugin config present (inbox/)');
  });

  // ── Any fail ─────────────────────────────────────────────────────────────────

  it('sets exitCode 1 when a check fails (not info)', async () => {
    mockRunChecks.mockResolvedValue(withFailures());
    await runDoctor({ plain: false, json: false });
    expect(process.exitCode).toBe(1);
  });

  it('prints ⚠ lines for failing checks', async () => {
    mockRunChecks.mockResolvedValue(withFailures());
    await runDoctor({ plain: true, json: false });
    const out = strip(stdoutOutput);
    expect(out).toContain('⚠');
    expect(out).toContain('not configured');
    expect(out).toContain('tmr init');
    expect(out).toContain('not found');
    expect(out).toContain('brew install --cask obsidian');
  });

  it('prints ℹ for info-only checks (Linux Granola) and does NOT set exitCode for info', async () => {
    const infoOnly: CheckResult[] = [
      {
        key: 'granola',
        label: 'Granola',
        ok: false,
        info: true,
        detail: 'not available on Linux',
      },
    ];
    mockRunChecks.mockResolvedValue(infoOnly);
    await runDoctor({ plain: true, json: false });
    const out = strip(stdoutOutput);
    expect(out).toContain('ℹ');
    expect(out).toContain('not available on Linux');
    expect(process.exitCode).toBeUndefined();
  });

  // ── --json output ────────────────────────────────────────────────────────────

  it('emits valid JSON with all check keys', async () => {
    mockRunChecks.mockResolvedValue(allPassing());
    await runDoctor({ plain: false, json: true });
    const parsed = JSON.parse(stdoutOutput) as Record<string, unknown>;
    expect(parsed).toHaveProperty('nodejs');
    expect(parsed).toHaveProperty('tmr');
    expect(parsed).toHaveProperty('vault');
    expect(parsed).toHaveProperty('obsidian');
    expect(parsed).toHaveProperty('granola');
    expect(parsed).toHaveProperty('google_drive');
    expect(parsed).toHaveProperty('granola_sync');
  });

  it('uses "version" key for nodejs and tmr in JSON output', async () => {
    mockRunChecks.mockResolvedValue(allPassing());
    await runDoctor({ plain: false, json: true });
    const parsed = JSON.parse(stdoutOutput) as Record<string, Record<string, unknown>>;
    expect(parsed['nodejs']['version']).toBeDefined();
    expect(parsed['tmr']['version']).toBeDefined();
  });

  it('P5: nodejs version in JSON is clean — no display annotation', async () => {
    mockRunChecks.mockResolvedValue(allPassing());
    await runDoctor({ plain: false, json: true });
    const parsed = JSON.parse(stdoutOutput) as Record<string, Record<string, unknown>>;
    expect(parsed['nodejs']['version']).toBe('v20.12.0');
    expect(String(parsed['nodejs']['version'])).not.toContain('required');
  });

  it('P5: human output appends version requirement annotation for nodejs', async () => {
    mockRunChecks.mockResolvedValue(allPassing());
    await runDoctor({ plain: true, json: false });
    const out = strip(stdoutOutput);
    expect(out).toContain('v20.12.0');
    expect(out).toContain('(required ≥ 18)');
  });

  it('includes detail and fix in JSON for failed checks', async () => {
    mockRunChecks.mockResolvedValue(withFailures());
    await runDoctor({ plain: false, json: true });
    const parsed = JSON.parse(stdoutOutput) as Record<string, Record<string, unknown>>;
    expect(parsed['vault']['ok']).toBe(false);
    expect(parsed['vault']['detail']).toBe('not configured');
    expect(parsed['vault']['fix']).toBe('tmr init');
  });

  it('JSON mode does not set exitCode when all pass', async () => {
    mockRunChecks.mockResolvedValue(allPassing());
    await runDoctor({ plain: false, json: true });
    expect(process.exitCode).toBeUndefined();
  });

  it('JSON mode sets exitCode 1 when checks fail', async () => {
    mockRunChecks.mockResolvedValue(withFailures());
    await runDoctor({ plain: false, json: true });
    expect(process.exitCode).toBe(1);
  });

  // ── Error handling ────────────────────────────────────────────────────────────

  it('catches service errors, prints to stderr, and sets exitCode 1', async () => {
    mockRunChecks.mockRejectedValue(new Error('Unexpected failure'));
    await runDoctor({ plain: true, json: false });
    expect(stderrOutput).toContain('Unexpected failure');
    expect(process.exitCode).toBe(1);
  });

  it('does not expose stack trace to user on error', async () => {
    const err = new Error('Internal error');
    err.stack = 'Error: Internal error\n    at Object.<anonymous> (doctor.service.ts:42:10)';
    mockRunChecks.mockRejectedValue(err);
    await runDoctor({ plain: true, json: false });
    expect(stdoutOutput).not.toContain('at Object.<anonymous>');
    expect(stderrOutput).not.toContain('at Object.<anonymous>');
  });
});
