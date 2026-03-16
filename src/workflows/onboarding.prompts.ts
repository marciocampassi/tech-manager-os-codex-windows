import inquirer from 'inquirer';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { LeadershipContext, ManagerProfile, TeamMember } from '../types/onboarding.types.js';

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
      default: '~/tech-leadership-workspace',
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
