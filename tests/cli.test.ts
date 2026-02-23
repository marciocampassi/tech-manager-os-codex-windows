import { VERSION } from '../src/cli.js';

describe('CLI entry point', () => {
  it('exports a VERSION constant', () => {
    expect(VERSION).toBe('1.0.0');
  });

  it('VERSION is a non-empty string', () => {
    expect(typeof VERSION).toBe('string');
    expect(VERSION.length).toBeGreaterThan(0);
  });
});
