# Sprint Change Proposal — 2026-04-29

**Project:** tech-manager-os
**Sprint Status at Change:** Epic 1 in-progress (Story 1.1 done; Stories 1.2–1.4 backlog)
**Change Scope:** Minor — Direct Adjustment
**Routed To:** Developer agent (Stories 2.1, 2.4, 2.5 — all backlog, no rework of completed work)

---

## Section 1: Issue Summary

### Problem Statement

During real-world daily usage, a recurring pain point emerged: changing a source-of-truth file inside a project (e.g., a participant roster, a date table, a decision log) causes several dependent documents to become silently stale. The cascade of required updates is easy to miss and hard to track manually.

### Context

A new Obsidian/Claude skill — `tmr-project-impact` — was designed and documented (`docs/TMR-PROJECT-IMPACT-SKILL.md`) to solve this problem. The skill:

1. Reads a `deps.yaml` manifest in a project folder declaring which files depend on which source-of-truth files
2. Detects git-tracked changes in declared sources
3. Produces a human-readable impact report with per-dependent suggestions — nothing applied automatically

The skill is ready. This change integrates it into the `tmr init` onboarding and `tmr project add` scaffolding flows so users get the benefit automatically rather than discovering it later.

### Discovery

Identified by Marlon from direct daily usage after Story 1.1 completed (2026-04-29).

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Impact |
|------|--------|
| Epic 1 (Shared Utilities & Relationship Removal) | None — Stories 1.2–1.4 unaffected |
| Epic 2 (tmr init Rework) | **Moderate additions** — 2 existing stories modified (2.1, 2.4), 1 new story added (2.5). All three are backlog; zero rework of completed work. |
| Epics 3–5 | None |

### Story Impact

| Story | Change Type | Detail |
|-------|-------------|--------|
| 2.1 Vault Scaffold & Folder Structure | AC addition | `CLAUDE.md` must contain project impact hook rule (FR36, INIT-UNIT-008) |
| 2.4 Sample Files, Skill Install, README & Post-Init Summary | AC addition | Install `tmr-project-impact` alongside `tmr-inbox` (FR35, INIT-INT-010b); update post-init summary hint (FR13) |
| **2.5 NEW** — `tmr project add` deps.yaml Scaffold | New story | `tmr project add` writes stub `deps.yaml` to new project directory (FR37, PROJ-UNIT-001) |

### Artifact Conflicts

| Artifact | Change |
|----------|--------|
| `_bmad-output/planning-artifacts/prd.md` | Added FR35, FR36, FR37; updated FR13, Must-Have Capabilities, Skill Registry Contract |
| `_bmad-output/planning-artifacts/epics.md` | Added FRs to inventory; updated FR Coverage Map; updated Epic 2 description and quality gates; modified Stories 2.1 and 2.4; added Story 2.5 |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Added `2-5-tmr-project-add-deps-yaml-scaffold: backlog`; updated `last_updated` |

### Technical Impact

- No new services required — `tmr-project-impact` install follows the identical `SkillRegistryService` pattern as `tmr-inbox`
- `CLAUDE.md` is already written by `InitService` (Story 2.1, INIT-UNIT-007) — adding the hook is a template content change only
- `tmr project add` is an existing command — `deps.yaml` write is a single `fs-extra.writeFile` call following existing patterns
- No architecture changes

---

## Section 3: Recommended Approach

**Option selected: Direct Adjustment**

All three affected stories are backlog. The change is additive — no completed work is modified, no epics are restructured, no rollbacks needed. Implementation follows existing patterns throughout.

| Dimension | Assessment |
|-----------|------------|
| Effort | Low — 3 targeted additions to backlog stories |
| Risk | Low — resilience contract already established by INIT-INT-010 for skill installs |
| Timeline impact | None — stories not yet started |
| Maintainability | High — skill install is a first-class pattern; `deps.yaml` is a plain YAML file |

---

## Section 4: Detailed Change Proposals

### PRD Changes (`prd.md`)

**Edit A — Must-Have Capabilities**

OLD:
```
automatic `tmr-inbox` skill install
```
NEW:
```
automatic `tmr-inbox` and `tmr-project-impact` skill install, `CLAUDE.md` with AI dependency-tracking hook
```

**Edit B — Skill Registry Contract**

OLD:
```
`tmr init` installs `tmr-inbox` as a default skill silently during onboarding
```
NEW:
```
`tmr init` installs `tmr-inbox` and `tmr-project-impact` as default skills silently during onboarding; skill install failures are logged but do not abort onboarding
```

**Edit C — FR13 (updated) + FR35 + FR36 (new, after FR10)**

- FR13 now includes hint to run `/tmr-project-impact <project-path> deps` after adding projects
- FR35: Auto-install `tmr-project-impact` during `tmr init`
- FR36: `CLAUDE.md` written during init contains AI agent rule for project change detection

**Edit D — FR37 (new, new "Project Management" section)**

- FR37: `tmr project add` scaffolds stub `deps.yaml` in new project directory

---

### Story 2.1 AC Addition

Added after existing INIT-UNIT-007 AC:

```
Given the `CLAUDE.md` is written to the vault root
When its content is inspected
Then it includes an instruction to AI agents: "Whenever any file changes inside
`my-company/projects/`, run `/tmr-project-impact` to check for dependent document
updates. Use `/tmr-project-impact <project-path> deps` to set up a project's
dependency manifest for the first time." (FR36, INIT-UNIT-008)
```

---

### Story 2.4 AC Additions

Added after existing INIT-INT-010 AC:

```
Given `InitService` installs `tmr-project-impact` via `SkillRegistryService`
When the network call succeeds
Then the skill files are written to `<workspace>/.claude/skills/tmr-project-impact/` (FR35)

Given `InitService` installs `tmr-project-impact` via `SkillRegistryService`
When the network call fails
Then the error is logged but onboarding continues (FR35, INIT-INT-010b)

Given integration tests mock both skill installs (one succeeds, one fails)
When the test runs
Then INIT-INT-010b passes: onboarding completes regardless of tmr-project-impact outcome
```

Post-init summary AC updated to mention `/tmr-project-impact <project-path> deps` hint.

---

### Story 2.5 (New)

**`tmr project add` — Scaffold `deps.yaml` for Dependency Tracking**

```
As a tmr user who just created a project via `tmr project add`,
I want a stub deps.yaml automatically created in the project folder,
So that I can run `/tmr-project-impact <project-path> deps` at any time
to set up dependency tracking without any manual file creation.

ACs: PROJ-UNIT-001 — deps.yaml exists in scaffolded project folder with correct
header and empty sources block; graceful error surfacing per NFR2.
```

---

## Section 5: Implementation Handoff

**Scope classification: Minor**

All changes are in backlog stories. No strategic or architectural decisions required.

| Story | Handoff | Action |
|-------|---------|--------|
| Story 2.1 | Developer agent | Add CLAUDE.md hook content to `InitService` template (INIT-UNIT-008) |
| Story 2.4 | Developer agent | Add second `SkillRegistryService.install('tmr-project-impact')` call with same resilience wrapper; update post-init summary string |
| Story 2.5 | Developer agent | Add `deps.yaml` stub write to existing `tmr project add` command handler |

**Success criteria:**

- `INIT-UNIT-008` passes: CLAUDE.md contains the `/tmr-project-impact` trigger rule
- `INIT-INT-010b` passes: onboarding completes when `tmr-project-impact` install fails
- `PROJ-UNIT-001` passes: `deps.yaml` stub exists after `tmr project add`
- `npm run validate` passes with all four steps (lint, typecheck, test, build)

---

*Approved by: Marlon — 2026-04-29*
*Generated by: Correct Course workflow*
