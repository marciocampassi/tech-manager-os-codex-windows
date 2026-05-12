# install.ps1 — Bootstrap installer for tech-manager-os (tmr)
# Supports: Windows (winget)
# Usage:  iwr -useb https://raw.githubusercontent.com/marlonvidal/tech-manager-os/main/scripts/install.ps1 | iex
#
# Single tool failures are non-fatal: the script prints a warning and continues.

#Requires -Version 5.1
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

# ── Helpers ───────────────────────────────────────────────────────────────────

function Print-Step {
  param([string]$Text)
  Write-Host ""
  Write-Host "──────────────────────────────────────────" -ForegroundColor Cyan
  Write-Host "  $Text" -ForegroundColor Cyan
  Write-Host "──────────────────────────────────────────" -ForegroundColor Cyan
}

function Prompt-YN {
  param([string]$Question)
  $answer = Read-Host "$Question [Y/n]"
  return ($answer -eq '' -or $answer -match '^[Yy]')
}

function Try-Install {
  param([string]$Name, [scriptblock]$Block)
  try {
    & $Block
    Write-Host "✔  $Name installed." -ForegroundColor Green
  } catch {
    Write-Warning "⚠  $Name install failed — continuing. You can install it manually later."
    Write-Warning "   Error: $($_.Exception.Message)"
  }
}

function Test-NodeVersion {
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { return $false }
  try {
    $v = (node --version 2>$null) -replace '^v', ''
    $major = [int]($v -split '\.')[0]
    return $major -ge 18
  } catch {
    return $false
  }
}

function Test-GoogleDrive {
  $processes = @('GoogleDriveFS', 'googledrivesync')
  foreach ($proc in $processes) {
    if (Get-Process $proc -ErrorAction SilentlyContinue) { return $true }
  }
  # Check common install paths
  $paths = @(
    "$env:LOCALAPPDATA\Google\Drive",
    "$env:ProgramFiles\Google\Drive File Stream"
  )
  foreach ($p in $paths) {
    if (Test-Path $p) { return $true }
  }
  return $false
}

# ── Banner ────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   tech-manager-os (tmr) — Windows installer     ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan

# ── Step 1: winget check ──────────────────────────────────────────────────────

Print-Step "Step 1/4 — winget (App Installer)"

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  Write-Host "✖  winget (App Installer) is required." -ForegroundColor Red
  Write-Host "   Install it from the Microsoft Store: https://aka.ms/getwinget — then re-run this script."
  exit 1
}

Write-Host "✔  winget is available: $(winget --version)"

# ── Step 2: Node.js ───────────────────────────────────────────────────────────

Print-Step "Step 2/4 — Node.js"

if (Test-NodeVersion) {
  Write-Host "✔  Node.js $(node --version) already installed (≥ 18)."
} else {
  Write-Host "Installing Node.js LTS via winget..."
  Try-Install "Node.js LTS" {
    winget install --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0) { throw "winget exited with code $LASTEXITCODE" }
    # Refresh PATH so node is available in this session
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [System.Environment]::GetEnvironmentVariable('Path', 'User')
  }
  if (-not (Test-NodeVersion)) {
    Write-Warning "Node.js ≥ 18 still not detected after install. Restart your terminal and re-run if issues persist."
  }
}

# ── Step 3: tmr ───────────────────────────────────────────────────────────────

Print-Step "Step 3/4 — tmr (tech-manager-os)"

Write-Host "Installing tmr globally via npm..."
Try-Install "tmr" {
  npm install -g @marlonvidal/tech-manager-os
  if ($LASTEXITCODE -ne 0) { throw "npm exited with code $LASTEXITCODE" }
}

if (-not (Get-Command tmr -ErrorAction SilentlyContinue)) {
  Write-Host "✖  tmr command not found after install. Check that npm's global bin is in your PATH." -ForegroundColor Red
  Write-Host "   Run: npm install -g @marlonvidal/tech-manager-os"
  exit 1
}

# ── Step 4: Optional tools ────────────────────────────────────────────────────

Print-Step "Step 4/4 — Optional tools"
Write-Host "The following tools are recommended but not required. You can install them later."
Write-Host ""

if (Prompt-YN "Install Obsidian?") {
  Try-Install "Obsidian" {
    winget install --id Obsidian.Obsidian --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0) { throw "winget exited with code $LASTEXITCODE" }
  }
}

if (Prompt-YN "Install Granola?") {
  Try-Install "Granola" {
    winget install --id Granola.Granola --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0) { throw "winget exited with code $LASTEXITCODE" }
  }
}

if (Prompt-YN "Install Google Drive?") {
  Try-Install "Google Drive" {
    winget install --id Google.GoogleDrive --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0) { throw "winget exited with code $LASTEXITCODE" }
  }
}

# Google Drive tip
if (Test-GoogleDrive) {
  Write-Host ""
  Write-Host "💡 Tip: For automatic cloud backup, place your vault inside your Google Drive folder." -ForegroundColor Yellow
}

# ── Launch tmr init ───────────────────────────────────────────────────────────

Write-Host ""
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  All done! Launching tmr init to set up your vault..." -ForegroundColor Green
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""

tmr init
