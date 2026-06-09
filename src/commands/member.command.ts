import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { memberService, MemberService } from '../services/member.service.js';
import { printError, printSuccess, printInfo, printWarning } from '../utils/display.js';
import { InvalidEmailError } from '../errors/tmr-error.js';
import { resolveEmailWithSimilarCheck } from '../utils/email-guard.js';
import { validateEmail } from '../utils/validation.js';
import { resolveSelfEmail } from '../utils/self-email.js';
import type { FileType } from '../types/member.types.js';

// ── Type guard ────────────────────────────────────────────────────────────────

const VALID_TYPES: readonly FileType[] = [
  '1on1',
  'feedback',
  'assessment',
  'performance-review',
] as const;

function isFileType(value: string): value is FileType {
  return (VALID_TYPES as readonly string[]).includes(value);
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

// ── Sub-command handlers ──────────────────────────────────────────────────────

export async function runMemberAdd(
  svc: MemberService,
  typeArg: string,
  emailArg: string | undefined,
  opts: { date?: string; team?: string; location?: string; contractor?: boolean; from?: string },
): Promise<void> {
  // Routing: if first arg is a valid email → member-creation mode
  if (isEmail(typeArg)) {
    let email = typeArg.trim().toLowerCase();

    const ws = svc.getWorkspaceRoot();

    email = await resolveEmailWithSimilarCheck(email, ws);

    const { name, gender, role, location } = await inquirer.prompt<{
      name: string;
      gender: string;
      role: string;
      location?: string;
    }>(
      [
        { type: 'input', name: 'name', message: 'Name (optional):' },
        { type: 'input', name: 'gender', message: 'Gender (optional):' },
        { type: 'input', name: 'role', message: 'Role (optional):' },
        !opts.location?.trim() && {
          type: 'input',
          name: 'location',
          message: 'Location (optional):',
        },
      ].filter(Boolean) as Parameters<typeof inquirer.prompt>[0],
    );

    // ── Domain check (FR41) ───────────────────────────────────────────────────
    let isContractor = opts.contractor ?? false;
    let externalDomainForRemember = '';

    if (!isContractor) {
      const domain = email.split('@')[1] ?? '';
      let internalDomains: string[] = [];
      try {
        internalDomains = await svc.getInternalDomains(ws);
      } catch {
        // org.yaml unreadable — skip domain check, proceed without routing prompt
      }
      if (internalDomains.length > 0 && domain && !internalDomains.includes(domain)) {
        const { routing } = await inquirer.prompt<{ routing: 'contractor' | 'member' }>([
          {
            type: 'list',
            name: 'routing',
            message: `${email} looks external (${domain}). Route to:`,
            choices: [
              { name: 'Contractors  (my-company/contractors/)', value: 'contractor' },
              { name: 'Company members  (my-company/members/)', value: 'member' },
            ],
            default: 'contractor',
          },
        ]);
        isContractor = routing === 'contractor';
        if (!isContractor) externalDomainForRemember = domain;
      }
    }

    // ── Create member profile ─────────────────────────────────────────────────
    let result;
    try {
      result = await svc.addMember(
        email,
        {
          team: opts.team,
          location: opts.location?.trim() || location?.trim() || undefined,
          contractor: isContractor,
          name: name.trim() || undefined,
          gender: gender.trim() || undefined,
          role: role.trim() || undefined,
        },
        ws,
      );
    } catch (err) {
      if (err instanceof InvalidEmailError) {
        printError(`Invalid email address: ${email}`);
        return;
      }
      printError(err instanceof Error ? err.message : String(err));
      return;
    }

    if (result.created) {
      printSuccess(`Member profile created for "${email}"`);
      if (externalDomainForRemember) {
        const { remember } = await inquirer.prompt<{ remember: boolean }>([
          {
            type: 'confirm',
            name: 'remember',
            message: `Remember "${externalDomainForRemember}" as an internal domain for future members?`,
            default: false,
          },
        ]);
        if (remember) {
          await svc.appendInternalDomain(externalDomainForRemember, ws);
          printInfo(`Domain "${externalDomainForRemember}" added to config/organization.yaml`);
        }
      }
    } else {
      process.stdout.write(`${chalk.dim('ℹ')} Member profile for "${email}" already exists\n`);
    }
    return;
  }

  // Routing: type-first mode
  if (!isFileType(typeArg)) {
    // The arg is not a file-type keyword — treat it as an attempted email address
    // and surface the proper InvalidEmailError (TMR_E103) via validateEmail().
    try {
      validateEmail(typeArg);
    } catch (err) {
      if (err instanceof InvalidEmailError) {
        printError(`Invalid email address: ${typeArg}`);
        process.exitCode = 1;
        return;
      }
    }
    printError(
      `Unknown type "${typeArg}".`,
      `Valid types: ${VALID_TYPES.join(', ')}, or pass an email address to create a member profile`,
    );
    process.exitCode = 1;
    return;
  }

  const ws = svc.getWorkspaceRoot();
  let email = emailArg?.trim().toLowerCase() ?? '';
  if (!email) {
    const { resolvedEmail } = await inquirer.prompt<{ resolvedEmail: string }>([
      {
        type: 'input',
        name: 'resolvedEmail',
        message: 'Member email:',
        validate: (v: string): boolean | string =>
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) || 'Valid email required',
      },
    ]);
    email = resolvedEmail.trim().toLowerCase();
  }

  // P7: Warn immediately when --from is supplied for a type that ignores it
  if (opts.from && typeArg !== 'feedback') {
    printWarning(`--from has no effect for "${typeArg}" files and will be ignored.`);
  }

  // P12: Run similar-email guard before prompting for reviewer details
  email = await resolveEmailWithSimilarCheck(email, ws);

  // ── Resolve reviewer email for feedback files ─────────────────────────────
  let fromEmail: string | undefined;
  if (typeArg === 'feedback') {
    const rawFrom = opts.from?.trim().toLowerCase();
    if (rawFrom) {
      try {
        validateEmail(rawFrom);
      } catch (err) {
        if (err instanceof InvalidEmailError) {
          printError(`Invalid email address: ${rawFrom}`);
          process.exitCode = 1;
          return;
        }
        throw err; // P3: re-throw unexpected validation errors
      }
      fromEmail = rawFrom;
    } else {
      // P2: resolveSelfEmail catches all I/O/parsing errors internally — never throws
      const selfEmail = await resolveSelfEmail(ws);
      if (selfEmail) {
        // P4: validate format before trusting the frontmatter value
        try {
          validateEmail(selfEmail);
          fromEmail = selfEmail;
        } catch {
          printWarning(
            `Email in my-career/ profile ("${selfEmail}") is not a valid address — please enter it manually.`,
          );
        }
      }
      if (!fromEmail) {
        const { resolved } = await inquirer.prompt<{ resolved: string }>([
          {
            type: 'input',
            name: 'resolved',
            message: 'Reviewer email (--from):',
            // P5: use validateEmail for the same rules as the --from flag path
            validate: (v: string): boolean | string => {
              try {
                validateEmail(v.trim());
                return true;
              } catch (err) {
                if (err instanceof InvalidEmailError) return err.message || 'Valid email required';
                return 'Valid email required';
              }
            },
          },
        ]);
        fromEmail = resolved.trim().toLowerCase();
      }
    }
  }

  let result;
  try {
    result = await svc.createMemberFile(email, typeArg, { date: opts.date, fromEmail }, ws);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    printError(message, 'Check that the member exists: tmr team list');
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`${chalk.green('✔')} Created: ${result.filePath}\n`);
  process.stdout.write(`${chalk.dim('  Profile updated:')} ${result.profilePath}\n`);
  process.stdout.write(`${chalk.dim('  Wiki-link:')} ${result.wikiLink}\n`);
}

// ── Command factory ───────────────────────────────────────────────────────────

export function createMemberCommand(): Command {
  const svc = memberService;

  const cmd = new Command('member').description('manage member-related files');

  cmd
    .command('add <type-or-email> [email]')
    .description(
      `add a file for a team member, or create a member profile\n  type: ${VALID_TYPES.join(' | ')}\n  email: creates a member profile`,
    )
    .option('--date <date>', 'date for the file (YYYY-MM-DD), defaults to today')
    .option('--team <name>', 'scope the member profile to a team (routes to my-teams/members/)')
    .option('--location <location>', 'location field for the member profile')
    .option(
      '--contractor',
      'create profile in my-company/contractors/ for external/contractor members',
    )
    .option('--from <email>', 'reviewer email for feedback files (defaults to your own email)')
    .action(
      async (
        typeOrEmail: string,
        email: string | undefined,
        opts: {
          date?: string;
          team?: string;
          location?: string;
          contractor?: boolean;
          from?: string;
        },
      ) => {
        await runMemberAdd(svc, typeOrEmail, email, opts);
      },
    );

  return cmd;
}
