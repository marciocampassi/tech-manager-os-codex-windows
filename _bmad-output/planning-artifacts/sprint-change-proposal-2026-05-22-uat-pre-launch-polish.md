# Sprint Change Proposal — Epic 9: UAT Pre-Launch Polish

**Date:** 2026-05-22  
**Prepared by:** Developer Agent  
**Status:** Ready for Developer implementation

---

## Section 1: Issue Summary

### Problem Statement

During implementation of Epics 1–8, a cluster of architectural inconsistencies and functional gaps surfaced across the codebase that were not captured in the original PRD or epic specifications. These issues were discovered at UAT phase and span entity resolution, vault folder structure, frontmatter conventions, CLI command gaps, and environment tooling. Left unresolved, they would ship a product with divergent resolution paths, incomplete command coverage, and vault structures that break Obsidian navigation.

### Discovery Context

Issues were identified through:
- Implementation review of Stories 3.1–3.3 (member routing)
- UAT testing of `tmr member add`, `tmr show`, `tmr project`
- Comparison of vault structures across scope types (team, company, contractor, self, leadership)
- Review of `tmr doctor` coverage against the `ObsidianPluginService` plugin list
- `tmr init` testing revealing no offline/CI path

### Evidence

- `MemberService.findMemberGlobally()` and `createMember()` existed in parallel with `EmailResolutionService.resolve()` — two competing resolution paths with different results
- `my-career/` wrote `<email>/<email>.md` (nested) inconsistently with the decision that self has no subdirs
- `relationship` frontmatter was absent from all profiles despite being required for Obsidian graph navigation
- `tmr show <own-email>` returned "not found" even when a self-profile existed
- No `tmr myself` command existed for self-profile document management
- `tmr doctor` had no check for `community-plugins.json`
- `ObsidianPluginService` silently swallowed partial download failures
- `tmr init` had no way to skip network operations

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Impact |
|---|---|
| **Epic 1** (Shared Utilities) | [N/A] — utilities already created; `EmailResolutionService` is the resolution anchor |
| **Epic 2** (`tmr init`) | [!] `--scaffold-only` flag missing; domain routing prompt needs rewording; `organization.yaml` written inconsistently; Story 9.18 corrects |
| **Epic 3** (Team & Member Management) | [!] `addMember()` nested path bug; `findMemberGlobally()` divergence; contractor subdir parity gap — Stories 9.1, 9.5, 9.7, 9.9–9.12 address |
| **Epic 4** (Skill Ecosystem) | [N/A] — not affected |
| **Epic 5** (Open Source) | [N/A] — not affected |
| **Epic 6** (`tmr-myself-config`) | [x] Self-profile path updated to flat structure in Story 9.3 — prerequisite for Epic 6 |
| **Epic 7** (Zero-Friction Setup) | [!] `tmr doctor` community plugins check missing; `tmr init` plugin regression — Stories 9.17, 9.18 address |

### Story Impact

| Category | Stories |
|---|---|
| **Already written (9.1–9.13)** — locked prior to this session | No changes required |
| **Written this session (9.14–9.18)** | 5 new stories — ready for dev |

### Artifact Conflicts

| Artifact | Conflict | Resolution |
|---|---|---|
| `project-context.md` | Stale entity resolution rules; missing vault structure table | **Updated** — new `⚠ CRITICAL` section added 2026-05-22 |
| `epics.md` Stories 3.2 | `relationship` frontmatter value says `company` not `company-member`; contractor path format stale | Story 9.5 supersedes; dev agent must follow `project-context.md` over `epics.md` for these values |
| `epics.md` Story 2.1 | Scaffold creates `my-company/contractors/members/` — now correct (FR38) | [x] Already aligned |
| Architecture doc | Lazy-loading table references `relationship` command (deleted in Epic 1) | Story 1.4 AC already covers this update |

### Technical Impact

- **Deleted methods**: `MemberService.findMemberGlobally()` and `createMember()` — any story that references these is stale
- **New service**: `MyselfService` (Story 9.16) — new file, no regressions to existing services
- **New command**: `myself` registered as static import in `cli.ts`
- **New utility**: `appendToSection()` in `src/utils/markdown-section.ts` (Story 9.14) — shared, no regressions
- **`TeamService.showProfile()`** extended with self + contractor lookup steps (Story 9.15)
- **`DoctorService`** gets `checkCommunityPlugins()` check (Story 9.17)
- **`ObsidianPluginService`** gets improved failure reporting; `styles.css` treated as optional (Story 9.18)

---

## Section 3: Recommended Approach

**Option 1 (Direct Adjustment) — Selected.**

All 18 stories are additive corrections or net-new commands within the existing architecture. No rollback is needed. No MVP scope reduction is warranted. The changes align with and reinforce the existing `EmailResolutionService`-first architecture.

**Rationale:**
- Stories 9.1–9.18 do not introduce new architectural patterns — they enforce and complete patterns already established
- No completed stories need to be reverted
- Risk is low: most stories touch single services with isolated acceptance criteria
- Sequencing dependency (9.3 must land before 9.15 for self-profile resolution to work) is documented in story notes

**Effort:** Medium (18 stories, predominantly XS–S)  
**Risk:** Low  
**Timeline impact:** One focused sprint

---

## Section 4: Detailed Change Proposals

All story files are written and located at `_bmad-output/implementation-artifacts/9-*.md`. Summary:

### Stories written prior to this session (9.1–9.13) — locked

| Story | Summary | Effort |
|---|---|---|
| 9.1 | Unify entity resolution — delete `findMemberGlobally()` + `createMember()`, route all lookups through `EmailResolutionService.resolve()`, fix `addMember()` nested path writes | M |
| 9.2 | `.tmr` sentinel file for workspace anchoring | XS |
| 9.3 | `my-career` flat structure — `my-career/<email>.md`; update init, resolver, manager link | XS |
| 9.4 | `organization.yaml` domain inference from user email; `showUnsupportedFiles` in `app.json` | S |
| 9.5 | `relationship` frontmatter on all profiles (5 values: self, direct-report, leadership, company-member, contractor) | S |
| 9.6 | Leadership: location prompt + `tmr leadership add 1on1 <email>` subcommand | S |
| 9.7 | `tmr member add` location prompt + domain routing integration test | S |
| 9.8 | Shared email similarity utility (`src/utils/email-similarity.ts`) — warn on Levenshtein ≤ 2, applied to all email-accepting commands | M |
| 9.9 | `tmr member add feedback` fix — correct folder (`feedbacks/`), format, `--from` flag | S |
| 9.10 | `tmr member add assessment` + `performance-review` verification + tests | S |
| 9.11 | `tmr member add 1on1` auto-create + similarity check before write | S |
| 9.12 | `tmr team add` — `<email>-shared/` folder + `direct-report` frontmatter | XS |
| 9.13 | `tmr project standup` — `--date` flag + project wikilink in frontmatter | XS |

### Stories written this session (9.14–9.18) — new

| Story | Summary | Effort |
|---|---|---|
| 9.14 | `tmr project link-member/link-stakeholder` — write back-link under `## Projects` in linked profile; idempotent append via `appendToSection()` utility | S |
| 9.15 | `tmr show <email>` — add self + contractor lookup steps; route through `EmailResolutionService.resolve()`; new `'self'` and `'contractor'` location labels | XS |
| 9.16 | `tmr myself add performance-review` — new `myself` command + `MyselfService`; writes `YYYY-MM-performance-review-<own-email>.md` in `my-career/`; back-links into self profile | S |
| 9.17 | `tmr doctor` — `checkCommunityPlugins()` validates `community-plugins.json` lists all 4 required plugins; Linux info-only | XS |
| 9.18 | `tmr init --scaffold-only` skips network ops; plugin regression fix (per-plugin failure reporting, `styles.css` optional); version art consistency | S |

---

## Section 5: Implementation Handoff

### Scope Classification: **Moderate**

All 18 stories are implementation-ready with precise before/after diffs, file lists, and acceptance criteria. No PM or Architect involvement required. Handoff is directly to the Developer agent.

### Sequencing Constraints

The following ordering dependencies must be respected within a single sprint:

```
9.1  →  9.3  →  9.15   (self-profile resolution path must be flat before show works)
9.1  →  9.5             (relationship frontmatter requires correct addMember paths)
9.1  →  9.9, 9.10, 9.11 (createMemberFile must use resolve(), not findMemberGlobally)
9.14 requires appendToSection utility (create it in 9.14 story, reuse in 9.16)
```

All other stories are independent and can be executed in any order.

### Developer Agent Instructions

1. Read `project-context.md` before implementing any story — the `⚠ CRITICAL` section is the authoritative source for entity resolution and vault structure rules
2. `project-context.md` supersedes `epics.md` wherever they conflict (specifically: `relationship` values and contractor path format)
3. The deleted methods (`findMemberGlobally`, `createMember`, `ICreateMemberOptions`) must not be re-created under any name
4. Run `npm run validate` (lint + typecheck + test + build) before marking any story done
5. Stories 9.3 and 9.1 should be implemented first as they unblock the most downstream work

### Success Criteria

- All 18 story acceptance criteria pass
- `npm run validate` passes cleanly after each story
- Coverage thresholds (78% lines/functions/statements, 60% branches) maintained
- `tmr show <own-email>` returns self profile
- `tmr myself add performance-review` creates file in `my-career/`
- `tmr doctor` reports community plugins status
- `tmr init --scaffold-only` completes without network calls
- `tmr project link-member` writes back-link in member profile

---

## Appendix: Architectural Decisions Locked This Epic

All decisions are documented in `project-context.md` (updated 2026-05-22) and `epic9-session-resume.md`. Key highlights:

- `EmailResolutionService.resolve()` is the **only** entity lookup method — no exceptions
- Vault folder: nested `<scope>/<email>/<email>.md` for all scopes; flat `my-career/<email>.md` for self only
- `relationship` frontmatter is required on all profiles (5 canonical values)
- `organization.yaml` for domain routing — `domains.md` is deprecated
- `tmr leadership add 1on1` replaces `tmr leadership 1on1` (type-first pattern)
- Dated files: `1on1` uses full `YYYY-MM-DD`; all others use `YYYY-MM`
- `contractor: true` and `company:` fields removed — replaced by `relationship: contractor`
- Email similarity check shared utility (`email-similarity.ts`) applied to all email-accepting commands
- `<email>-shared/` folder created for team-scoped members only
