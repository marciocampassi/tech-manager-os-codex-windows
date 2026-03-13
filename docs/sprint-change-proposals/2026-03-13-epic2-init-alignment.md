# Sprint Change Proposal — Epic 2: `tmr init` Alignment & Obsidian Plugin Setup

**Date:** 2026-03-13  
**Prepared by:** John (PM Agent)  
**Trigger:** User-reported misalignment between `tmr init` workspace structure and Epic 2 canonical paths, plus two new requirements (Obsidian plugin auto-install and wiki-link notation in all generated files).

---

## 1. Analysis Summary

### Issue

`tmr init` (Story 1.6) was implemented before Epic 2 was fully designed. As a result:

1. **Structural mismatch:** The workspace it creates uses `my-team/{email}/profile.md` (old flat structure), while Epic 2 commands operate on `my-teams/_members/{email}/{email}.md` (canonical multi-team structure). Running any Epic 2 command after `tmr init` would fail to find the expected paths.

2. **Leadership path mismatch:** `tmr init` creates `my-leadership/profile.md` (flat bootstrap file), but Epic 2 Story 2.4 expects `my-leadership/{email}/{email}.md`. The `tmr leadership add` command would create a duplicate structure.

3. **Career profile path mismatch:** `tmr init` creates `my-career/profile.md`, but the data architecture defines `my-career/{email}/{email}.md`.

4. **Missing directories:** `my-teams/_archived/`, `my-company/projects/` are not created by init but are required by Epic 2 commands.

5. **No Obsidian plugin setup:** The workspace is intended to be opened as an Obsidian vault, but no `.obsidian/` configuration or plugins are installed during init.

6. **No wiki-link notation:** Email references in generated files are plain text. Obsidian wiki-links (`[[...]]`) are not applied, breaking the graph view and cross-file navigation that is core to the product's value.

7. **`gender` field in `TeamMember`:** The gender field collected during onboarding is not part of the Epic 2 data schema and should be removed.

### Root Cause

Story 1.6 was written and implemented before Epic 2 stories were fully detailed. The workspace structure in `workspace-builder.ts` was based on a preliminary folder list that was subsequently superseded by the canonical Epic 2 structure.

---

## 2. Epic Impact Assessment

| Epic | Impact |
|------|--------|
| Epic 2 (current) | **Add Stories 2.7 and 2.8** to address the two new requirements. No existing stories need modification — the fixes are additive. |
| Epic 3+ | No impact — these epics depend on Epic 2 CLI commands, not on `tmr init` directly. |

**Checklist:**
- [x] Current epic (2) can still be completed — two new stories added
- [x] Future epics unaffected
- [x] No story removals or reordering needed
- [x] No new epics required

---

## 3. Artifact Impact

| Artifact | Change Required |
|----------|----------------|
| `docs/prd/epics/epic-2-complete-command-line-interface-implementation.md` | Add Stories 2.7 and 2.8 summaries; update expanded goal |
| `docs/stories/2.7.obsidian-plugin-setup-in-init.story.md` | **New file** — full story specification |
| `docs/stories/2.8.tmr-init-epic2-alignment.story.md` | **New file** — full story specification |
| `src/workflows/workspace-builder.ts` | Remove `my-team/`, add Epic 2 canonical dirs (Story 2.8) |
| `src/templates/onboarding.templates.ts` | Update all generators for new paths + wiki-links (Story 2.8) |
| `src/commands/init.command.ts` | New paths, `writeDefaultTeam()`, plugin service call (Stories 2.7, 2.8) |
| `src/workflows/onboarding.prompts.ts` | Remove gender prompt, add location (Story 2.8) |
| `src/types/onboarding.types.ts` | Remove `gender` from `TeamMember`, add `location?` (Story 2.8) |
| `src/services/obsidian-plugin.service.ts` | **New file** (Story 2.7) |
| All affected test files | Path and mock data updates (Stories 2.7, 2.8) |

**Architecture debts resolved:**
- ARCH-1.6-04: `my-leadership/profile.md` flat path → canonical `my-leadership/{email}/{email}.md`
- QA-1.6R-05: `generateCareerProfile` missing Epic 2 schema fields

---

## 4. Recommended Path Forward

**Option selected: Direct Adjustment (add Stories 2.7 and 2.8 to Epic 2)**

Rationale:
- No completed work needs to be rolled back — the Story 1.6 code is modified in-place by Story 2.8
- The changes are well-scoped and do not affect Epic 2 Stories 2.1–2.6
- Story 2.7 (Obsidian plugins) and Story 2.8 (init alignment) are independent and can be implemented in parallel or sequentially
- Suggested order: **2.8 first** (structural alignment is a prerequisite for correct manual testing), then **2.7** (plugin download is additive)

---

## 5. Specific Proposed Edits

### Edit 1: `docs/prd/epics/epic-2-complete-command-line-interface-implementation.md`

- Updated expanded goal to mention Stories 2.7 and 2.8
- Added Story 2.7 and 2.8 summaries before Story 2.6

### Edit 2: New story file `docs/stories/2.7.obsidian-plugin-setup-in-init.story.md`

Full story created. Key specs:
- `ObsidianPluginService` with `installPlugins()` and `downloadPluginFile()` methods
- Downloads `main.js`, `manifest.json`, `styles.css` from GitHub releases for 3 plugins
- Non-fatal on network failure
- Creates `community-plugins.json` and `app.json`

### Edit 3: New story file `docs/stories/2.8.tmr-init-epic2-alignment.story.md`

Full story created. Key specs:
- All workspace paths aligned to Epic 2 canonical structure
- All email references use `[[...]]` wiki-link notation
- `gender` field **kept** in `TeamMember` and member profile frontmatter; `location` field added
- `gender` added to Epic 2 Story 2.1 member profile schema (was missing; now canonical)
- Default team created when members are collected during init
- All tests updated

---

## 6. PRD MVP Impact

None. These changes improve correctness and usability of the existing `tmr init` command. No features are removed or deferred. The MVP scope is unchanged.

---

## 7. High-Level Action Plan

| Priority | Story | Assignee | Notes |
|----------|-------|----------|-------|
| 1 | Story 2.8: `tmr init` alignment | Dev (James) | Implement first — structural prerequisite |
| 2 | Story 2.7: Obsidian plugin setup | Dev (James) | Can follow immediately after 2.8 |

Both stories are "Ready for Development" and fully specified.

---

## 8. Agent Handoff Plan

- **PO/SM:** Add Stories 2.7 and 2.8 to the backlog at the top of Epic 2 (or after current in-progress story)
- **Dev (James):** Implement Story 2.8 first, then 2.7
- **QA (Quinn):** Review both stories after implementation using standard gate process

---

*Sprint Change Proposal approved and artifacts updated: 2026-03-13*
