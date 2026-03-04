# Sprint Change Proposal — Onboarding Refactor (2026-03-03)

**Prepared by:** Bob (Scrum Master)
**Date:** 2026-03-03
**Trigger:** QA-1.6R-04 — Story 1.6 ACs 5/6/7 stale after user-directed onboarding wizard simplification
**Status:** Applied

---

## Decision Summary

Story 1.6 ACs **left unchanged** — the original ACs 5, 6, 7 document features que serão re-implementadas futuramente por decisão de produto. Os campos foram temporariamente removidos do `tmr init`, não cancelados. O registro dos campos deferidos está em `docs/backlog/deferred-onboarding-extended-profile.md` (sem vínculo a nenhum épico).

---

## Change-Checklist Analysis

### §1 — Trigger & Context

| Item | Notes |
|------|-------|
| Triggering story | Story 1.6: Interactive Onboarding Workflow |
| Issue type | User-directed intentional temporary removal — not a bug or cancelled feature |
| Core problem | Dev implemented user-requested wizard simplification outside a formal story. Story 1.6 ACs 5/6/7 describe fields temporariamente removidos por decisão de produto. Os campos são **adiados, não cancelados**. |
| Product decision | Fields removed from init wizard now because downstream consumers (Epic 3–4 agents) are not yet implemented. Collecting rich data at init without a consumer adds friction with no value at this stage. |
| Evidence | QA gate `docs/qa/gates/1.6-onboarding-refactor.yml` (CONCERNS), 176/176 tests passing |

**Changes delivered outside story scope (in current codebase):**

| Change | Status |
|--------|--------|
| Removed `experienceYears`, `managementStyle`, `strengths`, `developmentAreas` from `ManagerProfile` + prompts | Temporary — registered in backlog |
| Removed `CareerGoals` type + `promptCareerGoals()` | Temporary — registered in backlog |
| Removed `expectations` from `LeadershipContext` + prompts | Temporary — registered in backlog |
| Added API documentation links printed before provider dropdown | Permanent — enhancement to Story 1.6 AC 2 |
| Added `TeamMember` type + `promptTeamMembers()` loop | New feature — delivered, sem story formal |
| Added `writeTeamMemberFiles()` + `my-team/{email}/profile.md` | New feature — delivered, sem story formal |
| Added `my-team/` to workspace scaffold | New feature — delivered |

---

### §2 — Epic Impact Assessment

| Epic / Story | Impact | Action |
|---|---|---|
| Epic 1, Story 1.6 | ACs 5/6/7 descrevem funcionalidades adiadas — **mantidos intactos intencionalmente** | None — do not modify |
| Backlog (sem épico) | Registro histórico criado para os campos deferidos | Arquivo em `docs/backlog/deferred-onboarding-extended-profile.md` |
| Epic 3, Story 3.1 (`tmr team add`) | No conflict — uses `my-teams/{team}/{email}/` (richer structure); init uses `my-team/{email}/` (bootstrap) | None |
| Epic 4, Stories 4.1/4.2 | Agents that read `my-career/profile.md` will find fewer fields until the deferred backlog item is implemented | Noted — Epic 4 work should not hard-depend on fields not yet collected at init |

---

### §3 — Artifact Conflicts

| Artifact | Conflict | Resolution |
|----------|----------|------------|
| `docs/stories/1.6.*.md` — ACs 5/6/7 | Descrevem funcionalidades com implementação adiada | ✅ **Left unchanged** — ACs remain as the future goal |
| `docs/prd/epic-details.md` — Story 1.6 | Same as above | ✅ **Left unchanged** |
| `docs/prd/requirements.md` — FR1 | Mentions "career goals and leadership context" — still accurate as long-term goal | ⚠️ **Flag for PM** — may want to note that full collection is deferred to the backlog item |
| `docs/prd/data-architecture.md` — Leader Profile schema | `experience_years`, `leadership_style`, `strengths`, `development_areas` defined; temporarily absent from generated `profile.md` | ⚠️ **Flag for Architect** — add note that init generates a bootstrap file; full schema populated when backlog item is prioritized |
| `docs/prd/data-architecture.md` — Folder structure | `my-team/` (singular) not in PRD folder tree | ⚠️ **Flag for Architect** — add `my-team/` with description distinguishing it from `my-teams/` |

---

### §4 — Path Forward

**Selected: Registrar e adiar (não modificar Story 1.6)**

- Story 1.6 ACs ficam como escritos — representam o estado final desejado para o wizard
- Registro de backlog criado em `docs/backlog/` sem vínculo a épico — será formalizado como story quando houver decisão de priorizar
- Codebase está correto e todos os testes passam
- No rollback needed

---

## Actions Taken

| Action | Status |
|--------|--------|
| Story 1.6 ACs left unchanged | ✅ Done |
| Registro de backlog criado (`docs/backlog/deferred-onboarding-extended-profile.md`) | ✅ Done |
| Sprint Change Proposal document created | ✅ This document |

---

## Open Items — Handoff Required

| ID | Who | What |
|----|-----|------|
| CP-01 | **PM** | Update `docs/prd/requirements.md` FR1 — note that full profile collection (career goals, management style, etc.) is deferred, not removed |
| CP-02 | **Architect** | Update `docs/prd/data-architecture.md` Leader Profile schema — note that `experience_years`, `leadership_style`, `strengths`, `development_areas` are temporarily absent from the `tmr init`-generated file |
| CP-03 | **Architect** | Add `my-team/` directory to workspace folder tree in `docs/prd/data-architecture.md` — describe it as a lightweight bootstrap distinct from `my-teams/` |
| CP-04 | **Architect/PM** | Confirm whether `brag-document.md` should be generated at `tmr init` (FR23 says yes; current code does not generate it) |
