import inquirer from 'inquirer';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { LeadershipContext, ManagerProfile, TeamMember } from '../types/onboarding.types.js';
import { validateEmail, isValidDomain } from '../utils/validation.js';
import { InvalidEmailError } from '../errors/tmr-error.js';

export interface MinimalOnboardingAnswers {
  name: string;
  email: string;
  role: string;
  company: string;
}

export interface GoogleDriveSetupResult {
  enabled: boolean;
  folderDriveId: string;
  clientId: string;
  clientSecret: string;
}

type ValidateResult = boolean | string;

function expandPath(p: string): string {
  return p.startsWith('~/') ? join(homedir(), p.slice(2)) : p;
}

export async function promptWorkspacePath(): Promise<string> {
  const answers = await inquirer.prompt<{ workspacePath: string }>([
    {
      type: 'input',
      name: 'workspacePath',
      message: 'Where should your workspace be created?',
      default: process.cwd(),
    },
  ]);
  return expandPath(answers.workspacePath);
}

export async function promptProviderSelection(): Promise<string> {
  process.stdout.write('\nAPI Key documentation:\n');
  process.stdout.write('  Gemini : https://ai.google.dev/gemini-api/docs/api-key?hl=pt-br\n');
  process.stdout.write('  OpenAI : https://developers.openai.com/api/docs/quickstart/\n');
  process.stdout.write('  Claude : https://platform.claude.com/docs/en/get-started\n\n');

  const answers = await inquirer.prompt<{ provider: string }>([
    {
      type: 'select',
      name: 'provider',
      message: 'Select your AI provider:',
      choices: [
        { name: 'Gemini (Google)', value: 'gemini' },
        { name: 'OpenAI (GPT-4o)', value: 'openai' },
        // Architecture uses 'claude' as the canonical provider key (database-schema.md)
        { name: 'Claude (Anthropic)', value: 'claude' },
      ],
    },
  ]);
  return answers.provider;
}

export async function promptApiKey(
  provider: string,
  attempt = 1,
  maxAttempts = 1,
): Promise<string> {
  const attemptSuffix = maxAttempts > 1 ? ` (attempt ${attempt}/${maxAttempts})` : '';
  const answers = await inquirer.prompt<{ apiKey: string }>([
    {
      type: 'password',
      name: 'apiKey',
      message: `Enter your ${provider} API key${attemptSuffix}:`,
      validate: (v: string): ValidateResult =>
        v.trim().length > 0 ? true : 'API key cannot be empty',
    },
  ]);
  return answers.apiKey;
}

export async function promptManagerProfile(): Promise<ManagerProfile> {
  const answers = await inquirer.prompt<{
    name: string;
    email: string;
    role: string;
    location: string;
  }>([
    {
      type: 'input',
      name: 'name',
      message: 'Your full name:',
      validate: (v: string): ValidateResult =>
        v.trim().length > 0 ? true : 'Name cannot be empty',
    },
    {
      type: 'input',
      name: 'email',
      message: 'Your work email:',
      validate: (v: string): ValidateResult =>
        v.includes('@') ? true : 'Must be a valid email address',
    },
    {
      type: 'input',
      name: 'role',
      message: 'Your current role/title:',
      validate: (v: string): ValidateResult =>
        v.trim().length > 0 ? true : 'Role cannot be empty',
    },
    {
      type: 'input',
      name: 'location',
      message: 'Your location (optional):',
      default: '',
    },
  ]);

  return {
    name: answers.name,
    email: answers.email,
    role: answers.role,
    ...(answers.location.trim() ? { location: answers.location.trim() } : {}),
  };
}

export async function promptLeadershipContext(): Promise<LeadershipContext> {
  const answers = await inquirer.prompt<LeadershipContext>([
    {
      type: 'input',
      name: 'managerName',
      message: "Your manager's full name:",
      validate: (v: string): ValidateResult =>
        v.trim().length > 0 ? true : 'Name cannot be empty',
    },
    {
      type: 'input',
      name: 'managerEmail',
      message: "Your manager's email:",
      validate: (v: string): ValidateResult =>
        v.includes('@') ? true : 'Must be a valid email address',
    },
  ]);
  return answers;
}

// Characters unsafe for use as filesystem directory segments.
// Real email addresses never contain these, so rejecting them is both
// a security guard and a valid email format check.
const PATH_UNSAFE_RE = /[/\\.]\.|\.\.|[/\\]/;

export async function promptTeamMembers(): Promise<TeamMember[]> {
  process.stdout.write(
    '\nNow, we are going to add your team members. Type their email one by one, when you finish just type enter.\n\n',
  );

  const members: TeamMember[] = [];
  const seenEmails = new Set<string>();

  while (true) {
    const { email } = await inquirer.prompt<{ email: string }>([
      {
        type: 'input',
        name: 'email',
        message: "Type your team member email (empty when you're done):",
        validate: (v: string): ValidateResult => {
          const trimmed = v.trim();
          if (trimmed.length === 0) return true; // exit condition — allow empty
          if (!trimmed.includes('@')) return 'Must be a valid email address';
          if (PATH_UNSAFE_RE.test(trimmed)) return 'Email contains unsafe characters';
          return true;
        },
      },
    ]);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) break;

    if (seenEmails.has(trimmedEmail)) {
      process.stdout.write(`  ⚠  ${trimmedEmail} was already added — skipping duplicate.\n`);
      continue;
    }

    const { name, gender, role, location } = await inquirer.prompt<{
      name: string;
      gender: string;
      role: string;
      location: string;
    }>([
      {
        type: 'input',
        name: 'name',
        message: 'His/her name:',
        validate: (v: string): ValidateResult =>
          v.trim().length > 0 ? true : 'Name cannot be empty',
      },
      {
        type: 'select',
        name: 'gender',
        message: 'Gender:',
        choices: ['Male', 'Female', 'Non-binary', 'Prefer not to say'],
      },
      {
        type: 'input',
        name: 'role',
        message: 'Role:',
        validate: (v: string): ValidateResult =>
          v.trim().length > 0 ? true : 'Role cannot be empty',
      },
      {
        type: 'input',
        name: 'location',
        message: 'Location (optional):',
        default: '',
      },
    ]);

    seenEmails.add(trimmedEmail);
    members.push({
      email: trimmedEmail,
      name: name.trim(),
      gender,
      role: role.trim(),
      ...(location.trim() ? { location: location.trim() } : {}),
    });
  }

  return members;
}

/**
 * Shown immediately after the user's email is collected during `tmr init`.
 * Displays the inferred domain and asks for any additional internal email domains.
 * Entries are comma-separated; each is validated with `isValidDomain()`.
 * Invalid entries cause a re-prompt with a clear error message.
 * Returns a (possibly empty) array of validated additional domains (not including the inferred one).
 */
export async function promptAdditionalDomains(inferredDomain: string): Promise<string[]> {
  process.stdout.write(`\nYour company email domain is: ${inferredDomain}\n`);

  while (true) {
    const { raw } = await inquirer.prompt<{ raw: string }>([
      {
        type: 'input',
        name: 'raw',
        message:
          'Does your company use other internal email domains?\nEnter them as a comma-separated list, or press Enter to skip:',
        default: '',
      },
    ]);

    const trimmed = raw.trim();
    if (!trimmed) return [];

    const entries = trimmed
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    if (entries.length === 0) {
      process.stdout.write('No valid domains found. Press Enter to skip or re-enter:\n');
      continue;
    }

    const invalid = entries.filter((e) => !isValidDomain(e));

    if (invalid.length > 0) {
      for (const inv of invalid) {
        process.stdout.write(
          `✖ Invalid domain: "${inv}" — domains must contain a dot and no spaces.\n`,
        );
      }
      process.stdout.write('Please re-enter:\n');
      continue;
    }

    return entries;
  }
}

export interface NameAndEmailAnswers {
  name: string;
  email: string;
}

export interface RoleAndCompanyAnswers {
  role: string;
  company: string;
}

/**
 * Prompts for the user's name and work email only.
 * Split from `promptMinimalOnboarding` so `promptAdditionalDomains` can fire
 * immediately after the email field, as specified in Story 9.4.
 */
export async function promptNameAndEmail(): Promise<NameAndEmailAnswers> {
  return inquirer.prompt<NameAndEmailAnswers>([
    {
      type: 'input',
      name: 'name',
      message: 'Your full name:',
      validate: (v: string): ValidateResult =>
        v.trim().length > 0 ? true : 'Name cannot be empty',
    },
    {
      type: 'input',
      name: 'email',
      message: 'Your work email:',
      validate: (v: string): ValidateResult => {
        try {
          validateEmail(v.trim());
          return true;
        } catch (e) {
          return e instanceof InvalidEmailError ? e.message : 'Invalid email address';
        }
      },
    },
  ]);
}

/**
 * Prompts for the user's role and company.
 * Called after `promptNameAndEmail` and `promptAdditionalDomains` so that
 * the domain prompt fires immediately after email collection.
 */
export async function promptRoleAndCompany(): Promise<RoleAndCompanyAnswers> {
  return inquirer.prompt<RoleAndCompanyAnswers>([
    {
      type: 'input',
      name: 'role',
      message: 'Your current role / title:',
      validate: (v: string): ValidateResult =>
        v.trim().length > 0 ? true : 'Role cannot be empty',
    },
    {
      type: 'input',
      name: 'company',
      message: 'Your company / domain (e.g. acme.com):',
      validate: (v: string): ValidateResult =>
        v.trim().length > 0 ? true : 'Company cannot be empty',
    },
  ]);
}

export async function promptMinimalOnboarding(): Promise<MinimalOnboardingAnswers> {
  return inquirer.prompt<MinimalOnboardingAnswers>([
    {
      type: 'input',
      name: 'name',
      message: 'Your full name:',
      validate: (v: string): ValidateResult =>
        v.trim().length > 0 ? true : 'Name cannot be empty',
    },
    {
      type: 'input',
      name: 'email',
      message: 'Your work email:',
      validate: (v: string): ValidateResult => {
        try {
          validateEmail(v.trim());
          return true;
        } catch (e) {
          return e instanceof InvalidEmailError ? e.message : 'Invalid email address';
        }
      },
    },
    {
      type: 'input',
      name: 'role',
      message: 'Your current role / title:',
      validate: (v: string): ValidateResult =>
        v.trim().length > 0 ? true : 'Role cannot be empty',
    },
    {
      type: 'input',
      name: 'company',
      message: 'Your company / domain (e.g. acme.com):',
      validate: (v: string): ValidateResult =>
        v.trim().length > 0 ? true : 'Company cannot be empty',
    },
  ]);
}

// ── Story 2.2: Leader details ──────────────────────────────────────────────────

export interface LeaderDetails {
  name: string;
  email: string;
  role: string;
}

export async function promptLeaderDetails(): Promise<LeaderDetails> {
  const result = await inquirer.prompt<LeaderDetails>([
    {
      type: 'input',
      name: 'name',
      message: "Your leader's full name:",
      validate: (v: string): ValidateResult =>
        v.trim().length > 0 ? true : 'Name cannot be empty',
    },
    {
      type: 'input',
      name: 'email',
      message: "Your leader's work email:",
      validate: (v: string): ValidateResult => {
        try {
          validateEmail(v.trim());
          return true;
        } catch (e) {
          return e instanceof InvalidEmailError ? e.message : 'Invalid email address';
        }
      },
    },
    {
      type: 'input',
      name: 'role',
      message: "Your leader's role / title:",
      validate: (v: string): ValidateResult =>
        v.trim().length > 0 ? true : 'Role cannot be empty',
    },
  ]);
  return {
    name: result.name.trim(),
    email: result.email.trim(),
    role: result.role.trim(),
  };
}

// ── Story 2.2: Team setup ──────────────────────────────────────────────────────

export async function promptTeamCount(): Promise<number> {
  const { teamCount } = await inquirer.prompt<{ teamCount: string }>([
    {
      type: 'input',
      name: 'teamCount',
      message: 'How many teams do you manage?',
      validate: (v: string): ValidateResult => {
        const trimmed = v.trim();
        if (!/^\d+$/.test(trimmed)) return 'Team count must be a positive integer (minimum 1)';
        const n = parseInt(trimmed, 10);
        if (n < 1) return 'Team count must be a positive integer (minimum 1)';
        if (n > 50) return 'Team count must be between 1 and 50';
        return true;
      },
    },
  ]);
  return parseInt(teamCount, 10);
}

export async function promptTeamName(index: number): Promise<string> {
  const { teamName } = await inquirer.prompt<{ teamName: string }>([
    {
      type: 'input',
      name: 'teamName',
      message: `Team ${index} name:`,
      validate: (v: string): ValidateResult =>
        v.trim().length > 0 ? true : 'Team name cannot be empty',
    },
  ]);
  return teamName.trim();
}

// ── Story 2.3: Member collection ──────────────────────────────────────────────

export interface MemberDetails {
  name: string;
  role: string;
  gender: string;
  location: string;
}

/**
 * Prompts for a team member's email for a given team.
 * Returns `''` (empty string) when the user presses Enter without input —
 * the caller treats this as the loop sentinel to stop adding members.
 * Non-empty input is validated with `validateEmail()`.
 */
export async function promptMemberEmail(teamName: string): Promise<string> {
  const { memberEmail } = await inquirer.prompt<{ memberEmail: string }>([
    {
      type: 'input',
      name: 'memberEmail',
      message: `Email for next ${teamName} member (leave empty to finish):`,
      validate: (v: string): ValidateResult => {
        const trimmed = v.trim();
        if (!trimmed) return true;
        if (PATH_UNSAFE_RE.test(trimmed)) return 'Email contains unsafe characters';
        try {
          validateEmail(trimmed);
          return true;
        } catch (e) {
          return e instanceof InvalidEmailError ? e.message : 'Invalid email address';
        }
      },
    },
  ]);
  return memberEmail.trim();
}

/**
 * Prompts for a team member's profile details.
 * Called only after a valid non-empty email has been collected.
 * Name and role are required; gender and location are optional.
 * All fields are trimmed on return.
 */
export async function promptMemberDetails(): Promise<MemberDetails> {
  const result = await inquirer.prompt<MemberDetails>([
    {
      type: 'input',
      name: 'name',
      message: "Member's full name:",
      validate: (v: string): ValidateResult =>
        v.trim().length > 0 ? true : 'Name cannot be empty',
    },
    {
      type: 'input',
      name: 'role',
      message: "Member's role / title:",
      validate: (v: string): ValidateResult =>
        v.trim().length > 0 ? true : 'Role cannot be empty',
    },
    {
      type: 'input',
      name: 'gender',
      message: "Member's gender (optional, press Enter to skip):",
    },
    {
      type: 'input',
      name: 'location',
      message: "Member's location (optional, press Enter to skip):",
    },
  ]);
  return {
    name: result.name.trim(),
    role: result.role.trim(),
    gender: result.gender.trim(),
    location: result.location.trim(),
  };
}

// ── Google Drive setup ────────────────────────────────────────────────────────

export async function promptGoogleDriveSetup(): Promise<GoogleDriveSetupResult> {
  process.stdout.write('\n─────────────────────────────────────────────\n');
  process.stdout.write('Google Docs Integration (Optional)\n');
  process.stdout.write('─────────────────────────────────────────────\n');
  process.stdout.write('Would you like to enable Google Docs sync for\n');
  process.stdout.write('action items? This will create a shared Google\n');
  process.stdout.write('Doc for each team member and sync changes back\n');
  process.stdout.write('to your local .md files.\n\n');
  process.stdout.write('Requires: Google account + Drive folder ID\n');
  process.stdout.write('─────────────────────────────────────────────\n');

  const { enabled } = await inquirer.prompt<{ enabled: boolean }>([
    {
      type: 'confirm',
      name: 'enabled',
      message: 'Enable Google Docs sync for action items?',
      default: false,
    },
  ]);

  if (!enabled) {
    return { enabled: false, folderDriveId: '', clientId: '', clientSecret: '' };
  }

  process.stdout.write(
    '\nTo create OAuth2 credentials, visit:\n' +
      'https://console.cloud.google.com/apis/credentials\n' +
      'Create an "OAuth client ID" of type "Desktop app".\n\n',
  );

  const answers = await inquirer.prompt<{
    folderDriveId: string;
    clientId: string;
    clientSecret: string;
  }>([
    {
      type: 'input',
      name: 'folderDriveId',
      message: 'Google Drive Team Folder ID (the folder that mirrors my-teams/_members/):',
      validate: (v: string): boolean | string =>
        v.trim().length > 0 ? true : 'Drive folder ID is required',
    },
    {
      type: 'input',
      name: 'clientId',
      message: 'Google OAuth2 Client ID:',
      validate: (v: string): boolean | string =>
        v.trim().length > 0 ? true : 'Client ID is required',
    },
    {
      type: 'password',
      name: 'clientSecret',
      message: 'Google OAuth2 Client Secret:',
      validate: (v: string): boolean | string =>
        v.trim().length > 0 ? true : 'Client secret is required',
    },
  ]);

  return {
    enabled: true,
    folderDriveId: answers.folderDriveId.trim(),
    clientId: answers.clientId.trim(),
    clientSecret: answers.clientSecret.trim(),
  };
}
