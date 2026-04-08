export type TaskPeriod = 'today' | 'this-week' | 'this-month' | 'this-quarter';

export type TaskStatus = 'todo' | 'done';

/** All valid TaskPeriod values for runtime validation of AI responses. */
export const TASK_PERIODS: ReadonlySet<TaskPeriod> = new Set<TaskPeriod>([
  'today',
  'this-week',
  'this-month',
  'this-quarter',
]);

/** Workspace-relative paths for each task period file. */
export const TASK_FILE_MAP: Record<TaskPeriod, string> = {
  today: 'my-tasks/today.md',
  'this-week': 'my-tasks/this-week.md',
  'this-month': 'my-tasks/this-month.md',
  'this-quarter': 'my-tasks/this-quarter.md',
};

/** A single actionable task extracted from inbox files by the AI. */
export interface ExtractedTask {
  description: string;
  owner: string;
  urgencyReason: string;
  period: TaskPeriod;
  status: TaskStatus;
  sourceFile: string;
}

/** Result returned by `TaskService.extractTasks()`. */
export interface TaskExtractionResult {
  tasks: ExtractedTask[];
  tasksAdded: number;
  tasksMarkedDone: number;
  filesUpdated: TaskPeriod[];
}

/** Maps each period to the raw markdown content of its current task file. */
export type ExistingTasksMap = Record<TaskPeriod, string>;

export interface ITaskViewOptions {
  plain?: boolean;
  json?: boolean;
}
