import { describe, it, expect } from '@jest/globals';
import { validateEmail, isValidDomain } from '../../src/utils/validation.js';
import { InvalidEmailError } from '../../src/errors/tmr-error.js';

describe('validateEmail', () => {
  // ── Valid inputs ────────────────────────────────────────────────────────────

  it('VAL-UNIT-002: returns void for a valid email (no throw)', () => {
    expect(() => validateEmail('valid@company.com')).not.toThrow();
  });

  it('returns void for email with subdomains', () => {
    expect(() => validateEmail('user@mail.example.co.uk')).not.toThrow();
  });

  it('returns void for email with + alias', () => {
    expect(() => validateEmail('user+alias@example.com')).not.toThrow();
  });

  it('returns void for email with leading/trailing whitespace after trim', () => {
    expect(() => validateEmail('  user@example.com  ')).not.toThrow();
  });

  // ── Invalid inputs — must throw InvalidEmailError (TMR_E103) ────────────────

  it('VAL-UNIT-001: throws InvalidEmailError for email with missing domain ("marco@")', () => {
    expect(() => validateEmail('marco@')).toThrow(InvalidEmailError);
  });

  it('error code is TMR_E103 for missing domain (VAL-UNIT-001)', () => {
    expect.assertions(2);
    try {
      validateEmail('marco@');
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidEmailError);
      expect((err as InvalidEmailError).code).toBe('TMR_E103');
    }
  });

  it('VAL-UNIT-003: throws InvalidEmailError for email with no @ symbol ("not-an-email")', () => {
    expect(() => validateEmail('not-an-email')).toThrow(InvalidEmailError);
  });

  it('error code is TMR_E103 for no @ symbol (VAL-UNIT-003)', () => {
    expect.assertions(2);
    try {
      validateEmail('not-an-email');
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidEmailError);
      expect((err as InvalidEmailError).code).toBe('TMR_E103');
    }
  });

  it('throws InvalidEmailError for empty string', () => {
    expect(() => validateEmail('')).toThrow(InvalidEmailError);
  });

  it('throws InvalidEmailError for whitespace-only string', () => {
    expect(() => validateEmail('   ')).toThrow(InvalidEmailError);
  });

  it('throws InvalidEmailError for missing username part ("@example.com")', () => {
    expect(() => validateEmail('@example.com')).toThrow(InvalidEmailError);
  });

  it('throws InvalidEmailError for missing TLD ("user@example")', () => {
    expect(() => validateEmail('user@example')).toThrow(InvalidEmailError);
  });

  it('error message contains the invalid email value', () => {
    expect.assertions(1);
    try {
      validateEmail('bad-input');
    } catch (err) {
      expect((err as InvalidEmailError).message).toContain('bad-input');
    }
  });
});

describe('isValidDomain', () => {
  // ── Valid inputs ────────────────────────────────────────────────────────────

  it('returns true for a simple domain', () => {
    expect(isValidDomain('example.com')).toBe(true);
  });

  it('returns true for a subdomain', () => {
    expect(isValidDomain('mail.example.co.uk')).toBe(true);
  });

  it('returns true for domain with leading/trailing whitespace (trimmed internally)', () => {
    expect(isValidDomain('  company.com  ')).toBe(true);
  });

  it('returns true for hyphenated domain', () => {
    expect(isValidDomain('company-eu.com')).toBe(true);
  });

  // ── Invalid inputs ──────────────────────────────────────────────────────────

  it('returns false for empty string', () => {
    expect(isValidDomain('')).toBe(false);
  });

  it('returns false for whitespace-only string', () => {
    expect(isValidDomain('   ')).toBe(false);
  });

  it('returns false when value contains @', () => {
    expect(isValidDomain('user@example.com')).toBe(false);
  });

  it('returns false when value contains a space', () => {
    expect(isValidDomain('not a domain')).toBe(false);
  });

  it('returns false when value has no dot (bare label)', () => {
    expect(isValidDomain('nodot')).toBe(false);
  });
});
