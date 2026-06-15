import { join } from 'node:path';
import chalk from 'chalk';
import matter from 'gray-matter';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { fileSystemService } from './file-system.service.js';
import { FileSystemError } from '../errors/tmr-error.js';
import type { TaskPeriod } from '../types/task.types.js';

const PERIOD_FILE_MAP: Record<TaskPeriod, string> = {
  today: 'my-tasks/today.md',
  'this-week': 'my-tasks/this-week.md',
  'this-month': 'my-tasks/this-month.md',
  'this-quarter': 'my-tasks/this-quarter.md',
};

const DIVIDER = '─'.repeat(34);

export class TaskViewService {
  async readTaskFile(period: TaskPeriod, workspaceRoot: string): Promise<string> {
    const filePath = join(workspaceRoot, PERIOD_FILE_MAP[period]);
    try {
      const content = await fileSystemService.readFile(filePath);
      // Strip YAML frontmatter (type/owner shell metadata) so it never leaks
      // into the rendered task view.
      const body = matter(content).content;
      return body.trim().length === 0 ? '' : body;
    } catch (err) {
      if (err instanceof FileSystemError) {
        return '';
      }
      throw err;
    }
  }

  /** Returns the plain-text header label for the given period. */
  formatHeaderText(period: TaskPeriod): string {
    const now = new Date();
    switch (period) {
      case 'today':
        return `📅 Today — ${format(now, 'EEEE, MMMM d, yyyy')}`;
      case 'this-week': {
        const start = startOfWeek(now, { weekStartsOn: 1 });
        const end = endOfWeek(now, { weekStartsOn: 1 });
        return `📆 This Week — ${format(start, 'MMM d')}–${format(end, 'MMM d, yyyy')}`;
      }
      case 'this-month':
        return `🗓️  This Month — ${format(now, 'MMMM yyyy')}`;
      case 'this-quarter': {
        const q = Math.ceil((now.getMonth() + 1) / 3);
        return `📊 This Quarter — Q${q} ${now.getFullYear()}`;
      }
    }
  }

  /** Returns a chalk-styled bold header for terminal output. */
  formatHeader(period: TaskPeriod): string {
    return chalk.bold(this.formatHeaderText(period));
  }

  /** Renders markdown content for terminal display. */
  renderContent(content: string, plain: boolean): string {
    if (plain) return content;
    return content
      .split('\n')
      .map((line) => {
        if (/^#{1,6}\s/.test(line)) return chalk.bold(line);
        if (/^- \[x\]/i.test(line)) return chalk.dim(line);
        return line;
      })
      .join('\n');
  }

  /** Returns the empty-state display block when no tasks exist for the period. */
  formatEmptyState(period: TaskPeriod, plain: boolean): string {
    const filePath = PERIOD_FILE_MAP[period];
    if (plain) {
      return [
        'No tasks yet for this period.',
        '',
        'Run `tmr process` to populate from your inbox,',
        `or add tasks manually to ${filePath}`,
      ].join('\n');
    }
    const headerLine = this.formatHeader(period);
    return [
      DIVIDER,
      headerLine,
      DIVIDER,
      '',
      'No tasks yet for this period.',
      '',
      'Run `tmr process` to populate from your inbox,',
      `or add tasks manually to ${filePath}`,
      DIVIDER,
    ].join('\n');
  }

  /** Formats the full display block (header + content) for a populated task file. */
  formatDisplay(period: TaskPeriod, content: string, plain: boolean): string {
    const rendered = this.renderContent(content, plain);
    if (plain) return rendered;
    const headerLine = this.formatHeader(period);
    return [DIVIDER, headerLine, DIVIDER, '', rendered].join('\n');
  }
}

export const taskViewService = new TaskViewService();
