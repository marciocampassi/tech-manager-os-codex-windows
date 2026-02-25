import { describe, it, expect } from '@jest/globals';
import { redact } from '../../src/utils/redact.js';

describe('redact()', () => {
  it('masks all but the last 4 characters', () => {
    expect(redact('sk-ant-api03-ABCD')).toBe('*************ABCD');
  });

  it('shows exactly the last 4 characters', () => {
    const result = redact('abcdefgh');
    expect(result).toBe('****efgh');
  });

  it('returns **** for strings of exactly 4 characters', () => {
    expect(redact('1234')).toBe('****');
  });

  it('returns **** for strings shorter than 4 characters', () => {
    expect(redact('abc')).toBe('****');
    expect(redact('a')).toBe('****');
    expect(redact('')).toBe('****');
  });

  it('handles long API key strings', () => {
    const key = 'sk-proj-' + 'x'.repeat(40) + 'ZZZZ';
    const result = redact(key);
    expect(result.endsWith('ZZZZ')).toBe(true);
    expect(result.startsWith('*')).toBe(true);
    expect(result).not.toContain('x');
  });
});
