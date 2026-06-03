import { InvalidEmailError } from '../errors/tmr-error.js';

// ── Email Validation ──────────────────────────────────────────────────────────

/**
 * Validates that `email` is a syntactically correct email address.
 * Throws `InvalidEmailError` (TMR_E103) on any invalid input — including empty
 * strings, missing `@`, missing domain, or whitespace-only strings — so that
 * callers never reach a file system operation with a bad address.
 *
 * Uses the same regex that existed in `EmailResolutionService.validateEmail`.
 */
export function validateEmail(email: string): void {
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new InvalidEmailError(email);
  }
}

// ── Domain Validation ─────────────────────────────────────────────────────────

/**
 * Returns true if `value` is a well-formed domain: non-empty, contains a dot,
 * no `@` character, and no whitespace.  Used to validate additional internal
 * domains entered at `tmr init` or via the inline "remember domain" prompt.
 */
export function isValidDomain(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length > 0 && !trimmed.includes('@') && !trimmed.includes(' ') && trimmed.includes('.')
  );
}
