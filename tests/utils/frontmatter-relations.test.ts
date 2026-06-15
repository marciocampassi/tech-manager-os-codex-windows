import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

const { default: matter } = await import('gray-matter');
const { FileSystemService } = await import('../../src/services/file-system.service.js');
const { addRelation, removeRelation, setScalar } =
  await import('../../src/utils/frontmatter-relations.js');

// ── Helpers ──

function writeProfile(
  dir: string,
  fileName: string,
  frontmatter: Record<string, unknown>,
  body = '\n# Profile\n\n## Notes\n\nSome prose content.\n',
): string {
  const filePath = path.join(dir, fileName);
  fs.writeFileSync(filePath, matter.stringify(body, frontmatter));
  return filePath;
}

function readBody(filePath: string): string {
  return matter(fs.readFileSync(filePath, 'utf8')).content;
}

// ── Tests ──

describe('frontmatter-relations', () => {
  let tmpDir: string;
  let fss: InstanceType<typeof FileSystemService>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmr-fm-test-'));
    fss = new FileSystemService();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── addRelation ──

  describe('addRelation', () => {
    it('AC1 — appends to array idempotently (same value twice → length 1)', async () => {
      const filePath = writeProfile(tmpDir, 'member.md', { email: 'a@co.com', direct_reports: [] });
      const link = '[[../../members/b@co.com/b@co.com.md|b@co.com]]';

      await addRelation(filePath, 'direct_reports', link, fss);
      await addRelation(filePath, 'direct_reports', link, fss);

      const { data } = matter(fs.readFileSync(filePath, 'utf8'));
      expect(data.direct_reports).toEqual([link]);
      expect((data.direct_reports as string[]).length).toBe(1);
    });

    it('AC2 — scalar overwrite: current_manager is replaced, not appended', async () => {
      const filePath = writeProfile(tmpDir, 'member.md', {
        email: 'a@co.com',
        current_manager: '[[old.md|old@co.com]]',
      });

      await addRelation(filePath, 'current_manager', '[[new.md|new@co.com]]', fss);

      const raw = fs.readFileSync(filePath, 'utf8');
      expect(raw).toContain('new@co.com');
      expect(raw).not.toContain('old@co.com');
    });

    it('AC6 — throws with path in message when file does not exist', async () => {
      const missing = path.join(tmpDir, 'ghost.md');
      await expect(addRelation(missing, 'direct_reports', '[[x.md|x]]', fss)).rejects.toThrow(
        missing,
      );
    });

    it('builds array from scratch when key is absent', async () => {
      const filePath = writeProfile(tmpDir, 'member.md', { email: 'a@co.com' });
      const link = '[[b.md|b@co.com]]';

      await addRelation(filePath, 'direct_reports', link, fss);

      const raw = fs.readFileSync(filePath, 'utf8');
      expect(raw).toContain(link);
    });
  });

  // ── removeRelation ──

  describe('removeRelation', () => {
    it('AC3 — absent key is silent (no throw)', async () => {
      const filePath = writeProfile(tmpDir, 'member.md', { email: 'a@co.com' });
      await expect(
        removeRelation(filePath, 'direct_reports', '[[x.md|x]]', fss),
      ).resolves.toBeUndefined();
    });

    it('AC3 variant — missing file is silent (no throw)', async () => {
      const missing = path.join(tmpDir, 'ghost.md');
      await expect(
        removeRelation(missing, 'direct_reports', '[[x.md|x]]', fss),
      ).resolves.toBeUndefined();
    });

    it('AC4 — filters value from array; key stays present as []', async () => {
      const link = '[[b.md|b@co.com]]';
      const filePath = writeProfile(tmpDir, 'member.md', {
        email: 'a@co.com',
        direct_reports: [link],
      });

      await removeRelation(filePath, 'direct_reports', link, fss);

      const raw = fs.readFileSync(filePath, 'utf8');
      expect(raw).not.toContain(link);
      expect(raw).toMatch(/direct_reports:\s*\[\]/);
    });
  });

  // ── setScalar ──

  describe('setScalar', () => {
    it('AC7 — writes value correctly', async () => {
      const filePath = writeProfile(tmpDir, 'member.md', { email: 'a@co.com' });

      await setScalar(filePath, 'last_1on1', '2026-06-09', fss);

      const raw = fs.readFileSync(filePath, 'utf8');
      expect(raw).toContain('2026-06-09');
    });

    it('AC8 — missing file is silent (no throw)', async () => {
      const missing = path.join(tmpDir, 'ghost.md');
      await expect(setScalar(missing, 'last_1on1', '2026-06-09', fss)).resolves.toBeUndefined();
    });
  });

  // ── Body Preservation ──

  describe('AC9 — body preservation', () => {
    const body =
      '\n# Profile\n\n## Notes\n\nThis is important prose.\n\n### Details\n\nMore content here.\n';

    it('addRelation preserves body content', async () => {
      const filePath = writeProfile(tmpDir, 'member.md', { email: 'a@co.com' }, body);
      const bodyBefore = readBody(filePath);
      await addRelation(filePath, 'direct_reports', '[[x.md|x]]', fss);
      expect(readBody(filePath)).toBe(bodyBefore);
    });

    it('removeRelation preserves body content', async () => {
      const link = '[[x.md|x@co.com]]';
      const filePath = writeProfile(
        tmpDir,
        'member.md',
        { email: 'a@co.com', direct_reports: [link] },
        body,
      );
      const bodyBefore = readBody(filePath);
      await removeRelation(filePath, 'direct_reports', link, fss);
      expect(readBody(filePath)).toBe(bodyBefore);
    });

    it('setScalar preserves body content', async () => {
      const filePath = writeProfile(tmpDir, 'member.md', { email: 'a@co.com' }, body);
      const bodyBefore = readBody(filePath);
      await setScalar(filePath, 'last_1on1', '2026-06-09', fss);
      expect(readBody(filePath)).toBe(bodyBefore);
    });
  });
});
