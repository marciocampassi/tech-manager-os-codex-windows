import path from 'node:path';
import type { AIProvider } from '../providers/ai-provider.interface.js';
import { FileSystemService, FileSystemError } from './file-system.service.js';
import type { InboxFile } from '../types/inbox.types.js';
import {
  TASK_PERIODS,
  TASK_FILE_MAP,
  type TaskPeriod,
  type ExtractedTask,
  type TaskExtractionResult,
  type ExistingTasksMap,
} from '../types/task.types.js';

type Result<T> = { success: true; data: T } | { success: false; error: string };

/** Raw AI task payload before sourceFile is injected. */
type RawAITask = {
  description: string;
  owner: string;
  urgencyReason: string;
  period: TaskPeriod;
  status: 'todo';
  sourceFile?: string;
};

/** Full AI response payload. */
type RawAIPayload = {
  tasks: RawAITask[];
  completedDescriptions: string[];
};

export const TASK_EXTRACTION_SYSTEM_PROMPT = `You are a task extraction assistant for an engineering manager's workspace.
Analyze the provided meeting notes and inbox files. Your job is to:
1. Extract all actionable tasks and classify them by urgency
2. Identify any tasks from the existing task list mentioned as completed

Respond with ONLY a valid JSON object — no markdown, no explanation, no code fences.
The JSON must have this exact structure:
{
  "tasks": [
    {
      "description": "clear actionable task description",
      "owner": "person name or email responsible",
      "urgencyReason": "why this urgency level",
      "period": "today|this-week|this-month|this-quarter",
      "status": "todo",
      "sourceFile": "path/to/source/file"
    }
  ],
  "completedDescriptions": ["partial text matching an existing task that was mentioned as done"]
}

Classification rules:
- "today": Urgent items, "ASAP", "end of day", explicit today deadlines, overdue
- "this-week": "this week", "by Friday", "soon", week-level deadlines
- "this-month": Monthly goals, "end of month", month-level deadlines
- "this-quarter": Quarterly objectives, "this quarter", longer-horizon goals

Rules:
- "tasks" must be an array (empty if no tasks found)
- "completedDescriptions" must be an array (empty if no completions mentioned)
- "status" must always be "todo" for new tasks
- "period" must be one of the exact values listed above
- "owner" should be the email address if known, or the person's name if only name is available
- "description" should be concise and actionable (imperative mood: "Review PR", "Send update")
- "sourceFile" should match the file path provided in the prompt for the file containing this task
- Only extract tasks that require the manager or a team member to take an action
- Do NOT extract tasks that are already noted as complete in the current notes`;

// ── Runtime type-guards ───────────────────────────────────────────────────────

function isValidPeriod(v: unknown): v is TaskPeriod {
  return typeof v === 'string' && TASK_PERIODS.has(v as TaskPeriod);
}

function isRawAITask(v: unknown): v is RawAITask {
  if (typeof v !== 'object' || v === null) return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t['description'] === 'string' &&
    typeof t['owner'] === 'string' &&
    typeof t['urgencyReason'] === 'string' &&
    isValidPeriod(t['period']) &&
    t['status'] === 'todo'
  );
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((item) => typeof item === 'string');
}

function isRawAIPayload(obj: unknown): obj is RawAIPayload {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    Array.isArray(o['tasks']) &&
    o['tasks'].every(isRawAITask) &&
    isStringArray(o['completedDescriptions'])
  );
}

// ── TaskService ───────────────────────────────────────────────────────────────

export class TaskService {
  constructor(
    private readonly _ai: AIProvider,
    private readonly _fs: FileSystemService,
  ) {}

  /**
   * Reads all 4 period task files. Absent or unreadable files are represented
   * as empty strings — load errors are silenced per-period so one missing file
   * does not block the whole extraction run.
   */
  private async _loadExistingTasks(workspaceRoot: string): Promise<ExistingTasksMap> {
    const result: ExistingTasksMap = {
      today: '',
      'this-week': '',
      'this-month': '',
      'this-quarter': '',
    };
    for (const period of TASK_PERIODS as ReadonlySet<TaskPeriod>) {
      try {
        const filePath = path.join(workspaceRoot, TASK_FILE_MAP[period]);
        result[period] = await this._fs.readFile(filePath);
      } catch {
        // Absent file → empty string; continue
      }
    }
    return result;
  }

  /**
   * Builds the user-facing prompt combining existing task file contents with
   * the inbox file(s) to process.
   */
  private _buildPrompt(files: InboxFile[], existingTasks: ExistingTasksMap): string {
    const sections: string[] = [
      'Existing tasks by period:',
      '',
      '## TODAY',
      existingTasks['today'] || '(empty)',
      '',
      '## THIS WEEK',
      existingTasks['this-week'] || '(empty)',
      '',
      '## THIS MONTH',
      existingTasks['this-month'] || '(empty)',
      '',
      '## THIS QUARTER',
      existingTasks['this-quarter'] || '(empty)',
      '',
      '---',
      'Inbox files to process:',
      '',
    ];

    files.forEach((file, idx) => {
      sections.push(`### File ${idx + 1}: ${file.filepath}`);
      sections.push(file.content);
      sections.push('');
    });

    return sections.join('\n');
  }

  /**
   * Parses and validates the raw AI JSON string.
   * Strips markdown code fences (```json...```) before parsing.
   */
  private _parseAIResponse(raw: string): Result<RawAIPayload> {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      const lines = cleaned.split('\n');
      const lastLine = lines[lines.length - 1]?.trim();
      cleaned = lines.slice(1, lastLine === '```' ? -1 : undefined).join('\n');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return { success: false, error: `AI returned invalid JSON: ${raw.slice(0, 120)}` };
    }

    if (!isRawAIPayload(parsed)) {
      return {
        success: false,
        error: 'AI response missing required fields or contains invalid types',
      };
    }

    return { success: true, data: parsed };
  }

  /**
   * Formats a single extracted task as a markdown list item for appending to
   * a task period file.
   */
  private _formatTask(task: ExtractedTask): string {
    return `\n- [ ] **${task.description}** — ${task.owner}\n  - Urgency: ${task.urgencyReason}\n  - Source: ${task.sourceFile}`;
  }

  /**
   * Scans `content` for task lines matching each completed description
   * (case-insensitive partial match on the `- [ ] **...**` line) and
   * replaces `- [ ]` with `- [x]` for the first match per description.
   */
  private _markCompletedInContent(
    content: string,
    completedDescriptions: string[],
  ): { updated: string; markedCount: number } {
    let result = content;
    let markedCount = 0;

    for (const desc of completedDescriptions) {
      const lower = desc.toLowerCase();
      const lines = result.split('\n');
      let replaced = false;

      const updated = lines.map((line) => {
        if (!replaced && line.startsWith('- [ ] **') && line.toLowerCase().includes(lower)) {
          replaced = true;
          markedCount++;
          return line.replace('- [ ] **', '- [x] **');
        }
        return line;
      });

      result = updated.join('\n');
    }

    return { updated: result, markedCount };
  }

  /**
   * Extracts actionable tasks from `files`, merges them into the
   * `my-tasks/{period}.md` files in `workspaceRoot`, and marks any
   * previously-listed tasks that are mentioned as complete.
   *
   * - Returns `{ success: false }` if the AI call fails or returns invalid JSON.
   * - Individual file-write errors are propagated as `{ success: false }`.
   */
  async extractTasks(
    files: InboxFile[],
    workspaceRoot: string,
  ): Promise<Result<TaskExtractionResult>> {
    if (files.length === 0) {
      return {
        success: true,
        data: { tasks: [], tasksAdded: 0, tasksMarkedDone: 0, filesUpdated: [] },
      };
    }

    // ── 1. Load existing task file contents ───────────────────────────────────
    const existingTasks = await this._loadExistingTasks(workspaceRoot);

    // ── 2. Build prompt and call AI ───────────────────────────────────────────
    const prompt = this._buildPrompt(files, existingTasks);

    let raw: string;
    try {
      raw = await this._ai.generateText(prompt, {
        systemPrompt: TASK_EXTRACTION_SYSTEM_PROMPT,
        maxTokens: 2048,
      });
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'AI provider request failed',
      };
    }

    // ── 3. Parse and validate AI response ────────────────────────────────────
    const parsed = this._parseAIResponse(raw);
    if (!parsed.success) return parsed;

    const { tasks: rawTasks, completedDescriptions } = parsed.data;
    const fallbackSource = files[0]?.filepath ?? '';

    // ── 4. Normalise tasks (inject sourceFile when absent) ───────────────────
    const tasks: ExtractedTask[] = rawTasks.map((t) => ({
      description: t.description,
      owner: t.owner,
      urgencyReason: t.urgencyReason,
      period: t.period,
      status: 'todo' as const,
      sourceFile: t.sourceFile ?? fallbackSource,
    }));

    // ── 5. Group new tasks by period and append to files ─────────────────────
    const byPeriod: Partial<Record<TaskPeriod, ExtractedTask[]>> = {};
    for (const task of tasks) {
      (byPeriod[task.period] ??= []).push(task);
    }

    const filesUpdated = new Set<TaskPeriod>();

    for (const [period, periodTasks] of Object.entries(byPeriod) as [
      TaskPeriod,
      ExtractedTask[],
    ][]) {
      const filePath = path.join(workspaceRoot, TASK_FILE_MAP[period]);
      const toAppend = periodTasks.map((t) => this._formatTask(t)).join('');
      try {
        await this._fs.appendFile(filePath, toAppend);
        filesUpdated.add(period);
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : `Failed to write task file: ${period}`,
        };
      }
    }

    // ── 6. Mark completed tasks ───────────────────────────────────────────────
    let totalMarkedDone = 0;

    if (completedDescriptions.length > 0) {
      for (const period of TASK_PERIODS as ReadonlySet<TaskPeriod>) {
        const filePath = path.join(workspaceRoot, TASK_FILE_MAP[period]);
        let content: string;
        try {
          content = await this._fs.readFile(filePath);
        } catch (err) {
          if (err instanceof FileSystemError) continue; // file absent — nothing to mark
          return {
            success: false,
            error: err instanceof Error ? err.message : `Failed to read task file: ${period}`,
          };
        }

        const { updated, markedCount } = this._markCompletedInContent(
          content,
          completedDescriptions,
        );
        if (markedCount > 0) {
          try {
            await this._fs.writeFile(filePath, updated);
            filesUpdated.add(period);
            totalMarkedDone += markedCount;
          } catch (err) {
            return {
              success: false,
              error:
                err instanceof Error ? err.message : `Failed to write completed tasks: ${period}`,
            };
          }
        }
      }
    }

    return {
      success: true,
      data: {
        tasks,
        tasksAdded: tasks.length,
        tasksMarkedDone: totalMarkedDone,
        filesUpdated: Array.from(filesUpdated),
      },
    };
  }
}

// No singleton export: TaskService requires an AIProvider that varies by user
// configuration. Story 3.6 (tmr process) constructs it with the active provider.
