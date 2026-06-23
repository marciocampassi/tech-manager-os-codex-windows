# Story 7.2: `tmr doctor` Environment Health Check

**Epic:** 7 — Zero-Friction Setup
**Story ID:** 7.2
**Story Key:** `7-2-tmr-doctor-environment-health-check`
**Status:** ready-for-dev
**Created:** 2026-05-11

---

## Story

As an engineering manager troubleshooting a `tmr` setup issue,
I want to run `tmr doctor` and see the status of every required and recommended tool in my environment,
So that I know exactly what is missing or misconfigured and the exact command to run to fix it — without digging through documentation.

---

## Acceptance Criteria

**AC1 — All checks pass: exit 0 with ✔ lines**
Given `tmr doctor` is run on a fully configured system
When all checks pass
Then each line shows `✔  <tool>  <version or status>` and exit code is `0` (FR53, DOCTOR-UNIT-001)

**AC2 — Obsidian not installed: platform-specific fix hint**
Given `tmr doctor` is run and Obsidian is not installed
When the Obsidian check fails
Then output includes `⚠  Obsidian  not found — run: brew install --cask obsidian` (macOS) or platform-appropriate instruction (FR53, DOCTOR-UNIT-002)

**AC3 — Vault not configured**
Given `tmr doctor` is run and the vault is not configured
When the vault check fails
Then output includes `⚠  Vault  not configured — run: tmr init` (FR53, DOCTOR-UNIT-003)

**AC4 — Granola Sync plugin config missing or misconfigured**
Given `tmr doctor` is run and the Granola Sync plugin config is missing or `customBaseFolder` is not `"inbox"`
When the plugin config check runs
Then output includes `⚠  Granola Sync  plugin config missing or misconfigured — re-run tmr init to repair` (FR53, DOCTOR-UNIT-004)

**AC5 — Any ⚠ causes non-zero exit**
Given `tmr doctor` is run and any check has `⚠` status
When all checks complete
Then exit code is non-zero (FR54, DOCTOR-UNIT-005)

**AC6 — `--json` structured output**
Given `tmr doctor` is run with `--json` flag
When output is generated
Then a structured JSON object is emitted with each check as a key (e.g. `{ "nodejs": { "ok": true, "version": "20.x.x" }, ... }`) following the `--json` output contract

**AC7 — Linux Granola info (not warning)**
Given `tmr doctor` detects Granola is not installed on Linux
When the Granola check runs
Then it prints `ℹ  Granola  not available on Linux` (info only, not `⚠`) and does not contribute to non-zero exit code

**AC8 — Error handling**
Given any unexpected runtime error occurs during `tmr doctor`
When the error propagates
Then it is caught, surfaced via `printError` to `process.stderr`, and no stack trace is visible to the user (NFR2)

---

## Tasks / Subtasks

### Phase 1 — DoctorService (core logic)

- [x] T1.1 — Create `src/services/doctor.service.ts` with `CheckResult` interface and `DoctorService` class
  - [x] T1.1a — Define `CheckResult` interface (key, label, ok, info?, value?, detail?, fix?)
  - [x] T1.1b — Implement Node.js check: parse `process.version`, pass if major ≥ 18
  - [x] T1.1c — Implement `tmr` check: resolve `package.json` version (use `createRequire(import.meta.url)`)
  - [x] T1.1d — Implement Vault check: `configService.getWorkspacePath()` → `fs.existsSync(path)`
  - [x] T1.1e — Implement Obsidian check: platform-aware (macOS → `/Applications/Obsidian.app`, Windows → `which('Obsidian') + winget hint`, Linux → `which('obsidian') + snap hint`)
  - [x] T1.1f — Implement Granola check: macOS → `/Applications/Granola.app`; Windows → `which` + winget hint; Linux → `info` (not available on Linux, never ⚠)
  - [x] T1.1g — Implement Google Drive check: macOS → `/Applications/Google Drive.app` or `~/Library/CloudStorage/GoogleDrive-*/`; Windows → `which` or common paths; Linux → info (not available on Linux)
  - [x] T1.1h — Implement Granola Sync config check: read `<vault>/.obsidian/plugins/granola-sync/data.json`, verify `customBaseFolder === "inbox"` (skip if vault not configured)

- [x] T1.2 — Write unit tests in `tests/services/doctor.service.test.ts`
  - [x] T1.2a — Mock `which` module
  - [x] T1.2b — Mock `node:fs` (existsSync)
  - [x] T1.2c — Mock `configService`
  - [x] T1.2d — Test all 8 checks (happy paths + failure paths + Linux Granola info path)
  - [x] T1.2e — Test Granola Sync: missing file, wrong customBaseFolder, correct config

### Phase 2 — DoctorCommand

- [x] T2.1 — Create `src/commands/doctor.command.ts`
  - [x] T2.1a — Implement `runDoctor(opts)` that calls `DoctorService.runChecks()`
  - [x] T2.1b — Implement table-formatted output: label padded to 14 chars, then value/detail
  - [x] T2.1c — Implement `--json` path: emit structured object per AC6
  - [x] T2.1d — Set `process.exitCode = 1` when any non-info check has `ok === false` (AC5)
  - [x] T2.1e — Wrap in try/catch; surface errors via `printError` (AC8)

- [x] T2.2 — Write unit tests in `tests/commands/doctor.command.test.ts`
  - [x] T2.2a — Mock `DoctorService`
  - [x] T2.2b — Test all-pass scenario: stdout has ✓ lines, exitCode 0
  - [x] T2.2c — Test any-fail scenario: exitCode 1
  - [x] T2.2d — Test `--json` output: valid JSON with expected keys
  - [x] T2.2e — Test error thrown by service → printError on stderr, no stack trace

### Phase 3 — CLI Registration & Validation

- [x] T3.1 — Register `createDoctorCommand` in `src/cli.ts` as a static import (lightweight command — no AI, no inquirer)
- [x] T3.2 — Run `npm run validate` (lint + typecheck + tests + build); lint ✓, typecheck ✓, 1019/1019 tests PASS, build ✓

### Review Findings

- [ ] [Review][Patch] P1 — Linux Granola Sync check causes spurious exit 1: `checkGranolaSync` has no Linux guard; since Granola is unavailable on Linux the plugin config never exists, causing `ok:false` (no `info:true`) → exit 1 on every Linux `tmr doctor` run [doctor.service.ts:checkGranolaSync]
- [ ] [Review][Patch] P2 — Help text shows invalid flag position: `tmr doctor --json` / `tmr doctor --plain` fail due to `enablePositionalOptions()`; correct form is `tmr --json doctor` [doctor.command.ts:createDoctorCommand]
- [ ] [Review][Patch] P3 — AC4: "plugin config missing" detail deviates from spec: the file-absent branch uses `detail: 'plugin config missing'` but AC4 requires `'plugin config missing or misconfigured'` [doctor.service.ts:~167]
- [ ] [Review][Patch] P4 — AC4: fix hint produces "run: re-run tmr init to repair": template prepends `" — run: "` to fix field value `'re-run tmr init to repair'`, producing output that doesn't match the spec's `"— re-run tmr init to repair"` [doctor.service.ts:~167,177,184]
- [ ] [Review][Patch] P5 — AC6: Node.js `version` in JSON includes display annotation: `checkNodejs()` embeds `"   (required ≥ 18)"` in `value`; JSON serializer uses `r.value` as the `version` field, producing `"v20.x.x   (required ≥ 18)"` instead of a clean version string [doctor.service.ts:checkNodejs]
- [ ] [Review][Patch] P6 — Unknown platforms (BSD, etc.) fall through with `ok:false` and no `info:true` in `checkGranola` / `checkGoogleDrive`, causing spurious exit 1 [doctor.service.ts:checkGranola,checkGoogleDrive]
- [ ] [Review][Patch] P7 — macOS per-user `~/Applications` not checked for Obsidian and Granola; non-admin installs always report "not found" [doctor.service.ts:checkObsidian,checkGranola]
- [ ] [Review][Patch] P8 — Windows GUI apps not in PATH; `which()` always returns null for Obsidian, Granola, and Google Drive; all Windows checks are broken [doctor.service.ts:checkObsidian,checkGranola,checkGoogleDrive]

- [x] [Review][Defer] D1 — `Promise.all` atomic rejection: if any async check throws, all results are discarded and the catch shows a generic error instead of partial results — deferred, pre-existing architectural pattern, outer catch handles it per AC8
- [x] [Review][Defer] D2 — `checkTmr()` unguarded synchronous `require('../../package.json')`: throws if package.json is absent but package.json is never absent in normal tmr usage — deferred, pre-existing pattern

---

## Dev Notes

### Nature of This Story

This is a **new TypeScript command** that reads the local environment and reports status. It has no AI providers, no inquirer prompts (output-only), and no file writes — making it a lightweight command that should be **statically imported** in `cli.ts` (not lazy-loaded).

---

### Architecture Compliance

- **Command → Service pattern** (architecture mandate): logic lives in `DoctorService`; command file only calls the service and formats output.
- **No new npm dependencies** required — `which` v5 is already in `package.json` as a dependency; `node:fs`, `node:path`, `node:os` are Node built-ins.
- **Error contract**: all unexpected throws caught in `runDoctor()`; `printError()` to stderr; exit 1 via `process.exitCode`.
- **`--json` contract**: emit via `printJson()` from `display.ts`; never print both human and JSON output in the same run.
- **`--plain` contract**: all human output goes through `printSuccess`/`printWarning`/`printInfo`/`printError` from `display.ts`; plain flag threads through.

---

### New Files

| File | Purpose |
|------|---------|
| `src/services/doctor.service.ts` | All check logic (NEW) |
| `src/commands/doctor.command.ts` | Command factory + output formatting (NEW) |
| `tests/services/doctor.service.test.ts` | DoctorService unit tests (NEW) |
| `tests/commands/doctor.command.test.ts` | DoctorCommand unit tests (NEW) |

### Updated Files

| File | Change |
|------|--------|
| `src/cli.ts` | `import { createDoctorCommand } from './commands/doctor.command.js'` + `p.addCommand(createDoctorCommand())` in the static-imports section |

---

### `CheckResult` Interface

```typescript
export interface CheckResult {
  key: string;       // JSON key, e.g. "nodejs", "vault", "granola_sync"
  label: string;     // Display label, e.g. "Node.js", "Granola Sync"
  ok: boolean;       // true = ✔ pass
  info?: boolean;    // true = ℹ info (not ok, not warning — Linux Granola/GDrive)
  value?: string;    // version or path (shown on pass lines)
  detail?: string;   // status text on failure/info
  fix?: string;      // repair command
}
```

---

### DoctorService Implementation Guide

```typescript
import { existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import which from 'which';
import { createRequire } from 'node:module';
import { configService } from './config.service.js';

const require = createRequire(import.meta.url);
```

**Node.js check:**
```typescript
const versionStr = process.version; // e.g. "v20.12.0"
const major = parseInt(versionStr.replace('v', '').split('.')[0], 10);
ok = major >= 18;
value = versionStr;
```

**tmr check:**
```typescript
const pkg = require('../../package.json') as { version: string };
// ok = true (if this code runs, tmr is installed)
value = `v${pkg.version}`;
```

**Vault check:**
```typescript
const vaultPath = configService.getWorkspacePath();
if (!vaultPath || !existsSync(vaultPath)) {
  return { key: 'vault', label: 'Vault', ok: false, detail: 'not configured', fix: 'tmr init' };
}
return { key: 'vault', label: 'Vault', ok: true, value: vaultPath };
```

**Obsidian check (platform-aware):**
```typescript
const platform = process.platform;
let obsidianOk = false;
let obsidianFix = '';

if (platform === 'darwin') {
  obsidianOk = existsSync('/Applications/Obsidian.app');
  obsidianFix = 'brew install --cask obsidian';
} else if (platform === 'win32') {
  const found = await which('Obsidian', { nothrow: true });
  obsidianOk = found !== null;
  obsidianFix = 'winget install Obsidian.Obsidian';
} else {
  // Linux
  const found = await which('obsidian', { nothrow: true });
  obsidianOk = found !== null;
  obsidianFix = 'snap install obsidian --classic';
}

if (!obsidianOk) {
  return { key: 'obsidian', label: 'Obsidian', ok: false, detail: 'not found', fix: obsidianFix };
}
return { key: 'obsidian', label: 'Obsidian', ok: true, value: 'installed' };
```

**Granola check (platform-aware, Linux is info):**
```typescript
if (platform === 'linux') {
  return { key: 'granola', label: 'Granola', ok: false, info: true, detail: 'not available on Linux' };
}
let granolaOk = false;
let granolaFix = '';
if (platform === 'darwin') {
  granolaOk = existsSync('/Applications/Granola.app');
  granolaFix = 'brew install --cask granola';
} else if (platform === 'win32') {
  const found = await which('granola', { nothrow: true });
  granolaOk = found !== null;
  granolaFix = 'winget install Granola.Granola';
}
```

**Google Drive check (platform-aware, Linux is info):**
```typescript
if (platform === 'linux') {
  return { key: 'google_drive', label: 'Google Drive', ok: false, info: true, detail: 'not available on Linux' };
}
let gdriveOk = false;
let gdriveFix = '';
if (platform === 'darwin') {
  // Check app bundle OR CloudStorage mount
  const appExists = existsSync('/Applications/Google Drive.app');
  const cloudStorageDir = join(homedir(), 'Library', 'CloudStorage');
  const cloudExists = existsSync(cloudStorageDir) &&
    readdirSync(cloudStorageDir).some(d => d.startsWith('GoogleDrive-'));
  gdriveOk = appExists || cloudExists;
  gdriveFix = 'brew install --cask google-drive';
} else if (platform === 'win32') {
  const found = await which('googledrivesync', { nothrow: true });
  gdriveOk = found !== null;
  gdriveFix = 'winget install Google.GoogleDrive';
}
```

Note: `readdirSync` import: `import { existsSync, readFileSync, readdirSync } from 'node:fs';`

**Granola Sync config check:**
```typescript
// Only run if vault is configured and exists
const granolaConfigPath = join(vaultPath, '.obsidian', 'plugins', 'granola-sync', 'data.json');
if (!existsSync(granolaConfigPath)) {
  return { key: 'granola_sync', label: 'Granola Sync', ok: false, detail: 'plugin config missing', fix: 're-run tmr init to repair' };
}
try {
  const raw = readFileSync(granolaConfigPath, 'utf-8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  if (parsed['customBaseFolder'] !== 'inbox') {
    return { key: 'granola_sync', label: 'Granola Sync', ok: false, detail: 'customBaseFolder is not "inbox"', fix: 're-run tmr init to repair' };
  }
  return { key: 'granola_sync', label: 'Granola Sync', ok: true, value: 'plugin config present (inbox/)' };
} catch {
  return { key: 'granola_sync', label: 'Granola Sync', ok: false, detail: 'plugin config unreadable', fix: 're-run tmr init to repair' };
}
```

---

### DoctorCommand Output Format

The command formats each `CheckResult` as a padded table line. The prefix icon comes from display utility:

```typescript
const NAME_COL = 14;  // padEnd target for label column

for (const r of results) {
  const name = r.label.padEnd(NAME_COL);
  if (r.ok) {
    printSuccess(`${name}  ${r.value ?? 'ok'}`, opts.plain);
  } else if (r.info) {
    printInfo(`${name}  ${r.detail ?? ''}`, opts.plain);
  } else {
    const fixHint = r.fix ? ` — run: ${r.fix}` : '';
    printWarning(`${name}  ${r.detail ?? 'not found'}${fixHint}`, opts.plain);
  }
}
```

Example output (all passing):
```
✓ Node.js        v20.12.0   (required ≥ 18)
✓ tmr            v1.2.3
✓ Vault          /Users/marlon/vault
✓ Obsidian       installed
✓ Granola        installed
✓ Google Drive   detected
✓ Granola Sync   plugin config present (inbox/)
```

Example output (some failing):
```
✓ Node.js        v20.12.0   (required ≥ 18)
✓ tmr            v1.2.3
⚠ Vault          not configured — run: tmr init
⚠ Obsidian       not found — run: brew install --cask obsidian
⚠ Granola        not found — run: brew install --cask granola
⚠ Google Drive   not found — run: brew install --cask google-drive
⚠ Granola Sync   plugin config missing — run: re-run tmr init to repair
```

---

### `--json` Output Shape

Per AC6, the JSON output must use each check's `key` field:

```json
{
  "nodejs": { "ok": true, "version": "v20.12.0" },
  "tmr": { "ok": true, "version": "v1.2.3" },
  "vault": { "ok": false, "detail": "not configured", "fix": "tmr init" },
  "obsidian": { "ok": true },
  "granola": { "ok": true },
  "google_drive": { "ok": true },
  "granola_sync": { "ok": true, "value": "plugin config present (inbox/)" }
}
```

Build the JSON object in `runDoctor` by iterating `results` and constructing entries:
```typescript
const out: Record<string, Record<string, unknown>> = {};
for (const r of results) {
  const entry: Record<string, unknown> = { ok: r.ok };
  if (r.info) entry['info'] = true;
  if (r.value) entry['version'] = r.value;   // or 'value' — see below
  if (r.detail) entry['detail'] = r.detail;
  if (r.fix) entry['fix'] = r.fix;
  out[r.key] = entry;
}
printJson(out);
```

Note: For `nodejs` and `tmr`, prefer key `"version"` in JSON output (matching AC6 example). For others, use `"value"` or omit if absent.

---

### `cli.ts` Registration

`tmr doctor` is a lightweight, output-only command with no AI deps. Register it as a **static import** in the lightweight-imports block, alongside `config`, `team`, `member`, etc.:

```typescript
// top of cli.ts — add to static imports:
import { createDoctorCommand } from './commands/doctor.command.js';

// inside createProgram(), after existing static addCommand calls:
p.addCommand(createDoctorCommand());
```

Do NOT use lazy `dynamic import()` for this command.

---

### Testing Patterns

Follow the `install.command.test.ts` pattern exactly:
- `jest.unstable_mockModule(...)` for all dependencies (ESM mocking)
- Dynamic `await import(...)` after mocks
- `jest.spyOn(process.stdout, 'write').mockImplementation(() => true)` for output capture
- `jest.spyOn(process.stderr, 'write').mockImplementation(() => true)` for error capture
- `process.exitCode = undefined` in `beforeEach`, restore in `afterEach`

**Mocking `which` (ESM):**
```typescript
const mockWhich = jest.fn<(cmd: string, opts?: { nothrow: boolean }) => Promise<string | null>>();
jest.unstable_mockModule('which', () => ({ default: mockWhich }));
```

**Mocking `node:fs`:**
```typescript
const mockExistsSync = jest.fn<(p: string) => boolean>(() => false);
const mockReadFileSync = jest.fn<(p: string, enc: string) => string>();
const mockReaddirSync = jest.fn<(p: string) => string[]>(() => []);
jest.unstable_mockModule('node:fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  readdirSync: mockReaddirSync,
}));
```

**Mocking `configService`:**
```typescript
const mockGetWorkspacePath = jest.fn<() => string | undefined>(() => undefined);
jest.unstable_mockModule('../../src/services/config.service.js', () => ({
  configService: { getWorkspacePath: mockGetWorkspacePath },
}));
```

**Mocking `process.platform`:**
```typescript
// In individual tests:
Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
// Restore in afterEach:
Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
```

---

### Previous Story Intelligence (from 7.1)

- 7.1 was **script-only** (no TypeScript); 7.2 is **TypeScript-only** (no script changes).
- The `try_install` fix from 7.1 confirmed pattern: capture return codes explicitly; do not rely on conditional branch last-command to propagate status.
- The `npm run validate` suite has 1 pre-existing flaky integration test (`file-organization.service.integration.test.ts`) that fails intermittently under load but passes in isolation. If this fails during validate, re-run once before escalating.

---

### Git Context

Recent commits:
```
5d94f84 Add bootstrap install scripts for macOS, Linux, and Windows
90f41b1 Merge pull request #57 from marlonvidal/mvpfix/story-6.2-tmrmyselfconfigupdateDeltaReviewMode
b94995b Implement delta review mode for `tmr-myself-config` skill update
17718b4 Merge pull request #56 from marlonvidal/mvpfix/story-6.1-tmrMyselfConfigSkillSetupFlow
04c2e26 Add `tmr-myself-config` skill setup flow and update sprint status
```

Branch for this story: `story/7.2-tmr-doctor-environment-health-check`

---

## Dev Agent Record

### Debug Log

- **Lint fix (T1.1):** `NodeJS.Platform` type not in scope — changed getter return type to `string` (`process.platform` inferred correctly). ESLint `no-useless-assignment` fired on `let ok = false` / `let fix = ''` in `checkObsidian()` and `checkGranola()` — removed initial values (declarations become `let ok: boolean; let fix: string;`); TypeScript control-flow analysis confirms assignment in every if/else branch.
- **TS1378 with individual file runs:** Top-level `await import()` in test files errors when files run in isolation with `npx jest <file>` — this is a known ts-jest quirk for the project (same pattern in `install.command.test.ts`). Tests pass correctly via `npm test` (full suite) which sets `NODE_OPTIONS=--experimental-vm-modules`.

### Completion Notes

- `src/services/doctor.service.ts`: `DoctorService` with 7 checks (Node.js, tmr, Vault, Obsidian, Granola, Google Drive, Granola Sync). All checks platform-aware; Granola and Google Drive return `info: true` on Linux (never contribute to exit code). Granola Sync check skips gracefully when vault is unconfigured.
- `src/commands/doctor.command.ts`: `runDoctor()` + `createDoctorCommand()`. Formats table output with `padEnd(14)` column alignment. Honors `--json` and `--plain` global flags. Sets `process.exitCode = 1` on any non-info failure. All errors caught and surfaced via `printError`.
- `src/cli.ts`: `createDoctorCommand` registered as static import alongside other lightweight commands.
- Tests: 1019/1019 pass (37 new tests across 2 new test files — `doctor.service.test.ts` and `doctor.command.test.ts`). `npm run validate` exits 0.

---

## File List

- `src/services/doctor.service.ts` (NEW)
- `src/commands/doctor.command.ts` (NEW)
- `tests/services/doctor.service.test.ts` (NEW)
- `tests/commands/doctor.command.test.ts` (NEW)
- `src/cli.ts` (UPDATED — static import + `p.addCommand(createDoctorCommand())`)

---

## Change Log

| Date | Change |
|------|--------|
| 2026-05-11 | Story created |
| 2026-05-11 | Implementation complete — all tasks checked, 1019/1019 tests pass |
| 2026-05-11 | Code-review patches applied (P1–P8) — 1026/1026 tests pass, `npm run validate` exits 0 |
| 2026-05-11 | Integration smoke-test revealed bundle path bug in `checkTmr()` (`../../package.json` invalid from `dist/`); fixed by injecting version via `DoctorService(tmrVersion)` constructor, supplied by `createDoctorCommand(pkg.version)` in `cli.ts`. 1026/1026 tests pass. |

---

## Status

done
