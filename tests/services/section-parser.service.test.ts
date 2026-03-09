import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { SectionParserService } from '../../src/services/section-parser.service.js';
import type { FileSystemService } from '../../src/services/file-system.service.js';

// ── Mock FileSystemService ────────────────────────────────────────────────────

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
  };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROFILE_WITH_SECTIONS = `---
email: john@co.com
---

## Current Manager

[[my-career/me@co.com.md]]

## Previous Managers

## 1on1s

## Assessments

## Feedbacks
`;

const PROFILE_WITHOUT_1ON1_SECTION = `---
email: john@co.com
---

## Current Manager

## Assessments
`;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SectionParserService', () => {
  let svc: SectionParserService;
  let mockFS: MockFS;

  beforeEach(() => {
    mockFS = createMockFS();
    svc = new SectionParserService(mockFS as unknown as FileSystemService);
  });

  // ── findSection ─────────────────────────────────────────────────────────────

  describe('findSection', () => {
    it('returns true when the section exists', () => {
      expect(svc.findSection(PROFILE_WITH_SECTIONS, '1on1s')).toBe(true);
    });

    it('returns false when the section does not exist', () => {
      expect(svc.findSection(PROFILE_WITH_SECTIONS, 'Performance Reviews')).toBe(false);
    });

    it('is case-sensitive', () => {
      expect(svc.findSection(PROFILE_WITH_SECTIONS, '1ON1S')).toBe(false);
    });
  });

  // ── appendToSection (pure) ──────────────────────────────────────────────────

  describe('appendToSection', () => {
    it('appends line to an existing section before the next section', () => {
      const result = svc.appendToSection(
        PROFILE_WITH_SECTIONS,
        '1on1s',
        '- [[1on1s/2026-03-07-john@co.com-1on1.md]]',
      );
      expect(result).toContain('## 1on1s');
      expect(result).toContain('- [[1on1s/2026-03-07-john@co.com-1on1.md]]');
      // Should appear before ## Assessments
      const linkPos = result.indexOf('- [[1on1s/2026-03-07-john@co.com-1on1.md]]');
      const assessPos = result.indexOf('## Assessments');
      expect(linkPos).toBeLessThan(assessPos);
    });

    it('creates missing section at end of file', () => {
      const result = svc.appendToSection(
        PROFILE_WITHOUT_1ON1_SECTION,
        '1on1s',
        '- [[1on1s/2026-03-07-john@co.com-1on1.md]]',
      );
      expect(result).toContain('## 1on1s');
      expect(result).toContain('- [[1on1s/2026-03-07-john@co.com-1on1.md]]');
    });

    it('preserves all other sections when appending', () => {
      const result = svc.appendToSection(
        PROFILE_WITH_SECTIONS,
        '1on1s',
        '- [[1on1s/2026-03-07-john@co.com-1on1.md]]',
      );
      expect(result).toContain('## Current Manager');
      expect(result).toContain('## Assessments');
      expect(result).toContain('## Feedbacks');
      expect(result).toContain('[[my-career/me@co.com.md]]');
    });

    it('appends multiple links in correct order', () => {
      const after1 = svc.appendToSection(
        PROFILE_WITH_SECTIONS,
        '1on1s',
        '- [[1on1s/2026-03-01-john@co.com-1on1.md]]',
      );
      const after2 = svc.appendToSection(
        after1,
        '1on1s',
        '- [[1on1s/2026-03-07-john@co.com-1on1.md]]',
      );
      const pos1 = after2.indexOf('2026-03-01');
      const pos2 = after2.indexOf('2026-03-07');
      expect(pos1).toBeLessThan(pos2);
    });

    it('appends to last section when it is at EOF with no trailing section', () => {
      const content = `## Feedbacks\n`;
      const result = svc.appendToSection(content, 'Feedbacks', '- [[feedback/2026-03-07-f.md]]');
      expect(result).toContain('## Feedbacks');
      expect(result).toContain('- [[feedback/2026-03-07-f.md]]');
    });
  });

  // ── appendToFile ─────────────────────────────────────────────────────────────

  describe('appendToFile', () => {
    it('reads file, transforms content, and writes result', async () => {
      mockFS.readFile.mockResolvedValue(PROFILE_WITH_SECTIONS);

      await svc.appendToFile('/ws/_members/john@co.com/john@co.com.md', '1on1s', '- [[link]]');

      expect(mockFS.readFile).toHaveBeenCalledWith('/ws/_members/john@co.com/john@co.com.md');
      const writtenContent = (mockFS.writeFile.mock.calls[0] as [string, string])[1];
      expect(writtenContent).toContain('- [[link]]');
      expect(writtenContent).toContain('## 1on1s');
    });

    it('passes file path correctly to writeFile', async () => {
      const profilePath = '/ws/_members/john@co.com/john@co.com.md';
      mockFS.readFile.mockResolvedValue('## 1on1s\n');

      await svc.appendToFile(profilePath, '1on1s', '- [[link]]');

      expect(mockFS.writeFile).toHaveBeenCalledWith(profilePath, expect.any(String));
    });
  });
});
