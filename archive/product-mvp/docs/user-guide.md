# User Guide

> End-to-end walkthrough: from first install to daily use as an engineering manager.

---

## Prerequisites

Before you begin, ensure you have:

- **Node.js 18 or higher** (20.17.0 LTS recommended) — [nodejs.org](https://nodejs.org)
  ```bash
  node --version   # should output v18.x.x or higher
  ```
- **npm** — included with Node.js
- **An AI API key** from one of:
  - [OpenAI](https://platform.openai.com/api-keys) — GPT-4o recommended
  - [Anthropic](https://console.anthropic.com/) — Claude recommended
  - [Google AI Studio](https://aistudio.google.com/app/apikey) — Gemini

---

## Step 1: Installation

**Option A — Install globally (recommended):**
```bash
npm install -g @marlonvidal/tech-manager-os
tmr --version   # confirm it's installed
```

**Option B — Run without installing:**
```bash
npx @marlonvidal/tech-manager-os --version
npx @marlonvidal/tech-manager-os init
```

For the rest of this guide, we use `tmr` (global install). Substitute `npx @marlonvidal/tech-manager-os` if using Option B.

---

## Step 2: First Run — `tmr init`

`tmr init` scaffolds your entire vault and generates the `CLAUDE.md` context file that powers Claude Code skills.

```bash
tmr init
```

You'll be prompted for 5 pieces of information:

| Prompt | Example | Notes |
|--------|---------|-------|
| **Workspace path** | `~/my-workspace` | Where to create the vault on your machine (default: `~/tech-leadership-workspace`) |
| **Your name** | `Marlon Vidal` | Used in CLAUDE.md and context files |
| **Your work email** | `marlon@company.com` | Used as your identity throughout the vault |
| **Your role / title** | `Engineering Manager` | Included in CLAUDE.md context |
| **Your company / domain** | `acme.com` | Used in folder names and context |

After answering, `tmr init` creates:

```
your-vault/
├── CLAUDE.md                       ← Your identity + folder map for Claude Code
├── inbox/                          ← Drop meeting notes here
├── archive/
├── config/
├── my-career/
│   ├── assessments/
│   └── feedbacks/
├── my-leadership/
├── my-tasks/                       ← tasks.md + Dataview view files
├── my-teams/
│   ├── archived/
│   ├── feedback-templates/
│   ├── members/
│   └── teams/
├── my-company/
│   ├── meetings/
│   ├── members/
│   └── projects/
└── knowledge-base/
    ├── branding-guidelines/
    ├── company/
    ├── files/
    ├── people/
    ├── process/
    └── security/
```

> **Tip:** You can run `tmr init` in an existing Obsidian vault — it will add the folder structure without touching your existing notes.

---

## Step 3: Configure Your AI Provider — `tmr config`

`tmr process` uses AI to route and analyze your meeting notes. Set up your API key:

```bash
tmr config
```

This opens an interactive menu. Select **`set-key`** to add your API key:

```
? What would you like to do?
  show-security   — display how API keys are stored and their redacted values
❯ set-key         — add or update an API key for a provider
  delete-key
  switch-provider
```

You'll then be prompted to choose your provider (Gemini, OpenAI, or Claude) and paste your API key. The key is encrypted and stored locally — see [SECURITY.md](../SECURITY.md) for details.

**Check your stored key:**
```bash
tmr config show-security   # displays current provider and redacted key value
```

---

## Step 4: Install a Skill — `tmr install tmr-inbox`

Skills are Claude Code workflows installed into your vault's `.claude/skills/` directory. The primary skill is `tmr-inbox`, which routes meeting notes from `inbox/` to the right folders.

```bash
tmr install tmr-inbox
```

This fetches `tmr-inbox/SKILL.md` from the skills registry and installs it to:
```
your-vault/.claude/skills/tmr-inbox/SKILL.md
```

**Update all installed skills:**
```bash
tmr update
```

---

## Step 5: Process Your Inbox — `tmr process`

Once you have notes in `inbox/` (via Granola, manual copy, or any method), process them:

```bash
tmr process
```

The command will:
1. Scan `inbox/` for Markdown files with Granola-style frontmatter
2. Parse attendees, date, title, and content
3. Route each file to the correct folder (`my-teams/members/`, `my-leadership/`, etc.)
4. Rename files with a consistent date-based convention
5. Append dated excerpts to each person's context file
6. Extract tasks to `my-tasks/tasks.md`
7. Move originals to `archive/{year}/{month}/inbox/`

**If confidence is low**, `tmr process` will pause and ask you to confirm the destination before moving the file.

**Output flags:**
```bash
tmr process --plain   # No colors or spinners (good for logging)
tmr process --json    # JSON output for scripting or CI
```

---

## Step 6: Use the Claude Code Skill — `/tmr-inbox`

If you have Claude Code installed, you can run inbox processing as a Claude Code slash command — no CLI required:

1. Open Claude Code in your vault directory
2. Run `/tmr-inbox` in the chat
3. Claude reads `CLAUDE.md` for your identity and routing rules, then processes all files in `inbox/`

This is the recommended daily driver — Claude Code provides richer reasoning and can handle edge cases more gracefully than the CLI.

**First-time setup:**
```
/tmr-inbox setup
```
This creates `my-tasks/tasks.md` and the Dataview view files (`today.md`, `this-week.md`, etc.).

---

## Step 7: Daily Workflow

Once set up, your daily workflow looks like this:

```
1. You have meetings → Granola records and transcribes them
2. Granola Sync plugin → syncs transcripts into your vault's inbox/
3. Open Obsidian or Claude Code → run tmr process (or /tmr-inbox)
4. Notes are routed, tasks extracted, context files updated
5. Check my-tasks/tasks.md for any extracted action items
```

**Recommended morning routine:**
```bash
cd ~/your-vault
tmr process           # route yesterday's meetings
# or in Claude Code: /tmr-inbox
```

**Auto-mode (background watcher):**
```bash
tmr watch             # automatically processes new inbox files as they arrive
```

---

## Team Management

Keep your team roster up to date:

```bash
# Create a team first
tmr team create platform

# Add a team member (will prompt interactively if args omitted)
tmr team add platform alice@company.com

# Or just run without args and answer the prompts
tmr team add

# List all teams
tmr team list

# List members of a specific team
tmr team list platform

# Archive a former team member
tmr team archive platform alice@company.com

# Display full profile for any person
tmr show alice@company.com
```

Team members are stored in `my-teams/members/{email}/` with a Markdown profile file.

---

## Leadership and Projects

```bash
# Track your leadership chain
tmr leadership add ceo@company.com
tmr leadership list

# Track active projects
tmr project add "Platform Migration Q2"
tmr project list
```

---

## Obsidian Integration

For the best experience, open your vault in Obsidian and install the Granola Sync and Obsidian Terminal plugins. See the [Obsidian Setup Guide](setup/obsidian-setup.md) for step-by-step instructions.

With the Obsidian Terminal plugin, you can run `tmr process` from a terminal panel inside Obsidian — no context switching required.

---

## Troubleshooting

**`tmr: command not found`**  
→ Ensure `npm install -g tech-manager-os` completed successfully. Run `npm list -g tech-manager-os` to confirm.

**`tmr process` reports no files found**  
→ Confirm that `inbox/` exists in your vault and contains `.md` files with Granola-style YAML frontmatter (fields: `granola_id`, `date`, `attendees`).

**Routing confidence is always low**  
→ Check that your `CLAUDE.md` has the correct email addresses for your team members. Run `tmr team list` to verify.

**API key error during `tmr process`**  
→ Run `tmr config` again to re-enter your API key. Verify your key is valid and has available quota in your AI provider dashboard.

---

## Next Steps

- [Obsidian Setup Guide](setup/obsidian-setup.md) — Obsidian + Granola Sync + Terminal plugin
- [Skill Authoring Guide](skill-authoring-guide.md) — write and publish your own Claude Code skills
- [SECURITY.md](../SECURITY.md) — understand how your API key is stored
- [CHANGELOG.md](../CHANGELOG.md) — what changed in each release
