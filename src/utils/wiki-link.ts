import path from 'node:path';

// ── Wiki-Link Formatting ──────────────────────────────────────────────────────

/**
 * Produces an Obsidian wiki-link that anchors `resolvedPath` relative to the
 * file being written (`fromPath`). Path separators are normalized to `/` on all
 * platforms so the output is always valid Obsidian syntax.
 *
 * @param resolvedPath - Absolute path to the target entity file (e.g. the member profile).
 * @param fromPath     - Absolute path to the file that will contain the link.
 * @param displayName  - Text shown inside the link (e.g. the entity email address).
 * @returns `[[relative/path/to/file.md|displayName]]`
 *
 * Examples:
 *   formatWikiLink('/ws/my-teams/members/a@b.com.md', '/ws/my-leadership/a@b.com/a@b.com.md', 'a@b.com')
 *     → '[[../../my-teams/members/a@b.com.md|a@b.com]]'
 *   formatWikiLink('/ws/members/a@b.com.md', '/ws/members/report.md', 'a@b.com')
 *     → '[[a@b.com.md|a@b.com]]'
 */
export function formatWikiLink(
  resolvedPath: string,
  fromPath: string,
  displayName: string,
): string {
  const rel = path.relative(path.dirname(fromPath), resolvedPath);
  const normalizedRel = rel.split(path.sep).join('/');
  return `[[${normalizedRel}|${displayName}]]`;
}
