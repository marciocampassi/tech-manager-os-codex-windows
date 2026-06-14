import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import matter from 'gray-matter';
import { dirname, join } from 'node:path';
import type { FileSystemService } from '../../src/services/file-system.service.js';

// ── Mock declarations ─────────────────────────────────────────────────────────
// config.service pulls in `conf` (ESM-only) which Jest cannot transform; the
// migration paths never touch it, so a stub is sufficient.

jest.unstable_mockModule('../../src/services/config.service.js', () => ({
  configService: { getWorkspacePath: jest.fn(() => undefined) },
}));

// ── Dynamic import (after mocks) ──────────────────────────────────────────────

const { DoctorService, migrateProfileContent, migrateProjectContent, migrateRosterContent } =
  await import('../../src/services/doctor.service.js');

// ── In-memory fake FileSystemService ──────────────────────────────────────────
//
// listFiles returns FULL paths, listDirectories returns child names — matching the
// real FileSystemService contract that DoctorService relies on.

class FakeFs {
  private readonly files = new Map<string, string>();

  set(path: string, content: string): void {
    this.files.set(path, content);
  }

  get(path: string): string | undefined {
    return this.files.get(path);
  }

  async readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) throw new Error(`ENOENT: ${path}`);
    return content;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async exists(path: string): Promise<boolean> {
    if (this.files.has(path)) return true;
    // Treat a path as an existing directory if any file lives under it.
    const prefix = path.endsWith('/') ? path : `${path}/`;
    for (const key of this.files.keys()) if (key.startsWith(prefix)) return true;
    return false;
  }

  async listFiles(dirPath: string, extension?: string): Promise<string[]> {
    const out: string[] = [];
    for (const key of this.files.keys()) {
      if (dirname(key) !== dirPath) continue;
      if (extension && !key.endsWith(extension)) continue;
      out.push(key);
    }
    return out.sort();
  }

  async listDirectories(dirPath: string): Promise<string[]> {
    const prefix = `${dirPath}/`;
    const names = new Set<string>();
    for (const key of this.files.keys()) {
      if (!key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      const slash = rest.indexOf('/');
      if (slash > -1) names.add(rest.slice(0, slash));
    }
    return [...names].sort();
  }
}

function asFs(fake: FakeFs): FileSystemService {
  return fake as unknown as FileSystemService;
}

// ── Pure transform tests ──────────────────────────────────────────────────────

describe('migrateProfileContent', () => {
  it('lifts structural ## sections into frontmatter and empties the body section', () => {
    const raw = [
      '---',
      'email: ic@co.com',
      'name: IC',
      '---',
      '',
      '## Current Manager',
      '',
      '- [[../../my-leadership/boss@co.com/boss@co.com.md|boss@co.com]]',
      '',
      '## Direct Reports',
      '',
      '- [[../report-a@co.com/report-a@co.com.md|report-a@co.com]]',
      '- [[../report-b@co.com/report-b@co.com.md|report-b@co.com]]',
      '',
      '## Notes',
      '',
      'keep me',
      '',
    ].join('\n');

    const out = migrateProfileContent(raw);
    expect(out.changed).toBe(true);
    expect(out.legacy).toBe(true);

    const parsed = matter(out.content);
    expect(parsed.data['current_manager']).toBe(
      '[[../../my-leadership/boss@co.com/boss@co.com.md|boss@co.com]]',
    );
    expect(parsed.data['direct_reports']).toEqual([
      '[[../report-a@co.com/report-a@co.com.md|report-a@co.com]]',
      '[[../report-b@co.com/report-b@co.com.md|report-b@co.com]]',
    ]);
    // Body link bullets stripped, headers + Notes content preserved.
    expect(parsed.content).not.toContain('[[../report-a@co.com');
    expect(parsed.content).toContain('## Current Manager');
    expect(parsed.content).toContain('## Notes');
    expect(parsed.content).toContain('keep me');
  });

  it('renames legacy `manager` key to `current_manager` and flags renamed', () => {
    const raw = [
      '---',
      'email: ic@co.com',
      'manager: "[[boss.md|boss]]"',
      '---',
      '',
      '# Notes',
      '',
    ].join('\n');
    const out = migrateProfileContent(raw);
    expect(out.renamed).toBe(true);
    expect(out.legacy).toBe(true);
    const parsed = matter(out.content);
    expect(parsed.data['manager']).toBeUndefined();
    expect(parsed.data['current_manager']).toBe('[[boss.md|boss]]');
  });

  it('does NOT overwrite an existing current_manager when renaming manager', () => {
    const raw = [
      '---',
      'current_manager: "[[new.md|new]]"',
      'manager: "[[old.md|old]]"',
      '---',
      '',
    ].join('\n');
    const out = migrateProfileContent(raw);
    const parsed = matter(out.content);
    expect(parsed.data['manager']).toBeUndefined();
    expect(parsed.data['current_manager']).toBe('[[new.md|new]]');
  });

  it('strips deprecated action_items_gdoc frontmatter and ## Action Items body links', () => {
    const raw = [
      '---',
      'email: ic@co.com',
      'action_items_gdoc: https://docs.google.com/x',
      '---',
      '',
      '## Action Items',
      '',
      '- [[action-items-2026-05.md|action items]]',
      '',
    ].join('\n');
    const out = migrateProfileContent(raw);
    expect(out.changed).toBe(true);
    expect(out.legacy).toBe(true);
    const parsed = matter(out.content);
    expect(parsed.data['action_items_gdoc']).toBeUndefined();
    expect(parsed.content).not.toContain('action-items-2026-05');
    expect(parsed.content).toContain('## Action Items');
  });

  it('sets last_<type> scalar from latest dated section entry and leaves body links in place', () => {
    const raw = [
      '---',
      'email: ic@co.com',
      '---',
      '',
      '## 1on1s',
      '',
      '- [[1on1s/2026-05-22-1on1.md|2026-05-22]]',
      '- [[1on1s/2026-04-01-1on1.md|2026-04-01]]',
      '',
    ].join('\n');
    const out = migrateProfileContent(raw);
    expect(out.changed).toBe(true);
    // Dated-only change is NOT a "legacy body link" for warning purposes.
    expect(out.legacy).toBe(false);
    const parsed = matter(out.content);
    expect(parsed.data['last_1on1']).toBe('2026-05-22');
    // Dated body links stay put.
    expect(parsed.content).toContain('2026-05-22-1on1.md');
    expect(parsed.content).toContain('2026-04-01-1on1.md');
  });

  it('is idempotent — a second run reports no change', () => {
    const raw = [
      '---',
      'email: ic@co.com',
      'manager: "[[boss.md|boss]]"',
      'action_items_gdoc: x',
      '---',
      '',
      '## Direct Reports',
      '',
      '- [[../r@co.com/r@co.com.md|r@co.com]]',
      '',
      '## 1on1s',
      '',
      '- [[1on1s/2026-05-22-1on1.md|2026-05-22]]',
      '',
    ].join('\n');
    const first = migrateProfileContent(raw);
    expect(first.changed).toBe(true);
    const second = migrateProfileContent(first.content);
    expect(second.changed).toBe(false);
    expect(second.content).toBe(first.content);
  });

  it('merges + dedupes structural links into an existing frontmatter array', () => {
    const raw = [
      '---',
      'direct_reports:',
      '  - "[[../a@co.com/a@co.com.md|a@co.com]]"',
      '---',
      '',
      '## Direct Reports',
      '',
      '- [[../a@co.com/a@co.com.md|a@co.com]]',
      '- [[../b@co.com/b@co.com.md|b@co.com]]',
      '',
    ].join('\n');
    const out = migrateProfileContent(raw);
    const parsed = matter(out.content);
    expect(parsed.data['direct_reports']).toEqual([
      '[[../a@co.com/a@co.com.md|a@co.com]]',
      '[[../b@co.com/b@co.com.md|b@co.com]]',
    ]);
  });

  it('preserves a non-string `manager` value instead of deleting it (no data loss)', () => {
    // Unquoted `manager: [[x]]` parses into a nested array, not a string.
    const raw = [
      '---',
      'email: ic@co.com',
      'manager: [[boss@co.com]]',
      '---',
      '',
      '## Notes',
      '',
    ].join('\n');
    const out = migrateProfileContent(raw);
    expect(out.changed).toBe(false);
    const parsed = matter(out.content);
    expect(parsed.data['manager']).toBeDefined();
    expect(parsed.data['current_manager']).toBeUndefined();
  });

  it('coerces an existing scalar at an array key into the array (no data loss)', () => {
    const raw = [
      '---',
      'direct_reports: "[[../a@co.com/a@co.com.md|a@co.com]]"',
      '---',
      '',
      '## Direct Reports',
      '',
      '- [[../b@co.com/b@co.com.md|b@co.com]]',
      '',
    ].join('\n');
    const out = migrateProfileContent(raw);
    const parsed = matter(out.content);
    expect(parsed.data['direct_reports']).toEqual([
      '[[../a@co.com/a@co.com.md|a@co.com]]',
      '[[../b@co.com/b@co.com.md|b@co.com]]',
    ]);
  });

  it('does NOT downgrade a newer existing last_<type> scalar with an older body date', () => {
    const raw = [
      '---',
      'email: ic@co.com',
      'last_1on1: 2026-06-01',
      '---',
      '',
      '## 1on1s',
      '',
      '- [[1on1s/2026-05-22-1on1.md|2026-05-22]]',
      '',
    ].join('\n');
    const out = migrateProfileContent(raw);
    expect(out.changed).toBe(false);
    expect(out.content).toBe(raw);
  });

  it('is idempotent for a dated scalar even when the existing value round-trips to a Date', () => {
    const first = migrateProfileContent(
      [
        '---',
        'email: ic@co.com',
        '---',
        '',
        '## 1on1s',
        '',
        '- [[1on1s/2026-05-22-1on1.md|2026-05-22]]',
        '',
      ].join('\n'),
    );
    expect(first.changed).toBe(true);
    const second = migrateProfileContent(first.content);
    expect(second.changed).toBe(false);
  });

  it('picks the entry date, not a folder date earlier in the link path', () => {
    const raw = [
      '---',
      'email: ic@co.com',
      '---',
      '',
      '## 1on1s',
      '',
      '- [[2020-archive/2026-05-22-1on1.md|2026-05-22]]',
      '',
    ].join('\n');
    const out = migrateProfileContent(raw);
    expect(matter(out.content).data['last_1on1']).toBe('2026-05-22');
  });

  it('reports no change for an already-frontmatter-native profile', () => {
    const raw = [
      '---',
      'email: ic@co.com',
      'current_manager: "[[boss.md|boss]]"',
      'direct_reports:',
      '  - "[[r.md|r]]"',
      '---',
      '',
      '## Notes',
      '',
      'hello',
      '',
    ].join('\n');
    const out = migrateProfileContent(raw);
    expect(out.changed).toBe(false);
    expect(out.legacy).toBe(false);
    expect(out.content).toBe(raw);
  });
});

describe('migrateRosterContent', () => {
  it('lifts roster body member links into the members frontmatter array', () => {
    const raw = [
      '---',
      'team: alpha',
      '---',
      '',
      '# Team Members',
      '',
      '- [[../../members/a@co.com/a@co.com.md|a@co.com]]',
      '- [[../../members/b@co.com/b@co.com.md|b@co.com]]',
      '',
    ].join('\n');
    const out = migrateRosterContent(raw);
    expect(out.changed).toBe(true);
    const parsed = matter(out.content);
    expect(parsed.data['members']).toEqual([
      '[[../../members/a@co.com/a@co.com.md|a@co.com]]',
      '[[../../members/b@co.com/b@co.com.md|b@co.com]]',
    ]);
    expect(parsed.content).not.toContain('a@co.com.md|');
  });

  it('only lifts links under the Team Members section, leaving other sections intact', () => {
    const raw = [
      '---',
      'team: alpha',
      '---',
      '',
      '# Team Members',
      '',
      '- [[../../members/a@co.com/a@co.com.md|a@co.com]]',
      '',
      '## Notes',
      '',
      '- [[../../docs/charter.md|charter]]',
      '',
    ].join('\n');
    const out = migrateRosterContent(raw);
    const parsed = matter(out.content);
    expect(parsed.data['members']).toEqual(['[[../../members/a@co.com/a@co.com.md|a@co.com]]']);
    // The Notes link must NOT be absorbed and must remain in the body.
    expect(parsed.content).toContain('[[../../docs/charter.md|charter]]');
  });

  it('reports no change when the roster body has no links', () => {
    const raw = [
      '---',
      'team: alpha',
      'members:',
      '  - "[[a.md|a]]"',
      '---',
      '',
      '# Team Members',
      '',
    ].join('\n');
    const out = migrateRosterContent(raw);
    expect(out.changed).toBe(false);
    expect(out.content).toBe(raw);
  });
});

describe('migrateProjectContent', () => {
  it('lifts # Team Members and # Stakeholders body links into frontmatter', () => {
    const raw = [
      '---',
      'project: apollo',
      '---',
      '',
      '# Team Members',
      '',
      '- [[../../members/a@co.com/a@co.com.md|a@co.com]]',
      '',
      '# Stakeholders',
      '',
      '- [[../../members/s@co.com/s@co.com.md|s@co.com]]',
      '',
    ].join('\n');
    const out = migrateProjectContent(raw);
    expect(out.changed).toBe(true);
    const parsed = matter(out.content);
    expect(parsed.data['members']).toEqual(['[[../../members/a@co.com/a@co.com.md|a@co.com]]']);
    expect(parsed.data['stakeholders']).toEqual([
      '[[../../members/s@co.com/s@co.com.md|s@co.com]]',
    ]);
  });
});

// ── DoctorService IO orchestration ────────────────────────────────────────────

describe('DoctorService.migrateFrontmatter / detectLegacyBodyLinks', () => {
  const ws = '/vault';
  let fake: FakeFs;
  let service: InstanceType<typeof DoctorService>;

  beforeEach(() => {
    fake = new FakeFs();
    service = new DoctorService('1.0.0', asFs(fake));
  });

  function seedLegacyVault(): void {
    // self profile (flat in my-career)
    fake.set(
      join(ws, 'my-career', 'me@co.com.md'),
      [
        '---',
        'email: me@co.com',
        '---',
        '',
        '## Direct Reports',
        '',
        '- [[../my-teams/members/r@co.com/r@co.com.md|r@co.com]]',
        '',
      ].join('\n'),
    );
    // team member (nested my-teams/members/<email>/<email>.md)
    fake.set(
      join(ws, 'my-teams', 'members', 'r@co.com', 'r@co.com.md'),
      ['---', 'email: r@co.com', 'manager: "[[boss.md|boss]]"', '---', ''].join('\n'),
    );
    // archived member (my-teams/archived/<year>/<email>/<email>.md)
    fake.set(
      join(ws, 'my-teams', 'archived', '2025', 'old@co.com', 'old@co.com.md'),
      [
        '---',
        'email: old@co.com',
        '---',
        '',
        '## 1on1s',
        '',
        '- [[1on1s/2025-01-02-1on1.md|2025-01-02]]',
        '',
      ].join('\n'),
    );
    // roster file (my-teams/teams/<slug>/<slug>-members.md)
    fake.set(
      join(ws, 'my-teams', 'teams', 'alpha', 'alpha-members.md'),
      [
        '---',
        'team: alpha',
        '---',
        '',
        '# Team Members',
        '',
        '- [[../../members/r@co.com/r@co.com.md|r@co.com]]',
        '',
      ].join('\n'),
    );
    // project overview (my-company/projects/<name>/<name>.md)
    fake.set(
      join(ws, 'my-company', 'projects', 'apollo', 'apollo.md'),
      [
        '---',
        'project: apollo',
        '---',
        '',
        '# Team Members',
        '',
        '- [[../../members/r@co.com/r@co.com.md|r@co.com]]',
        '',
      ].join('\n'),
    );
  }

  it('migrates every file type and reports an accurate summary', async () => {
    seedLegacyVault();
    const summary = await service.migrateFrontmatter(ws);
    expect(summary.scanned).toBe(5);
    expect(summary.migrated).toBe(5);
    expect(summary.renamed).toBe(1); // only the team member had a `manager` key

    const roster = matter(fake.get(join(ws, 'my-teams', 'teams', 'alpha', 'alpha-members.md'))!);
    expect(roster.data['members']).toEqual(['[[../../members/r@co.com/r@co.com.md|r@co.com]]']);

    const project = matter(fake.get(join(ws, 'my-company', 'projects', 'apollo', 'apollo.md'))!);
    expect(project.data['members']).toEqual(['[[../../members/r@co.com/r@co.com.md|r@co.com]]']);
  });

  it('is idempotent across runs — second run migrates nothing', async () => {
    seedLegacyVault();
    await service.migrateFrontmatter(ws);
    const second = await service.migrateFrontmatter(ws);
    expect(second.scanned).toBe(5);
    expect(second.migrated).toBe(0);
    expect(second.renamed).toBe(0);
  });

  it('detects legacy body links (excluding dated-only profiles)', async () => {
    seedLegacyVault();
    // self + team member + roster + project are legacy; archived has only a dated section.
    expect(await service.detectLegacyBodyLinks(ws)).toBe(4);
  });

  it('reports zero legacy links after a migration run', async () => {
    seedLegacyVault();
    await service.migrateFrontmatter(ws);
    expect(await service.detectLegacyBodyLinks(ws)).toBe(0);
  });

  it('returns a zero summary for an empty vault', async () => {
    const summary = await service.migrateFrontmatter(ws);
    expect(summary).toEqual({ scanned: 0, migrated: 0, renamed: 0, skipped: 0 });
    expect(await service.detectLegacyBodyLinks(ws)).toBe(0);
  });

  it('skips a file with malformed YAML instead of aborting the run', async () => {
    // One good legacy profile + one corrupt file.
    fake.set(
      join(ws, 'my-career', 'me@co.com.md'),
      [
        '---',
        'email: me@co.com',
        '---',
        '',
        '## Direct Reports',
        '',
        '- [[../r@co.com/r@co.com.md|r]]',
        '',
      ].join('\n'),
    );
    fake.set(
      join(ws, 'my-teams', 'members', 'bad@co.com', 'bad@co.com.md'),
      [
        '---',
        'email: "unterminated',
        'broken: [a, b',
        '---',
        '',
        '## Direct Reports',
        '',
        '- [[x]]',
        '',
      ].join('\n'),
    );
    // detection must not throw on the corrupt file (counts only the good legacy profile)
    await expect(service.detectLegacyBodyLinks(ws)).resolves.toBe(1);

    const summary = await service.migrateFrontmatter(ws);
    expect(summary.scanned).toBe(2);
    expect(summary.migrated).toBe(1);
    expect(summary.skipped).toBe(1);
  });
});
