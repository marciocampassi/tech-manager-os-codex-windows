import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { FileSystemService } from '../../src/services/file-system.service.js';
import { appendToSection } from '../../src/utils/markdown-section.js';

type MockFS = {
  [K in keyof FileSystemService]: jest.MockedFunction<FileSystemService[K]>;
};

function createMockFS(): MockFS {
  return {
    createDirectory: jest.fn<FileSystemService['createDirectory']>().mockResolvedValue(undefined),
    writeFile: jest.fn<FileSystemService['writeFile']>().mockResolvedValue(undefined),
    readFile: jest.fn<FileSystemService['readFile']>().mockResolvedValue(''),
    moveFile: jest.fn<FileSystemService['moveFile']>().mockResolvedValue(undefined),
    exists: jest.fn<FileSystemService['exists']>().mockResolvedValue(false),
    appendFile: jest.fn<FileSystemService['appendFile']>().mockResolvedValue(undefined),
    listFiles: jest.fn<FileSystemService['listFiles']>().mockResolvedValue([]),
    listDirectories: jest.fn<FileSystemService['listDirectories']>().mockResolvedValue([]),
    removeFile: jest.fn<FileSystemService['removeFile']>().mockResolvedValue(undefined),
  };
}

const FILE = '/ws/profile.md';
const ENTRY = '- [[../platform-project/platform-project.md|platform]]';

describe('appendToSection', () => {
  let mockFS: MockFS;

  beforeEach(() => {
    mockFS = createMockFS();
  });

  // ── Idempotency ────────────────────────────────────────────────────────────

  it('no-op when entry already present in file', async () => {
    mockFS.readFile.mockResolvedValue(`## Projects\n\n${ENTRY}\n`);

    await appendToSection(FILE, 'Projects', ENTRY, mockFS as unknown as FileSystemService);

    expect(mockFS.writeFile).not.toHaveBeenCalled();
  });

  // ── Section exists ─────────────────────────────────────────────────────────

  it('appends entry inside existing section before next ## heading', async () => {
    const content = `# Profile\n\n## Projects\n\n## Notes\n`;
    mockFS.readFile.mockResolvedValue(content);

    await appendToSection(FILE, 'Projects', ENTRY, mockFS as unknown as FileSystemService);

    const written = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
    const projectsIdx = written.indexOf('## Projects');
    const entryIdx = written.indexOf(ENTRY);
    const notesIdx = written.indexOf('## Notes');
    expect(entryIdx).toBeGreaterThan(projectsIdx);
    expect(entryIdx).toBeLessThan(notesIdx);
  });

  it('appends entry at EOF when section is the last section', async () => {
    const content = `# Profile\n\n## Projects\n\n`;
    mockFS.readFile.mockResolvedValue(content);

    await appendToSection(FILE, 'Projects', ENTRY, mockFS as unknown as FileSystemService);

    const written = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
    expect(written).toContain(ENTRY);
    expect(written.indexOf(ENTRY)).toBeGreaterThan(written.indexOf('## Projects'));
  });

  it('appends entry among existing entries in section', async () => {
    const existing = '- [[../other-project/other-project.md|other]]';
    const content = `## Projects\n\n${existing}\n`;
    mockFS.readFile.mockResolvedValue(content);

    await appendToSection(FILE, 'Projects', ENTRY, mockFS as unknown as FileSystemService);

    const written = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
    expect(written).toContain(existing);
    expect(written).toContain(ENTRY);
  });

  // ── Section absent ─────────────────────────────────────────────────────────

  it('creates ## Projects section and appends entry when section absent', async () => {
    mockFS.readFile.mockResolvedValue('# Profile\n\n## Bio\n\nSome text.\n');

    await appendToSection(FILE, 'Projects', ENTRY, mockFS as unknown as FileSystemService);

    const written = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
    expect(written).toContain('## Projects');
    expect(written).toContain(ENTRY);
    expect(written.indexOf('## Projects')).toBeGreaterThan(written.indexOf('## Bio'));
  });

  it('writes to the correct file path', async () => {
    mockFS.readFile.mockResolvedValue('');

    await appendToSection(FILE, 'Projects', ENTRY, mockFS as unknown as FileSystemService);

    expect(mockFS.writeFile).toHaveBeenCalledWith(FILE, expect.any(String));
  });
});
