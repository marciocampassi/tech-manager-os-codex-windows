# Obsidian Setup Guide

> Part of the [tech-manager-os](../../README.md) documentation. See also: [User Guide](../user-guide.md).

This guide covers setting up Obsidian as the primary daily workspace for Tech Leadership OS, including the two required plugins: **Granola Sync** (meeting note ingestion) and **Obsidian Terminal** (run `tmr` commands without leaving Obsidian).

---

## Overview

- **Obsidian** is the primary daily workspace. Your Tech Leadership OS workspace folder *is* the Obsidian vault.
- **Granola** is the official meeting transcript capture tool. Meeting notes are automatically synced from Granola into the `inbox/` folder via the Granola Sync plugin.
- **Obsidian Terminal** lets you run `tmr process`, `tmr today`, and all other CLI commands from a terminal panel inside Obsidian — no context switching required.
- An external IDE (Cursor, Claude Code, Gemini CLI) remains supported and is recommended for AI agent operations like 1:1 prep, performance reviews, and project reports.

**Full flow:**
```
Granola (records meeting)
  → Granola Sync plugin → inbox/
  → tmr process (run from Obsidian Terminal or any shell)
  → correct folders + context updates
```

**Recommended Obsidian layout:**
```
[ File tree ] | [ Active note ] | [ Terminal panel (bottom) ]
```

---

## Step 1: Install Obsidian

1. Download Obsidian from [https://obsidian.md](https://obsidian.md)
2. Install and open it
3. On the welcome screen, choose **Open folder as vault**
4. Navigate to and select your Tech Leadership OS project folder (e.g., `~/projects/tech-manager-os`)
5. Click **Open**

Obsidian will create a `.obsidian/` directory at the root of your project — this is normal and expected. It is gitignored by default.

> **Important:** Do not create a new vault in a separate folder. The Tech Leadership OS workspace folder itself is the vault.

---

## Step 2: Install the Granola Sync Plugin

The Granola Sync plugin ([philfreo/obsidian-granola-plugin](https://github.com/philfreo/obsidian-granola-plugin)) reads from Granola's local cache and writes meeting notes as Markdown files directly into your vault.

### Manual Installation (currently required — not yet in Obsidian directory)

1. Go to the [latest release](https://github.com/philfreo/obsidian-granola-plugin/releases/latest) on GitHub
2. Download the `.zip` file from the release assets
3. Extract the contents into your vault's plugin folder:
   ```
   <vault>/.obsidian/plugins/obsidian-granola-plugin/
   ```
   The folder should contain `main.js`, `manifest.json`, and `styles.css`
4. In Obsidian, open **Settings → Community plugins**
5. Turn off **Safe mode** if prompted
6. Find **Granola Meetings Simple Sync** in the installed plugins list and enable it

---

## Step 3: Configure the Granola Sync Plugin

After enabling the plugin, go to **Settings → Community plugins → Granola Meetings Simple Sync → Settings**.

Apply the following configuration:

| Setting | Value | Why |
|---|---|---|
| **Base folder** | Custom folder | Directs notes to a specific folder |
| **Custom base folder** | `inbox` | Routes all synced notes to your Tech Leadership OS inbox |
| **Filename pattern** | `{date}-{title}` | Produces sortable, descriptive filenames (e.g., `2026-02-19-Marlon-Lee.md`) |
| **Sync notes** | Enabled (toggle on) | Syncs the full AI-enhanced meeting notes |
| **Include Private Notes** | Your preference | Enable to include your raw private notes at the top |
| **Save notes as** | Individual files | One file per meeting |
| **Subfolder organization** | No subfolders (flat) | All notes land directly in `inbox/` — `tmr process` handles routing |

### Screenshot Reference

The settings panel should look like this after configuration:

- Base folder: **Custom folder**
- Custom base folder: **inbox**
- Filename pattern: **{date}-{title}**
- Sync notes toggle: **ON**

---

## Step 4: Install the Obsidian Terminal Plugin

The Obsidian Terminal plugin ([polyipseity/obsidian-terminal](https://github.com/polyipseity/obsidian-terminal)) integrates a full terminal inside Obsidian, so you can run `tmr` commands without switching to an external IDE or shell window.

### Installation via Community Plugins (recommended)

1. In Obsidian, open **Settings → Community plugins**
2. Turn off **Safe mode** if prompted
3. Click **Browse** and search for **Terminal**
4. Find **Terminal** by polyipseity and click **Install**, then **Enable**

### Manual Installation (alternative)

1. Go to the [latest release](https://github.com/polyipseity/obsidian-terminal/releases/latest) on GitHub
2. Download `main.js`, `manifest.json`, and `styles.css` from the release assets
3. Place them in:
   ```
   <vault>/.obsidian/plugins/terminal/
   ```
4. In Obsidian, open **Settings → Community plugins** and enable **Terminal**

### Configure the Terminal Plugin

After enabling, open the plugin settings (**Settings → Terminal**) and apply:

| Setting | Recommended value |
|---|---|
| **Default profile** | `zsh` (macOS/Linux) or `PowerShell` (Windows) |
| **Restore history** | Enabled — terminal state persists across Obsidian sessions |
| **Font size** | Your preference (12–14px is comfortable in a bottom panel) |

### Open a Terminal Panel

Three ways to open a terminal:
- **Ribbon**: Click the terminal icon in the left sidebar → select your shell profile
- **Command palette**: `Cmd+P` → search **Terminal: Open terminal** → select profile
- **Context menu**: Right-click any file or folder → **Open terminal here**

For the recommended bottom-panel layout:
1. Open a terminal via the ribbon or command palette
2. Drag the terminal tab to the bottom of the Obsidian window
3. Now you have: file tree (left) | active note (center) | terminal (bottom)

---

## Step 5: Verify the Granola Integration

1. Make sure Granola has at least one meeting note synced
2. In Obsidian, trigger a sync: click the ribbon icon (calendar/sync icon) or use `Cmd+P` → **Granola Meetings Simple Sync: Sync meetings**
3. Check that a file appears in your `inbox/` folder with a name like `2026-02-19-Meeting Title.md`
4. Open the file — it should have frontmatter similar to:

```yaml
---
granola_id: 51c3da32-def7-45ce-9117-f70a002994e2
granola_url: https://app.granola.ai/...
title: "Marlon / Lee"
date: 2026-02-11
created: 2026-02-11T14:29:22.630Z
updated: 2026-02-11T15:19:52.177Z
attendees:
  - "[[lee.vallery@willowtreeapps.com]]"
tags:
  - meeting
  - granola
---
```

This frontmatter is what the `process-meeting-note` skill uses for routing.

---

## Step 6: Run `tmr process` from the Obsidian Terminal

Once notes are landing in `inbox/`, run from the Obsidian Terminal panel (or any shell):

```bash
tmr process
```

The system will:
1. Detect Granola-synced files by their frontmatter structure
2. Parse the `attendees`, `date`, `title`, and content
3. Convert all email addresses to `[[@email@domain.com]]` Obsidian wiki-links
4. If routing confidence is low, pause and ask you to confirm the destination
5. Route the note to the correct destination (1:1 folder, team meeting, leadership folder, etc.)
6. Append dated excerpts to context files for all identified people
7. Create `{email}.md` identity files for any new email addresses found
8. Move the original transcript to `archive/{year}/{month}/inbox/` with routing metadata

---

## How the Obsidian Graph View Works

The graph view shows connections between your notes. The connections are driven by `[[@email]]` wiki-links that the system generates during processing.

- Each person's `{email}/` folder contains a `{email}.md` file (e.g., `lee.vallery@willowtreeapps.com.md`)
- Every time that person is mentioned in a processed note, a `[[@lee.vallery@willowtreeapps.com]]` link is created
- Obsidian resolves that link to the `{email}.md` file and draws the connection in the graph
- Over time, the graph reveals the network of your relationships and meeting history

---

## Sync Frequency

By default, the Granola plugin syncs every 15 minutes. You can adjust this in plugin settings. For immediate syncs, use the ribbon icon or command palette as described in Step 5.

---

## Troubleshooting

### Granola Sync

**Notes aren't appearing in `inbox/`:**
- Confirm Granola is installed and has recorded at least one meeting
- Check that the Custom base folder is set to exactly `inbox` (lowercase, no trailing slash)
- Try a manual sync via command palette

**Wrong folder — notes going to a folder named `Meetings`:**
- The default folder name in the plugin is `Meetings`. Make sure you changed it to `inbox` in settings.

**Filenames don't have date prefix:**
- Confirm Filename pattern is set to `{date}-{title}` (not the default `{date} {title}`)

**Plugin not showing in community plugins list:**
- Confirm you extracted the zip to `.obsidian/plugins/obsidian-granola-plugin/` (not a subfolder inside that)
- Restart Obsidian after placing the files

### Obsidian Terminal

**Terminal opens but `tmr` command not found:**
- Ensure you ran `npm install -g tech-manager-os` (or the local equivalent) in your regular shell first
- The terminal inherits your shell's `PATH` — confirm `which tmr` works in a regular terminal window
- If using `zsh`, make sure your `.zshrc` is sourced: try opening the profile as `zsh --login`

**Terminal panel disappears on restart:**
- Enable **Restore history** in the Terminal plugin settings — this persists the panel across sessions

**Hotkeys not working while terminal is focused:**
- This is by design. When the terminal is focused, Obsidian hotkeys are suspended so you can type special characters. Press `Ctrl+Shift+`` ` `` to unfocus the terminal and restore Obsidian hotkeys.
