# Examples

This directory contains sample files to help you understand `tech-manager-os` before running `tmr init`.

---

## `sample-vault/`

A skeleton of the vault structure that `tmr init` creates. Use this to understand what the folder layout looks like before running the command on your own machine.

```
sample-vault/
├── CLAUDE.md              # Sample identity + folder map (edit with your own values)
├── inbox/                 # Where meeting notes land (empty by default)
├── my-teams/members/      # One folder per direct report (empty, populated by tmr team add)
└── my-tasks/tasks.md      # Sample tasks file with Dataview query
```

**Note:** Run `tmr init` to generate a real vault with your own identity values — don't use these sample files directly as your vault.

---

## `inbox-samples/`

Sample Granola-format meeting transcripts — the kind of files that land in your `inbox/` after Granola syncs. Use these to test `tmr process` without needing a real Granola account:

```bash
cp examples/inbox-samples/*.md your-vault/inbox/
tmr process
```

| File | Type | Description |
|------|------|-------------|
| `2026-04-10-Marlon-Alex.md` | 1:1 meeting | Engineering manager with a direct report |
| `2026-04-15-Team-Sync.md` | Team meeting | Weekly team sync with multiple attendees |

---

## Related

- [User Guide](../docs/user-guide.md) — how to use these examples in a real workflow
- [Obsidian Setup](../docs/setup/obsidian-setup.md) — how Granola Sync produces files like these automatically
