/**
 * Packaging tests for the skill registry.
 *
 * These tests read real files from disk (no mocking) to verify that the
 * skill registry is correctly structured and all published skills are
 * discoverable by `tmr install` / `tmr update`.
 *
 * Prevents future regressions where a skill is added to index.json without
 * a corresponding SKILL.md, or published without a semantic version comment.
 */
import { beforeAll, describe, expect, it } from '@jest/globals';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../');
const registryIndexPath = path.join(rootDir, 'skills', 'index.json');
const VERSION_COMMENT_RE = /<!--\s*version:\s*(\S+)\s*-->/;

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseVersionComment(content: string): string | null {
  const match = VERSION_COMMENT_RE.exec(content);
  return match ? match[1] : null;
}

function semverAtLeast(version: string, minimum: string): boolean {
  const parse = (v: string): number[] => v.split('.').map(Number);
  const [va, vb, vc] = parse(version);
  const [ma, mb, mc] = parse(minimum);
  if (va !== ma) return va > ma;
  if (vb !== mb) return vb > mb;
  return vc >= mc;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Skill registry integrity', () => {
  let registrySkills: string[];

  beforeAll(() => {
    const raw = fs.readFileSync(registryIndexPath, 'utf8');
    registrySkills = JSON.parse(raw) as string[];
  });

  it('SKILL-PKG-001: skills/index.json is valid JSON and contains tmr-project-impact', () => {
    expect(Array.isArray(registrySkills)).toBe(true);
    expect(registrySkills).toContain('tmr-project-impact');
  });

  it('SKILL-PKG-002: skills/tmr-project-impact/SKILL.md exists and has a version comment >= 1.0.0', () => {
    const skillPath = path.join(rootDir, 'skills', 'tmr-project-impact', 'SKILL.md');
    expect(fs.existsSync(skillPath)).toBe(true);

    const content = fs.readFileSync(skillPath, 'utf8');
    const version = parseVersionComment(content);

    expect(version).not.toBeNull();
    expect(semverAtLeast(version!, '1.0.0')).toBe(true);
  });

  it('SKILL-PKG-003: docs/skills/tmr-project-impact/SKILL.md exists and has a version comment >= 1.0.0', () => {
    const skillPath = path.join(rootDir, 'docs', 'skills', 'tmr-project-impact', 'SKILL.md');
    expect(fs.existsSync(skillPath)).toBe(true);

    const content = fs.readFileSync(skillPath, 'utf8');
    const version = parseVersionComment(content);

    expect(version).not.toBeNull();
    expect(semverAtLeast(version!, '1.0.0')).toBe(true);
  });

  it('SKILL-PKG-004: registry copy and bundled copy have the same version comment', () => {
    const registryPath = path.join(rootDir, 'skills', 'tmr-project-impact', 'SKILL.md');
    const bundledPath = path.join(rootDir, 'docs', 'skills', 'tmr-project-impact', 'SKILL.md');

    const registryVersion = parseVersionComment(fs.readFileSync(registryPath, 'utf8'));
    const bundledVersion = parseVersionComment(fs.readFileSync(bundledPath, 'utf8'));

    expect(registryVersion).not.toBeNull();
    expect(bundledVersion).not.toBeNull();
    expect(registryVersion).toBe(bundledVersion);
  });

  it('SKILL-PKG-005: every entry in skills/index.json has a corresponding skills/<name>/SKILL.md', () => {
    expect(registrySkills.length).toBeGreaterThan(0);
    for (const skillName of registrySkills) {
      const skillPath = path.join(rootDir, 'skills', skillName, 'SKILL.md');
      expect(fs.existsSync(skillPath)).toBe(true);
    }
  });
});
