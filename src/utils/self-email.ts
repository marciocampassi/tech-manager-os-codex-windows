import path from 'node:path';
import * as fs from 'node:fs';
import matter from 'gray-matter';

/**
 * Resolves the application user's own email from the `my-career/` directory.
 * Reads the first `.md` file found alphabetically (flat structure — one profile per vault)
 * and extracts the `email` field from the YAML frontmatter.
 *
 * Returns `null` if the directory does not exist, is empty, the file has no `email` field,
 * or any I/O or parsing error occurs.
 *
 * When multiple `.md` files are present, a console warning is emitted and the
 * first file alphabetically is used (matching the behaviour of `_resolveManagerLink`).
 */
export async function resolveSelfEmail(workspaceRoot: string): Promise<string | null> {
  const careerDir = path.join(workspaceRoot, 'my-career');
  try {
    if (!fs.existsSync(careerDir)) return null;
    const allFiles = fs
      .readdirSync(careerDir)
      .filter((f) => f.endsWith('.md'))
      .sort();
    if (allFiles.length === 0) return null;
    if (allFiles.length > 1) {
      process.stderr.write(
        `Warning: multiple profiles found in my-career/ — using "${allFiles[0]}" for self-email resolution.\n`,
      );
    }
    const content = await fs.promises.readFile(path.join(careerDir, allFiles[0]), 'utf8');
    const { data } = matter(content);
    if (typeof data['email'] !== 'string') return null;
    const trimmed = data['email'].trim().toLowerCase();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}
