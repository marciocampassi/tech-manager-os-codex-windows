# Open Questions & Design Decisions

## Questions Requiring User Input

**Q1: Time-Based Task View Details**

What exactly should each time view show?

- **`tmr today`:**
  - Urgent tasks only? Or all tasks due today?
  - Should it show scheduled 1:1s automatically by reading calendar files?
  - Should it show "suggested actions" from last process run?
  - Format: Categorized list or priority-sorted?

- **`tmr this-week`:**
  - Weekly objectives or daily task rollup?
  - Should it predict capacity (days × hours)?
  - Should it show project milestones due this week?

- **`tmr this-month` and `tmr this-quarter`:**
  - More strategic (goals/objectives) or tactical (task list)?
  - Should these be manually curated or AI-generated?

**Q2: PIP vs Feedback Escalation**

When should the system suggest PIP initiation?

- After N constructive feedback items (what's N: 2, 3, 5)?
- Based on severity analysis by AI (flag "critical" issues)?
- Never suggest automatically (always manager decision)?
- Should there be a "concern" escalation level before PIP?

**Q3: Context Summary Growth Management**

How do we prevent context files from growing unbounded?

- Maximum context size (tokens/characters)?
- Summarization strategy: periodic compression, sliding window, hierarchical summaries?
- Should we keep separate "recent" (detailed) and "historical" (summarized) sections?
- Archival: Move old detailed context to archive after N months?

**Q4: Profile Collection - Team Member Engagement**

How do we encourage team members to complete profile collection?

- Should managers be able to schedule "profile interview" in the agent?
- Should the system send reminders (requires email integration)?
- Should profiles be mandatory or optional?
- What's the fallback if someone doesn't complete it?

**Q5: IDE Integration Priority**

Which IDE should we perfect first?

- **Cursor** (most popular in community)
- **Claude Code** (most natural for AI-native workflow)
- **Gemini CLI** (unique CLI-based approach)
- Or all three in parallel (slower but broader reach)?

**Q6: Transcript Format Specifics**

What transcript formats are most common for users?

- Plain text with speaker labels: "Manager: ... Member: ..."
- Markdown with headers: "## Manager\n...\n## Member\n..."
- JSON from tools like Otter.ai, Fireflies.ai: `{"speaker": "Manager", "text": "..."}`
- Should we support custom parsers per transcript source?

**Q7: Community Pack System (Post-MVP)**

For v1.1+ pack distribution:

- Host packs on GitHub (user installs via URL)?
- Create central registry/marketplace?
- How do users discover packs?
- Versioning strategy for packs?
- Security: how to validate community packs aren't malicious?

---
