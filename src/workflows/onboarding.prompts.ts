import inquirer from 'inquirer';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { CareerGoals, LeadershipContext, ManagerProfile } from '../types/onboarding.types.js';

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
  const answers = await inquirer.prompt<{ provider: string }>([
    {
      type: 'list',
      name: 'provider',
      message: 'Select your AI provider:',
      choices: [
        { name: 'OpenAI (GPT-4o)', value: 'openai' },
        // Architecture uses 'claude' as the canonical provider key (database-schema.md)
        { name: 'Anthropic (Claude)', value: 'claude' },
        { name: 'Google (Gemini)', value: 'gemini' },
      ],
    },
  ]);
  return answers.provider;
}

export async function promptApiKey(provider: string): Promise<string> {
  const answers = await inquirer.prompt<{ apiKey: string }>([
    {
      type: 'password',
      name: 'apiKey',
      message: `Enter your ${provider} API key:`,
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
    experienceYears: number;
    managementStyle: string;
    strengths: string;
    developmentAreas: string;
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
      type: 'number',
      name: 'experienceYears',
      message: 'Years of management experience:',
      validate: (v: number): ValidateResult =>
        Number.isInteger(v) && v >= 0 ? true : 'Must be a non-negative integer',
    },
    {
      type: 'list',
      name: 'managementStyle',
      message: 'Your primary management style:',
      choices: ['Servant', 'Directive', 'Coaching', 'Democratic', 'Transformational'],
    },
    {
      type: 'input',
      name: 'strengths',
      message: 'Your key strengths (comma-separated):',
      validate: (v: string): ValidateResult =>
        v.trim().length > 0 ? true : 'Please enter at least one strength',
    },
    {
      type: 'input',
      name: 'developmentAreas',
      message: 'Your development areas (comma-separated):',
      validate: (v: string): ValidateResult =>
        v.trim().length > 0 ? true : 'Please enter at least one development area',
    },
  ]);

  return {
    name: answers.name,
    email: answers.email,
    role: answers.role,
    experienceYears: answers.experienceYears,
    managementStyle: answers.managementStyle,
    strengths: answers.strengths
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean),
    developmentAreas: answers.developmentAreas
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean),
  };
}

export async function promptCareerGoals(): Promise<CareerGoals> {
  const answers = await inquirer.prompt<CareerGoals>([
    {
      type: 'input',
      name: 'shortTerm',
      message: 'Short-term career goal (next 6 months):',
      validate: (v: string): ValidateResult =>
        v.trim().length > 0 ? true : 'Please enter a short-term goal',
    },
    {
      type: 'input',
      name: 'longTerm',
      message: 'Long-term career goal (1–3 years):',
      validate: (v: string): ValidateResult =>
        v.trim().length > 0 ? true : 'Please enter a long-term goal',
    },
    {
      type: 'input',
      name: 'targetRole',
      message: 'Target role:',
      validate: (v: string): ValidateResult =>
        v.trim().length > 0 ? true : 'Please enter a target role',
    },
  ]);
  return answers;
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
    {
      type: 'input',
      name: 'expectations',
      message: 'Key expectations from your manager:',
      validate: (v: string): ValidateResult =>
        v.trim().length > 0 ? true : 'Please enter expectations',
    },
  ]);
  return answers;
}
