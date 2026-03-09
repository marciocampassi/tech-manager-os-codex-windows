import { FileSystemService, fileSystemService } from './file-system.service.js';

/**
 * Parses and mutates markdown `##` sections in profile files.
 * Pure string transformation methods have no IO — callers control file writes.
 */
export class SectionParserService {
  constructor(private readonly _fs: FileSystemService) {}

  /**
   * Returns true if the file content contains a `## {sectionName}` heading.
   */
  findSection(content: string, sectionName: string): boolean {
    return content.split('\n').some((l) => l === `## ${sectionName}`);
  }

  /**
   * Pure function: appends `appendLine` to the named `##` section.
   * - If section exists: inserts the line at the end of that section (before the next `##`).
   * - If section is missing: creates it at the end of the file.
   * Returns the updated content string; does NOT write to disk.
   */
  appendToSection(content: string, sectionName: string, appendLine: string): string {
    const lines = content.split('\n');
    const secIdx = lines.findIndex((l) => l === `## ${sectionName}`);

    if (secIdx === -1) {
      // Section not found — append it at the end
      return content.trimEnd() + `\n\n## ${sectionName}\n\n${appendLine}\n`;
    }

    // Find where the next ## section starts (or use EOF)
    let nextSecIdx = lines.findIndex((l, i) => i > secIdx && l.startsWith('## '));
    if (nextSecIdx === -1) nextSecIdx = lines.length;

    // Slice and reassemble
    const beforeLines = lines.slice(0, nextSecIdx);
    const afterLines = lines.slice(nextSecIdx);
    const beforeStr = beforeLines.join('\n').trimEnd();
    const afterStr = afterLines.join('\n');

    return afterStr.length > 0
      ? `${beforeStr}\n${appendLine}\n\n${afterStr}`
      : `${beforeStr}\n${appendLine}\n`;
  }

  /**
   * IO method: reads file, transforms via appendToSection, writes atomically.
   */
  async appendToFile(filePath: string, sectionName: string, appendLine: string): Promise<void> {
    const content = await this._fs.readFile(filePath);
    const updated = this.appendToSection(content, sectionName, appendLine);
    await this._fs.writeFile(filePath, updated);
  }
}

export const sectionParserService = new SectionParserService(fileSystemService);
