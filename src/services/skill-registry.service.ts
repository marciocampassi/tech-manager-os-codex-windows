import * as fs from 'node:fs';
import * as https from 'node:https';
import * as path from 'node:path';

type Result<T> = { success: true; data: T } | { success: false; error: string };

export interface SkillManifestEntry {
  name: string;
  version: string;
  installedAt: string;
}

const REGISTRY_BASE_URL =
  'https://raw.githubusercontent.com/marlonvidal/tech-manager-os/main/skills';

const VERSION_COMMENT_RE = /<!--\s*version:\s*(\S+)\s*-->/;

const REQUEST_TIMEOUT_MS = 10_000;

function fetchUrl(url: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode ?? 0,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`));
    });
  });
}

function parseVersion(content: string): string {
  const match = VERSION_COMMENT_RE.exec(content);
  return match ? match[1] : '0.0.0';
}

export class SkillRegistryService {
  private readonly skillsDir: string;
  private readonly manifestPath: string;

  constructor(private readonly workspaceRoot: string) {
    this.skillsDir = path.join(workspaceRoot, '.claude', 'skills');
    this.manifestPath = path.join(this.skillsDir, 'skill-manifest.json');
  }

  getRegistryUrl(skillName: string): string {
    return `${REGISTRY_BASE_URL}/${skillName}/SKILL.md`;
  }

  getRegistryIndexUrl(): string {
    return `${REGISTRY_BASE_URL}/index.json`;
  }

  async fetchSkillList(): Promise<Result<string[]>> {
    const url = this.getRegistryIndexUrl();
    let response: { statusCode: number; body: string };
    try {
      response = await fetchUrl(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Network error: ${msg}` };
    }

    if (response.statusCode === 404) {
      return { success: false, error: 'Skill registry index not found' };
    }
    if (response.statusCode !== 200) {
      return {
        success: false,
        error: `Registry returned status ${response.statusCode} for skill index`,
      };
    }

    try {
      const parsed: unknown = JSON.parse(response.body);
      if (!Array.isArray(parsed)) {
        return { success: false, error: 'Malformed registry response: expected JSON array' };
      }
      const nonStrings = parsed.filter((el) => typeof el !== 'string');
      if (nonStrings.length > 0) {
        return {
          success: false,
          error: `Malformed registry response: array contains non-string elements`,
        };
      }
      return { success: true, data: parsed as string[] };
    } catch {
      return { success: false, error: 'Malformed registry response: invalid JSON' };
    }
  }

  async fetchSkillContent(
    skillName: string,
  ): Promise<Result<{ content: string; version: string }>> {
    const url = this.getRegistryUrl(skillName);
    let response: { statusCode: number; body: string };
    try {
      response = await fetchUrl(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Network error: ${msg}` };
    }

    if (response.statusCode === 404) {
      return { success: false, error: `Skill "${skillName}" not found in registry` };
    }
    if (response.statusCode !== 200) {
      return {
        success: false,
        error: `Registry returned status ${response.statusCode} for skill "${skillName}"`,
      };
    }

    const content = response.body;
    const version = parseVersion(content);
    return { success: true, data: { content, version } };
  }

  readManifest(): SkillManifestEntry[] {
    if (!fs.existsSync(this.manifestPath)) {
      return [];
    }
    try {
      const raw = fs.readFileSync(this.manifestPath, 'utf8');
      return JSON.parse(raw) as SkillManifestEntry[];
    } catch {
      return [];
    }
  }

  writeManifest(entries: SkillManifestEntry[]): void {
    fs.mkdirSync(this.skillsDir, { recursive: true });
    fs.writeFileSync(this.manifestPath, JSON.stringify(entries, null, 2), 'utf8');
  }

  isInstalled(skillName: string): boolean {
    return this.readManifest().some((e) => e.name === skillName);
  }

  getInstalledVersion(skillName: string): string | undefined {
    return this.readManifest().find((e) => e.name === skillName)?.version;
  }

  installSkill(skillName: string, content: string, version: string): void {
    const skillDir = path.join(this.skillsDir, skillName);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content, 'utf8');

    const entries = this.readManifest().filter((e) => e.name !== skillName);
    entries.push({ name: skillName, version, installedAt: new Date().toISOString() });
    this.writeManifest(entries);
  }

  listInstalledSkills(): SkillManifestEntry[] {
    return this.readManifest();
  }
}
