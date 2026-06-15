import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import which from 'which';
import matter from 'gray-matter';
import { configService } from './config.service.js';
import { FileSystemService, fileSystemService } from './file-system.service.js';
import { REQUIRED_PLUGIN_IDS } from './obsidian-plugin.service.js';

export interface CheckResult {
  key: string;
  label: string;
  ok: boolean;
  info?: boolean;
  value?: string;
  detail?: string;
  fix?: string;
}

/** Result of a `tmr doctor --fix-frontmatter` run. */
export interface MigrationSummary {
  scanned: number;
  migrated: number;
  renamed: number;
  /** Files that could not be read or parsed (e.g. malformed YAML) and were skipped. */
  skipped: number;
}

/** Result of a `tmr doctor --prune-links` run. */
export interface LinkRepairSummary {
  scanned: number;
  /** Files that had at least one dangling link removed (and were rewritten). */
  repaired: number;
  /** Total dangling link entries removed across all files. */
  removed: number;
  /** Files that could not be read or parsed (e.g. malformed YAML) and were skipped. */
  skipped: number;
}

/**
 * Frontmatter relation arrays whose wiki-link entries are checked for dangling targets by
 * `tmr doctor --prune-links`. Scoped to structural/reciprocal relations (decision #7 vocabulary);
 * scalar relations (`current_manager`) and non-selected arrays are intentionally excluded.
 */
export const REPAIRABLE_RELATION_KEYS: ReadonlyArray<string> = [
  'direct_reports',
  'leadership',
  'members',
  'stakeholders',
  'projects',
  'teams',
];

const WIKILINK_VALUE = /^\s*\[\[([^\]]+?)\]\]\s*$/;

/**
 * Extracts the target path from a frontmatter wiki-link value (`[[target|display]]` or
 * `[[target]]`). Returns null for any non-wiki-link string (which must never be pruned).
 */
export function parseWikiLinkTarget(value: string): string | null {
  const m = value.match(WIKILINK_VALUE);
  if (!m) return null;
  const inner = m[1];
  const pipe = inner.indexOf('|');
  const target = (pipe === -1 ? inner : inner.slice(0, pipe)).trim();
  return target === '' ? null : target;
}

// ── Frontmatter migration helpers (Story 9.36) ────────────────────────────────
//
// Pure, IO-free transforms used by DoctorService.migrateFrontmatter /
// detectLegacyBodyLinks. Each returns the rewritten content plus flags:
//   - `changed`: any migration happened (incl. dated `last_<type>` scalar) → write + count migrated
//   - `legacy`:  a structural/key/deprecated body link was present → counts toward the warning
//     (dated `## 1on1s` etc. are intentionally NOT legacy — they stay in body, decision #2)

interface MigrationOutcome {
  content: string;
  changed: boolean;
  legacy: boolean;
  renamed: boolean;
}

/** Structural body sections lifted into frontmatter (decision #7 vocabulary). */
const STRUCTURAL_SECTIONS: ReadonlyArray<{ section: string; key: string; scalar: boolean }> = [
  { section: 'Current Manager', key: 'current_manager', scalar: true },
  { section: 'Previous Managers', key: 'previous_manager', scalar: false },
  { section: 'Leadership', key: 'leadership', scalar: false },
  { section: 'Other Leaderships', key: 'other_leaderships', scalar: false },
  { section: 'Projects', key: 'projects', scalar: false },
  { section: 'Direct Reports', key: 'direct_reports', scalar: false },
];

/** Dated body sections: body stays put; only the `last_<type>` scalar is computed. */
const DATED_SECTIONS: ReadonlyArray<{ section: string; scalar: string }> = [
  { section: '1on1s', scalar: 'last_1on1' },
  { section: 'Feedbacks', scalar: 'last_feedback' },
  { section: 'Assessments', scalar: 'last_assessment' },
  { section: 'Performance Reviews', scalar: 'last_performance_review' },
];

const WIKILINK_BULLET = /^-\s*(\[\[.+?\]\])/;
const DATE_TOKEN_G = /\d{4}-\d{2}(?:-\d{2})?/g;

function headingOf(line: string): { level: number; name: string } | null {
  const m = line.match(/^(#{1,6})\s+(.*)$/);
  return m ? { level: m[1].length, name: m[2].trim() } : null;
}

/** Largest `YYYY-MM[-DD]` token on a line (ISO sorts lexicographically), or null. */
function maxDateOnLine(line: string): string | null {
  const tokens = line.match(DATE_TOKEN_G);
  return tokens ? tokens.reduce((a, b) => (b > a ? b : a)) : null;
}

/**
 * Normalizes an existing frontmatter date value to a `YYYY-MM-DD` string for comparison.
 * gray-matter parses unquoted full dates into JS `Date` objects, so a raw `!==` against a
 * date string is always true; this keeps the dated-scalar migration idempotent.
 */
function dateToken(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string') return value;
  return undefined;
}

function mergeArray(data: Record<string, unknown>, key: string, links: string[]): void {
  let existing: string[];
  if (Array.isArray(data[key])) {
    existing = (data[key] as string[]).slice();
  } else if (typeof data[key] === 'string' && (data[key] as string).trim() !== '') {
    // Preserve a legacy scalar value sitting at an array key instead of discarding it.
    existing = [data[key] as string];
  } else {
    existing = [];
  }
  for (const l of links) if (!existing.includes(l)) existing.push(l);
  data[key] = existing;
}

/**
 * Migrates a single entity profile (self / member / leadership / company / contractor / archived):
 * lifts structural `## Section` body wiki-links into frontmatter, renames `manager`→`current_manager`,
 * strips deprecated `action_items_gdoc` + body `## Action Items` line, and sets `last_<type>` scalars
 * from the latest date in each dated section (whose body links are left untouched).
 */
export function migrateProfileContent(raw: string): MigrationOutcome {
  const parsed = matter(raw);
  const data = { ...(parsed.data as Record<string, unknown>) };
  let changed = false;
  let legacy = false;
  let renamed = false;

  // Legacy frontmatter: rename `manager` → `current_manager`, strip `action_items_gdoc`.
  // Only migrate when `manager` holds a usable non-empty string; a non-string value
  // (e.g. an unquoted `manager: [[x]]` that YAML parses into a nested array) is left
  // untouched rather than silently deleted, to avoid data loss.
  if (Object.prototype.hasOwnProperty.call(data, 'manager')) {
    const mgr = data['manager'];
    if (typeof mgr === 'string' && mgr.trim() !== '') {
      const cur = data['current_manager'];
      if (cur === undefined || cur === '') data['current_manager'] = mgr;
      delete data['manager'];
      changed = true;
      legacy = true;
      renamed = true;
    }
  }
  if (Object.prototype.hasOwnProperty.call(data, 'action_items_gdoc')) {
    delete data['action_items_gdoc'];
    changed = true;
    legacy = true;
  }

  const structural = new Map(STRUCTURAL_SECTIONS.map((s) => [s.section, s]));
  const dated = new Map(DATED_SECTIONS.map((s) => [s.section, s]));
  const collected = new Map<string, string[]>();
  const datedMax = new Map<string, string>();

  const outLines: string[] = [];
  let current: string | null = null;
  let kind: 'structural' | 'dated' | 'actionItems' | 'other' = 'other';

  for (const line of parsed.content.split('\n')) {
    const h = headingOf(line);
    if (h) {
      current = h.level === 2 ? h.name : null;
      if (current && structural.has(current)) kind = 'structural';
      else if (current && dated.has(current)) kind = 'dated';
      else if (current === 'Action Items') kind = 'actionItems';
      else kind = 'other';
      outLines.push(line); // keep header (even when emptied)
      continue;
    }

    const bullet = line.match(WIKILINK_BULLET);

    if (kind === 'structural' && bullet) {
      const arr = collected.get(current as string) ?? [];
      arr.push(bullet[1]);
      collected.set(current as string, arr);
      changed = true;
      legacy = true;
      continue; // strip line
    }
    if (kind === 'actionItems' && /^-\s*\[\[action-items-/.test(line)) {
      changed = true;
      legacy = true;
      continue; // strip deprecated line
    }
    if (kind === 'dated' && bullet) {
      const d = maxDateOnLine(line);
      if (d) {
        const prev = datedMax.get(current as string);
        if (!prev || d > prev) datedMax.set(current as string, d);
      }
      outLines.push(line); // dated body links stay put
      continue;
    }
    outLines.push(line);
  }

  for (const { section, key, scalar } of STRUCTURAL_SECTIONS) {
    const links = collected.get(section);
    if (!links || links.length === 0) continue;
    if (scalar) {
      const cur = data[key];
      if (cur === undefined || cur === '') data[key] = links[0];
    } else {
      mergeArray(data, key, links);
    }
  }

  for (const { section, scalar } of DATED_SECTIONS) {
    const max = datedMax.get(section);
    if (!max) continue;
    // Fill if absent, upgrade if the body has a newer date, never downgrade a newer
    // existing scalar — and normalize Date↔string so re-runs are idempotent (AC5).
    const existing = dateToken(data[scalar]);
    if (existing === undefined || max > existing) {
      data[scalar] = max;
      changed = true;
    }
  }

  if (!changed) return { content: raw, changed: false, legacy: false, renamed: false };
  return { content: matter.stringify(outLines.join('\n'), data), changed: true, legacy, renamed };
}

/** Migrates a team roster file: `# Team Members` body link list → frontmatter `members` array. */
export function migrateRosterContent(raw: string): MigrationOutcome {
  const parsed = matter(raw);
  const data = { ...(parsed.data as Record<string, unknown>) };
  const links: string[] = [];
  const outLines: string[] = [];
  let inMembers = false;
  for (const line of parsed.content.split('\n')) {
    const h = headingOf(line);
    if (h) {
      // Scope to the Team Members section so links in other sections are never absorbed.
      inMembers = h.name === 'Team Members';
      outLines.push(line);
      continue;
    }
    const bullet = line.match(WIKILINK_BULLET);
    if (inMembers && bullet) {
      links.push(bullet[1]);
      continue;
    }
    outLines.push(line);
  }
  if (links.length === 0) return { content: raw, changed: false, legacy: false, renamed: false };
  mergeArray(data, 'members', links);
  return {
    content: matter.stringify(outLines.join('\n'), data),
    changed: true,
    legacy: true,
    renamed: false,
  };
}

/** Migrates a project overview: body `# Team Members` / `# Stakeholders` link lists → frontmatter. */
export function migrateProjectContent(raw: string): MigrationOutcome {
  const parsed = matter(raw);
  const data = { ...(parsed.data as Record<string, unknown>) };
  const map: Record<string, 'members' | 'stakeholders'> = {
    'Team Members': 'members',
    Stakeholders: 'stakeholders',
  };
  const collected: Record<'members' | 'stakeholders', string[]> = { members: [], stakeholders: [] };
  const outLines: string[] = [];
  let currentKey: 'members' | 'stakeholders' | null = null;

  for (const line of parsed.content.split('\n')) {
    const h = headingOf(line);
    if (h) {
      currentKey = map[h.name] ?? null;
      outLines.push(line);
      continue;
    }
    const bullet = line.match(WIKILINK_BULLET);
    if (currentKey && bullet) {
      collected[currentKey].push(bullet[1]);
      continue;
    }
    outLines.push(line);
  }

  if (collected.members.length === 0 && collected.stakeholders.length === 0) {
    return { content: raw, changed: false, legacy: false, renamed: false };
  }
  if (collected.members.length > 0) mergeArray(data, 'members', collected.members);
  if (collected.stakeholders.length > 0) mergeArray(data, 'stakeholders', collected.stakeholders);
  return {
    content: matter.stringify(outLines.join('\n'), data),
    changed: true,
    legacy: true,
    renamed: false,
  };
}

export class DoctorService {
  // tmrVersion is injected by the command layer (which reads package.json at the correct
  // relative path for both source and dist environments).
  // _fs is injected for the async frontmatter-migration methods (Story 9.36); the legacy
  // synchronous health checks continue to use node:fs directly.
  constructor(
    private readonly tmrVersion = '0.0.0',
    private readonly _fs: FileSystemService = fileSystemService,
  ) {}

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

  private checkCommunityPlugins(vaultPath: string | undefined): CheckResult {
    if (process.platform === 'linux') {
      return {
        key: 'community_plugins',
        label: 'Community Plugins',
        ok: false,
        info: true,
        detail: 'not applicable on Linux',
      };
    }

    if (!vaultPath || !existsSync(vaultPath)) {
      return {
        key: 'community_plugins',
        label: 'Community Plugins',
        ok: false,
        detail: 'skipped (vault not configured)',
        fix: 'tmr init',
      };
    }

    const pluginsJsonPath = join(vaultPath, '.obsidian', 'community-plugins.json');

    if (!existsSync(pluginsJsonPath)) {
      return {
        key: 'community_plugins',
        label: 'Community Plugins',
        ok: false,
        detail: 'not found',
        fix: 'tmr init',
      };
    }

    try {
      const raw = readFileSync(pluginsJsonPath, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return {
          key: 'community_plugins',
          label: 'Community Plugins',
          ok: false,
          detail: 'not found',
          fix: 'tmr init',
        };
      }
      const registered = parsed as string[];
      const missing = REQUIRED_PLUGIN_IDS.filter((id) => !registered.includes(id));

      if (missing.length > 0) {
        return {
          key: 'community_plugins',
          label: 'Community Plugins',
          ok: false,
          detail: `missing: ${missing.join(', ')}`,
          fix: 'tmr init',
        };
      }

      return {
        key: 'community_plugins',
        label: 'Community Plugins',
        ok: true,
        value: `${REQUIRED_PLUGIN_IDS.length}/${REQUIRED_PLUGIN_IDS.length} registered`,
      };
    } catch {
      return {
        key: 'community_plugins',
        label: 'Community Plugins',
        ok: false,
        detail: 'not found',
        fix: 'tmr init',
      };
    }
  }

  // ── Frontmatter migration (Story 9.36) ─────────────────────────────────────

  private async _collectFlat(out: string[], dir: string): Promise<void> {
    if (await this._fs.exists(dir)) out.push(...(await this._fs.listFiles(dir, '.md')));
  }

  /** Collects `<root>/<email>/<email>.md` profiles. */
  private async _collectNested(out: string[], root: string): Promise<void> {
    if (!(await this._fs.exists(root))) return;
    for (const dir of await this._fs.listDirectories(root)) {
      const profile = join(root, dir, `${dir}.md`);
      if (await this._fs.exists(profile)) out.push(profile);
    }
  }

  /** Collects `<root>/<year>/<email>/<email>.md` archived profiles. */
  private async _collectArchived(out: string[], root: string): Promise<void> {
    if (!(await this._fs.exists(root))) return;
    for (const year of await this._fs.listDirectories(root)) {
      const yearDir = join(root, year);
      for (const dir of await this._fs.listDirectories(yearDir)) {
        const profile = join(yearDir, dir, `${dir}.md`);
        if (await this._fs.exists(profile)) out.push(profile);
      }
    }
  }

  private async _listEntityProfiles(ws: string): Promise<string[]> {
    const out: string[] = [];
    await this._collectFlat(out, join(ws, 'my-career')); // self (flat; perf-reviews/ subdir ignored)
    await this._collectNested(out, join(ws, 'my-teams', 'members'));
    await this._collectNested(out, join(ws, 'my-leadership'));
    await this._collectNested(out, join(ws, 'my-company', 'members'));
    await this._collectNested(out, join(ws, 'my-company', 'contractors'));
    await this._collectArchived(out, join(ws, 'my-teams', 'archived'));
    return out;
  }

  private async _listRosterFiles(ws: string): Promise<string[]> {
    const out: string[] = [];
    const root = join(ws, 'my-teams', 'teams');
    if (!(await this._fs.exists(root))) return out;
    for (const slug of await this._fs.listDirectories(root)) {
      const file = join(root, slug, `${slug}-members.md`);
      if (await this._fs.exists(file)) out.push(file);
    }
    return out;
  }

  private async _listProjectOverviews(ws: string): Promise<string[]> {
    const out: string[] = [];
    const root = join(ws, 'my-company', 'projects');
    if (!(await this._fs.exists(root))) return out;
    for (const name of await this._fs.listDirectories(root)) {
      const file = join(root, name, `${name}.md`);
      if (await this._fs.exists(file)) out.push(file);
    }
    return out;
  }

  /**
   * Walks every entity / roster / project file in the vault and migrates structural
   * body wiki-links into frontmatter (idempotent — a second run reports 0 migrated).
   */
  async migrateFrontmatter(workspaceRoot: string): Promise<MigrationSummary> {
    let scanned = 0;
    let migrated = 0;
    let renamed = 0;
    let skipped = 0;

    const run = async (files: string[], fn: (raw: string) => MigrationOutcome): Promise<void> => {
      for (const file of files) {
        scanned++;
        // Isolate each file: a single unreadable/malformed-YAML file must not abort the
        // whole migration (which would leave the vault partially migrated).
        let outcome: MigrationOutcome;
        try {
          outcome = fn(await this._fs.readFile(file));
        } catch {
          skipped++;
          continue;
        }
        if (outcome.changed) {
          await this._fs.writeFile(file, outcome.content);
          migrated++;
          if (outcome.renamed) renamed++;
        }
      }
    };

    await run(await this._listEntityProfiles(workspaceRoot), migrateProfileContent);
    await run(await this._listRosterFiles(workspaceRoot), migrateRosterContent);
    await run(await this._listProjectOverviews(workspaceRoot), migrateProjectContent);

    return { scanned, migrated, renamed, skipped };
  }

  /**
   * Read-only scan: counts files that still carry legacy structural body wiki-links or
   * deprecated frontmatter keys. Dated sections (`## 1on1s` etc.) do NOT count.
   */
  async detectLegacyBodyLinks(workspaceRoot: string): Promise<number> {
    let count = 0;

    const scan = async (files: string[], fn: (raw: string) => MigrationOutcome): Promise<void> => {
      for (const file of files) {
        // Read-only: never let one unreadable/malformed file break plain `tmr doctor`.
        try {
          if (fn(await this._fs.readFile(file)).legacy) count++;
        } catch {
          /* skip unreadable / unparseable file */
        }
      }
    };

    await scan(await this._listEntityProfiles(workspaceRoot), migrateProfileContent);
    await scan(await this._listRosterFiles(workspaceRoot), migrateRosterContent);
    await scan(await this._listProjectOverviews(workspaceRoot), migrateProjectContent);

    return count;
  }

  // ── Dangling reciprocal-link repair (consistency) ──────────────────────────

  /** True if a wiki-link target resolves to an existing file (tolerating extension-less links). */
  private async _linkTargetExists(fileDir: string, target: string): Promise<boolean> {
    if (await this._fs.exists(join(fileDir, target))) return true;
    // Obsidian-style links may omit the `.md` extension — treat `<target>.md` as a match too.
    if (!target.endsWith('.md') && (await this._fs.exists(join(fileDir, `${target}.md`)))) {
      return true;
    }
    return false;
  }

  /**
   * Computes the pruned content for a single file: removes frontmatter relation-array entries
   * that are wiki-links whose target no longer exists. Returns null when nothing changes (so the
   * file is left byte-for-byte untouched). May throw on malformed YAML — callers isolate that.
   */
  private async _pruneFileLinks(
    file: string,
    raw: string,
  ): Promise<{ content: string; removed: number } | null> {
    const parsed = matter(raw);
    const data = { ...(parsed.data as Record<string, unknown>) };
    const fileDir = dirname(file);
    let removed = 0;

    for (const key of REPAIRABLE_RELATION_KEYS) {
      const val = data[key];
      if (!Array.isArray(val)) continue;
      const kept: unknown[] = [];
      for (const entry of val) {
        if (typeof entry === 'string') {
          const target = parseWikiLinkTarget(entry);
          if (target && !(await this._linkTargetExists(fileDir, target))) {
            removed++;
            continue; // drop dangling entry
          }
        }
        kept.push(entry);
      }
      if (kept.length !== val.length) data[key] = kept;
    }

    if (removed === 0) return null;
    return { content: matter.stringify(parsed.content, data), removed };
  }

  /**
   * Walks every entity / roster / project file and removes dangling reciprocal frontmatter links
   * (entries pointing at a target file that no longer exists). Idempotent — a second run removes
   * nothing. Only files that actually change are rewritten.
   */
  async pruneDanglingLinks(workspaceRoot: string): Promise<LinkRepairSummary> {
    let scanned = 0;
    let repaired = 0;
    let removed = 0;
    let skipped = 0;

    const files = [
      ...(await this._listEntityProfiles(workspaceRoot)),
      ...(await this._listRosterFiles(workspaceRoot)),
      ...(await this._listProjectOverviews(workspaceRoot)),
    ];

    for (const file of files) {
      scanned++;
      let result: { content: string; removed: number } | null;
      try {
        result = await this._pruneFileLinks(file, await this._fs.readFile(file));
      } catch {
        skipped++;
        continue;
      }
      if (result) {
        await this._fs.writeFile(file, result.content);
        repaired++;
        removed += result.removed;
      }
    }

    return { scanned, repaired, removed, skipped };
  }

  /** Read-only scan: counts files that carry at least one dangling reciprocal frontmatter link. */
  async detectDanglingLinks(workspaceRoot: string): Promise<number> {
    let count = 0;

    const files = [
      ...(await this._listEntityProfiles(workspaceRoot)),
      ...(await this._listRosterFiles(workspaceRoot)),
      ...(await this._listProjectOverviews(workspaceRoot)),
    ];

    for (const file of files) {
      try {
        if (await this._pruneFileLinks(file, await this._fs.readFile(file))) count++;
      } catch {
        /* skip unreadable / unparseable file */
      }
    }

    return count;
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
      this.checkCommunityPlugins(vaultPath),
    ];
  }
}

// Singleton intentionally omits version; command layer supplies it via constructor.
export const doctorService = new DoctorService();
