# Epic 9 — UAT Pre-Launch Polish: Session Resume File

> **Purpose:** Captures the full state of the Epic 9 planning session so work can resume from any context window boundary.  
> **Last updated:** 2026-05-22  
> **Session mode:** Incremental — one story at a time, discuss → lock → write file → move on.

---

## What Has Been Done This Session

### 1. `project-context.md` updated (high-priority rules added)

File: `_bmad-output/project-context.md`

New section added: **`⚠ CRITICAL: Canonical Entity Resolution & Vault Structure`** — covers:
- `EmailResolutionService.resolve()` as the single authoritative lookup method
- `findMemberGlobally()` and `createMember()` are **deleted** — called out by name as stale if seen
- Nested `<email>/<email>.md` folder pattern for all scopes (table)
- `my-career/<email>.md` is flat (single exception)
- Required `relationship` frontmatter on all profiles (table)
- `organization.yaml` for domain routing (not `domains.md`)
- Dated file naming convention (table)
- Contractor subdirs = same four as company member (full parity)

### 2. Story 9.1 written

File: `_bmad-output/implementation-artifacts/9-1-unify-entity-resolution-and-folder-structure.md`

Status: **Ready for dev**

Key decisions locked:
- `addMember()` fixed to write nested paths for team and company scope
- Contractors get full subdir parity: `1on1s/`, `feedbacks/`, `assessments/`, `performance-reviews/`
- `findMemberGlobally()` **deleted** (not deprecated)
- `createMember()` **deleted** (not deprecated)
- `ICreateMemberOptions` type deleted with `createMember()`
- `createMemberFile()` re-routed through `EmailResolutionService.resolve()`
- `IEntityLocation.type` gains `'contractor'`
- `_doResolve()` gets contractor step 3.5
- TODO comments planted for Story 9.3 in `_resolveManagerLink()` and self-profile step

---

## Current Position

**All 18 stories written. Sprint Change Proposal produced.**

File: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-22-uat-pre-launch-polish.md`

---

## Full Locked Story List (Epic 9)

| # | Story | Status | File |
|---|---|---|---|
| 9.1 | Unify entity resolution + enforce nested folder pattern | **Written** | `9-1-unify-entity-resolution-and-folder-structure.md` |
| 9.2 | Workspace anchoring (`.tmr` sentinel file, like git) | **Written** | `9-2-workspace-anchoring-tmr-sentinel.md` |
| 9.3 | `my-career` flat structure (`my-career/<email>.md`, no subfolder) | **Written** | `9-3-my-career-flat-structure.md` |
| 9.4 | `organization.yaml` domain inference from user email + `showUnsupportedFiles` in `app.json` | **Written** | `9-4-organization-yaml-domain-inference-and-obsidian-config.md` |
| 9.5 | `relationship` frontmatter on all profiles | **Written** | `9-5-relationship-frontmatter-all-profiles.md` |
| 9.6 | Leadership: location prompt + `tmr leadership add 1on1 <email>` subcommand | **Written** | `9-6-leadership-location-and-1on1-subcommand.md` |
| 9.7 | `tmr member add`: location prompt + domain routing integration test | **Written** | `9-7-member-add-location-prompt-and-routing-integration.md` |
| 9.8 | Shared email similarity utility applied to all email-accepting commands | **Written** | `9-8-email-similarity-warning.md` |
| 9.9 | `tmr member add feedback` fix — folder name (`feedbacks/`), format, `--from` flag | **Written** | `9-9-member-feedback-fix.md` |
| 9.10 | `tmr member add assessment` + `performance-review`: verification & tests | **Written** | `9-10-member-assessment-and-performance-review.md` |
| 9.11 | `tmr member add 1on1`: auto-create + similarity check before write | **Written** | `9-11-member-add-1on1-subcommand.md` |
| 9.12 | `tmr team`: `<email>-shared/` folder + `direct-report` frontmatter | **Written** | `9-12-team-shared-folder-and-direct-report-frontmatter.md` |
| 9.13 | `tmr project standup` — `--date` flag + wikilink to project file | **Written** | `9-13-project-standup-date-flag-and-wikilink.md` |
| 9.14 | `tmr project` — bidirectional member/stakeholder links | **Written** | `9-14-project-bidirectional-member-stakeholder-links.md` |
| 9.15 | `tmr show` — self-profile lookup fix | **Written** | `9-15-show-self-profile-lookup-fix.md` |
| 9.16 | `tmr myself add performance-review` CLI command | **Written** | `9-16-myself-add-performance-review.md` |
| 9.17 | `tmr doctor` — granola plugins check | **Written** | `9-17-doctor-granola-plugins-check.md` |
| 9.18 | `tmr init` — `--scaffold-only` flag, fix terminal plugin regression, update version art | **Written** | `9-18-init-scaffold-only-plugin-regression-version-art.md` |

---

## Key Architectural Decisions Made This Session

### Entity resolution
- `EmailResolutionService.resolve(email, ws)` is THE lookup method — no exceptions
- Resolution order: team-member → leadership → self → company-member → contractor → auto-create
- Step 3.5 (contractor) added to `_doResolve()` in Story 9.1

### Folder structure
- All scopes use nested `<email>/<email>.md` — only `my-career` is flat (`my-career/<email>.md`)
- Subdir parity: company, team, contractor all get `1on1s/`, `feedbacks/`, `assessments/`, `performance-reviews/`
- Team scope also gets `<email>-shared/`
- Leadership gets only `1on1s/`

### Domain routing
- Keep `organization.yaml` — no `domains.md`
- Remove domain question from `tmr init`; infer domain from user email at init time
- `MemberService.getInternalDomains()` stays as-is (reads `organization.yaml`)

### `tmr init` deps install
- Default = full install (plugins + deps) — assumes internet
- `--scaffold-only` flag = files/folders only, no network

### Email similarity check (Story 9.8)
- No blanket confirmation on every email
- Shared utility `src/utils/email-similarity.ts`
- Scan vault entity dirs, warn if Levenshtein ≤ 2 on same domain
- Applied to ALL commands that accept email: `tmr member add`, `tmr leadership add`, `tmr team add`, `tmr project link-member`, `tmr project link-stakeholder`

### Deleted methods (Story 9.1)
- `MemberService.findMemberGlobally()` — **deleted**
- `MemberService.createMember()` — **deleted**
- `ICreateMemberOptions` type — **deleted**
- Any future code referencing these is stale and must be fixed immediately

### Dated file prefix rules (project-context.md updated)
- **1on1**: full date prefix `YYYY-MM-DD` — happens weekly, needs day to distinguish files
- **feedback, assessment, performance-review**: year-month only `YYYY-MM` — happens monthly at most
- Extraction: full date = ISO string as-is; year-month = `date.slice(0, 7)`
- `filePrefix(type, isoDate)` helper should be added to `member.service.ts`

### organization.yaml domain management (Story 9.4)
- Keep `organization.yaml` (not `domains.md`)
- Remove the confusing "additional domains" prompt from `tmr init`; replace with clear reworded prompt immediately after email collection: shows inferred domain, accepts comma-separated additional domains, validates each
- "Remember domain" offer fires in ALL member-related commands (`tmr member add`, `tmr team add`, `tmr leadership add`) when an external-domain email is routed to company scope
- `MemberService.appendInternalDomain(domain, ws)` — new method, idempotent

### `contractor: true` field removed (Story 9.5)
- Replaced entirely by `relationship: contractor`
- `company: <domain>` frontmatter field also removed
- `IAddMemberOptions.company` field deleted

### `tmr leadership add 1on1` (Story 9.6)
- Old `tmr leadership 1on1 <email>` command **removed**
- New: `tmr leadership add 1on1 <email>` (type-first pattern matching `tmr member add`)
- `runLeadership1on1` function kept internally, just not registered as direct Commander subcommand

### `my-career` manager link update scope
- `TeamService.getManagerEmail()` uses old `my-career/<email>/<email>.md` — TODO(Story 9.3) comment added in Story 9.12
- `TeamService.buildMemberProfileMd()` uses old manager link path — TODO(Story 9.3) comment added
- `MemberService._resolveManagerLink()` — TODO(Story 9.3) comment added in Story 9.1
- Story 9.3 must update ALL THREE of these spots

### `<email>-shared/` folder (Story 9.12)
- Created by `TeamService.addMember()` for team-scoped members
- Name: `<normalizedEmail>-shared/` (e.g. `user@co.com-shared/`)
- Not created for company-scoped or contractor members

### Dated file naming convention
| Command | Output filename |
|---|---|
| `tmr member add 1on1 <email>` | `YYYY-MM-1on1-<email>.md` |
| `tmr member add feedback <email>` | `YYYY-MM-feedback-<my-email>-<email>.md` |
| `tmr member add feedback <email> --from <f>` | `YYYY-MM-feedback-<f>-<email>.md` |
| `tmr member add assessment <email>` | `YYYY-MM-assessment-<email>.md` |
| `tmr member add performance-review <email>` | `YYYY-MM-performance-review-<email>.md` |
| `tmr leadership add 1on1 <email>` | `YYYY-MM-1on1-<email>.md` |

### `relationship` frontmatter values
| Entity | `relationship` value |
|---|---|
| Self | `self` |
| Direct report (team-scoped) | `direct-report` |
| Leadership | `leadership` |
| Company member | `company-member` |
| Contractor | `contractor` |

---

## How to Resume This Session

1. Read this file
2. Read `project-context.md` (already updated with all canonical rules)
3. Check which story is "In discussion" in the table above
4. Re-present the proposal for that story to Marlon and wait for approval
5. Once approved, write the story file to `_bmad-output/implementation-artifacts/<id>-<slug>.md`
6. Update this file: mark story as Written, advance "Current Position"
7. Continue to next story

When all 18 stories are written, produce the Sprint Change Proposal at:
`_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-22-uat-pre-launch-polish.md`
