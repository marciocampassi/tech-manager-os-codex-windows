---
date: '2026-04-27'
project: 'tech-manager-os'
stepsCompleted: ['step-01-document-discovery', 'step-02-prd-analysis', 'step-03-epic-coverage-validation', 'step-04-ux-alignment', 'step-05-epic-quality-review', 'step-06-final-assessment']
status: 'complete'
documentsInventoried:
  prd: '_bmad-output/planning-artifacts/prd.md'
  epics: '_bmad-output/planning-artifacts/epics.md'
  architecture: 'docs/architecture.md'
  ux: null
---

# Implementation Readiness Assessment Report

**Date:** 2026-04-27
**Project:** tech-manager-os

---

## PRD Analysis

### Functional Requirements

| # | Requirement |
|---|---|
| FR1 | User can run `tmr init` to create a new vault through a guided interactive flow |
| FR2 | User can specify vault location during init, with the current working directory as the default |
| FR3 | System creates the standard vault folder structure during init, excluding `/utils` and `/my-teams/feedback-templates` |
| FR4 | User can provide their email, name, and role during init to generate their profile file under `my-career/` |
| FR5 | User can provide their leader's name, role, and email during init to generate a leadership file under `my-leadership/` |
| FR6 | User can specify how many teams they manage during init |
| FR7 | User can provide a team name for each team during init to create the corresponding team entry |
| FR8 | User can add members to each team during init by providing email, name, role, gender, and location per member |
| FR9 | User can finish adding members to a team by submitting an empty email input |
| FR10 | System automatically installs the `tmr-inbox` skill as part of every `tmr init` run |
| FR11 | System copies bundled sample inbox notes into the vault's inbox folder during init |
| FR12 | System generates a `README.md` in the vault root during init containing the most-used commands and a full command reference |
| FR13 | System displays a post-init next-steps summary directing the user to `tmr project add` and `/tmr-inbox` |
| FR14 | System displays post-init guidance to open Obsidian and enable required plugins *(nice-to-have: automated plugin enablement)* |
| FR15 | User can create a new team by providing a team name |
| FR16 | User can add a member to an existing team by providing a team name and member email |
| FR17 | System normalizes team names to lowercase/kebab-case on all team create and add operations |
| FR18 | User can create a company-scoped member profile by providing only an email, stored under `my-company/members/` |
| FR19 | User can create a team-scoped member profile by providing an email and a team name, stored under `my-teams/members/` |
| FR20 | System links team-scoped members to the current user as their manager, resolved from `my-career/<email>.md` |
| FR21 | User can provide a location when creating any member profile, stored in the profile frontmatter |
| FR22 | User can add feedback for a member identified by email |
| FR23 | System resolves a member's file via a global email resolver that searches both `my-company/members/` and `my-teams/members/` |
| FR24 | System auto-creates a company-scoped member profile when feedback is requested for an email not found in any member location |
| FR25 | User can install all available skills from the official skill registry in a single command |
| FR26 | User can install a specific skill from the official skill registry by name |
| FR27 | System accesses the skill registry through an abstracted service layer that supports future registry evolution |
| FR28 | System validates all email inputs before any file system operation and rejects invalid formats with a descriptive error |
| FR29 | System re-prompts the user on invalid input during interactive flows without losing progress or crashing |
| FR30 | System validates team count input during init as a positive integer greater than zero |
| FR31 | System normalizes all name and team name inputs to lowercase/kebab-case, confirming the normalized form in output |
| FR32 | System no longer exposes `tmr relationship` as a CLI command or in CLI help output |
| FR33 | System generates Obsidian wiki-link references (`[[email]]`) in all Markdown files that reference other entities — default output behavior across all commands |
| FR34 | Repository includes a `CONTRIBUTING.md` covering development setup, coding conventions, test process, PR guidelines, and skill submission process |

**Total FRs: 34**

### Non-Functional Requirements

| # | Requirement |
|---|---|
| NFR1 | `tmr init` must not leave the vault in a silently partial state on failure — any write error must be surfaced via `printError` to stderr with a clear message and recovery guidance before the process exits |
| NFR2 | No command may exit with an unhandled exception or stack trace visible to the user; all errors are caught and surfaced through `printError` |
| NFR3 | `tmr relationship` removal must produce zero dangling code references, registered commands, or help text entries |
| NFR4 | No prompt in the `tmr init` interactive loop may block for more than 3 seconds without a visible `ora` spinner indicating progress |
| NFR5 | File write operations for profile, member, and leader files must complete within 500ms under normal local I/O conditions |
| NFR6 | `tmr install` must handle skill registry failures (network error, timeout, malformed response) by surfacing a descriptive `printError` message without crashing; exit code must be non-zero on failure |
| NFR7 | The skill registry endpoint must be read from `SkillRegistryService` configuration — no hardcoded URLs in command or service files |

**Total NFRs: 7**

### Additional Requirements

- **ARCH-001–ARCH-007**: 7 architectural mandates (lazy loading, shared utilities, delegation patterns, template bundling)
- **ARCH-DEBT-001–002**: 2 architectural debt items to address during implementation
- **TEA-INFRA-001–006**: 6 test infrastructure prerequisites embedded in stories
- **TEA P0 Risk Gates (R-001–R-006)**: 6 quality gates tied to critical business and technical risks

### PRD Completeness Assessment

The PRD is thorough and well-structured. Requirements are unambiguously numbered, scoped to this release, and directly traceable. The brownfield context is clearly called out. Nice-to-have items are explicitly labeled. No ambiguities requiring clarification were identified.

---

## Epic Coverage Validation

### Coverage Matrix

| FR | PRD Summary | Epic / Story | Status |
|---|---|---|---|
| FR1 | `tmr init` guided interactive flow | Epic 2 / Story 2.1–2.4 | ✅ Covered |
| FR2 | Vault path defaults to CWD | Epic 2 / Story 2.1 | ✅ Covered |
| FR3 | Standard folder structure (exclusions) | Epic 2 / Story 2.1 | ✅ Covered |
| FR4 | User profile under `my-career/` | Epic 2 / Story 2.2 | ✅ Covered |
| FR5 | Leader profile under `my-leadership/` | Epic 2 / Story 2.2 | ✅ Covered |
| FR6 | Team count input during init | Epic 2 / Story 2.2 | ✅ Covered |
| FR7 | Team name input and folder creation | Epic 2 / Story 2.2 | ✅ Covered |
| FR8 | Member add loop (email, name, role, gender, location) | Epic 2 / Story 2.3 | ✅ Covered |
| FR9 | Empty email ends member loop | Epic 2 / Story 2.3 | ✅ Covered |
| FR10 | Auto-install `tmr-inbox` silently | Epic 2 / Story 2.4 | ✅ Covered |
| FR11 | Copy bundled sample inbox notes | Epic 2 / Story 2.4 | ✅ Covered |
| FR12 | Generate `README.md` in vault root | Epic 2 / Story 2.4 | ✅ Covered |
| FR13 | Post-init next-steps summary | Epic 2 / Story 2.4 | ✅ Covered |
| FR14 | Post-init Obsidian plugin guidance | Epic 2 / Story 2.4 | ✅ Covered |
| FR15 | `tmr team create <name>` | Epic 3 / Story 3.1 | ✅ Covered |
| FR16 | `tmr team add <name> <email>` | Epic 3 / Story 3.1 | ✅ Covered |
| FR17 | Team name normalization on all team ops | Epic 3 / Story 3.1 | ✅ Covered |
| FR18 | Company-scoped member → `my-company/members/` | Epic 3 / Story 3.2 | ✅ Covered |
| FR19 | Team-scoped member → `my-teams/members/` | Epic 3 / Story 3.2 | ✅ Covered |
| FR20 | Manager link from `my-career/<email>.md` | Epic 3 / Story 3.2 | ✅ Covered |
| FR21 | `location` field in member frontmatter | Epic 3 / Story 3.2 | ✅ Covered |
| FR22 | `tmr member add feedback <email>` | Epic 3 / Story 3.3 | ✅ Covered |
| FR23 | Global email resolver (both directories) | Epic 3 / Story 3.3 | ✅ Covered |
| FR24 | Auto-create company-scoped member on unknown feedback email | Epic 3 / Story 3.3 | ✅ Covered |
| FR25 | `tmr install` — all skills | Epic 4 / Story 4.1 | ✅ Covered |
| FR26 | `tmr install <skill-name>` — single skill | Epic 4 / Story 4.1 | ✅ Covered |
| FR27 | `SkillRegistryService` abstraction (no hardcoded URLs) | Epic 4 / Story 4.1 | ✅ Covered |
| FR28 | Email validation before FS ops | Epic 1 / Story 1.1 | ✅ Covered |
| FR29 | Re-prompt on invalid input (no crash, no progress loss) | Epic 1 / Story 1.1 | ✅ Covered |
| FR30 | Team count validated as integer > 0 | Epic 2 / Story 2.2 | ✅ Covered |
| FR31 | Name/team normalization to lowercase/kebab-case | Epic 1 / Story 1.2 | ✅ Covered |
| FR32 | Remove `tmr relationship` from CLI | Epic 1 / Story 1.4 | ✅ Covered |
| FR33 | Obsidian wiki-link format in all entity-referencing Markdown | Epic 1 / Story 1.3 | ✅ Covered |
| FR34 | `CONTRIBUTING.md` in repo root | Epic 5 / Story 5.1 | ✅ Covered |

### Missing Requirements

None.

### Coverage Statistics

- Total PRD FRs: 34
- FRs covered in epics: 34
- **Coverage: 100%** ✅

---

## UX Alignment Assessment

### UX Document Status

Not found. The epics document explicitly notes: *"N/A — `tech-manager-os` is a CLI tool with no graphical interface. No UX design document exists. All interaction patterns are terminal-based and fully specified in the PRD user journeys and functional requirements."*

### Alignment Issues

None. All user interaction patterns are fully specified through:
- PRD user journeys (4 journeys: happy path, edge cases, day-to-day changes, colleague onboarding)
- Functional requirements (FR1–FR14 for onboarding flow, FR28–FR31 for input validation UX)
- The established `display.ts` output contract (color-coded printSuccess/printError/printInfo/printWarning)
- `inquirer` prompt sequences specified in story acceptance criteria

### Warnings

✅ No warning issued — the absence of a UX document is intentional and appropriate for a CLI-only tool.

---

## Epic Quality Review

### Best Practices Validation Summary

| Epic | User Value | Independent | Stories Sized | No Forward Deps | ACs Testable |
|---|---|---|---|---|---|
| Epic 1 | ⚠️ Partial | ✅ | ✅ | 🟡 Minor gap | ✅ |
| Epic 2 | ✅ | ✅ | ✅ | ✅ | ✅ |
| Epic 3 | ✅ | ✅ | ✅ | 🟡 Minor gap | ✅ |
| Epic 4 | ✅ | ✅ | 🟡 Oversized | ✅ | ✅ |
| Epic 5 | ✅ | ✅ | ✅ | ✅ | ✅ |

---

### 🟠 Major Issues

#### ISSUE-M1: Epic 1 is a Technical Foundation Epic, Not a User-Value Epic

**Epic:** Epic 1 — Shared Input Contracts, Utilities & Relationship Removal

**Violation:** Stories 1.1, 1.2, and 1.3 deliver developer tooling (shared utility functions), not end-user value. The epic description itself says *"Engineers and downstream epics can rely on..."* — this is explicitly developer-centric language.

**Evidence:**
- Story 1.1 (Email Validation Utility): creates `src/utils/validation.ts` — no user-observable outcome
- Story 1.2 (Entity Slug Normalization Utility): creates `src/utils/normalization.ts` — no user-observable outcome
- Story 1.3 (File-Anchored Wiki-Link Utility): creates `src/utils/wiki-link.ts` — no user-observable outcome
- Story 1.4 (Remove `tmr relationship`): this IS user-facing ✅

**Impact:** Low risk operationally — the utilities are necessary prerequisites and the stories are well-scoped. However, if story tracking tools enforce user-value gates, Stories 1.1-1.3 will fail them.

**Recommendation:** Two options: (A) Accept as-is with an explicit "Foundation Epic" label and note in the epic description that this is a necessary pre-condition for all downstream epics; or (B) Embed utility creation as AC items within their first consuming story (e.g., "Given `validateEmail` from Story 1.1 is available, When..." becomes the first AC of Story 2.2 which creates it). Option A is lower risk for this brownfield project.

---

#### ISSUE-M2: NFR2, NFR4, and NFR5 Have No Owning Story

**NFRs affected:**
- **NFR2**: "No command may exit with an unhandled exception or stack trace visible to the user"
- **NFR4**: "No prompt in the `tmr init` interactive loop may block for more than 3 seconds without a visible `ora` spinner"
- **NFR5**: "File write operations for profile, member, and leader files must complete within 500ms"

**Violation:** These three NFRs are not referenced by any story's acceptance criteria. There is no traceability from NFR → story → test.

**Evidence from coverage map:** Only NFR1, NFR3, NFR6, and NFR7 appear in story ACs or the coverage table. NFR2, NFR4, NFR5 are absent from all story ACs and from the FR Coverage Map (which only maps FRs, not NFRs).

**Impact:** High risk. NFR4 (spinner timing) and NFR5 (file write performance) are performance NFRs with specific numeric thresholds. Without an owning story or test case, they will not be validated before release. NFR2 (unhandled exceptions) is a reliability NFR that could silently ship violated.

**Recommendation:** Add acceptance criteria to existing stories:
- NFR2 → Add a negative AC to Stories 2.1, 3.1, 3.2, 4.1: "Given any unexpected error occurs, When caught, Then `printError` is called and no stack trace is visible to the user"
- NFR4 → Add to Story 2.2 and 2.3: "Given a prompt step takes more than 500ms, When the delay begins, Then an `ora` spinner is shown until the step resolves"
- NFR5 → Optionally add a performance assertion to integration tests (e.g., `expect(elapsed).toBeLessThan(500)` around file write calls in init/member integration tests)

---

### 🟡 Minor Concerns

#### ISSUE-m1: Story 1.4 Auto-Create Routing Ambiguity Creates Potential Duplication with Story 3.2

**Stories:** Story 1.4 and Story 3.2

**Concern:** Story 1.4's AC states that when `RelationshipService` is removed from `EmailResolutionService._doResolve()`, the auto-create fallback should be "re-routed to write a company-scoped member profile directly to `my-company/members/<email>/`." Story 3.2 then independently implements `MemberService.addMember()` for the exact same path.

If Story 1.4 is implemented with inline write logic (to avoid a forward dependency on `MemberService`) and Story 3.2 later reimplements the same write logic, there will be two code paths writing to `my-company/members/` — a maintenance risk and a divergence point for frontmatter format.

**Recommendation:** Add explicit clarification to Story 1.4's implementation notes: "The inline auto-create logic written in Story 1.4 MUST be refactored to delegate to `MemberService.addMember()` as part of Story 3.2, when `MemberService` is available." This makes the intended two-phase implementation explicit and prevents the inline logic from becoming permanent.

---

#### ISSUE-m2: Story 3.3 Has an Implied Dependency on Story 3.2

**Stories:** Story 3.3 and Story 3.2

**Concern:** Story 3.3's auto-create path (`my-company/members/<email>.md`) is the same directory as Story 3.2's company-scoped member routing. If implemented out of order, Story 3.3 would need to duplicate the company-member write logic rather than calling `MemberService.addMember()`.

**Recommendation:** Add an explicit note to Story 3.3: "This story must be implemented after Story 3.2 — the auto-create uses `MemberService.addMember()` without `--team` flag."

---

#### ISSUE-m3: Architecture Document Still Lists `relationship` as a Static Import Command

**Document:** `docs/architecture.md`, Lazy Loading section

**Concern:** The architecture's Lazy Loading table reads:
> *Static imports: `config, team, member, leadership, project, relationship, task-view`*

After Story 1.4 removes the relationship command, this table will be stale. An implementor reading the architecture doc post-Story-1.4 could be confused.

**Recommendation:** Add to Story 1.4's AC: "Given `docs/architecture.md` references `relationship` in the lazy loading table, When Story 1.4 is implemented, Then `docs/architecture.md` is updated to remove `relationship` from the static import list."

---

#### ISSUE-m4: Architecture Workspace Diagram Missing `my-company/members/`

**Document:** `docs/architecture.md`, Workspace Structure section

**Concern:** The workspace tree diagram shows `my-company/projects/` but omits `my-company/members/`. However, FR18, FR24, Story 2.1, Story 3.2, and Story 3.3 all depend on this directory existing. An implementor reading only the architecture for workspace structure would not see it.

**Recommendation:** Update `docs/architecture.md` workspace diagram to add `├── my-company/members/` below `my-company/projects/`. This can be done in Story 1.4 or Story 3.2.

---

#### ISSUE-m5: ARCH-DEBT-001 Has No Owning Story

**Requirement:** ARCH-DEBT-001 — Remove deprecated `AppConfig.provider` and `AppConfig.apiKey` fields after all callers migrated.

**Concern:** This item appears in the epics doc's Additional Requirements section but is not referenced in any story's acceptance criteria. It has no owner and no definition of "done."

**Recommendation:** Embed ARCH-DEBT-001 into Story 1.1 (the shared utilities story in Epic 1) as a cleanup AC, since that story already touches the validation infrastructure. Add: "Given `AppConfig.provider` and `AppConfig.apiKey` are deprecated, When Story 1.1 is implemented, Then a negative test asserts that no source file uses these deprecated fields, and the fields are removed from the `AppConfig` type."

---

#### ISSUE-m6: Story 4.1 Is Toward the High End of Story Sizing

**Story:** Story 4.1 — `tmr install` Skill Registry Integration

**Concern:** This single story covers: two commands (`tmr install` and `tmr install <name>`), registry abstraction layer, four error scenarios (timeout, 404, malformed response, general failure), exit code handling, and integration tests. That is 7+ distinct Given/When/Then ACs and spans both command implementation and infrastructure design.

**Impact:** Low — the story is well-specified and all ACs are testable. However, it is the most implementation-dense story in the epics.

**Recommendation:** Accept as-is if delivery confidence is high. If splitting is preferred, Story 4.1a could be "SkillRegistryService + basic install-all" and Story 4.1b "install by name + all error handling + exit codes."

---

### Brownfield Correctness Check

| Check | Result |
|---|---|
| Integration points with existing services called out | ✅ (EmailResolutionService, TeamService, MemberService brownfield notes) |
| Migration / compatibility stories present | ✅ (ARCH-DEBT-001, Story 1.4 backward compat, Story 1.3 deprecation of old wiki-link) |
| Relationship removal has no dangling references plan | ✅ (Story 1.4 ACs are comprehensive — source, tests, CLI help, fallback re-route) |
| Deprecated fields addressed | 🟡 No owning story (ISSUE-m5) |

---

## Summary and Recommendations

### Overall Readiness Status

## ✅ READY — with recommended improvements before implementation begins

The planning artifacts are well-structured, traceable, and internally consistent. All 34 FRs are covered. The brownfield context is clearly documented. Story ACs are specific and testable in BDD format. The epics flow logically from utilities → onboarding → team management → skills → docs.

**The project can proceed to implementation.** The issues identified below are recommendations that reduce risk — they do not block execution.

---

### Issues Summary

| ID | Severity | Title | Blocking? |
|---|---|---|---|
| ISSUE-M1 | 🟠 Major | Epic 1 is a technical foundation epic | No |
| ISSUE-M2 | 🟠 Major | NFR2, NFR4, NFR5 have no owning story or test | No |
| ISSUE-m1 | 🟡 Minor | Story 1.4 auto-create routing ambiguity vs Story 3.2 | No |
| ISSUE-m2 | 🟡 Minor | Story 3.3 has undeclared dependency on Story 3.2 | No |
| ISSUE-m3 | 🟡 Minor | Architecture doc still lists `relationship` as static import | No |
| ISSUE-m4 | 🟡 Minor | Architecture workspace diagram missing `my-company/members/` | No |
| ISSUE-m5 | 🟡 Minor | ARCH-DEBT-001 has no owning story | No |
| ISSUE-m6 | 🟡 Minor | Story 4.1 is toward the high end of story sizing | No |

**Total issues: 8** (0 Critical, 2 Major, 6 Minor)

---

### Recommended Next Steps

1. **Address NFR ownership before first sprint starts (ISSUE-M2)** — Add NFR2/NFR4/NFR5 acceptance criteria to their respective stories. NFR4 (spinner timing) in particular is a user-visible quality commitment that should have a test.

2. **Annotate Epic 1 as a Foundation Epic (ISSUE-M1)** — Add one sentence to the epic description: *"Note: This is a foundation epic. Stories 1.1–1.3 create shared utilities with no direct user-visible output; their value is unlocked by all downstream epics."* This prevents process-gate failures in tools that enforce user-value checks.

3. **Clarify Story 1.4's auto-create strategy and add an explicit ordering note to Story 3.3 (ISSUE-m1, ISSUE-m2)** — These are the only two cross-story coordination risks. A brief implementation note in each story's description resolves both.

4. **Update architecture document (ISSUE-m3, ISSUE-m4)** — Two small fixes: remove `relationship` from the lazy-loading table and add `my-company/members/` to the workspace diagram. These are best done as part of Story 1.4 or as a pre-sprint document cleanup pass.

5. **Assign ARCH-DEBT-001 to a story (ISSUE-m5)** — Embed into Story 1.1 as a cleanup AC. Without an owner, this debt will persist indefinitely.

6. **Optionally split Story 4.1 if sprint velocity is a concern (ISSUE-m6)** — Only act on this if the team determines Story 4.1 exceeds one developer's sprint capacity.

---

### Final Note

This assessment examined: 1 PRD (34 FRs, 7 NFRs), 1 architecture document, 1 epics document (5 epics, 9 stories), and 7 additional architectural requirements. FR coverage is 100%. UX coverage is intentionally N/A. The 8 issues found are all addressable without rework to the core planning structure.

**The artifacts are ready for sprint planning and story-level implementation.**

*Assessment completed: 2026-04-27*
*Assessor: Implementation Readiness Check Skill*
