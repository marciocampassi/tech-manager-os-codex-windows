import { Command } from 'commander';
import { DoctorService } from '../services/doctor.service.js';
import { configService } from '../services/config.service.js';
import { printSuccess, printWarning, printInfo, printError, printJson } from '../utils/display.js';

const NAME_COL = 14;

export async function runDoctor(opts: {
  plain: boolean;
  json: boolean;
  tmrVersion?: string;
  fixFrontmatter?: boolean;
}): Promise<void> {
  const service = new DoctorService(opts.tmrVersion ?? '0.0.0');

  try {
    if (opts.fixFrontmatter) {
      const ws = configService.getWorkspacePath();
      if (!ws) {
        if (opts.json) {
          printJson({
            error: 'no vault configured',
            scanned: 0,
            migrated: 0,
            renamed: 0,
            skipped: 0,
          });
        } else {
          printWarning('No vault configured — run tmr init first.', opts.plain);
        }
        process.exitCode = 1;
        return;
      }
      const summary = await service.migrateFrontmatter(ws);
      if (opts.json) {
        printJson(summary);
        return;
      }
      const upToDate = summary.scanned - summary.migrated - summary.skipped;
      const skippedNote =
        summary.skipped > 0 ? `, ${summary.skipped} skipped (unreadable/invalid)` : '';
      printSuccess(
        `Scanned ${summary.scanned} profiles, migrated ${summary.migrated} ` +
          `(${upToDate} already up to date${skippedNote}). ` +
          `Renamed 'manager'→'current_manager' on ${summary.renamed} profiles.`,
        opts.plain,
      );
      return;
    }

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

      // Story 9.36: warn when the vault still has legacy body-style wiki-links.
      const ws = configService.getWorkspacePath();
      if (ws) {
        const legacy = await service.detectLegacyBodyLinks(ws);
        if (legacy > 0) {
          printWarning(
            `${legacy} profiles contain legacy body-style wiki-links.\n` +
              '  Run `tmr doctor --fix-frontmatter` to migrate them to frontmatter.\n' +
              '  Without migration, `tmr team list`, `tmr project list`, and similar\n' +
              '  commands will show empty results.',
            opts.plain,
          );
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
    .option('--fix-frontmatter', 'migrate legacy body-style wiki-links into frontmatter')
    .addHelpText(
      'after',
      '\nExamples:\n  tmr doctor\n  tmr --json doctor\n  tmr --plain doctor\n  tmr doctor --fix-frontmatter\n',
    )
    .action(async (localOpts: { fixFrontmatter?: boolean }, command: Command) => {
      const globals = command.parent?.opts() as { plain?: boolean; json?: boolean } | undefined;
      const plain = globals?.plain ?? false;
      const json = globals?.json ?? false;
      await runDoctor({ plain, json, tmrVersion, fixFrontmatter: localOpts?.fixFrontmatter });
    });
}
