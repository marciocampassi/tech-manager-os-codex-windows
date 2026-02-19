# Obsidian + Granola Setup Guide

This guide covers setting up Obsidian as the vault interface for Tech Leadership OS and configuring Granola to automatically sync meeting notes into your `inbox/` folder.

---

## Overview

- **Obsidian** is used as the local-first vault viewer. Your Tech Leadership OS workspace folder *is* the Obsidian vault.
- **Granola** is the official meeting transcript capture tool. Meeting notes are automatically synced from Granola into the `inbox/` folder via the Granola Sync plugin.
- The `tmr process` command (or the `process-meeting-note` skill) then picks up those notes and routes them to the correct folders.

**Flow:**
```
Granola (records meeting) → Granola Sync plugin → inbox/ → tmr process → correct folders
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

## Step 3: Configure the Plugin

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

## Step 4: Verify the Integration

1. Make sure Granola has at least one meeting note synced
2. In Obsidian, trigger a sync: click the ribbon icon (calendar/sync icon in the left sidebar) or use the command palette (`Cmd+P`) → search **Granola Meetings Simple Sync: Sync meetings**
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

## Step 5: Run `tmr process`

Once notes are landing in `inbox/`, run:

```bash
tmr process
```

The system will:
1. Detect Granola-synced files by their frontmatter structure
2. Parse the `attendees`, `date`, `title`, and content
3. Convert all email addresses to `[[@email@domain.com]]` Obsidian wiki-links
4. Route the note to the correct destination (1:1 folder, team meeting, leadership folder, etc.)
5. Update context files for all identified people
6. Create `{email}.md` identity files for any new email addresses found

---

## How the Obsidian Graph View Works

The graph view (second screenshot in the reference images) shows connections between your notes. The connections are driven by `[[@email]]` wiki-links that the system generates during processing.

- Each person's `{email}/` folder contains a `{email}.md` file (e.g., `lee.vallery@willowtreeapps.com.md`)
- Every time that person is mentioned in a processed note, a `[[@lee.vallery@willowtreeapps.com]]` link is created
- Obsidian resolves that link to the `{email}.md` file and draws the connection in the graph
- Over time, the graph reveals the network of your relationships and meeting history

---

## Sync Frequency

By default, the plugin syncs every 15 minutes. You can adjust this in plugin settings. For immediate syncs, use the ribbon icon or command palette as described in Step 4.

---

## Troubleshooting

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
