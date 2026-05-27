import type { FileSystemService } from '../services/file-system.service.js';

/**
 * Appends `entry` under the `## {sectionHeading}` section of the file at `filePath`.
 *
 * - If section exists and entry already present within it: no-op (section-scoped idempotency).
 * - If section exists and entry absent: appends after the last line of the section
 *   (before the next `##` heading or EOF).
 * - If section absent: appends `\n## {sectionHeading}\n\n{entry}\n` to end of file.
 */
export async function appendToSection(
  filePath: string,
  sectionHeading: string,
  entry: string,
  fs: FileSystemService,
): Promise<void> {
  const content = await fs.readFile(filePath);
  const sectionMarker = `## ${sectionHeading}`;
  const lines = content.split('\n');
  const sectionStart = lines.findIndex((l) => l === sectionMarker);

  if (sectionStart !== -1) {
    let insertAt = lines.length;
    for (let i = sectionStart + 1; i < lines.length; i++) {
      if (lines[i].startsWith('## ')) {
        insertAt = i;
        break;
      }
    }
    // Idempotency: check only within the section, not the whole file
    if (lines.slice(sectionStart, insertAt).includes(entry)) return;
    lines.splice(insertAt, 0, entry);
    await fs.writeFile(filePath, lines.join('\n'));
  } else {
    const suffix = `\n## ${sectionHeading}\n\n${entry}\n`;
    await fs.writeFile(filePath, content.trimEnd() + suffix);
  }
}
