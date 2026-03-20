# Sprint Change Proposal — Action Items Tracker with Google Docs Sync

**Date:** 2026-03-20  
**Author:** John (PM)  
**Status:** Proposed  
**Type:** New Requirement Addition

---

## 1. Issue Summary

A newly identified requirement needs to be added to Epic 2: when a team member is created (via `tmr init` onboarding or `tmr team add`), the system must automatically generate a structured **Action Items Tracker** file for that member and optionally create a linked Google Doc for collaborative tracking.

**Change trigger:** User request — new capability not captured in the original Epic 2 scope.  
**Nature:** Newly discovered requirement (not a regression or technical failure).  
**Urgency:** Medium — adds value to existing Epic 2 commands, no breaking changes.

---

## 2. Epic Impact Summary

| Epic | Impact |
|------|--------|
| **Epic 2 (current)** | New Story 2.9 added; touches `tmr init` and `tmr team add` |
| **Epic 1** | No impact |
| **Epics 3–8** | No impact |

**Scope verdict:** The change is additive. Epic 2's goal already covers "all commands support auto-create structures as needed." Adding action items files fits naturally within this mandate. Story 2.9 is a coherent extension — it does not require reordering or removing existing stories.

**Prerequisite dependency:** Story 2.9 depends on Story 2.1 (team management commands) and Story 2.8 (workspace alignment). Both are complete. Story 2.9 can be queued immediately.

---

## 3. Artifact Adjustment Needs

| Artifact | Change Required |
|----------|----------------|
| `docs/prd/epics/epic-2-complete-command-line-interface-implementation.md` | Add Story 2.9 entry |
| `docs/architecture/external-apis.md` | Add Google Drive API and Google Docs API sections |
| `docs/architecture/tech-stack.md` | Add `googleapis` npm package |
| `docs/stories/2.9.action-items-tracker-gdocs-sync.story.md` | **Create new** (see Section 5) |

---

## 4. Recommended Path Forward

**Selected Option: Direct Adjustment / New Story**

Add Story 2.9 to Epic 2. No rollback of completed stories needed. No MVP scope reduction. The feature is purely additive.

**Rationale:**
- Local `.md` creation is low-complexity; follows existing patterns from Stories 2.1–2.2
- Google Docs integration is gated behind a config flag — if the user opts out, zero impact on existing behavior
- AppScript sync is a documentation/guidance concern, not a blocking code requirement for the CLI itself
- `clasp` auto-deployment is optional, gracefully degraded to a setup guide if unavailable

**Risk:** Google OAuth2 flow in CLI context adds auth complexity. Mitigated by:
- Making the entire Google integration optional (config-gated)
- Using the proven `googleapis` package
- Treating Google integration as a progressive enhancement (skip it and still get the .md file)

---

## 5. Specific Proposed Edits

### 5.1 New Stories

→ **Create:** `docs/stories/2.9.task-view-commands.story.md` — FR7 time-based task view commands, formalized as the 9th Epic 2 story (previously un-numbered in requirements)

→ **Create:** `docs/stories/2.10.action-items-tracker-gdocs-sync.story.md` — Action Items Tracker with Google Docs Sync (renumbered from initial 2.9 draft after Story 2.9 was formalized)

Full story specs are the primary outputs of this proposal.

### 5.2 Epic 2 Document Update

**Updated `docs/prd/epics/epic-2-complete-command-line-interface-implementation.md`**:
- Expanded goal updated to mention Story 2.9 (Task Views) and Story 2.10 (Action Items)
- Story 2.9 (Task View Commands) entry added before closing `---`
- Story 2.10 (Action Items Tracker) entry added after 2.9
- Story 2.6 ordering corrected (moved back to canonical position)

```markdown
## Story 2.9: Time-Based Task View Commands
[tmr today, tmr this-week, tmr this-month, tmr this-quarter — reads my-tasks/{period}.md]

## Story 2.10: Action Items Tracker with Google Docs Sync
[action-items-{email}.md + Google Doc + AppScript via clasp]
```

### 5.3 Story 2.9 Validity Check

**Story 2.9 (Task View Commands — FR7):** Still valid. The `my-tasks/` directory was always planned (created by `tmr init` in Story 2.8). The four task files (`today.md`, `this-week.md`, `this-month.md`, `this-quarter.md`) are populated by Epic 3 Story 3.4, but the CLI read/display layer belongs in Epic 2. FR7 explicitly documents these as standalone commands. The open questions (Q1 in `open-questions-design-decisions.md`) around specific content are resolved by using a simple "display file content" approach for MVP.

### 5.4 Tech Stack Update

**Add to `docs/architecture/tech-stack.md`** tech stack table:

```markdown
| **Google API Client** | googleapis | 144.x | Google Drive & Docs API | Official Node.js client, OAuth2 support, Drive file creation, Docs formatting |
```

### 5.5 External APIs Update

**Add to `docs/architecture/external-apis.md`** — see full entry in the story's Dev Notes section.

---

## 6. High-Level Action Plan

| Step | Action | Owner |
|------|--------|-------|
| 1 | Formalize Story 2.9 (Task View Commands) | PM (John) — **this session** |
| 2 | Create Story 2.10 (Action Items Tracker) | PM (John) — **this session** |
| 3 | Update Epic 2 doc (2.9, 2.10, goal, ordering) | PM (John) — **this session** |
| 4 | Add `googleapis` + `which` to tech stack | Architect (Winston) — advisory only |
| 5 | Implement Story 2.9 | Dev Agent |
| 6 | Implement Story 2.10 | Dev Agent (after 2.9) |
| 7 | QA Stories 2.9 and 2.10 | Quinn (QA) |

---

## 7. PRD MVP Impact

**No scope reduction.** This is a feature addition within Epic 2's mandate. The MVP definition is unchanged. Google Docs integration is an enhancement, not a core requirement — the `.md` file creation alone satisfies the minimum viable behavior.

---

## 8. Agent Handoff Plan

- **PM → Dev Agent:** Story 2.9 is ready for implementation once user approves this proposal
- **Dev Agent:** implement Story 2.9 per the story spec
- **QA (Quinn):** review after implementation; apply `qa-checklist` as for prior Epic 2 stories

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-03-20 | 1.0 | Initial proposal — new requirement, Story 2.9 drafted | John (PM) |
| 2026-03-20 | 1.1 | Story 2.9 (Task View Commands / FR7) formalized; Action Items story renumbered to 2.10; clasp made recommended default-Yes path | John (PM) |
