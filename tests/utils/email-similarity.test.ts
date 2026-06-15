import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { findSimilarEmail } from '../../src/utils/email-similarity.js';

describe('findSimilarEmail', () => {
  let workspace: string;

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'tmr-similarity-test-'));
  });

  afterEach(() => {
    fs.rmSync(workspace, { recursive: true, force: true });
  });

  function seedMember(email: string): void {
    const dir = path.join(workspace, 'my-company', 'members', email);
    fs.mkdirSync(dir, { recursive: true });
  }

  function seedLeadership(email: string): void {
    const dir = path.join(workspace, 'my-leadership', email);
    fs.mkdirSync(dir, { recursive: true });
  }

  function seedCareer(email: string): void {
    const dir = path.join(workspace, 'my-career');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${email}.md`), '');
  }

  // ── Exact match ────────────────────────────────────────────────────────────

  it('returns null when email is an exact match of an existing entity', () => {
    seedMember('user1@co.com');
    expect(findSimilarEmail('user1@co.com', workspace)).toBeNull();
  });

  it('exact match is case-insensitive', () => {
    seedMember('user1@co.com');
    expect(findSimilarEmail('USER1@CO.COM', workspace)).toBeNull();
  });

  // ── Typo detection ─────────────────────────────────────────────────────────

  it('returns existing email when local-part distance is 1 (dist=1)', () => {
    seedMember('user1@co.com');
    expect(findSimilarEmail('usr1@co.com', workspace)).toBe('user1@co.com');
  });

  it('returns existing email when local-part distance is 2 (dist=2)', () => {
    seedMember('user1@co.com');
    expect(findSimilarEmail('usr@co.com', workspace)).toBe('user1@co.com');
  });

  it('9.8: user2@co.com with existing user1@co.com — dist=1, returns warning', () => {
    seedMember('user1@co.com');
    expect(findSimilarEmail('user2@co.com', workspace)).toBe('user1@co.com');
  });

  // ── Too far ────────────────────────────────────────────────────────────────

  it('returns null when local-part distance is 3 (too far)', () => {
    seedMember('user1@co.com');
    expect(findSimilarEmail('abc@co.com', workspace)).toBeNull();
  });

  // ── First-char guard (cuts false positives) ─────────────────────────────────

  it('returns null when local-parts differ in their first char (carlos vs marlon, dist=2)', () => {
    seedMember('marlon@co.com');
    expect(findSimilarEmail('carlos@co.com', workspace)).toBeNull();
  });

  it('returns null when first char differs even at distance 1 (jon vs ron)', () => {
    seedMember('ron@co.com');
    expect(findSimilarEmail('jon@co.com', workspace)).toBeNull();
  });

  it('still matches a real typo at distance 2 when the first char is shared (usr vs user1)', () => {
    seedMember('user1@co.com');
    expect(findSimilarEmail('usr@co.com', workspace)).toBe('user1@co.com');
  });

  // ── Domain boundary ────────────────────────────────────────────────────────

  it('returns null when domains differ even if local-parts are identical', () => {
    seedMember('user1@co.com');
    expect(findSimilarEmail('user1@other.com', workspace)).toBeNull();
  });

  // ── Empty vault ───────────────────────────────────────────────────────────

  it('returns null when vault has no entities', () => {
    expect(findSimilarEmail('user1@co.com', workspace)).toBeNull();
  });

  // ── Scan coverage ─────────────────────────────────────────────────────────

  it('detects match in my-teams/members/', () => {
    const dir = path.join(workspace, 'my-teams', 'members', 'user1@co.com');
    fs.mkdirSync(dir, { recursive: true });
    expect(findSimilarEmail('usr1@co.com', workspace)).toBe('user1@co.com');
  });

  it('detects match in my-company/contractors/', () => {
    const dir = path.join(workspace, 'my-company', 'contractors', 'user1@co.com');
    fs.mkdirSync(dir, { recursive: true });
    expect(findSimilarEmail('usr1@co.com', workspace)).toBe('user1@co.com');
  });

  it('detects match in my-leadership/', () => {
    seedLeadership('user1@co.com');
    expect(findSimilarEmail('usr1@co.com', workspace)).toBe('user1@co.com');
  });

  it('detects match in my-career/ flat files', () => {
    seedCareer('user1@co.com');
    expect(findSimilarEmail('usr1@co.com', workspace)).toBe('user1@co.com');
  });

  // ── Best-match selection ───────────────────────────────────────────────────

  it('returns the closest match when multiple similar emails exist', () => {
    seedMember('user12@co.com'); // dist=2 from user1@co.com
    seedMember('user1@co.com'); // dist=1 from usr1@co.com
    // usr1@co.com vs user1@co.com: dist=1; vs user12@co.com: dist=2
    expect(findSimilarEmail('usr1@co.com', workspace)).toBe('user1@co.com');
  });

  // ── Malformed emails ──────────────────────────────────────────────────────

  it('returns null for malformed email (no @)', () => {
    seedMember('user1@co.com');
    expect(findSimilarEmail('notanemail', workspace)).toBeNull();
  });

  // ── Unreadable directory ──────────────────────────────────────────────────

  it('returns null gracefully when vault root does not exist', () => {
    expect(findSimilarEmail('user1@co.com', '/nonexistent/path')).toBeNull();
  });
});
