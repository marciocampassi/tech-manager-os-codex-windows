import { join } from 'node:path';
import { fileSystemService } from './file-system.service.js';
import { logger } from '../utils/logger.js';

export const REQUIRED_PLUGIN_IDS = [
  'obsidian-git',
  'granola-sync',
  'terminal',
  'dataview',
] as const;

export type RequiredPluginId = (typeof REQUIRED_PLUGIN_IDS)[number];

const OBSIDIAN_PLUGINS: readonly { id: RequiredPluginId; owner: string; repo: string }[] = [
  { id: 'obsidian-git', owner: 'Vinzent03', repo: 'obsidian-git' },
  { id: 'granola-sync', owner: 'tomelliot', repo: 'obsidian-granola-sync' },
  { id: 'terminal', owner: 'polyipseity', repo: 'obsidian-terminal' },
  { id: 'dataview', owner: 'blacksmithgu', repo: 'obsidian-dataview' },
];

const PLUGIN_FILES = ['main.js', 'manifest.json', 'styles.css'] as const;

const DOWNLOAD_TIMEOUT_MS = 30_000;

export class ObsidianPluginService {
  async downloadPluginFile(
    pluginDir: string,
    url: string,
    filename: string,
    optional: boolean = false,
  ): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) return false;
      const buffer = Buffer.from(await res.arrayBuffer());
      await fileSystemService.writeFile(join(pluginDir, filename), buffer.toString());
      return true;
    } catch (err) {
      if (!optional) {
        logger.warn(
          `Failed to download ${filename} from ${url}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  async installPlugins(workspacePath: string): Promise<string[]> {
    const obsidianDir = join(workspacePath, '.obsidian');
    const OPTIONAL_FILES = new Set(['styles.css']);
    const fullyFailedPlugins: string[] = [];
    const requiredCount = PLUGIN_FILES.length - OPTIONAL_FILES.size;

    await Promise.all(
      OBSIDIAN_PLUGINS.map(async (plugin) => {
        const pluginDir = join(obsidianDir, 'plugins', plugin.id);
        const baseUrl = `https://github.com/${plugin.owner}/${plugin.repo}/releases/latest/download`;

        const fileResults = await Promise.all(
          PLUGIN_FILES.map(async (filename) => {
            const isOptional = OPTIONAL_FILES.has(filename);
            const ok = await this.downloadPluginFile(
              pluginDir,
              `${baseUrl}/${filename}`,
              filename,
              isOptional,
            );
            if (!ok && isOptional) {
              logger.debug(`Optional file ${filename} not found for ${plugin.id} — skipping`);
              return true;
            }
            return ok;
          }),
        );

        const failed = fileResults.filter((ok) => !ok).length;
        if (failed === requiredCount) {
          fullyFailedPlugins.push(plugin.id);
        } else if (failed > 0) {
          logger.warn(`${failed}/${PLUGIN_FILES.length} files failed for plugin "${plugin.id}"`);
        }
      }),
    );

    await fileSystemService.writeFile(
      join(obsidianDir, 'community-plugins.json'),
      JSON.stringify(OBSIDIAN_PLUGINS.map((p) => p.id)),
    );

    const appJsonPath = join(obsidianDir, 'app.json');
    let appConfig: Record<string, unknown> = {};
    if (await fileSystemService.exists(appJsonPath)) {
      try {
        const parsed: unknown = JSON.parse(await fileSystemService.readFile(appJsonPath));
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
          appConfig = parsed as Record<string, unknown>;
        }
      } catch {
        // malformed app.json — start fresh
      }
    }
    appConfig['showUnsupportedFiles'] = true;
    await fileSystemService.writeFile(appJsonPath, JSON.stringify(appConfig, null, 2));

    try {
      await this.writeGranolaConfig(obsidianDir);
    } catch (err) {
      logger.warn(
        `Granola Sync config write failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return fullyFailedPlugins;
  }

  private async writeGranolaConfig(obsidianDir: string): Promise<void> {
    const config = {
      syncNotes: true,
      includePrivateNotes: true,
      saveAsIndividualFiles: true,
      baseFolderType: 'custom',
      customBaseFolder: 'inbox',
      filenamePattern: '{date}-{title}',
      isSyncEnabled: true,
      syncInterval: 1800,
    };
    await fileSystemService.writeFile(
      join(obsidianDir, 'plugins', 'granola-sync', 'data.json'),
      JSON.stringify(config, null, 2),
    );
  }
}

export const obsidianPluginService = new ObsidianPluginService();
