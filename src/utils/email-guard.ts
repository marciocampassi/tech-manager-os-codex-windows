import inquirer from 'inquirer';
import { findSimilarEmail } from './email-similarity.js';
import { printWarning } from './display.js';

/**
 * Checks for a similar email in the vault. If found, prompts the user to
 * confirm whether they meant the existing email or want to continue with
 * the typed one. Returns the email to use — either the similar one or the
 * original. Never aborts; the caller always gets a valid email back.
 */
export async function resolveEmailWithSimilarCheck(
  email: string,
  workspaceRoot: string,
): Promise<string> {
  const similar = findSimilarEmail(email, workspaceRoot);
  if (!similar) return email;

  printWarning(`Similar email already exists: ${similar}`);
  const { useSimilar } = await inquirer.prompt<{ useSimilar: boolean }>([
    {
      type: 'confirm',
      name: 'useSimilar',
      message: `Did you mean "${similar}"? (Y = use "${similar}", N = continue with "${email}")`,
      default: false,
    },
  ]);
  return useSimilar ? similar : email;
}
