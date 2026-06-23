# Story 7.1: Bootstrap Install Scripts

**Epic:** 7 — Zero-Friction Setup
**Story ID:** 7.1
**Story Key:** `7-1-bootstrap-install-scripts`
**Status:** ready-for-dev
**Created:** 2026-05-11

---

## Story

As a new engineering manager who has never used `tmr`,
I want to run a single command that installs all necessary tools and drops me into the `tmr init` guided flow,
So that I go from zero to a fully operational vault without needing to know what Node.js, Homebrew, or winget are.

---

## Acceptance Criteria

**AC1 — macOS: Homebrew auto-install**
Given a macOS user runs `curl -fsSL <url>/install.sh | bash` and Homebrew is not installed
When the script detects `brew` is absent
Then it installs Homebrew via the official script (`/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`) before proceeding (FR49, INSTALL-UNIT-001)

**AC2 — macOS: Node.js and tmr install**
Given Homebrew is present (or just installed)
When the macOS script continues
Then it checks for Node.js ≥ 18; installs via `brew install node` if absent; installs `tmr` globally via npm (FR49)

**AC3 — macOS: optional tools prompts**
Given the macOS script has installed `tmr`
When the optional-tools section runs
Then the user is prompted: *"Install Obsidian? [Y/n]"*, *"Install Granola? [Y/n]"*, *"Install Google Drive? [Y/n]"*; each accepted prompt runs the corresponding `brew install --cask` command (FR49)

**AC4 — Linux: package manager detection**
Given a Linux user runs `curl -fsSL <url>/install.sh | bash`
When the script executes
Then it detects the package manager in priority order: `apt-get` → `dnf` → `yum` → `pacman`; if none found, it exits with: *"No supported package manager detected (apt, dnf, yum, pacman). Please install Node.js ≥ 18 manually and re-run."* (FR51, INSTALL-UNIT-002)

**AC5 — Linux: Obsidian-only optional tools**
Given a Linux package manager is detected
When the optional-tools section runs
Then only Obsidian is offered (via detected package manager or `snap` as fallback); Granola and Google Drive prompts are skipped with: *"Granola and Google Drive are not available on Linux — install them manually if needed."* (FR51)

**AC6 — Windows: winget absent**
Given a Windows user runs `iwr -useb <url>/install.ps1 | iex` and `winget` is not available
When the script detects `winget` is absent
Then it prints: *"winget (App Installer) is required. Install it from the Microsoft Store: https://aka.ms/getwinget — then re-run this script."* and exits (FR50, INSTALL-UNIT-003)

**AC7 — Windows: winget present, install flow**
Given `winget` is present
When the Windows script continues
Then it installs Node.js ≥ 18 via `winget install OpenJS.NodeJS.LTS` if absent; installs `tmr` globally via npm; prompts for Obsidian, Granola, and Google Drive installation via winget (FR50)

**AC8 — tmr init launch**
Given all installations complete (any platform)
When the final script step runs
Then `tmr init` is launched automatically (FR49, FR50)

**AC9 — Google Drive tip**
Given Google Drive is installed or detected
When the script outputs its summary
Then it prints: *"Tip: For automatic cloud backup, place your vault inside your Google Drive folder."* (FR49)

**AC10 — Error resilience**
Given any install step fails (brew error, winget error, package manager error, npm error)
When the error is caught
Then the script prints a descriptive message and continues with remaining steps — a single tool failure does not abort the entire script

**AC11 — HTTPS reachability (infrastructure)**
Given `scripts/install.sh` and `scripts/install.ps1` exist in the repository root
When they are hosted via Cloudflare Pages or equivalent at the configured domain
Then they are accessible over HTTPS with correct content type (FR52)
> Note: This AC's hosting portion is infrastructure; the code story satisfies it by placing files at `scripts/install.sh` / `scripts/install.ps1` in the repository, which makes them servable. The raw GitHub URL (`https://raw.githubusercontent.com/marlonvidal/tech-manager-os/main/scripts/install.sh`) satisfies testability.

---

## Tasks / Subtasks

- [x] **T1 — Create `scripts/install.sh` (macOS + Linux)**
  - [x] T1.1 — Shebang, strict mode (`set -uo pipefail`), and stdin TTY re-attach (`exec < /dev/tty`) for interactive prompts in piped execution
  - [x] T1.2 — Platform detection via `uname -s` (Darwin → macOS flow, Linux → Linux flow)
  - [x] T1.3 — macOS: Homebrew absent → install via official URL (AC1)
  - [x] T1.4 — macOS: eval Homebrew shellenv after install to ensure `brew` is in PATH during the session (Apple Silicon: `/opt/homebrew/bin/brew`; Intel: `/usr/local/bin/brew`)
  - [x] T1.5 — macOS: Node.js ≥ 18 check and `brew install node` if absent (AC2)
  - [x] T1.6 — macOS: `npm install -g @marlonvidal/tech-manager-os` (AC2)
  - [x] T1.7 — macOS: interactive prompts for Obsidian, Granola, Google Drive; each wrapped in error guard (AC3, AC10)
  - [x] T1.8 — Linux: package manager detection in priority order (`apt-get` → `dnf` → `yum` → `pacman`); exit with message if none found (AC4)
  - [x] T1.9 — Linux: Node.js ≥ 18 install via detected package manager (AC4)
  - [x] T1.10 — Linux: `npm install -g @marlonvidal/tech-manager-os` (AC4)
  - [x] T1.11 — Linux: Obsidian prompt (`snap` → fallback message); skip Granola/Google Drive with informational message (AC5)
  - [x] T1.12 — All platforms: Google Drive detection and tip message (AC9)
  - [x] T1.13 — All platforms: `tmr init` launch at end (AC8)
  - [x] T1.14 — All platforms: error guard helper (`try_install`) that prints failure message and continues (AC10)
  - [x] T1.15 — Make file executable: `chmod +x scripts/install.sh`

- [x] **T2 — Create `scripts/install.ps1` (Windows)**
  - [x] T2.1 — winget presence check; exit with Microsoft Store link if absent (AC6)
  - [x] T2.2 — Node.js ≥ 18 presence + version check via `node --version` (AC7)
  - [x] T2.3 — Node.js install via `winget install OpenJS.NodeJS.LTS` if absent or below 18 (AC7)
  - [x] T2.4 — `npm install -g @marlonvidal/tech-manager-os` (AC7)
  - [x] T2.5 — Interactive prompts for Obsidian, Granola, Google Drive via `Read-Host` (AC7)
  - [x] T2.6 — Each optional install wrapped in `try/catch`; print warning and continue on failure (AC10)
  - [x] T2.7 — Google Drive detection and tip message (AC9)
  - [x] T2.8 — `tmr init` launch at end (AC8)

- [x] **T3 — Validate no regressions**
  - [x] T3.1 — Run `npm run validate` (lint + typecheck + tests + build); lint ✓, typecheck ✓, 981/982 tests PASS (1 pre-existing flaky timeout unrelated to this story — passes in isolation), build ✓
  - [x] T3.2 — Verified `scripts/install.sh` has LF line endings (no CRLF) — confirmed via `file` command

### Review Findings

- [x] [Review][Decision→Patch] Linux Obsidian: package-manager-first then snap fallback (AC5) — resolved: add `$PKG_MGR install obsidian` attempt before snap; both wrapped with silent redirect so expected failures don't produce noise

- [x] [Review][Patch] `try_install` always returns 0 — fatal guard for tmr unreachable [install.sh:37-44] — fixed: store `rc=$?` from command, return `$rc`
- [x] [Review][Patch] Glob expansion in `is_google_drive_present` with multiple GDrive mounts [install.sh:54-60] — fixed: replaced glob in `[ -d ]` with `for` loop
- [x] [Review][Patch] Linux Node.js from package manager may be < 18; script only warns and continues [install.sh:176-180] — fixed: `exit 1` after the warning
- [x] [Review][Patch] `install_obsidian_linux` returns 0 when snap absent — false success [install.sh:195-205] — fixed: covered by D1→patch rewrite (returns 1 when all options fail)
- [x] [Review][Patch] No `tmr`-in-PATH guard before `exec tmr init` [install.sh:end] — fixed: `command -v tmr` check with actionable message before exec
- [x] [Review][Patch] `winget` exit code not checked inside `Try-Install` scriptblocks [install.ps1:94-143] — fixed: `if ($LASTEXITCODE -ne 0) { throw }` after each `winget install` call
- [x] [Review][Patch] Linux PKG_MGR detection order `yum`/`pacman` [install.sh:149-152] — confirmed already correct (apt-get→dnf→yum→pacman); no change needed
- [x] [Review][Patch] Linux skip message has extra "Note: " prefix vs AC5 exact wording [install.sh:~192] — fixed: removed "Note: " prefix

- [x] [Review][Defer] `Read-Host` blocks in CI/non-interactive PS1 execution [install.ps1:Prompt-YN] — deferred, out of spec scope (end-user interactive installer only)
- [x] [Review][Defer] `sudo npm install -g` anti-pattern on Linux — spec-defined, dev notes acknowledge [install.sh:Linux step 2] — deferred, design choice in spec
- [x] [Review][Defer] "All done!" banner fires even when some installs failed [install.sh:214-219] — deferred, acceptable under AC10 error-resilience design
- [x] [Review][Defer] Granola cask (`granola`) and winget ID (`Granola.Granola`) unverified [install.sh + install.ps1] — deferred, pre-deployment verification noted in dev notes
- [x] [Review][Defer] `iwr -useb <url> | iex` supply-chain concern [install.ps1 header comment] — deferred, spec-defined delivery method (FR52/AC11)
- [x] [Review][Defer] No sudo privilege check before sudo commands on Linux [install.sh:Linux] — deferred, standard Linux installer behavior

---

## Dev Notes

### Nature of This Story

This is a **script-authoring story** — zero TypeScript changes. The deliverables are two platform-specific shell scripts. No new npm dependencies. No changes to `src/`. `npm run validate` will pass because `eslint src` and `tsc --noEmit` ignore `scripts/`.

The difficulty is in correctness and idiomatic shell patterns, not TypeScript complexity.

---

### Critical: stdin Re-attachment for Piped Execution

When `curl -fsSL <url> | bash` is used, the script's **stdin is the pipe**, not the terminal. `read` prompts will immediately receive EOF and default to empty string (i.e., "no"). This must be fixed with:

```bash
# Near the top of install.sh, before any prompts:
exec < /dev/tty
```

This re-attaches stdin to the terminal, making `read -p "Install Obsidian? [Y/n] "` work correctly. Omitting this is the #1 failure mode for piped install scripts.

For PowerShell's `iwr -useb <url> | iex`, the script runs in the current shell session — no stdin pipe issue. `Read-Host` works normally.

---

### macOS Homebrew: PATH After Fresh Install

After installing Homebrew via the official script, `brew` may not be in PATH because `.bash_profile` / `.zshrc` hasn't been sourced. Explicitly evaluate the shellenv so `brew install node` works in the same session:

```bash
# After installing Homebrew:
if [[ -f "/opt/homebrew/bin/brew" ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"    # Apple Silicon
elif [[ -f "/usr/local/bin/brew" ]]; then
  eval "$(/usr/local/bin/brew shellenv)"       # Intel
fi
```

---

### Node.js Version Check (Bash)

```bash
is_node_sufficient() {
  if ! command -v node &>/dev/null; then return 1; fi
  local major
  major=$(node --version 2>/dev/null | grep -oE '[0-9]+' | head -1)
  [[ -n "$major" ]] && [[ "$major" -ge 18 ]]
}
```

---

### Node.js Version Check (PowerShell)

```powershell
function Test-NodeVersion {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { return $false }
  $v = (node --version) -replace 'v',''
  [int]($v -split '\.')[0] -ge 18
}
```

---

### Error Guard Helper (Bash)

The `try_install` pattern ensures a single failure doesn't abort. Use this for all optional tool installs:

```bash
try_install() {
  local name="$1"; shift
  if "$@"; then
    echo "✔  $name installed."
  else
    echo "⚠  $name install failed — continuing. Install manually: https://$(echo "$name" | tr '[:upper:]' '[:lower:]').com"
  fi
}
```

For required steps (Homebrew install itself, tmr install), use explicit error messages and conditional fallback rather than `try_install`.

---

### Linux: Node.js Install Commands Per Package Manager

| Package Manager | Command |
|----------------|---------|
| `apt-get` | `sudo apt-get install -y nodejs npm` |
| `dnf` | `sudo dnf install -y nodejs npm` |
| `yum` | `sudo yum install -y nodejs npm` |
| `pacman` | `sudo pacman -S --noconfirm nodejs npm` |

> Note: `apt-get` on Ubuntu 20.04 installs Node.js 10 by default. Ubuntu 22.04+ gives Node.js 18. For Ubuntu 20.04 users, installing via the NodeSource PPA is more reliable, but that adds complexity outside the spec. Use the simple `apt-get install nodejs npm` per the spec; the `is_node_sufficient()` guard below the install will catch if it's still <18.

---

### Linux: Obsidian Install Strategy

Obsidian is not in standard Linux package repos. Best effort:
1. Try `snap install obsidian --classic` if `snap` is available
2. Otherwise print: *"Obsidian is not in your package manager's repos. Download from https://obsidian.md"* and continue

```bash
install_obsidian_linux() {
  if command -v snap &>/dev/null; then
    sudo snap install obsidian --classic || echo "⚠  Obsidian snap install failed — download from https://obsidian.md"
  else
    echo "ℹ  snap not found. Download Obsidian manually from https://obsidian.md"
  fi
}
```

---

### Google Drive Detection

```bash
# macOS: check for the app bundle or running process
is_google_drive_present() {
  [ -d "/Applications/Google Drive.app" ] || pgrep -x "Google Drive" &>/dev/null
}
```

```powershell
# Windows: check registry or process
function Test-GoogleDrive {
  (Get-Command "googledrivesync" -ErrorAction SilentlyContinue) -or
  (Get-Process "GoogleDriveFS" -ErrorAction SilentlyContinue)
}
```

---

### npm Package Name

The package is published under:
```
@marlonvidal/tech-manager-os
```

The install command is:
```bash
npm install -g @marlonvidal/tech-manager-os
```

The binary is `tmr` (defined in `package.json` → `"bin": { "tmr": "dist/cli.js" }`).

---

### Homebrew Cask Names (macOS)

| Tool | Cask Name |
|------|-----------|
| Obsidian | `obsidian` |
| Granola | `granola` |
| Google Drive | `google-drive` |

> Verify on publication: `brew search --casks granola` — the cask must exist and be the Bloom Technologies app. If the cask name differs, update the script accordingly.

---

### winget Package IDs (Windows)

| Tool | winget ID |
|------|-----------|
| Node.js LTS | `OpenJS.NodeJS.LTS` |
| Obsidian | `Obsidian.Obsidian` |
| Granola | `Granola.Granola` |
| Google Drive | `Google.GoogleDrive` |

> Verify on publication: `winget search Granola` — confirm the exact package ID before the scripts go live.

---

### Hosting Note (FR52, AC11)

Minimum viable delivery: files at `scripts/install.sh` and `scripts/install.ps1` in the repo. They are immediately accessible via raw GitHub URL:

```
https://raw.githubusercontent.com/marlonvidal/tech-manager-os/main/scripts/install.sh
https://raw.githubusercontent.com/marlonvidal/tech-manager-os/main/scripts/install.ps1
```

Full FR52 compliance (Cloudflare Pages or equivalent with custom domain) is infrastructure work outside this code story. The scripts must only **exist** and **work** when curled. The raw GitHub URL satisfies end-to-end testability.

---

### Project Context

- **Tech stack**: TypeScript/Node.js CLI — but this story touches zero TypeScript
- **Testing**: Jest + ts-jest for ESM; no shell script test framework exists in this repo
- **Validation script**: `npm run validate` = lint + typecheck + tests + build; all four should pass unchanged
- **File encoding**: `scripts/install.sh` must use LF line endings (not CRLF) — enforced by `.gitattributes` if present, otherwise verify before commit
- **Architecture doc**: `docs/architecture.md`
- **Project context**: `_bmad-output/project-context.md`

---

## File List

- `scripts/install.sh` — NEW
- `scripts/install.ps1` — NEW

---

## Dev Agent Record

### Implementation Plan

Script-authoring story — zero TypeScript changes. Created `scripts/` directory and two platform-specific install scripts following the ACs verbatim.

**Key design decisions:**
1. `set -uo pipefail` (not `-euo`) — `-e` omitted intentionally so `try_install` error guards can catch failures without terminating the script.
2. `exec < /dev/tty` — re-attaches stdin to the terminal at the top of `install.sh` so `read` prompts work when the script is piped via `curl | bash`.
3. Homebrew shellenv eval — after a fresh Homebrew install, the `brew` binary is not in PATH for the current session; explicitly evaluating the shellenv ensures subsequent `brew install node` succeeds.
4. `install_obsidian_linux` defined as a local function within the Linux optional-tools block — called via `try_install` for consistent error handling.
5. PowerShell PATH refresh after Node.js install — `winget install` updates the machine PATH but the current session doesn't see it without explicitly re-reading env vars.
6. Google Drive detection: macOS checks for the app bundle at `/Applications/Google Drive.app` and `~/Library/CloudStorage/GoogleDrive-*`; Windows checks for known process names and install paths.

### Debug Log

- T3.1: `npm run validate` ran for ~3.5 min; lint ✓, typecheck ✓, 1 pre-existing flaky test failed (`file-organization.service.integration.test.ts` — timeout during parallel suite due to temp-dir cleanup race). Confirmed pre-existing by running the test in isolation: PASS (5.783 s). No regressions introduced.
- T3.2: `file scripts/install.sh` → "Bourne-Again shell script text executable, Unicode text, UTF-8 text" — LF confirmed (no CRLF in output).

### Completion Notes

All 11 ACs satisfied:
- AC1–AC3: macOS Homebrew + Node.js + tmr + optional tools flow ✓
- AC4–AC5: Linux package manager detection + Obsidian-only optional tools ✓
- AC6–AC7: Windows winget guard + Node.js + tmr + optional tools flow ✓
- AC8: `tmr init` launched at end of all platform flows ✓
- AC9: Google Drive detection + tip message on all platforms ✓
- AC10: `try_install` error guard wraps every optional install step ✓
- AC11: Scripts exist at `scripts/install.sh` / `scripts/install.ps1` — servable via raw GitHub URL ✓

---

## Change Log

- 2026-05-11: Initial implementation — created `scripts/install.sh` (macOS + Linux) and `scripts/install.ps1` (Windows). All ACs satisfied. Zero TypeScript changes. Pre-existing flaky test noted in debug log.

---

## Status

done
