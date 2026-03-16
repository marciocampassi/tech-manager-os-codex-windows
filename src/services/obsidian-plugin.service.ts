import { join } from 'node:path';
import { fileSystemService } from './file-system.service.js';
import { logger } from '../utils/logger.js';

const OBSIDIAN_PLUGINS = [
  { id: 'obsidian-git', owner: 'Vinzent03', repo: 'obsidian-git' },
  { id: 'obsidian-granola-sync', owner: 'tomelliot', repo: 'obsidian-granola-sync' },
  { id: 'obsidian-terminal', owner: 'polyipseity', repo: 'obsidian-terminal' },
] as const;

const PLUGIN_FILES = ['main.js', 'manifest.json', 'styles.css'] as const;

const DOWNLOAD_TIMEOUT_MS = 30_000;

export class ObsidianPluginService {
  async downloadPluginFile(pluginDir: string, url: string, filename: string): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) return false;
      const buffer = Buffer.from(await res.arrayBuffer());
      await fileSystemService.writeFile(join(pluginDir, filename), buffer.toString());
      return true;
    } catch (err) {
      logger.warn(
        `Failed to download ${filename} from ${url}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  async installPlugins(workspacePath: string): Promise<void> {
    const obsidianDir = join(workspacePath, '.obsidian');

    const results = await Promise.all(
      OBSIDIAN_PLUGINS.map((plugin) => {
        const pluginDir = join(obsidianDir, 'plugins', plugin.id);
        const baseUrl = `https://github.com/${plugin.owner}/${plugin.repo}/releases/latest/download`;
        return Promise.all(
          PLUGIN_FILES.map((filename) =>
            this.downloadPluginFile(pluginDir, `${baseUrl}/${filename}`, filename),
          ),
        );
      }),
    );

    const allFailed = results.flat().every((ok) => !ok);
    if (allFailed) {
      logger.warn(
        'Obsidian plugins could not be downloaded (network unavailable). ' +
          'Install them manually from: https://obsidian.md/plugins',
      );
    }

    await fileSystemService.writeFile(
      join(obsidianDir, 'community-plugins.json'),
      JSON.stringify(OBSIDIAN_PLUGINS.map((p) => p.id)),
    );

    const appJsonPath = join(obsidianDir, 'app.json');
    if (!(await fileSystemService.exists(appJsonPath))) {
      await fileSystemService.writeFile(appJsonPath, '{}');
    }
  }
}

export const obsidianPluginService = new ObsidianPluginService();
