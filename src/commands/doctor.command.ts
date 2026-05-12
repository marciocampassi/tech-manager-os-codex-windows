import { Command } from 'commander';
import { DoctorService } from '../services/doctor.service.js';
import { printSuccess, printWarning, printInfo, printError, printJson } from '../utils/display.js';

const NAME_COL = 14;

export async function runDoctor(opts: {
  plain: boolean;
  json: boolean;
  tmrVersion?: string;
}): Promise<void> {
  const service = new DoctorService(opts.tmrVersion ?? '0.0.0');

  try {
    const results = await service.runChecks();
    const anyFail = results.some((r) => !r.ok && !r.info);

    if (opts.json) {
      const out: Record<string, Record<string, unknown>> = {};
      for (const r of results) {
        const entry: Record<string, unknown> = { ok: r.ok };
        if (r.info) entry['info'] = true;
        if (r.value !== undefined) {
          entry[r.key === 'nodejs' || r.key === 'tmr' ? 'version' : 'value'] = r.value;
        }
        if (r.detail !== undefined) entry['detail'] = r.detail;
        if (r.fix !== undefined) entry['fix'] = r.fix;
        out[r.key] = entry;
      }
      printJson(out);
    } else {
      for (const r of results) {
        const name = r.label.padEnd(NAME_COL);
        if (r.ok) {
          // P5: Node.js version annotation lives in display layer only, not in value/JSON
          const displayValue =
            r.key === 'nodejs' ? `${r.value ?? 'ok'}   (required ≥ 18)` : (r.value ?? 'ok');
          printSuccess(`${name}  ${displayValue}`, opts.plain);
        } else if (r.info) {
          printInfo(`${name}  ${r.detail ?? ''}`, opts.plain);
        } else {
          const fixHint = r.fix ? ` — run: ${r.fix}` : '';
          printWarning(`${name}  ${r.detail ?? 'not found'}${fixHint}`, opts.plain);
        }
      }
    }

    if (anyFail) {
      process.exitCode = 1;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    printError(msg, 'Run tmr doctor again or check your environment.', opts.plain);
    process.exitCode = 1;
  }
}

export function createDoctorCommand(tmrVersion: string): Command {
  return new Command('doctor')
    .description('check environment health — Node.js, tmr, vault, Obsidian, Granola, Google Drive')
    .addHelpText('after', '\nExamples:\n  tmr doctor\n  tmr --json doctor\n  tmr --plain doctor\n')
    .action(async (_opts: unknown, command: Command) => {
      const globals = command.parent?.opts() as { plain?: boolean; json?: boolean } | undefined;
      const plain = globals?.plain ?? false;
      const json = globals?.json ?? false;
      await runDoctor({ plain, json, tmrVersion });
    });
}
