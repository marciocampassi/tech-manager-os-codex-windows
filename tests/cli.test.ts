import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { createProgram, GlobalOptions } from '../src/cli.js';
import type { Command } from 'commander';

let program: Command;

beforeEach(() => {
  program = createProgram();
  program.exitOverride();
});

describe('CLI — program identity', () => {
  it('program name is tmr', () => {
    expect(program.name()).toBe('tmr');
  });

  it('has a non-empty description', () => {
    expect(program.description().length).toBeGreaterThan(0);
  });

  it('version is 1.0.0', () => {
    expect(program.version()).toBe('1.0.0');
  });
});

describe('CLI — global flags', () => {
  it('parses --verbose flag', async () => {
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await expect(program.parseAsync(['node', 'tmr', '--verbose'])).rejects.toThrow();
    expect(program.opts<GlobalOptions>().verbose).toBe(true);
    stdoutSpy.mockRestore();
  });

  it('parses --plain flag', async () => {
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await expect(program.parseAsync(['node', 'tmr', '--plain'])).rejects.toThrow();
    expect(program.opts<GlobalOptions>().plain).toBe(true);
    stdoutSpy.mockRestore();
  });

  it('parses --json flag', async () => {
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await expect(program.parseAsync(['node', 'tmr', '--json'])).rejects.toThrow();
    expect(program.opts<GlobalOptions>().json).toBe(true);
    stdoutSpy.mockRestore();
  });
});

describe('CLI — --help and --version', () => {
  it('--help exits cleanly via exitOverride', async () => {
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await expect(program.parseAsync(['node', 'tmr', '--help'])).rejects.toThrow();
    stdoutSpy.mockRestore();
  });

  it('--version exits cleanly via exitOverride', async () => {
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await expect(program.parseAsync(['node', 'tmr', '--version'])).rejects.toThrow();
    stdoutSpy.mockRestore();
  });

  it('no-args shows help output (AC4)', () => {
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    program.outputHelp();
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('tmr'));
    stdoutSpy.mockRestore();
  });
});

describe('CLI — unknown commands', () => {
  it('writes unknown command error to stderr and exits with 1', () => {
    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((_code?: string | number | null | undefined) => {
        throw new Error('process.exit called');
      });

    expect(() => {
      program.parse(['node', 'tmr', 'foobar']);
    }).toThrow('process.exit called');

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown command'));
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('foobar'));
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('tmr --help'));
    expect(exitSpy).toHaveBeenCalledWith(1);

    stderrSpy.mockRestore();
    exitSpy.mockRestore();
  });
});

describe('CLI — stub commands', () => {
  it('init command is registered with correct name and description', () => {
    const initCmd = program.commands.find((c) => c.name() === 'init');
    expect(initCmd).toBeDefined();
    expect(initCmd?.description()).toContain('setup wizard');
  });

  it('process command is registered with correct name and description (Story 3.6)', () => {
    const processCmd = program.commands.find((c) => c.name() === 'process');
    expect(processCmd).toBeDefined();
    expect(processCmd?.description().length).toBeGreaterThan(0);
  });

  it('watch command is registered with correct name and description (Story 3.7)', () => {
    const watchCmd = program.commands.find((c) => c.name() === 'watch');
    expect(watchCmd).toBeDefined();
    expect(watchCmd?.description()).toMatch(/watch|inbox|auto/i);
  });
});

describe('CLI — relationship command removed (REL-NEG)', () => {
  it('REL-NEG-001: --help output does not contain "relationship"', () => {
    const chunks: string[] = [];
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      chunks.push(String(chunk));
      return true;
    });
    program.outputHelp();
    stdoutSpy.mockRestore();
    expect(chunks.join('')).not.toMatch(/relationship/i);
  });

  it('REL-NEG-002: "tmr relationship" produces unrecognized command error', () => {
    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((_code?: string | number | null | undefined) => {
        throw new Error('process.exit called');
      });

    expect(() => {
      program.parse(['node', 'tmr', 'relationship']);
    }).toThrow('process.exit called');

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown command'));
    expect(exitSpy).toHaveBeenCalledWith(1);

    stderrSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
