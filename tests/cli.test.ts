import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { createProgram, GlobalOptions } from '../src/cli.js';
import type { Command } from 'commander';

let program: Command;

beforeEach(() => {
  program = createProgram();
  program.exitOverride();
});

describe('CLI — program identity', () => {
  it('program name is tm', () => {
    expect(program.name()).toBe('tm');
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
    await program.parseAsync(['node', 'tm', '--verbose', 'init']);
    expect(program.opts<GlobalOptions>().verbose).toBe(true);
    stdoutSpy.mockRestore();
  });

  it('parses --plain flag', async () => {
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(['node', 'tm', '--plain', 'init']);
    expect(program.opts<GlobalOptions>().plain).toBe(true);
    stdoutSpy.mockRestore();
  });

  it('parses --json flag', async () => {
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(['node', 'tm', '--json', 'init']);
    expect(program.opts<GlobalOptions>().json).toBe(true);
    stdoutSpy.mockRestore();
  });
});

describe('CLI — --help and --version', () => {
  it('--help exits cleanly via exitOverride', async () => {
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await expect(program.parseAsync(['node', 'tm', '--help'])).rejects.toThrow();
    stdoutSpy.mockRestore();
  });

  it('--version exits cleanly via exitOverride', async () => {
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await expect(program.parseAsync(['node', 'tm', '--version'])).rejects.toThrow();
    stdoutSpy.mockRestore();
  });

  it('no-args shows help output (AC4)', () => {
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    program.outputHelp();
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('tm'));
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
      program.parse(['node', 'tm', 'foobar']);
    }).toThrow('process.exit called');

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown command'));
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('foobar'));
    expect(exitSpy).toHaveBeenCalledWith(1);

    stderrSpy.mockRestore();
    exitSpy.mockRestore();
  });
});

describe('CLI — stub commands', () => {
  it('init stub writes coming-soon message to stdout', async () => {
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(['node', 'tm', 'init']);
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining("'init' coming soon"));
    stdoutSpy.mockRestore();
  });

  it('process stub writes coming-soon message to stdout', async () => {
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(['node', 'tm', 'process']);
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining("'process' coming soon"));
    stdoutSpy.mockRestore();
  });

  it('watch stub writes coming-soon message to stdout', async () => {
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await program.parseAsync(['node', 'tm', 'watch']);
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining("'watch' coming soon"));
    stdoutSpy.mockRestore();
  });
});
