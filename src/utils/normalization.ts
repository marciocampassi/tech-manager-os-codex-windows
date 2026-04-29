// ── Slug Normalization ────────────────────────────────────────────────────────

/**
 * Converts any entity name to a lowercase, hyphen-separated slug.
 * Spaces and underscores are replaced with hyphens; all other characters
 * are lowercased. The function is idempotent: already-normalized slugs
 * pass through unchanged.
 *
 * Examples:
 *   "Backend Team"     → "backend-team"
 *   "FRONTEND"         → "frontend"
 *   "my-team"          → "my-team"
 *   "Data_Science Team"→ "data-science-team"
 */
export function normalizeSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}
