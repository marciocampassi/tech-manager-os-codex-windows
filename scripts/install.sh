#!/usr/bin/env bash
# install.sh — Bootstrap installer for tech-manager-os (tmr)
# Supports: macOS (Homebrew) and Linux (apt/dnf/yum/pacman)
# Usage:  curl -fsSL https://raw.githubusercontent.com/marlonvidal/tech-manager-os/main/scripts/install.sh | bash
#
# Single tool failures are non-fatal: the script prints a warning and continues.

set -uo pipefail

# ── Re-attach stdin to the terminal so prompts work when piped via curl | bash ──
if [ -t 0 ]; then
  : # already a terminal; nothing to do
else
  exec < /dev/tty || {
    echo "⚠  Could not attach to terminal for interactive prompts."
    echo "   Download and run the script directly instead of piping:"
    echo "   curl -fsSL https://raw.githubusercontent.com/marlonvidal/tech-manager-os/main/scripts/install.sh -o install.sh && bash install.sh"
    exit 1
  }
fi

# ── Helpers ──────────────────────────────────────────────────────────────────

print_step() { echo; echo "──────────────────────────────────────"; echo "  $1"; echo "──────────────────────────────────────"; }

prompt_yn() {
  # Usage: prompt_yn "Install Foo?" && <do it>
  local answer
  read -r -p "$1 [Y/n] " answer
  case "$answer" in
    [nN]|[nN][oO]) return 1 ;;
    *) return 0 ;;
  esac
}

# Runs a command, prints a warning on failure, and propagates the exit code.
try_install() {
  local name="$1"; shift
  local rc
  "$@" 2>&1
  rc=$?
  if [[ $rc -eq 0 ]]; then
    echo "✔  $name installed."
  else
    echo "⚠  $name install failed — continuing. You can install it manually later."
  fi
  return $rc
}

# Returns 0 if node ≥ 18 is available, 1 otherwise.
is_node_sufficient() {
  if ! command -v node &>/dev/null; then return 1; fi
  local major
  major=$(node --version 2>/dev/null | grep -oE '[0-9]+' | head -1)
  [[ -n "$major" ]] && [[ "$major" -ge 18 ]]
}

# Returns 0 if Google Drive appears to be present.
is_google_drive_present() {
  [ -d "/Applications/Google Drive.app" ] && return 0
  local _gd
  for _gd in "$HOME/Library/CloudStorage/GoogleDrive-"*/; do
    [ -d "$_gd" ] && return 0
  done
  pgrep -x "Google Drive" &>/dev/null
}

# ── Detect platform ───────────────────────────────────────────────────────────

OS=$(uname -s)

# ══════════════════════════════════════════════════════════════════════════════
#  macOS FLOW
# ══════════════════════════════════════════════════════════════════════════════
if [[ "$OS" == "Darwin" ]]; then

  echo
  echo "╔══════════════════════════════════════════════════╗"
  echo "║   tech-manager-os (tmr) — macOS installer       ║"
  echo "╚══════════════════════════════════════════════════╝"

  # ── Step 1: Homebrew ────────────────────────────────────────────────────────
  print_step "Step 1/4 — Homebrew"
  if ! command -v brew &>/dev/null; then
    echo "Homebrew not found. Installing via the official script..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  else
    echo "✔  Homebrew already installed."
  fi

  # Ensure brew is in PATH for the rest of this session (required after fresh install)
  if [[ -f "/opt/homebrew/bin/brew" ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"   # Apple Silicon
  elif [[ -f "/usr/local/bin/brew" ]]; then
    eval "$(/usr/local/bin/brew shellenv)"      # Intel
  fi

  if ! command -v brew &>/dev/null; then
    echo "✖  Homebrew installation failed or brew is still not in PATH."
    echo "   Please install Homebrew manually (https://brew.sh) then re-run this script."
    exit 1
  fi

  # ── Step 2: Node.js ─────────────────────────────────────────────────────────
  print_step "Step 2/4 — Node.js"
  if is_node_sufficient; then
    echo "✔  Node.js $(node --version) already installed (≥ 18)."
  else
    echo "Installing Node.js via Homebrew..."
    try_install "Node.js" brew install node
  fi

  # ── Step 3: tmr ─────────────────────────────────────────────────────────────
  print_step "Step 3/4 — tmr (tech-manager-os)"
  echo "Installing tmr globally via npm..."
  if ! try_install "tmr" npm install -g @marlonvidal/tech-manager-os; then
    echo "✖  tmr installation failed. Check your npm configuration and try: npm install -g @marlonvidal/tech-manager-os"
    exit 1
  fi

  # ── Step 4: Optional tools ──────────────────────────────────────────────────
  print_step "Step 4/4 — Optional tools"
  echo "The following tools are recommended but not required. You can install them later."
  echo

  if prompt_yn "Install Obsidian?"; then
    try_install "Obsidian" brew install --cask obsidian
  fi

  if prompt_yn "Install Granola?"; then
    try_install "Granola" brew install --cask granola
  fi

  if prompt_yn "Install Google Drive?"; then
    try_install "Google Drive" brew install --cask google-drive
  fi

  # Google Drive tip
  if is_google_drive_present; then
    echo
    echo "💡 Tip: For automatic cloud backup, place your vault inside your Google Drive folder."
  fi

# ══════════════════════════════════════════════════════════════════════════════
#  LINUX FLOW
# ══════════════════════════════════════════════════════════════════════════════
elif [[ "$OS" == "Linux" ]]; then

  echo
  echo "╔══════════════════════════════════════════════════╗"
  echo "║   tech-manager-os (tmr) — Linux installer       ║"
  echo "╚══════════════════════════════════════════════════╝"

  # ── Detect package manager ──────────────────────────────────────────────────
  PKG_MGR=""
  if   command -v apt-get &>/dev/null; then PKG_MGR="apt-get"
  elif command -v dnf     &>/dev/null; then PKG_MGR="dnf"
  elif command -v yum     &>/dev/null; then PKG_MGR="yum"
  elif command -v pacman  &>/dev/null; then PKG_MGR="pacman"
  fi

  if [[ -z "$PKG_MGR" ]]; then
    echo "✖  No supported package manager detected (apt, dnf, yum, pacman)."
    echo "   Please install Node.js ≥ 18 manually and re-run."
    exit 1
  fi

  echo "✔  Detected package manager: $PKG_MGR"

  # ── Step 1: Node.js ─────────────────────────────────────────────────────────
  print_step "Step 1/3 — Node.js"
  if is_node_sufficient; then
    echo "✔  Node.js $(node --version) already installed (≥ 18)."
  else
    echo "Installing Node.js via $PKG_MGR..."
    case "$PKG_MGR" in
      apt-get) try_install "Node.js" sudo apt-get install -y nodejs npm ;;
      dnf)     try_install "Node.js" sudo dnf install -y nodejs npm ;;
      yum)     try_install "Node.js" sudo yum install -y nodejs npm ;;
      pacman)  try_install "Node.js" sudo pacman -S --noconfirm nodejs npm ;;
    esac

    if ! is_node_sufficient; then
      echo "✖  Installed Node.js is below version 18. tmr requires Node.js ≥ 18."
      echo "   Install manually from https://nodejs.org or use nvm: https://github.com/nvm-sh/nvm"
      exit 1
    fi
  fi

  # ── Step 2: tmr ─────────────────────────────────────────────────────────────
  print_step "Step 2/3 — tmr (tech-manager-os)"
  echo "Installing tmr globally via npm..."
  if ! try_install "tmr" sudo npm install -g @marlonvidal/tech-manager-os; then
    echo "✖  tmr installation failed. Try manually: sudo npm install -g @marlonvidal/tech-manager-os"
    exit 1
  fi

  # ── Step 3: Optional tools (Obsidian only on Linux) ─────────────────────────
  print_step "Step 3/3 — Optional tools"
  echo "Granola and Google Drive are not available on Linux — install them manually if needed."
  echo

  if prompt_yn "Install Obsidian?"; then
    install_obsidian_linux() {
      local pkg_rc=1
      # 1. Try detected package manager first (AC5: package-manager or snap as fallback)
      case "$PKG_MGR" in
        apt-get) sudo apt-get install -y obsidian >/dev/null 2>&1; pkg_rc=$? ;;
        dnf)     sudo dnf install -y obsidian >/dev/null 2>&1; pkg_rc=$? ;;
        yum)     sudo yum install -y obsidian >/dev/null 2>&1; pkg_rc=$? ;;
        pacman)  sudo pacman -S --noconfirm obsidian >/dev/null 2>&1; pkg_rc=$? ;;
      esac
      [[ $pkg_rc -eq 0 ]] && return 0
      # 2. Fallback: snap
      if command -v snap &>/dev/null; then
        sudo snap install obsidian --classic
      else
        echo "ℹ  Neither the package manager nor snap could install Obsidian."
        echo "   Download it from https://obsidian.md/download"
        return 1
      fi
    }
    try_install "Obsidian" install_obsidian_linux
  fi

else
  echo "✖  Unsupported platform: $OS"
  echo "   This script supports macOS and Linux. For Windows, use install.ps1."
  exit 1
fi

# ══════════════════════════════════════════════════════════════════════════════
#  LAUNCH tmr init (all platforms)
# ══════════════════════════════════════════════════════════════════════════════
if ! command -v tmr &>/dev/null; then
  echo "✖  tmr is not in PATH after installation."
  echo "   Try opening a new terminal session and running: tmr init"
  exit 1
fi

echo
echo "══════════════════════════════════════════════════════"
echo "  All done! Launching tmr init to set up your vault..."
echo "══════════════════════════════════════════════════════"
echo

exec tmr init
