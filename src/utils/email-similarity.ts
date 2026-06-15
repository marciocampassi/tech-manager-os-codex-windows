import path from 'node:path';
import * as fs from 'node:fs';

/**
 * Computes the Levenshtein edit distance between two strings.
 * Inline implementation — no external dependency.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? (dp[i - 1]?.[j - 1] ?? 0)
          : 1 + Math.min(dp[i - 1]?.[j] ?? 0, dp[i]?.[j - 1] ?? 0, dp[i - 1]?.[j - 1] ?? 0);
    }
  }
  return dp[m]?.[n] ?? 0;
}

/**
 * Scans canonical vault entity directories for existing email addresses.
 * Returns the closest match if it shares the same domain and has a local-part
 * edit distance ≤ 2 from `email`. Returns null otherwise.
 *
 * Scanned paths (post-Story-9.1 nested structure):
 *   my-teams/members/<email>/
 *   my-company/members/<email>/
 *   my-company/contractors/<email>/
 *   my-leadership/<email>/
 *   my-career/<email>.md  (flat)
 */
export function findSimilarEmail(email: string, workspaceRoot: string): string | null {
  const normalized = email.toLowerCase();
  const [localPart, domain] = normalized.split('@') as [string, string];
  if (!localPart || !domain) return null;

  const SCAN_DIRS = [
    path.join(workspaceRoot, 'my-teams', 'members'),
    path.join(workspaceRoot, 'my-company', 'members'),
    path.join(workspaceRoot, 'my-company', 'contractors'),
    path.join(workspaceRoot, 'my-leadership'),
  ];

  const candidates: string[] = [];

  for (const dir of SCAN_DIRS) {
    if (!fs.existsSync(dir)) continue;
    try {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        if (entry.includes('@')) candidates.push(entry.toLowerCase());
      }
    } catch {
      // unreadable directory — skip
    }
  }

  // my-career flat files
  const careerDir = path.join(workspaceRoot, 'my-career');
  if (fs.existsSync(careerDir)) {
    try {
      const entries = fs.readdirSync(careerDir);
      for (const entry of entries) {
        if (entry.endsWith('.md') && entry.includes('@')) {
          candidates.push(entry.replace(/\.md$/, '').toLowerCase());
        }
      }
    } catch {
      // skip
    }
  }

  let bestMatch: string | null = null;
  let bestDistance = Infinity;

  for (const candidate of candidates) {
    if (candidate === normalized) return null; // exact match — no warning needed
    const [candLocal, candDomain] = candidate.split('@') as [string, string];
    if (!candLocal || !candDomain) continue;
    if (candDomain !== domain) continue; // different domain — not a typo candidate
    // Require the local-part to start with the same character. Real typos (insertions,
    // deletions, single substitutions) almost always preserve the first letter, while
    // genuinely different names that merely share an interior substring (e.g. "carlos" vs
    // "marlon", distance 2) do not — this cuts those false positives.
    if (localPart[0] !== candLocal[0]) continue;
    const dist = levenshtein(localPart, candLocal);
    if (dist <= 2 && dist < bestDistance) {
      bestDistance = dist;
      bestMatch = candidate;
    }
  }

  return bestMatch;
}
