import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import which from 'which';
import { configService } from './config.service.js';

export interface CheckResult {
  key: string;
  label: string;
  ok: boolean;
  info?: boolean;
  value?: string;
  detail?: string;
  fix?: string;
}

export class DoctorService {
  // tmrVersion is injected by the command layer (which reads package.json at the correct
  // relative path for both source and dist environments).
  constructor(private readonly tmrVersion = '0.0.0') {}

  private get platform(): string {
    return process.platform;
  }

  private checkNodejs(): CheckResult {
    const versionStr = process.version;
    const major = parseInt(versionStr.replace('v', '').split('.')[0], 10);
    const ok = major >= 18;
    return {
      key: 'nodejs',
      label: 'Node.js',
      ok,
      value: versionStr, // P5: clean version only; display annotation added by command layer
      detail: ok ? undefined : `v${major} is below required ≥ 18`,
      fix: ok ? undefined : 'Install Node.js 18+ from https://nodejs.org',
    };
  }

  private checkTmr(): CheckResult {
    return {
      key: 'tmr',
      label: 'tmr',
      ok: true,
      value: `v${this.tmrVersion}`,
    };
  }

  private checkVault(): CheckResult {
    const vaultPath = configService.getWorkspacePath();
    if (!vaultPath || !existsSync(vaultPath)) {
      return {
        key: 'vault',
        label: 'Vault',
        ok: false,
        detail: 'not configured',
        fix: 'tmr init',
      };
    }
    return { key: 'vault', label: 'Vault', ok: true, value: vaultPath };
  }

  private async checkObsidian(): Promise<CheckResult> {
    const plat = this.platform;
    let ok: boolean;
    let fix: string;

    if (plat === 'darwin') {
      // P7: check both system-wide and per-user Applications directories
      ok =
        existsSync('/Applications/Obsidian.app') ||
        existsSync(join(homedir(), 'Applications', 'Obsidian.app'));
      fix = 'brew install --cask obsidian';
    } else if (plat === 'win32') {
      // P8: GUI apps don't register in PATH on Windows; check known install paths first
      const localAppData = process.env['LOCALAPPDATA'] ?? '';
      const appData = process.env['APPDATA'] ?? '';
      const winPaths = [
        join(localAppData, 'Programs', 'Obsidian', 'Obsidian.exe'),
        join(appData, 'Obsidian', 'Obsidian.exe'),
      ];
      ok =
        winPaths.some((p) => existsSync(p)) ||
        (await which('Obsidian', { nothrow: true })) !== null;
      fix = 'winget install Obsidian.Obsidian';
    } else {
      const found = await which('obsidian', { nothrow: true });
      ok = found !== null;
      fix = 'snap install obsidian --classic';
    }

    if (!ok) {
      return { key: 'obsidian', label: 'Obsidian', ok: false, detail: 'not found', fix };
    }
    return { key: 'obsidian', label: 'Obsidian', ok: true, value: 'installed' };
  }

  private async checkGranola(): Promise<CheckResult> {
    const plat = this.platform;

    if (plat === 'linux') {
      return {
        key: 'granola',
        label: 'Granola',
        ok: false,
        info: true,
        detail: 'not available on Linux',
      };
    }

    // P6: unknown platforms (BSD, etc.) get info, not warning
    if (plat !== 'darwin' && plat !== 'win32') {
      return {
        key: 'granola',
        label: 'Granola',
        ok: false,
        info: true,
        detail: 'not available on this platform',
      };
    }

    let ok: boolean;
    let fix: string;

    if (plat === 'darwin') {
      // P7: check both system-wide and per-user Applications directories
      ok =
        existsSync('/Applications/Granola.app') ||
        existsSync(join(homedir(), 'Applications', 'Granola.app'));
      fix = 'brew install --cask granola';
    } else {
      // win32 — P8: check known install paths first
      const localAppData = process.env['LOCALAPPDATA'] ?? '';
      const appData = process.env['APPDATA'] ?? '';
      const winPaths = [
        join(localAppData, 'Granola', 'Granola.exe'),
        join(appData, 'Granola', 'Granola.exe'),
      ];
      ok =
        winPaths.some((p) => existsSync(p)) || (await which('granola', { nothrow: true })) !== null;
      fix = 'winget install Granola.Granola';
    }

    if (!ok) {
      return { key: 'granola', label: 'Granola', ok: false, detail: 'not found', fix };
    }
    return { key: 'granola', label: 'Granola', ok: true, value: 'installed' };
  }

  private async checkGoogleDrive(): Promise<CheckResult> {
    const plat = this.platform;

    if (plat === 'linux') {
      return {
        key: 'google_drive',
        label: 'Google Drive',
        ok: false,
        info: true,
        detail: 'not available on Linux',
      };
    }

    // P6: unknown platforms get info, not warning
    if (plat !== 'darwin' && plat !== 'win32') {
      return {
        key: 'google_drive',
        label: 'Google Drive',
        ok: false,
        info: true,
        detail: 'not available on this platform',
      };
    }

    let ok: boolean;
    let fix: string;

    if (plat === 'darwin') {
      const appExists = existsSync('/Applications/Google Drive.app');
      let cloudExists = false;
      const cloudStorageDir = join(homedir(), 'Library', 'CloudStorage');
      if (existsSync(cloudStorageDir)) {
        try {
          cloudExists = readdirSync(cloudStorageDir).some((d) => d.startsWith('GoogleDrive-'));
        } catch {
          cloudExists = false;
        }
      }
      ok = appExists || cloudExists;
      fix = 'brew install --cask google-drive';
    } else {
      // win32 — P8: check known install paths first
      const localAppData = process.env['LOCALAPPDATA'] ?? '';
      const programFiles = process.env['PROGRAMFILES'] ?? '';
      const winPaths = [
        join(localAppData, 'Google', 'DriveFS', 'GoogleDriveFS.exe'),
        join(programFiles, 'Google', 'Drive File Stream', 'GoogleDriveFS.exe'),
      ];
      ok =
        winPaths.some((p) => existsSync(p)) ||
        (await which('googledrivesync', { nothrow: true })) !== null;
      fix = 'winget install Google.GoogleDrive';
    }

    if (!ok) {
      return { key: 'google_drive', label: 'Google Drive', ok: false, detail: 'not found', fix };
    }
    return { key: 'google_drive', label: 'Google Drive', ok: true, value: 'detected' };
  }

  private checkGranolaSync(vaultPath: string | undefined): CheckResult {
    // P1: Granola is not available on Linux — Granola Sync is not applicable
    if (process.platform === 'linux') {
      return {
        key: 'granola_sync',
        label: 'Granola Sync',
        ok: false,
        info: true,
        detail: 'not applicable on Linux',
      };
    }

    if (!vaultPath || !existsSync(vaultPath)) {
      return {
        key: 'granola_sync',
        label: 'Granola Sync',
        ok: false,
        detail: 'skipped (vault not configured)',
        fix: 'tmr init',
      };
    }

    const configPath = join(vaultPath, '.obsidian', 'plugins', 'granola-sync', 'data.json');

    if (!existsSync(configPath)) {
      // P3+P4: embed remediation in detail; no "run:" prefix per AC4 spec
      return {
        key: 'granola_sync',
        label: 'Granola Sync',
        ok: false,
        detail: 'plugin config missing or misconfigured — re-run tmr init to repair',
      };
    }

    try {
      const raw = readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed['customBaseFolder'] !== 'inbox') {
        // P3+P4: embed remediation in detail; no "run:" prefix per AC4 spec
        return {
          key: 'granola_sync',
          label: 'Granola Sync',
          ok: false,
          detail: 'plugin config missing or misconfigured — re-run tmr init to repair',
        };
      }
      return {
        key: 'granola_sync',
        label: 'Granola Sync',
        ok: true,
        value: 'plugin config present (inbox/)',
      };
    } catch {
      // P3+P4: embed remediation in detail; no "run:" prefix per AC4 spec
      return {
        key: 'granola_sync',
        label: 'Granola Sync',
        ok: false,
        detail: 'plugin config missing or misconfigured — re-run tmr init to repair',
      };
    }
  }

  async runChecks(): Promise<CheckResult[]> {
    const vaultPath = configService.getWorkspacePath();

    const [obsidian, granola, googleDrive] = await Promise.all([
      this.checkObsidian(),
      this.checkGranola(),
      this.checkGoogleDrive(),
    ]);

    return [
      this.checkNodejs(),
      this.checkTmr(),
      this.checkVault(),
      obsidian,
      granola,
      googleDrive,
      this.checkGranolaSync(vaultPath),
    ];
  }
}

// Singleton intentionally omits version; command layer supplies it via constructor.
export const doctorService = new DoctorService();
