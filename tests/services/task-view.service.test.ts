import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ── Mock declarations (must precede dynamic imports) ──────────────────────────

const mockReadFile = jest.fn<(path: string) => Promise<string>>();
const mockExists = jest.fn<(path: string) => Promise<boolean>>();

jest.unstable_mockModule('../../src/services/file-system.service.js', () => ({
  fileSystemService: {
    readFile: mockReadFile,
    exists: mockExists,
  },
  FileSystemError: class FileSystemError extends Error {
    constructor(
      message: string,
      public readonly operation: string,
      public readonly path: string,
      public readonly cause?: unknown,
    ) {
      super(message);
      this.name = 'FileSystemError';
      Object.setPrototypeOf(this, FileSystemError.prototype);
    }
  },
}));

jest.unstable_mockModule('../../src/errors/tmr-error.js', () => ({
  FileSystemError: class FileSystemError extends Error {
    constructor(
      message: string,
      public readonly operation: string,
      public readonly path: string,
      public readonly cause?: unknown,
    ) {
      super(message);
      this.name = 'FileSystemError';
      Object.setPrototypeOf(this, FileSystemError.prototype);
    }
  },
}));

// Minimal chalk mock (no colors in tests)
jest.unstable_mockModule('chalk', () => ({
  default: {
    bold: (s: string) => s,
    dim: (s: string) => s,
  },
}));

// date-fns mock — deterministic dates for tests
jest.unstable_mockModule('date-fns', () => ({
  format: (_date: Date, pattern: string) => {
    const patterns: Record<string, string> = {
      'EEEE, MMMM d, yyyy': 'Friday, March 21, 2026',
      'MMM d': 'Mar 17',
      'MMM d, yyyy': 'Mar 23, 2026',
      'MMMM yyyy': 'March 2026',
    };
    return patterns[pattern] ?? pattern;
  },
  startOfWeek: (_date: Date) => new Date('2026-03-16'),
  endOfWeek: (_date: Date) => new Date('2026-03-22'),
}));

// ── Dynamic import (after all mocks) ─────────────────────────────────────────

const { TaskViewService } = await import('../../src/services/task-view.service.js');
const { FileSystemError } = await import('../../src/errors/tmr-error.js');

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TaskViewService', () => {
  let svc: InstanceType<typeof TaskViewService>;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new TaskViewService();
  });

  describe('readTaskFile', () => {
    it('returns file content when file exists and has content', async () => {
      mockReadFile.mockResolvedValue('## My Tasks\n\n- [ ] Do something\n');
      const result = await svc.readTaskFile('today', '/workspace');
      expect(mockReadFile.mock.calls[0]![0].replace(/\\/g, '/')).toBe(
        '/workspace/my-tasks/today.md',
      );
      expect(result).toBe('## My Tasks\n\n- [ ] Do something\n');
    });

    it('returns empty string when file exists but is whitespace-only', async () => {
      mockReadFile.mockResolvedValue('   \n  \n');
      const result = await svc.readTaskFile('today', '/workspace');
      expect(result).toBe('');
    });

    it('9.35: strips YAML frontmatter (type/owner) so it does not leak into the view', async () => {
      mockReadFile.mockResolvedValue(
        '---\ntype: today\nowner: "[[../my-career/me@co.com.md|me@co.com]]"\n---\n\n# Tasks — Today\n\n- [ ] Do something\n',
      );
      const result = await svc.readTaskFile('today', '/workspace');
      expect(result).not.toContain('type: today');
      expect(result).not.toContain('owner:');
      expect(result).not.toMatch(/^---/);
      expect(result).toContain('# Tasks — Today');
      expect(result).toContain('- [ ] Do something');
    });

    it('9.35: returns empty string when file has only frontmatter and no body', async () => {
      mockReadFile.mockResolvedValue('---\ntype: today\nowner: "x"\n---\n');
      const result = await svc.readTaskFile('today', '/workspace');
      expect(result).toBe('');
    });

    it('returns empty string when file does not exist (FileSystemError)', async () => {
      mockReadFile.mockRejectedValue(
        new FileSystemError('ENOENT', 'readFile', '/workspace/my-tasks/today.md'),
      );
      const result = await svc.readTaskFile('today', '/workspace');
      expect(result).toBe('');
    });

    it('maps period to correct file path for all periods', async () => {
      mockReadFile.mockResolvedValue('content');

      const cases: Array<[import('../../src/types/task.types.js').TaskPeriod, string]> = [
        ['today', '/ws/my-tasks/today.md'],
        ['this-week', '/ws/my-tasks/this-week.md'],
        ['this-month', '/ws/my-tasks/this-month.md'],
        ['this-quarter', '/ws/my-tasks/this-quarter.md'],
      ];

      for (const [period, expectedPath] of cases) {
        jest.clearAllMocks();
        mockReadFile.mockResolvedValue('content');
        await svc.readTaskFile(period, '/ws');
        expect(mockReadFile.mock.calls[0]![0].replace(/\\/g, '/')).toBe(expectedPath);
      }
    });

    it('re-throws non-FileSystemError errors', async () => {
      const unexpected = new Error('Unexpected');
      mockReadFile.mockRejectedValue(unexpected);
      await expect(svc.readTaskFile('today', '/workspace')).rejects.toThrow('Unexpected');
    });
  });

  describe('formatHeaderText', () => {
    it('returns today header with formatted date', () => {
      const header = svc.formatHeaderText('today');
      expect(header).toContain('📅 Today');
      expect(header).toContain('Friday, March 21, 2026');
    });

    it('returns this-week header with week range', () => {
      const header = svc.formatHeaderText('this-week');
      expect(header).toContain('📆 This Week');
      expect(header).toContain('Mar 17');
    });

    it('returns this-month header with month and year', () => {
      const header = svc.formatHeaderText('this-month');
      expect(header).toContain('🗓️');
      expect(header).toContain('This Month');
      expect(header).toContain('March 2026');
    });

    it('returns this-quarter header with quarter number', () => {
      const header = svc.formatHeaderText('this-quarter');
      expect(header).toContain('📊 This Quarter');
      expect(header).toMatch(/Q\d \d{4}/);
    });
  });

  describe('formatHeader', () => {
    it('returns bold-wrapped version of formatHeaderText', () => {
      const text = svc.formatHeaderText('today');
      const header = svc.formatHeader('today');
      expect(header).toBe(text);
    });
  });

  describe('renderContent', () => {
    it('returns content unchanged in plain mode', () => {
      const content = '## Tasks\n\n- [ ] Do this\n- [x] Done';
      expect(svc.renderContent(content, true)).toBe(content);
    });

    it('applies bold to markdown headings in color mode', () => {
      const content = '## Tasks';
      const rendered = svc.renderContent(content, false);
      expect(rendered).toContain('## Tasks');
    });

    it('applies dim to completed tasks in color mode', () => {
      const content = '- [x] Done item';
      const rendered = svc.renderContent(content, false);
      expect(rendered).toContain('- [x] Done item');
    });

    it('passes through regular lines unchanged in color mode', () => {
      const content = 'Some regular text';
      expect(svc.renderContent(content, false)).toBe(content);
    });
  });

  describe('formatEmptyState', () => {
    it('includes the period file path in empty state message', () => {
      const msg = svc.formatEmptyState('today', true);
      expect(msg).toContain('my-tasks/today.md');
    });

    it('includes instruction to run tmr process', () => {
      const msg = svc.formatEmptyState('this-week', true);
      expect(msg).toContain('tmr process');
    });

    it('includes the period header in the empty state (color mode)', () => {
      const msg = svc.formatEmptyState('today', false);
      expect(msg).toContain('Today');
    });

    it('includes dividers in empty state (color mode)', () => {
      const msg = svc.formatEmptyState('today', false);
      expect(msg).toContain('─');
    });

    it('omits dividers and header in plain mode', () => {
      const msg = svc.formatEmptyState('today', true);
      expect(msg).not.toContain('─');
      expect(msg).toContain('No tasks yet for this period.');
    });
  });

  describe('formatDisplay', () => {
    it('includes header and content in display (color mode)', () => {
      const display = svc.formatDisplay('today', '- [ ] Task one\n', false);
      expect(display).toContain('Today');
      expect(display).toContain('- [ ] Task one');
    });

    it('includes divider in display (color mode)', () => {
      const display = svc.formatDisplay('today', 'content', false);
      expect(display).toContain('─');
    });

    it('returns only rendered content without chrome in plain mode', () => {
      const display = svc.formatDisplay('today', '- [ ] Task one\n', true);
      expect(display).not.toContain('─');
      expect(display).not.toContain('Today');
      expect(display).toBe('- [ ] Task one\n');
    });
  });
});
