import { Command } from 'commander';
import { taskViewService, TaskViewService } from '../services/task-view.service.js';
import { getWorkspaceRoot } from '../utils/workspace.js';
import type { TaskPeriod, ITaskViewOptions } from '../types/task.types.js';

export async function runTaskView(
  period: TaskPeriod,
  opts: ITaskViewOptions,
  svc: TaskViewService = taskViewService,
): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  const content = await svc.readTaskFile(period, workspaceRoot);

  if (opts.json) {
    process.stdout.write(JSON.stringify({ period, content }) + '\n');
    return;
  }

  const plain = opts.plain ?? false;

  if (!content) {
    process.stdout.write(svc.formatEmptyState(period, plain) + '\n');
    return;
  }

  process.stdout.write(svc.formatDisplay(period, content, plain) + '\n');
}

export function createTaskViewCommands(): Command[] {
  const periods: Array<{ name: TaskPeriod; description: string }> = [
    { name: 'today', description: 'show tasks for today' },
    { name: 'this-week', description: 'show tasks for this week' },
    { name: 'this-month', description: 'show tasks for this month' },
    { name: 'this-quarter', description: 'show tasks for this quarter' },
  ];

  return periods.map(({ name, description }) => {
    const cmd = new Command(name).description(description);
    cmd
      .option('--plain', 'disable colors and formatting (suitable for piping)')
      .option('--json', 'output raw content as JSON { period, content }')
      .action(async (opts: ITaskViewOptions) => {
        await runTaskView(name, opts);
      });
    return cmd;
  });
}
