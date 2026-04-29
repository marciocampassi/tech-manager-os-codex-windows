# Sprint Change Proposal — 2026-04-29 — Epic 7: Zero-Friction Setup

**Project:** tech-manager-os
**Sprint Status at Change:** Epic 1 in-progress (Story 1.1 done; Stories 1.2–1.4 backlog)
**Change Scope:** Minor — Direct Adjustment
**Routed To:** Developer agent (Stories 7.1, 7.2 — new backlog; Story 2.1 AC addition — backlog)

---

## Section 1: Issue Summary

### Problem Statement

Two friction points exist for new `tmr` users that this release has not yet addressed:

1. **Installation friction**: New users must independently discover, install, and configure Node.js, Obsidian, Granola, and Google Drive before `tmr` becomes useful. There is no guided path from zero to a fully operational workbench — only `npm install -g` documented in the README.

2. **Granola → Obsidian integration not pre-configured**: The `granola-sync` Obsidian plugin defaults its sync destination to a `"Granola"` folder. Left unconfigured, meeting notes land in the wrong place and `/tmr-inbox` never sees them. A user would have to discover this, open plugin settings, and manually change the path — breaking the zero-configuration promise.

### Context

Identified by Marlon during strategic planning on 2026-04-29, following confirmation that:
- Obsidian, Granola, and Google Drive are all available via Homebrew Cask and winget
- The `tomelliot/obsidian-granola-sync` plugin (v2.0.19) stores its settings in `.obsidian/plugins/granola-sync/data.json`, which `tmr init` can scaffold in the same way it already scaffolds `.claude/skills/`
- Granola is now available on both macOS and Windows (Linux not yet supported)

### Discovery

Identified by Marlon from strategic planning session after Sprint Change #3 (2026-04-29).

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Impact |
|------|--------|
| Epic 1 (Shared Utilities & Relationship Removal) | None |
| Epic 2 (tmr init Rework) | **Minor AC addition** — Story 2.1 scaffold step gains one new output: `.obsidian/plugins/granola-sync/data.json`. Story is backlog; zero rework of completed work. |
| Epics 3–6 | None |
| **Epic 7 NEW** — Zero-Friction Setup | New epic added at lowest priority (after Epic 6). Two stories: 7.1 (install scripts) and 7.2 (`tmr doctor`). |

### Story Impact

| Story | Change Type | Detail |
|-------|-------------|--------|
| 2.1 Vault Scaffold & Folder Structure | AC addition | Scaffold `.obsidian/plugins/granola-sync/data.json` pre-configured for `inbox/` routing (FR48) |
| **7.1 NEW** — Bootstrap Install Scripts | New story | `install.sh` (macOS/Linux) and `install.ps1` (Windows) — guided tool installation + `tmr init` entrypoint |
| **7.2 NEW** — `tmr doctor` Health Check | New story | CLI command validating full environment with actionable fix instructions |

### Artifact Conflicts

| Artifact | Change |
|----------|--------|
| `_bmad-output/planning-artifacts/prd.md` | Add FR48–FR54; update Must-Have Capabilities; add Epic 7 to Command Reference |
| `_bmad-output/planning-artifacts/epics.md` | Add FRs to inventory; update FR Coverage Map; update Story 2.1 AC; add Epic 7 with Stories 7.1 and 7.2 |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Add Epic 7 and Stories 7.1–7.2 as backlog; update `last_updated` |

### Technical Impact

- No new services required — Granola plugin config scaffolding follows identical `fs-extra.writeFile` pattern used for `CLAUDE.md` and sample files in Story 2.4
- Install scripts are plain shell/PowerShell — no TypeScript, no new npm dependencies
- `tmr doctor` is a new CLI command following the existing Command → Service pattern; no AI providers, no file system write operations
- No architecture changes

---

## Section 3: Recommended Approach

**Option selected: Direct Adjustment**

All affected stories are backlog. The change is entirely additive — no completed work is modified, no epics restructured, no rollbacks needed. Epic 7 is placed last in priority and does not block any in-flight work.

| Dimension | Assessment |
|-----------|------------|
| Effort | Low — one AC addition to an existing backlog story; two new stories following established patterns |
| Risk | Low — scaffolding a JSON file is the same operation as `CLAUDE.md`; install scripts have no runtime coupling to `tmr` internals |
| Timeline impact | None — Epic 7 starts after Epic 6 completes |
| Maintainability | High — install scripts are stateless shell; `tmr doctor` has no side effects |

---

## Section 4: Detailed Change Proposals

### PRD Changes (`prd.md`)

**Edit A — Must-Have Capabilities (add after tmr-myself-config install)**

OLD:
```
`tmr install`: installs all skills from official registry
```
NEW:
```
`tmr install`: installs all skills from official registry
- Bootstrap install scripts (`install.sh` / `install.ps1`) for guided zero-to-operational setup including Obsidian, Granola, and Google Drive
- `tmr doctor`: environment health check with actionable fix instructions
```

**Edit B — New Functional Requirements (after FR47, new section "Zero-Friction Setup")**

- **FR48**: System scaffolds `.obsidian/plugins/granola-sync/data.json` during `tmr init` with `customBaseFolder` set to `"inbox"` and `saveAsIndividualFiles` set to `true`, pre-configuring the Granola Sync plugin to route meeting notes to the vault's inbox folder without any manual plugin configuration
- **FR49**: A bootstrap install script for macOS (`install.sh`) detects whether Homebrew is installed; if absent, installs it automatically via the official Homebrew install script (`/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`); then uses Homebrew to install Node.js ≥ 18 and `tmr` via npm; prompts the user to optionally install Obsidian, Granola, and Google Drive via `brew install --cask`; ends with `tmr init`
- **FR50**: A bootstrap install script for Windows (`install.ps1`) detects whether `winget` is available; if absent, prints instructions to install App Installer from the Microsoft Store and exits with a descriptive message; if present, uses winget to install Node.js ≥ 18 and `tmr` via npm; prompts for optional Obsidian, Granola, and Google Drive installation via `winget install`; ends with `tmr init`
- **FR51**: A bootstrap install script for Linux (`install.sh`) auto-detects the available package manager in order: `apt-get` (Ubuntu/Debian), `dnf` (Fedora/RHEL), `yum` (older RHEL), `pacman` (Arch); if none is found, exits with a descriptive message listing supported package managers; installs Node.js ≥ 18 and `tmr` via npm; offers Obsidian installation only (via detected package manager or `snap` as fallback); skips Granola and Google Drive with a clear platform message
- **FR52**: Both install scripts are hosted at a public HTTPS URL and invocable via `curl -fsSL <url>/install.sh | bash` (macOS/Linux) and `iwr -useb <url>/install.ps1 | iex` (Windows)
- **FR53**: User can run `tmr doctor` to validate their full environment: Node.js version, tmr installation, Obsidian, Granola, Google Drive, and vault configuration — each check displays `✔` (pass) or `⚠` (action needed) with the exact remediation command
- **FR54**: `tmr doctor` exits with a non-zero exit code when any check fails, enabling scripted environment validation

---

### Story 2.1 AC Addition

Added after existing INIT-UNIT-010 (contractors folder) AC:

```
Given `InitService` creates the vault scaffold
When the scaffold completes
Then `.obsidian/plugins/granola-sync/data.json` is written with:
  - `customBaseFolder`: `"inbox"`
  - `saveAsIndividualFiles`: `true`
  - `isSyncEnabled`: `true`
  - `syncInterval`: `1800` (30 minutes)
  - all other fields set to plugin defaults
So that when the user installs the Granola Sync community plugin in Obsidian,
it is already pointed at the vault's inbox with no manual configuration required
(FR48, INIT-UNIT-013)
```

---

### Epic 7: Zero-Friction Setup

Engineering managers on macOS, Windows, and Linux can go from zero to a fully operational `tmr` vault in a single command. The install scripts handle all prerequisite and tool installation with per-step opt-in prompts. `tmr doctor` validates the environment at any time and surfaces actionable fix instructions.

**FRs covered:** FR49–FR54

---

### Story 7.1: Bootstrap Install Scripts

As a new engineering manager who has never used `tmr`,
I want to run a single command that installs all necessary tools and drops me into the `tmr init` guided flow,
So that I go from zero to a fully operational vault without needing to know what Node.js, Homebrew, or winget are.

**Acceptance Criteria:**

**Given** a macOS user runs `curl -fsSL <url>/install.sh | bash` and Homebrew is not installed
**When** the script detects `brew` is absent
**Then** it installs Homebrew via the official script (`/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`) before proceeding (FR49, INSTALL-UNIT-001)

**Given** Homebrew is present (or just installed)
**When** the macOS script continues
**Then** it checks for Node.js ≥ 18; installs via `brew install node` if absent; installs `tmr` globally via npm (FR49)

**Given** the macOS script has installed `tmr`
**When** the optional-tools section runs
**Then** the user is prompted: *"Install Obsidian? [Y/n]"*, *"Install Granola? [Y/n]"*, *"Install Google Drive? [Y/n]"*; each accepted prompt runs the corresponding `brew install --cask` command (FR49)

**Given** a Linux user runs `curl -fsSL <url>/install.sh | bash`
**When** the script executes
**Then** it detects the package manager in priority order: `apt-get` → `dnf` → `yum` → `pacman`; if none found, it exits with: *"No supported package manager detected (apt, dnf, yum, pacman). Please install Node.js ≥ 18 manually and re-run."* (FR51, INSTALL-UNIT-002)

**Given** a Linux package manager is detected
**When** the optional-tools section runs
**Then** only Obsidian is offered (via detected package manager or `snap` as fallback); Granola and Google Drive prompts are skipped with: *"Granola and Google Drive are not available on Linux — install them manually if needed."* (FR51)

**Given** a Windows user runs `iwr -useb <url>/install.ps1 | iex` and `winget` is not available
**When** the script detects `winget` is absent
**Then** it prints: *"winget (App Installer) is required. Install it from the Microsoft Store: https://aka.ms/getwinget — then re-run this script."* and exits (FR50, INSTALL-UNIT-003)

**Given** `winget` is present
**When** the Windows script continues
**Then** it installs Node.js ≥ 18 via `winget install OpenJS.NodeJS.LTS` if absent; installs `tmr` globally via npm; prompts for Obsidian (`winget install Obsidian.Obsidian`), Granola (`winget install Granola.Granola`), and Google Drive (`winget install Google.GoogleDrive`) (FR50)

**Given** all installations complete
**When** the final script step runs
**Then** `tmr init` is launched automatically, entering the guided vault setup flow (FR49, FR50)

**Given** Google Drive is installed or already present
**When** the script outputs its summary
**Then** it prints: *"Tip: For automatic cloud backup, run `tmr init` inside your Google Drive folder."* (FR49)

**Given** `scripts/install.sh` and `scripts/install.ps1` exist in the repository root
**When** the scripts are hosted via Cloudflare Pages or equivalent at the configured domain
**Then** they are accessible over HTTPS and served with `Content-Type: text/plain` (FR52)

**Given** any install step fails (brew error, winget error, npm error)
**When** the error is caught
**Then** the script prints a descriptive message and continues with remaining steps — a single tool failure does not abort the entire script

---

### Story 7.2: `tmr doctor` Health Check Command

As an engineering manager troubleshooting a `tmr` setup issue,
I want to run `tmr doctor` and see the status of every required and recommended tool in my environment,
So that I know exactly what is missing or misconfigured and what command to run to fix it — without digging through documentation.

**Acceptance Criteria:**

**Given** `tmr doctor` is run on a fully configured system
**When** all checks pass
**Then** output is:
```
✔  Node.js       v20.x.x   (required ≥ 18)
✔  tmr           v1.x.x
✔  Vault         /path/to/vault
✔  Obsidian      installed
✔  Granola       installed
✔  Google Drive  detected
✔  Granola Sync  plugin config present (inbox/)
```
**And** exit code is `0` (DOCTOR-UNIT-001)

**Given** `tmr doctor` is run and Obsidian is not installed
**When** the Obsidian check fails
**Then** output includes: `⚠  Obsidian      not found — run: brew install --cask obsidian` (macOS) or platform-appropriate instruction (DOCTOR-UNIT-002)

**Given** `tmr doctor` is run and the vault is not configured
**When** the vault check fails
**Then** output includes: `⚠  Vault         not configured — run: tmr init` (DOCTOR-UNIT-003)

**Given** `tmr doctor` is run and the Granola Sync plugin config is missing or points to the wrong folder
**When** the plugin config check runs
**Then** output includes: `⚠  Granola Sync  plugin config missing or misconfigured — run: tmr init --repair-obsidian-plugins` or guidance to re-run `tmr init` (DOCTOR-UNIT-004)

**Given** `tmr doctor` is run and any check has `⚠` status
**When** all checks complete
**Then** exit code is non-zero (FR54, DOCTOR-UNIT-005)

**Given** `tmr doctor` is run with `--json` flag
**When** output is generated
**Then** a structured JSON object is emitted with each check as a key: `{ "nodejs": { "ok": true, "version": "20.x.x" }, ... }` (NFR output contract)

**Given** `tmr doctor` detects Granola is not installed on Linux
**When** the Granola check runs
**Then** it prints `ℹ  Granola       not available on Linux` (info, not warning) and does not contribute to non-zero exit code

**Given** any unexpected runtime error occurs during `tmr doctor` execution
**When** the error propagates
**Then** it is caught, surfaced via `printError` to `process.stderr`, and no stack trace is visible to the user (NFR2)

---

## Section 5: Implementation Handoff

**Scope classification: Minor**

All changes are in backlog stories. No strategic or architectural decisions required.

| Story | Handoff | Action |
|-------|---------|--------|
| Story 2.1 | Developer agent | Add `.obsidian/plugins/granola-sync/data.json` write to `InitService` scaffold step (INIT-UNIT-013) |
| Story 7.1 | Developer agent | Author `scripts/install.sh` and `scripts/install.ps1`; add to repo root; document hosting setup in `CONTRIBUTING.md` |
| Story 7.2 | Developer agent | Add `tmr doctor` command following Command → Service pattern; no file writes, no AI provider |

**Success criteria:**

- `INIT-UNIT-013` passes: `.obsidian/plugins/granola-sync/data.json` exists after `tmr init` with correct `customBaseFolder` and `saveAsIndividualFiles` values
- `DOCTOR-UNIT-001` passes: `tmr doctor` exits 0 on a healthy system
- `DOCTOR-UNIT-005` passes: `tmr doctor` exits non-zero when any required tool is missing
- `npm run validate` passes with all four steps (lint, typecheck, test, build)
- Install scripts run end-to-end on macOS without error on a clean system

---

*Approved by: Marlon — 2026-04-29*
*Generated by: Correct Course workflow — 2026-04-29*
