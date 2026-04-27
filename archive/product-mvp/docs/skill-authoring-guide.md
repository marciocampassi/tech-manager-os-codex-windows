# Skill Authoring Guide

> How to write, test, and publish Claude Code skills for `tech-manager-os`.

---

## What Is a Skill?

A **skill** is a `SKILL.md` file that Claude Code reads as a set of instructions for a slash command. Skills are installed into your vault at `.claude/skills/{skill-name}/SKILL.md` and invoked in Claude Code with `/{skill-name}`.

Skills are plain Markdown — no code to compile, no dependencies to manage. Claude Code parses the file and follows the instructions whenever you run the slash command.

**Key properties:**
- Skills run entirely inside Claude Code — no separate server or process
- Skills read their configuration from `CLAUDE.md` — never hardcode user-specific values
- Skills are distributable — anyone can install your skill with `tmr install <your-skill>`

---

## SKILL.md Structure

A well-formed `SKILL.md` has these sections (see `skills/tmr-inbox/SKILL.md` for the canonical reference):

```markdown
# {skill-name}

> One-line description of what the skill does.

---

## Prerequisites

What must be true before this skill can run:
- CLAUDE.md must exist (run `tmr init`)
- Any required tools or plugins
- One-time setup commands if needed

---

## Reading Context from CLAUDE.md

How the skill extracts user-specific values from CLAUDE.md.
List each variable and how to parse it.

---

## Commands

### /{skill-name}
Main command description and behavior.

### /{skill-name} setup (optional)
One-time setup command, if needed.

---

## Step-by-Step Instructions

The numbered steps Claude should follow when the command is invoked.
Be explicit — Claude follows these literally.
```

---

## Reference: `tmr-inbox` SKILL.md Walkthrough

The `tmr-inbox` skill (`skills/tmr-inbox/SKILL.md`) is the canonical reference implementation. Here's how its sections map to the structure above:

### Prerequisites Section

```markdown
## Prerequisites

1. **`CLAUDE.md` must be present and populated.** Run `tmr init` to generate it.
2. **Obsidian Dataview plugin must be installed.**
3. **Run `/tmr-inbox setup` before first use.**
```

The skill guards against missing configuration by listing prerequisites first. Claude will check these before proceeding.

### Reading Context from CLAUDE.md

```markdown
## Reading Context from CLAUDE.md

At the start of every `/tmr-inbox` command, read `CLAUDE.md` from the vault root
and extract the following variables:

### Identity Variables

Parse the `## Identity` section:
- **Name:** {OWNER_NAME}
- **Email:** {OWNER_EMAIL}
```

This is the most important pattern: **all user-specific values come from `CLAUDE.md`**. The skill extracts them at runtime, so the same `SKILL.md` file works for any user.

### Step-by-Step Instructions

The instructions section tells Claude exactly what to do in order:

```markdown
## Step 1: Read CLAUDE.md
Read the vault root CLAUDE.md and extract identity variables.

## Step 2: Scan inbox/
List all .md files in inbox/ that have Granola-style frontmatter.

## Step 3: For each file...
(routing logic, context updates, task extraction)
```

Be specific and sequential. Claude follows these as literal instructions — ambiguity causes errors.

---

## Reading from CLAUDE.md

Every skill should read `CLAUDE.md` at the start of execution. The standard identity section looks like:

```markdown
## Identity

- **Name:** Marlon Vidal
- **Email:** marlon@company.com
- **Role:** Engineering Manager
- **Company:** Acme Corp
```

Parse these with a simple regex or string match instruction in your skill:

```markdown
Read CLAUDE.md and extract:
- OWNER_NAME: the value after "**Name:**"
- OWNER_EMAIL: the value after "**Email:**"
- OWNER_ROLE: the value after "**Role:**"
```

**Never hardcode** a specific name, email, folder path, or company name in your `SKILL.md`. Every user value must be read from `CLAUDE.md` at runtime.

---

## Installing a Skill for Development

While developing your skill, copy it directly into your vault:

```bash
# Copy your skill directory to the vault's skills folder
cp -r ./my-skill your-vault/.claude/skills/my-skill/
```

> **Note:** `tmr install` only supports skills from the official registry. For local development, use the manual copy approach above.

Test the skill by opening Claude Code in your vault and running `/{your-skill-name}`.

**Iteration cycle:**
1. Edit `SKILL.md`
2. Run the slash command in Claude Code
3. Observe behavior, adjust instructions
4. Repeat

---

## Publishing to the Registry

### Step 1: Create a GitHub Repository

Create a public GitHub repository. The repository must contain `SKILL.md` at its root:

```
your-skill-repo/
└── SKILL.md
```

The repository name becomes the skill name (e.g., `tmr-meeting-prep` → `tmr install tmr-meeting-prep`).

### Step 2: Tag a Release

Tag your initial release so `tmr install` fetches a stable version:

```bash
git tag v1.0.0
git push origin v1.0.0
```

### Step 3: Install from GitHub

Users install your skill with:

```bash
tmr install your-org/your-skill-repo
```

`tmr install` fetches `SKILL.md` from the repository's default branch and installs it to `.claude/skills/{skill-name}/SKILL.md`.

### Step 4: List in the Registry (Optional)

To appear in the official `tmr` skills registry, open a PR to the registry index. Skills in the registry can be installed by short name:

```bash
tmr install tmr-meeting-prep   # instead of tmr install your-org/tmr-meeting-prep
```

---

## Best Practices

### Always Read CLAUDE.md Dynamically
Never hardcode any user value. Extract everything from `CLAUDE.md` at the start of each command invocation.

### Guard Your Prerequisites
List all prerequisites explicitly. A skill that fails silently because `CLAUDE.md` is missing is a bad experience. Tell Claude to check and report errors clearly.

### Keep Commands Composable
Prefer small, focused commands over one giant command that does everything. A `setup` sub-command for one-time initialization is a good pattern (see `tmr-inbox setup`).

### Write Idempotent Instructions
Your skill might be run multiple times on the same files. Design instructions so re-running them doesn't cause duplicate entries, corrupted files, or errors.

### Use Explicit File Paths
Don't rely on Claude's inference about where files are. State exact paths relative to the vault root:
- ✅ `Read {vault-root}/inbox/ for .md files`
- ❌ `Find the inbox folder`

### Test Edge Cases in Instructions
Write explicit instructions for edge cases:
- What if `inbox/` is empty?
- What if a file has no `attendees` frontmatter?
- What if a person's folder doesn't exist yet?

### Version Your Skill
Include a version comment at the top of your `SKILL.md`:
```markdown
<!-- version: 1.2.0 -->
# my-skill
```

This helps users know when `tmr update` has fetched a newer version.

---

## Example: Minimal Skill

Here's a minimal skill that greets the user by name from `CLAUDE.md`:

```markdown
# tmr-greet

> Greets you by name using your identity from CLAUDE.md.

---

## Prerequisites

- `CLAUDE.md` must exist in the vault root (run `tmr init`)

---

## Commands

### /tmr-greet

Read `CLAUDE.md` from the vault root. Extract the value after `**Name:**` in the `## Identity` section. Reply: "Good morning, {OWNER_NAME}! Ready to process your vault?"
```

Simple, self-contained, reads from `CLAUDE.md`, no hardcoded values.

---

## Related

- [User Guide](user-guide.md) — installing and using skills
- [tmr-inbox SKILL.md](../skills/tmr-inbox/SKILL.md) — reference implementation
- [README.md](../README.md) — `tmr install` and `tmr update` commands
