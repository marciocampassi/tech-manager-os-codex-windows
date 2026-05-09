import { describe, it, expect } from '@jest/globals';
import { formatWikiLink } from '../../src/utils/wiki-link.js';

describe('formatWikiLink', () => {
  // ── Cross-directory paths ────────────────────────────────────────────────────

  it('VAL-UNIT-007: different-directory path returns correct relative segments', () => {
    const result = formatWikiLink(
      '/ws/my-teams/members/a@b.com.md',
      '/ws/my-leadership/a@b.com/a@b.com.md',
      'a@b.com',
    );
    expect(result).toBe('[[../../my-teams/members/a@b.com.md|a@b.com]]');
  });

  it('VAL-UNIT-008: same-directory path returns filename only (no path prefix)', () => {
    const result = formatWikiLink('/ws/members/a@b.com.md', '/ws/members/other.md', 'a@b.com');
    expect(result).toBe('[[a@b.com.md|a@b.com]]');
  });

  it('parent → child subdir: one level down produces correct relative path', () => {
    const result = formatWikiLink('/ws/my-teams/members/x@y.com.md', '/ws/summary.md', 'x@y.com');
    expect(result).toBe('[[my-teams/members/x@y.com.md|x@y.com]]');
  });

  it('child → parent: one level up produces correct relative path', () => {
    const result = formatWikiLink(
      '/ws/leader@co.com.md',
      '/ws/my-teams/report.md',
      'leader@co.com',
    );
    expect(result).toBe('[[../leader@co.com.md|leader@co.com]]');
  });

  // ── displayName is independent of file path ─────────────────────────────────

  it('displayName can differ from the filename', () => {
    const result = formatWikiLink(
      '/ws/members/marco@example.com.md',
      '/ws/members/team.md',
      'Marco Rossi',
    );
    expect(result).toBe('[[marco@example.com.md|Marco Rossi]]');
  });

  // ── Path separator normalization ─────────────────────────────────────────────

  it('always uses forward slashes as path separator in output', () => {
    const result = formatWikiLink(
      '/ws/my-company/members/a@b.com.md',
      '/ws/my-leadership/a@b.com/a@b.com.md',
      'a@b.com',
    );
    expect(result).not.toContain('\\');
    expect(result).toBe('[[../../my-company/members/a@b.com.md|a@b.com]]');
  });
});
