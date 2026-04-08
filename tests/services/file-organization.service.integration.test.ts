import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { pathExists } from 'fs-extra';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileSystemService } from '../../src/services/file-system.service.js';
import { FileOrganizationService } from '../../src/services/file-organization.service.js';
import type { InboxFile } from '../../src/types/inbox.types.js';

describe('FileOrganizationService (integration)', () => {
  let tmpRoot: string;
  let fsSvc: FileSystemService;
  let org: FileOrganizationService;

  beforeEach(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), 'tmr-org-'));
    fsSvc = new FileSystemService();
    org = new FileOrganizationService(fsSvc);
  });

  afterEach(async () => {
    await rm(tmpRoot, { recursive: true, force: true });
  });

  it('moves a single inbox file to one destination', async () => {
    const inboxDir = join(tmpRoot, 'inbox');
    const src = join(inboxDir, 'a.md');
    await fsSvc.createDirectory(inboxDir);
    await fsSvc.writeFile(src, 'body one');

    const file: InboxFile = {
      filepath: src,
      content: 'body one',
      timestamp: new Date(),
    };

    const r = await org.organizeFile(file, tmpRoot, ['my-teams/t1']);
    expect(r.success).toBe(true);
    if (!r.success) return;

    expect(r.data.mode).toBe('moved');
    expect(await pathExists(src)).toBe(false);
    const dest = join(tmpRoot, 'my-teams/t1', 'a.md');
    expect(await readFile(dest, { encoding: 'utf8' })).toBe('body one');
  });

  it('writes to multiple destinations and removes inbox copy', async () => {
    const inboxDir = join(tmpRoot, 'inbox');
    const src = join(inboxDir, 'b.md');
    await fsSvc.createDirectory(inboxDir);
    await fsSvc.writeFile(src, 'multi');

    const file: InboxFile = {
      filepath: src,
      content: 'multi',
      timestamp: new Date(),
    };

    const r = await org.organizeFile(file, tmpRoot, ['d1', 'd2']);
    expect(r.success).toBe(true);
    if (!r.success) return;

    expect(r.data.mode).toBe('copied');
    expect(await pathExists(src)).toBe(false);
    expect(await readFile(join(tmpRoot, 'd1', 'b.md'), { encoding: 'utf8' })).toBe('multi');
    expect(await readFile(join(tmpRoot, 'd2', 'b.md'), { encoding: 'utf8' })).toBe('multi');
  });

  it('archives when destinations are empty', async () => {
    const inboxDir = join(tmpRoot, 'inbox');
    const src = join(inboxDir, 'c.md');
    await fsSvc.createDirectory(inboxDir);
    await fsSvc.writeFile(src, 'arch');

    const file: InboxFile = {
      filepath: src,
      content: 'arch',
      timestamp: new Date(),
    };

    const r = await org.organizeFile(file, tmpRoot, []);
    expect(r.success).toBe(true);
    if (!r.success) return;

    expect(r.data.mode).toBe('archived');
    expect(await pathExists(src)).toBe(false);
    expect(await readFile(join(tmpRoot, 'archive', 'c.md'), { encoding: 'utf8' })).toBe('arch');
  });
});
