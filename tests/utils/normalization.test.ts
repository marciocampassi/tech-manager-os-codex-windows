import { describe, it, expect } from '@jest/globals';
import { normalizeSlug } from '../../src/utils/normalization.js';

describe('normalizeSlug', () => {
  // ── Valid transformations ────────────────────────────────────────────────────

  it('VAL-UNIT-004: converts "Backend Team" to "backend-team"', () => {
    expect(normalizeSlug('Backend Team')).toBe('backend-team');
  });

  it('VAL-UNIT-005: converts "FRONTEND" to "frontend"', () => {
    expect(normalizeSlug('FRONTEND')).toBe('frontend');
  });

  it('VAL-UNIT-006: "my-team" is idempotent (already normalized)', () => {
    expect(normalizeSlug('my-team')).toBe('my-team');
  });

  it('converts "Data_Science Team" (underscore + space) to "data-science-team"', () => {
    expect(normalizeSlug('Data_Science Team')).toBe('data-science-team');
  });

  it('collapses multiple consecutive spaces into a single hyphen', () => {
    expect(normalizeSlug('backend  team')).toBe('backend-team');
  });

  it('collapses multiple consecutive underscores into a single hyphen', () => {
    expect(normalizeSlug('data__science')).toBe('data-science');
  });

  it('collapses mixed consecutive whitespace and underscores into a single hyphen', () => {
    expect(normalizeSlug('data _science')).toBe('data-science');
  });

  it('lowercases a single word with no separators', () => {
    expect(normalizeSlug('ENGINEERING')).toBe('engineering');
  });

  it('returns an already lower-kebab string unchanged', () => {
    expect(normalizeSlug('backend-platform-team')).toBe('backend-platform-team');
  });

  it('handles an empty string gracefully (returns empty string)', () => {
    expect(normalizeSlug('')).toBe('');
  });

  it('handles a string of only spaces (returns empty string after trim)', () => {
    expect(normalizeSlug('   ')).toBe('');
  });

  it('collapses consecutive hyphens produced by mixed separators (e.g. "ops- team")', () => {
    expect(normalizeSlug('ops- team')).toBe('ops-team');
  });

  it('trims leading and trailing whitespace before slugging', () => {
    expect(normalizeSlug('  backend  ')).toBe('backend');
  });
});
