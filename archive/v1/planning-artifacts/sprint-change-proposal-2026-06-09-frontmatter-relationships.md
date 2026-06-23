# Sprint Change Proposal — Frontmatter-Native Relationships & Bidirectional Linking

**Date:** 2026-06-09
**Prepared by:** Developer Agent (Correct Course workflow)
**Status:** Draft — pending approval
**Triggered by:** Manual full-test of UAT v3 codebase by Marlon

---

## Section 1: Issue Summary

### Problem Statement

A full manual test pass of the post-UAT v3 codebase surfaced a **systemic pattern problem** combined with **multiple bidirectional-link bugs**.

**Pattern problem (architectural):**
Wiki-links between entities (people, teams, projects, dated artifacts) are written into the **body** of Markdown files, scattered across `##` sections. This:

- Forces LLM agents to load full file contents to discover relationships, even when only the graph is needed
- Bloats profiles over time (a member with 12 months of weekly 1-on-1s accumulates 50+ link lines in the body)
- Causes inconsistencies across services — each service invents its own "where do I put the link?" convention
- Makes mutation (add, remove on archive/fire) brittle — string-based section parsing in `SectionParserService` and `appendToHashSection`
- Breaks the Obsidian graph for entities that have no explicit body link (e.g. `tmr member add <email>` without `--team` writes no manager link at all)

**Bidirectional bugs (functional):**
Six commands produce **one-way** links or **broken** relationships:

| # | Command | Bug |
|---|---|---|
| B1 | `tmr member add <email> --team` | Profile is created in `my-teams/members/` but the team's `<team>-members.md` is **never updated**. The team page shows no new member. |
| B2 | `tmr member add <email>` (company/contractor) | Profile has **no `manager` link** — only `--team` mode sets it. Company members and contractors are graph orphans. |
| B3 | `tmr leadership add <email>` | Leader profile is written, but my self-profile (`my-career/<email>.md`) is **not updated** to add the leader to my `leadership` graph. The leader profile also has **no `direct_reports:`** pointing back to me. |
| B4 | `tmr leadership add 1on1 <email>` | The 1-on-1 file has **no frontmatter** linking back to me (the subject) or to the leader. Pure body template. |
| B5 | `tmr member add feedback <email> --from <reviewer>` | The reviewer email is embedded in the filename only. **No `from:` frontmatter** on the feedback file. If `<reviewer>` profile does not exist, **it is not auto-created** — the reviewer becomes a dangling string reference. |
| B6 | `tmr team fire / tmr team archive` | The team's `<team>-members.md` is updated, but the archived profile's `teams:` frontmatter is **not cleared** and `archived: true` is set on the file body parse but never surfaced as a primary frontmatter convention across listings. |

**Template noise:**
`team.service.buildMemberProfileMd` scaffolds empty `## Performance Reviews`, `## 1on1s`, `## Assessments`, `## Feedbacks`, `## Action Items`, `## Current Manager`, `## Previous Managers`, `## Other Leaderships`, `## Previous Leaderships` sections — all empty, all duplicated relationship surface. The hardcoded `[[action-items-${email}|Action Items Tracker]]` body link and the unused `action_items_gdoc: ''` frontmatter field also need to go.

**Self-profile graph gap:**
`my-career/<email>.md` (the user's own profile) has no link to `my-tasks/`, so the Obsidian graph view does not connect the user to their tasks. The leader link is written into body `## Leadership` rather than frontmatter, so it doesn't drive a metadata edge.

### Discovery Context

Identified during a single end-to-end manual test session on 2026-06-09 by Marlon, running through every `tmr` command in sequence against a fresh vault.

### Evidence

| # | Location | Confirmed by |
|---|---|---|
| Pattern | All 6 services write wiki-links via `appendToSection` / `appendToHashSection` / `appendFile` into body — none into frontmatter | `team.service.ts`, `member.service.ts`, `leadership.service.ts`, `myself.service.ts`, `project.service.ts`, `init.service.ts` |
| B1 | `MemberService.addMember()` (line 87–144) writes profile + subdirs only — never calls team-members append | `src/services/member.service.ts:141` |
| B2 | `MemberService.addMember()` line 127 — `manager: managerLink` set only when `opts.team && !opts.contractor` | `src/services/member.service.ts:127` |
| B3 | `LeadershipService.addLeadership()` writes only the leader profile; no update to self-profile or reciprocal `direct_reports:` | `src/services/leadership.service.ts:75–94` |
| B4 | `LeadershipService.add1on1()` writes file via `getLeadership1on1Template()` (no `subject:`/`with:` frontmatter); appends body link only | `src/services/leadership.service.ts:100–128` |
| B5 | `MemberService.createMemberFile()` line 232 — reviewer embedded in filename; template has no `from:` frontmatter; `EmailResolutionService.resolve(fromEmail)` is **never called** | `src/services/member.service.ts:215–245` |
| B6 | `TeamService.archiveMember()` sets `archived: true` and `archived_date` on profile only; `teams:` array stays populated; no reciprocal cleanup elsewhere | `src/services/team.service.ts:296–355` |
| Template noise | 7 empty `##` sections + hardcoded action-items link | `src/services/team.service.ts:81–133` |
| Self gap | `InitService.writeUserProfile()` writes `## Leadership` body section; no `tasks:` frontmatter | `src/services/init.service.ts:159–184` |

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Impact |
|---|---|
| **Epic 9** (UAT Pre-Launch Polish) | [!] Eleven corrective stories appended (9.26–9.36). Architectural pattern shift continues UAT theme. |
| **Epic 1** (Shared Utilities) | [!] Adds new utility: `src/utils/frontmatter-relations.ts`. Existing `formatWikiLink` is unchanged but its consumers shift from body appenders to frontmatter setters. |
| **Epic 3** (Member Management) | [!] All four member-add flows (`--team`, company, contractor, dated files) change behavior to write frontmatter. Backward-compatible reads required. |
| **Epic 6** (Self Profile) | [!] Self-profile gains `tasks:`, `goals:`, `leadership:` frontmatter arrays. |
| **Epic 7** (`tmr doctor`) | [!] `tmr doctor --fix-frontmatter` flag added to migrate existing vaults. |
| **All other epics** | [N/A] |

### Story Impact

| Story | Impact |
|---|---|
| 9.5 (`relationship` frontmatter on profiles) | [x] Builds on this — relationship field stays as identity; new fields are typed relationship arrays |
| 9.12 (team-shared folder & `direct-report` frontmatter) | [!] Direct-report manager field migrates from body to frontmatter array |
| 9.14 (project bidirectional links) | [!] Both sides move to frontmatter |
| 9.16 (myself add performance-review) | [!] Wiki-link moves from body `## Performance Reviews` to frontmatter `performance_reviews:` array |
| 9.22–9.25 (in-progress) | [N/A] — unaffected; proceed independently |
| All other 9.x stories | [N/A] |

### Artifact Conflicts

| Artifact | Conflict | Resolution |
|---|---|---|
| `epics.md` | Stories 9.26–9.36 missing | Append all eleven to Epic 9 |
| `sprint-status.yaml` | Same | Append with status `backlog` |
| `_bmad-output/project-context.md` | Section "Shared Utilities" must declare frontmatter-relations utility as canonical; "Critical Don't-Miss Rules" must forbid body wiki-links | Add new sub-section + anti-pattern rule |
| `docs/project-overview.md` | If it documents the relationship model, must be updated to reflect frontmatter-native pattern | Review and update Section "Vault Structure / Linking Conventions" |

### Technical Impact

| Component | Change |
|---|---|
| `src/utils/frontmatter-relations.ts` | **New file** — `addRelation`, `removeRelation`, `setScalar`, `appendToArray` operating on gray-matter parsed frontmatter; idempotent |
| `src/types/relations.types.ts` | **New file** — defines `RelationArrays` (manager, direct_reports, leadership, teams, projects, members, stakeholders) + dated arrays (one_on_ones, feedbacks, assessments, performance_reviews) |
| `src/services/team.service.ts` | `buildMemberProfileMd` rewritten — no empty sections; relationships in frontmatter; `archiveMember` adds `teams: []` cleanup + ensures `archived: true` is canonical |
| `src/services/member.service.ts` | `addMember` — frontmatter `manager` for all scopes (not just `--team`); add team-members append for `--team` path. `createMemberFile` — auto-resolve `fromEmail` (auto-create reviewer profile); add `from:`, `subject:` frontmatter to dated file; append wiki-link to profile's frontmatter array (`one_on_ones`, etc.) instead of body section |
| `src/services/leadership.service.ts` | `addLeadership` — append to leader's `direct_reports:` frontmatter array; append leader to self-profile `leadership:` frontmatter array. `add1on1` — dated file gets `subject:`, `with:` frontmatter; profile gets `one_on_ones:` frontmatter array entry |
| `src/services/myself.service.ts` | `addPerformanceReview` — wiki-link goes to self-profile `performance_reviews:` frontmatter array (replaces `appendToFile(profilePath, 'Performance Reviews', wikiLink)`) |
| `src/services/project.service.ts` | `linkMember`, `linkStakeholder` — project gets `members:` / `stakeholders:` frontmatter arrays; entity gets `projects:` frontmatter array. `addProject` — overview template gets the arrays scaffolded empty |
| `src/services/init.service.ts` | `writeUserProfile` — `leadership:` array + `tasks:` + `goals:` in frontmatter; remove `## Leadership` body section |
| `src/services/doctor.service.ts` | `--fix-frontmatter` flag — walks vault, parses every entity profile, lifts body wiki-links into frontmatter arrays; idempotent |
| `src/commands/doctor.command.ts` | Wire `--fix-frontmatter` CLI flag |
| `src/templates/onboarding.templates.ts` | Update any templates that scaffold body sections meant for link accumulation |
| `_bmad-output/project-context.md` | Add Section "Frontmatter-Native Relationship Model" + anti-pattern rule "DO NOT append wiki-links to body sections in entity profiles" |

### Compatibility & Read-side

- **Hard cutover (no fallback)** — all **read** paths (`listTeamMembers`, `listLeadership`, `showProfile`, `listProjects`, `countHashSection`) read from frontmatter **only**. No legacy body parsing is added.
- **Migration is user-driven**: existing vaults that have not run `tmr doctor --fix-frontmatter` (story 9.36) will show empty lists / zero counts in commands that rely on relationship arrays. This is acceptable given a small known user base.
- The post-init summary and `tmr doctor` (without `--fix-frontmatter`) will print a **prominent warning** when body-style links are detected, instructing the user to run `tmr doctor --fix-frontmatter`.
- `SectionParserService` and `appendToHashSection` stay (used elsewhere for actual prose), but `appendToFile(profilePath, sectionName, wikiLink)` call sites in services are eliminated.

---

## Section 3: Recommended Approach

**Selected approach: Direct Adjustment (Option 1) extending Epic 9**

Eleven corrective stories (9.26–9.36) added to Epic 9 implement the architectural pattern shift in a phased, incrementally shippable order. No PRD or architecture document rewrite is required because the pattern is internal to the implementation layer; the user-visible behavior (file locations, command UX) is unchanged except for graph completeness.

**Rationale:**
- **Effort:** Medium-High — touches 6 services + 1 utility + 1 migration script. Test suite needs rewrites for all profile-generation tests.
- **Risk:** Medium — read-side compatibility shim required for one release to avoid breaking existing vaults. Mitigated by auto-migration in `tmr doctor --fix-frontmatter`.
- **Timeline:** ~2–3 days dev time per story for 11 stories; stories are mostly independent (parallelizable) once 9.26 (utility + types) lands.
- **MVP:** Unaffected — no command added or removed; only internal pattern + bug fixes.

**Decisions confirmed with user (2026-06-09):**

1. **Scope:** extend Epic 9 (stories 9.26–9.36) rather than open Epic 10
2. **Dated files — body wiki-links + `last_<type>` scalar** (revised after user challenge). Structural relationships (manager, leadership, teams, projects, members, stakeholders) live in frontmatter; dated chronological artifacts (1on1s, feedbacks, assessments, performance-reviews) stay in body `##` sections (compact frontmatter, unbounded body — matches the original motivation of "let LLMs read small portions"). Latest-date scalars (`last_1on1`, etc.) live in frontmatter for sort/recency.
3. **Migration:** `tmr doctor --fix-frontmatter` auto-migration, idempotent — only migrates structural relationships (manager, leadership, projects, members, stakeholders); dated body sections stay as-is
4. **Archive cleanup:** mark-only — set `archived: true`, move `current_manager` to `previous_manager[]` then clear `current_manager`, do **not** walk vault to remove reverse links elsewhere (preserves history; Obsidian shows stale visually)
5. **Read-side compatibility:** hard cutover — readers use frontmatter only; no legacy body fallback; users must run `tmr doctor --fix-frontmatter` once after upgrade (small known user base makes this acceptable)
6. **Company member / contractor `current_manager` is empty** at creation. These profiles are created as reference entities; the actual reporting line is unknown to the tool and must be filled by the user. (Revised — earlier decision to auto-set `manager=me` is wrong; my relationship to a contractor I'm tracking is not "I'm their manager".)
7. **Field vocabulary** — `current_manager` (singular, was `manager`), `previous_manager[]`, `other_leaderships[]` (matrix/co-managers), `projects[]`, `start_date` (distinct from `date_added`, which is profile-creation date). Self profile expands `goals` into `today`, `this_week`, `this_month`, `this_quarter` scalars pointing at the corresponding `my-tasks/` shell files.

---

## Section 3.5: Frontmatter Schema Reference

This section is the **single source of truth** for what frontmatter every file type produced by the CLI must contain after stories 9.26–9.36 land.

**Core principle (decision #2, revised):** Frontmatter holds **structural relationships** (finite, define the org graph). Body holds **dated chronological artifacts** (unbounded, auto-appended in `##` sections). The frontmatter stays compact regardless of how many 1-on-1s, feedbacks, or reviews accumulate over years.

Legend:
- **type** — `scalar` (string), `array` (list of wiki-link strings), `bool`
- **populated by** — which command writes the field; `(user)` means left empty for the user to fill
- **wave** — implementation story (9.26 utility / 9.27 types / 9.28–9.36 features)

### Field Vocabulary (universal across entity profiles)

| Field | Type | Meaning |
|---|---|---|
| `current_manager` | scalar wiki-link | THE person this entity reports to right now (one person). Was `manager` in v1. |
| `previous_manager` | array of wiki-links | Historical managers, append-only. Populated when current_manager changes or on archive. |
| `leadership` | array of wiki-links | Upward chain — leaders above current_manager (skip-level, CTO, CEO, etc.) |
| `other_leaderships` | array of wiki-links | Matrix / co-managers / dotted-line — peers of current_manager who also have influence |
| `direct_reports` | array of wiki-links | People who report to this entity directly |
| `teams` | array of wiki-links | Teams this entity belongs to |
| `projects` | array of wiki-links | Projects this entity is on (member or stakeholder — distinction lives on the project side) |
| `start_date` | scalar (YYYY-MM-DD) | When the person started in their current role/company. Distinct from `date_added` (when the profile was created). User-fillable; not auto-populated except on init for self. |
| `date_added` | scalar (YYYY-MM-DD) | Profile creation date in the vault. Auto-set. Never changes. |
| `last_1on1`, `last_feedback`, `last_assessment`, `last_performance_review` | scalar (YYYY-MM[-DD]) | Latest date of each artifact type, auto-updated when a new dated file is created |

---

### 1. Self profile — `my-career/<email>.md`

| Field | Type | Populated by | Value example | Wave |
|---|---|---|---|---|
| email, name, role, relationship (`self`), date_added | scalar | `tmr init` | (existing) | existing |
| **start_date** | scalar | `tmr init` (user-confirmed) | `2024-03-15` | 9.35 |
| **current_manager** | scalar (wiki-link) | `tmr init` (if leader provided), `tmr leadership add` | `[[my-leadership/cto@co.com/cto@co.com.md\|cto@co.com]]` | 9.30, 9.35 |
| **previous_manager** | array | (user-managed; appended when `current_manager` changes) | `["[[my-leadership/old-boss@co.com/old-boss@co.com.md\|old-boss@co.com]]"]` | 9.30 |
| **leadership** | array | `tmr init`, `tmr leadership add` (skip-level/upward chain) | `["[[my-leadership/ceo@co.com/ceo@co.com.md\|ceo@co.com]]"]` | 9.30, 9.35 |
| **other_leaderships** | array | (user-managed; matrix / dotted-line) | `["[[my-leadership/vp-product@co.com/vp-product@co.com.md\|vp-product@co.com]]"]` | 9.30 |
| **direct_reports** | array | `tmr member add --team`, `tmr team add` | `["[[my-teams/members/jane@co.com/jane@co.com.md\|jane@co.com]]"]` | 9.29 |
| **projects** | array | `tmr project link-member`, `tmr project link-stakeholder` | `["[[my-company/projects/foo-project/foo-project.md\|foo-project]]"]` | 9.33 |
| **tasks** | scalar (wiki-link) | `tmr init` | `[[my-tasks/tasks.md\|tasks]]` | 9.35 |
| **today** | scalar (wiki-link) | `tmr init` | `[[my-tasks/today.md\|today]]` | 9.35 |
| **this_week** | scalar (wiki-link) | `tmr init` | `[[my-tasks/this-week.md\|this-week]]` | 9.35 |
| **this_month** | scalar (wiki-link) | `tmr init` | `[[my-tasks/this-month.md\|this-month]]` | 9.35 |
| **this_quarter** | scalar (wiki-link) | `tmr init` | `[[my-tasks/this-quarter.md\|this-quarter]]` | 9.35 |
| last_performance_review | scalar | `tmr myself add performance-review` | `2026-06` | 9.32 |

Body removed: `## Leadership` section (moved to frontmatter `current_manager` / `leadership`).
Body kept: `## Notes`, `## Performance Reviews` (wiki-links appended here by `tmr myself add performance-review` — see decision #2 revised).

---

### 2. Direct-report member profile — `my-teams/members/<email>/<email>.md`

| Field | Type | Populated by | Value example | Wave |
|---|---|---|---|---|
| email, name, role, gender, location, date_added | scalar | `tmr member add --team` / `tmr team add` | (existing) | existing |
| relationship | scalar | same | `direct-report` | existing |
| **start_date** | scalar | (user-fillable; empty by default) | `""` | 9.29 |
| **current_manager** | scalar (wiki-link) | `tmr member add --team` / `tmr team add` | `[[my-career/me@co.com.md\|me@co.com]]` | 9.29 (renamed from `manager`) |
| **previous_manager** | array | (user-managed; appended when current_manager changes; on archive) | `[]` initially | 9.29 |
| **other_leaderships** | array | (user-managed; matrix / dotted-line co-managers) | `[]` initially | 9.29 |
| **teams** | array of wiki-links | `tmr member add --team` (multi-team support) | `["[[my-teams/teams/backend/backend-context.md\|backend]]"]` | 9.28 (migrate from existing string array of slugs to wiki-link array) |
| **projects** | array | `tmr project link-member` / `link-stakeholder` | `["[[my-company/projects/foo-project/foo-project.md\|foo-project]]"]` | 9.33 |
| **last_1on1** | scalar | `tmr member add 1on1` | `2026-06-09` | 9.31 |
| **last_feedback** | scalar | `tmr member add feedback` | `2026-06` | 9.31 |
| **last_assessment** | scalar | `tmr member add assessment` | `2026-06` | 9.31 |
| **last_performance_review** | scalar | `tmr member add performance-review` | `2026-06` | 9.31 |
| archived | bool | `tmr team archive` / `tmr team fire` | `true` | 9.34 |
| archived_date | scalar | same | `2026-06-09` | 9.34 |
| termination | bool | `tmr team fire` | `true` | 9.34 |
| termination_date | scalar | `tmr team fire` | `2026-06-09` | 9.34 |
| termination_note | scalar | `tmr team fire` | `Voluntary departure` | 9.34 |

**Body sections** (kept, auto-populated with wiki-links by add commands):
- `## 1on1s` — `tmr member add 1on1` appends `- [[1on1s/<file>]]`
- `## Feedbacks` — `tmr member add feedback` appends `- [[feedbacks/<file>]]`
- `## Assessments` — `tmr member add assessment` appends `- [[assessments/<file>]]`
- `## Performance Reviews` — `tmr member add performance-review` appends `- [[performance-reviews/<file>]]`
- `## Notes` — human prose
- `# Member — <email>` — heading

**Removed** from template: `action_items_gdoc` frontmatter field (unused), `## Current Manager` / `## Previous Managers` / `## Other Leaderships` / `## Previous Leaderships` / `## Action Items` body sections (those relationships now live in frontmatter), hardcoded `[[action-items-<email>|Action Items Tracker]]` body link.

---

### 3. Company member profile — `my-company/members/<email>/<email>.md`

Same as **#2 Direct-report** except:
- `relationship: company-member`
- No `teams:` field (company members aren't on teams)
- **`current_manager: ""`** (empty — user fills; tool does NOT auto-link to me — decision #6). Their actual manager is not knowable from a profile-creation command.

---

### 4. Contractor profile — `my-company/contractors/<email>/<email>.md`

Same as **#3 Company member** except:
- `relationship: contractor`
- **`current_manager: ""`** (empty — user fills — decision #6)

---

### 5. Leadership profile — `my-leadership/<email>/<email>.md`

| Field | Type | Populated by | Value example | Wave |
|---|---|---|---|---|
| email, name, role, gender, location, areas_of_responsibility, date_added | scalar | `tmr leadership add` | (existing) | existing |
| relationship | scalar | `tmr leadership add` | `leadership` | existing |
| **start_date** | scalar | (user-fillable; empty by default) | `""` | 9.30 |
| **current_manager** | scalar (wiki-link) | (user-fillable; their boss above them) | `[[my-leadership/ceo@co.com/ceo@co.com.md\|ceo@co.com]]` | 9.30 |
| **previous_manager** | array | (user-managed) | `[]` initially | 9.30 |
| **other_leaderships** | array | (user-managed) | `[]` initially | 9.30 |
| **direct_reports** | array | `tmr leadership add` (reciprocal), `tmr init` | `["[[my-career/me@co.com.md\|me@co.com]]"]` | 9.30 |
| **projects** | array | `tmr project link-member` / `link-stakeholder` | `[]` | 9.33 |
| **last_1on1** | scalar | `tmr leadership add 1on1` | `2026-06-09` | 9.31 |

**Body sections** (kept, auto-populated):
- `## 1on1s` — `tmr leadership add 1on1` appends `- [[1on1s/<file>]]`
- `## Notes` — human prose
- `# Leadership — <email>` — heading

---

### 6. Archived member profile — `my-teams/archived/<year>/<email>/<email>.md`

Same as **#2 Direct-report** at time of archive, with the following frontmatter transformations:
- `archived: true`, `archived_date: <iso>`
- `teams: []` (cleared on archive — fixes B6)
- `current_manager` → appended to `previous_manager[]`, then `current_manager: ""` cleared
- `termination: true`, `termination_date`, `termination_note` (only if fired)
- `projects:` array preserved as-is (historical record; mark-only)
- `last_*` scalars preserved (last 1on1 etc.)
- Body sections (`## 1on1s`, `## Feedbacks`, etc.) preserved as-is — full history retained

Reverse-link cleanup elsewhere in the vault: **none** (mark-only — confirmed decision).

---

### 7. Team context file — `my-teams/teams/<team>/<team>-context.md`

| Field | Type | Populated by | Value example | Wave |
|---|---|---|---|---|
| team | scalar | `tmr team create` | `backend` | existing |
| created | scalar | `tmr team create` | `2026-06-09` | existing |

No relationship arrays — this file is for team mission/goals/norms (human prose only). Members live in `<team>-members.md` (#8).

---

### 8. Team members file — `my-teams/teams/<team>/<team>-members.md`

| Field | Type | Populated by | Value example | Wave |
|---|---|---|---|---|
| **members** | array | `tmr team add`, `tmr member add --team`, `tmr team archive` (remove) | `["[[my-teams/members/jane@co.com/jane@co.com.md\|jane@co.com]]"]` | 9.28 |

Body kept: `# Team Members` heading only (no auto-generated content). Members are read from frontmatter array.

---

### 9. Project overview — `my-company/projects/<name>/<name>.md`

| Field | Type | Populated by | Value example | Wave |
|---|---|---|---|---|
| project (or name) | scalar | `tmr project add` | `foo-project` | existing |
| created | scalar | `tmr project add` | `2026-06-09` | existing |
| **members** | array | `tmr project link-member` | `["[[my-teams/members/jane@co.com/jane@co.com.md\|jane@co.com]]"]` | 9.33 |
| **stakeholders** | array | `tmr project link-stakeholder` | `["[[my-company/members/ceo@co.com/ceo@co.com.md\|ceo@co.com]]"]` | 9.33 |

Body removed: `# Team Members` and `# Stakeholders` auto-populated sections. Body kept: project description / status / human prose.

Reciprocal: every linked entity (self, member, contractor, leadership) gets the project appended to its frontmatter `projects:` array. Both `link-member` and `link-stakeholder` produce the same reciprocal `projects:` entry on the entity side — the role distinction (member vs stakeholder) lives only on the project side.

---

### 10. Project standup — `my-company/projects/<name>/standups/<date>-<name>-standup.md`

| Field | Type | Populated by | Value example | Wave |
|---|---|---|---|---|
| **type** | scalar | `tmr project standup` | `standup` | 9.31 (pattern extended) |
| **date** | scalar | `tmr project standup` | `2026-06-09` | 9.31 |
| **project** | scalar (wiki-link) | `tmr project standup` | `[[my-company/projects/foo-project/foo-project.md\|foo-project]]` | 9.31 |

(Current implementation embeds these in body via template; story 9.31 adds frontmatter parallel — body template stays for human notes.)

---

### 11. 1on1 file — `.../1on1s/<date>-1on1-<email>.md`

Used by both `tmr member add 1on1` and `tmr leadership add 1on1`.

| Field | Type | Populated by | Value example | Wave |
|---|---|---|---|---|
| **type** | scalar | command | `1on1` | 9.31 |
| **date** | scalar | command | `2026-06-09` | 9.31 |
| **subject** | scalar (wiki-link) | command | `[[my-teams/members/jane@co.com/jane@co.com.md\|jane@co.com]]` | 9.31 |
| **with** | scalar (wiki-link) | command | `[[my-career/me@co.com.md\|me@co.com]]` | 9.31 |

Body kept: `## Topics`, `## Action Items` for human prose.

Reciprocal: subject profile gets `- [[1on1s/<file>]]` appended to its `## 1on1s` body section AND `last_1on1:` scalar updated in frontmatter.

---

### 12. Feedback file — `.../feedbacks/<ym>-feedback-<from>-<email>.md`

| Field | Type | Populated by | Value example | Wave |
|---|---|---|---|---|
| **type** | scalar | `tmr member add feedback` | `feedback` | 9.31 |
| **date** | scalar | same | `2026-06` | 9.31 |
| **subject** | scalar (wiki-link) | same | `[[my-teams/members/jane@co.com/jane@co.com.md\|jane@co.com]]` | 9.31 |
| **from** | scalar (wiki-link) | same (defaults to self if `--from` omitted; auto-creates `<from>` profile if missing) | `[[my-company/members/peer@co.com/peer@co.com.md\|peer@co.com]]` | 9.31 (fixes B5) |

Body kept: `## Feedback`, `## Context` for human prose.

Reciprocal: subject profile gets `- [[feedbacks/<file>]]` appended to its `## Feedbacks` body section AND `last_feedback:` scalar updated in frontmatter. The reviewer's profile is **created** if it doesn't exist (auto-stub via `EmailResolutionService.resolve`) but is **not** updated with any link to the feedback file (one-way provenance).

---

### 13. Assessment file — `.../assessments/<ym>-assessment-<email>.md`

| Field | Type | Populated by | Value example | Wave |
|---|---|---|---|---|
| **type** | scalar | `tmr member add assessment` | `assessment` | 9.31 |
| **date** | scalar | same | `2026-06` | 9.31 |
| **subject** | scalar (wiki-link) | same | `[[my-teams/members/jane@co.com/jane@co.com.md\|jane@co.com]]` | 9.31 |
| **with** | scalar (wiki-link) | same (the assessor — defaults to self) | `[[my-career/me@co.com.md\|me@co.com]]` | 9.31 |

Reciprocal: subject profile gets `- [[assessments/<file>]]` appended to its `## Assessments` body section AND `last_assessment:` scalar updated in frontmatter.

---

### 14. Performance-review file (member) — `.../performance-reviews/<ym>-performance-review-<email>.md`

| Field | Type | Populated by | Value example | Wave |
|---|---|---|---|---|
| **type** | scalar | `tmr member add performance-review` | `performance-review` | 9.31 |
| **date** | scalar | same | `2026-06` | 9.31 |
| **subject** | scalar (wiki-link) | same | `[[my-teams/members/jane@co.com/jane@co.com.md\|jane@co.com]]` | 9.31 |
| **with** | scalar (wiki-link) | same (the reviewer — defaults to self) | `[[my-career/me@co.com.md\|me@co.com]]` | 9.31 |

Reciprocal: subject profile gets `- [[performance-reviews/<file>]]` appended to its `## Performance Reviews` body section AND `last_performance_review:` scalar updated in frontmatter.

---

### 15. Performance-review file (myself) — `my-career/performance-reviews/<ym>-performance-review-<email>.md`

| Field | Type | Populated by | Value example | Wave |
|---|---|---|---|---|
| **type** | scalar | `tmr myself add performance-review` | `performance-review` | 9.32 |
| **date** | scalar | same | `2026-06` | 9.32 |
| **subject** | scalar (wiki-link) | same | `[[my-career/me@co.com.md\|me@co.com]]` | 9.32 |

No `with:` — self-review by default. Body template kept for content.

Reciprocal: self profile gets `- [[performance-reviews/<file>]]` appended to its `## Performance Reviews` body section AND `last_performance_review:` scalar updated in frontmatter.

---

### 16. Task shell files — `my-tasks/{tasks,today,this-week,this-month,this-quarter}.md`

Created by `tmr init` (story 9.35). Minimal frontmatter so the graph edge from `self.tasks` / `self.goals` resolves.

| Field | Type | Populated by | Value example | Wave |
|---|---|---|---|---|
| **type** | scalar | `tmr init` | `tasks` (or `today`, `this-week`, etc.) | 9.35 |
| **owner** | scalar (wiki-link) | `tmr init` | `[[my-career/me@co.com.md\|me@co.com]]` | 9.35 |

Body: empty `# Tasks` / `# Today` heading.

---

### Cross-Cutting Reciprocity Map

This table summarizes which commands update which fields on which sides — the **bidirectional contract**.

| Command | Writes to subject file | Writes to reciprocal file(s) |
|---|---|---|
| `tmr init` (self profile) | self: `tasks`, `today`, `this_week`, `this_month`, `this_quarter`, `current_manager` (if leader provided) | — |
| `tmr init` (leader add) | leader: `direct_reports[+=me]` | self: `current_manager=leader` (if not already set) |
| `tmr team create` | `<team>-context.md` (no relations) | — |
| `tmr team add <team> <email>` | member: `teams[+=team]`, `current_manager=me` | `<team>-members.md`: `members[+=email]`; self: `direct_reports[+=email]` |
| `tmr member add <email> --team <t>` | same as above | same as above |
| `tmr member add <email>` (company) | member: `current_manager=""` (empty, user fills) | — (no reciprocal) |
| `tmr member add <email> --contractor` | contractor: `current_manager=""` (empty, user fills) | — (no reciprocal) |
| `tmr member add 1on1 <email>` | 1on1 file frontmatter: `type,date,subject,with` | member body: `- [[1on1s/<file>]]` appended to `## 1on1s`; member frontmatter: `last_1on1=date` |
| `tmr member add feedback <email> --from <r>` | feedback file frontmatter: `type,date,subject,from` | member body: `## Feedbacks` append; member frontmatter: `last_feedback=date`; **auto-creates `<r>` profile** if missing |
| `tmr member add assessment <email>` | assessment file frontmatter: `type,date,subject,with` | member body: `## Assessments` append; member frontmatter: `last_assessment=date` |
| `tmr member add performance-review <email>` | perf-review file frontmatter: `type,date,subject,with` | member body: `## Performance Reviews` append; member frontmatter: `last_performance_review=date` |
| `tmr myself add performance-review` | perf-review file frontmatter: `type,date,subject` | self body: `## Performance Reviews` append; self frontmatter: `last_performance_review=date` |
| `tmr leadership add <email>` | leader: `direct_reports[+=me]` | self: `current_manager=leader` (if not set) OR `leadership[+=leader]` (if already has a manager) |
| `tmr leadership add 1on1 <email>` | 1on1 file frontmatter: `type,date,subject,with` | leader body: `## 1on1s` append; leader frontmatter: `last_1on1=date` |
| `tmr project add <name>` | project: `members:[], stakeholders:[]` (scaffolded empty) | — |
| `tmr project link-member <name> <email>` | project: `members[+=email]` | entity: `projects[+=project]` |
| `tmr project link-stakeholder <name> <email>` | project: `stakeholders[+=email]` | entity: `projects[+=project]` |
| `tmr project standup <name>` | standup file: `type,date,project` | — (project file is the graph anchor) |
| `tmr team archive <team> <email>` | archived profile: `archived=true, archived_date, teams=[]`, `previous_manager[+=current_manager]`, `current_manager=""` | `<team>-members.md`: `members[-=email]`; self: `direct_reports[-=email]` |
| `tmr team fire <team> <email>` | archived profile: above + `termination=true, termination_date, termination_note` | `<team>-members.md`: `members[-=email]`; self: `direct_reports[-=email]` |

---

## Section 4: Detailed Change Proposals

> **Implementation order matters.** Stories 9.26 (utility) and 9.27 (types + project-context rule) are blockers. Stories 9.28–9.34 (per-command bug + pattern migration) can proceed in parallel. Story 9.35 (`tmr doctor` migration) and 9.36 (read-side compatibility shim) come last.

---

### Story 9.26: Frontmatter-relations shared utility

**As a** developer mutating entity profile relationships,
**I want** a single utility for idempotent frontmatter array operations,
**So that** no service invents its own append/remove logic and all relationship writes are consistent.

#### Change Proposals

**New file `src/utils/frontmatter-relations.ts`:**

```typescript
import matter from 'gray-matter';
import type { FileSystemService } from '../services/file-system.service.js';

export type RelationKey =
  | 'manager'
  | 'direct_reports'
  | 'leadership'
  | 'teams'
  | 'projects'
  | 'members'
  | 'stakeholders'
  | 'one_on_ones'
  | 'feedbacks'
  | 'assessments'
  | 'performance_reviews'
  | 'tasks'
  | 'goals';

const SCALAR_KEYS: ReadonlySet<RelationKey> = new Set(['manager', 'tasks', 'goals']);

export async function addRelation(
  filePath: string,
  key: RelationKey,
  wikiLink: string,
  fs: FileSystemService,
): Promise<void> {
  if (!(await fs.exists(filePath))) {
    throw new Error(`Cannot add relation to missing file: ${filePath}`);
  }
  const content = await fs.readFile(filePath);
  const parsed = matter(content);
  const data = parsed.data as Record<string, unknown>;

  if (SCALAR_KEYS.has(key)) {
    data[key] = wikiLink;
  } else {
    const existing = Array.isArray(data[key]) ? (data[key] as string[]) : [];
    if (!existing.includes(wikiLink)) existing.push(wikiLink);
    data[key] = existing;
  }
  await fs.writeFile(filePath, matter.stringify(parsed.content, data));
}

export async function removeRelation(
  filePath: string,
  key: RelationKey,
  wikiLink: string,
  fs: FileSystemService,
): Promise<void> {
  if (!(await fs.exists(filePath))) return;
  const content = await fs.readFile(filePath);
  const parsed = matter(content);
  const data = parsed.data as Record<string, unknown>;

  if (SCALAR_KEYS.has(key)) {
    if (data[key] === wikiLink) delete data[key];
  } else {
    const existing = Array.isArray(data[key]) ? (data[key] as string[]) : [];
    data[key] = existing.filter((v) => v !== wikiLink);
  }
  await fs.writeFile(filePath, matter.stringify(parsed.content, data));
}

export async function setScalar(
  filePath: string,
  key: 'last_1on1' | 'last_feedback' | 'last_assessment' | 'last_performance_review' | 'archived' | 'archived_date',
  value: string | boolean,
  fs: FileSystemService,
): Promise<void> {
  if (!(await fs.exists(filePath))) return;
  const content = await fs.readFile(filePath);
  const parsed = matter(content);
  const data = parsed.data as Record<string, unknown>;
  data[key] = value;
  await fs.writeFile(filePath, matter.stringify(parsed.content, data));
}
```

#### Acceptance Criteria

- **Given** an entity profile exists, **When** `addRelation(path, 'direct_reports', '[[...|jane@co.com]]', fs)` is called twice, **Then** the array contains exactly one entry (idempotent)
- **Given** a profile with `manager: "[[...|old]]"`, **When** `addRelation(path, 'manager', '[[...|new]]', fs)` is called, **Then** `manager` is replaced (scalar)
- **Given** `removeRelation` is called on a key that does not exist, **Then** no error is thrown
- **Given** an array contains the value, **When** `removeRelation` is called, **Then** the value is filtered out; the key stays present as `[]`
- Tests in `tests/utils/frontmatter-relations.test.ts` cover all 5 cases above

#### Files Modified

- `src/utils/frontmatter-relations.ts` *(new)*
- `tests/utils/frontmatter-relations.test.ts` *(new)*

---

### Story 9.27: Relation types + project-context rule

**As an** AI agent implementing entity-related code,
**I want** a typed vocabulary of relationship keys and an enforced anti-pattern rule,
**So that** body wiki-link regressions are prevented and frontmatter is the single source of truth.

#### Change Proposals

**New file `src/types/relations.types.ts`:**

```typescript
export interface IEntityRelations {
  manager?: string;
  direct_reports?: string[];
  leadership?: string[];
  teams?: string[];
  projects?: string[];
  one_on_ones?: string[];
  feedbacks?: string[];
  assessments?: string[];
  performance_reviews?: string[];
  last_1on1?: string;
  last_feedback?: string;
  last_assessment?: string;
  last_performance_review?: string;
}

export interface ITeamRelations {
  members?: string[];
}

export interface IProjectRelations {
  members?: string[];
  stakeholders?: string[];
}

export interface ISelfRelations extends IEntityRelations {
  tasks?: string;
  goals?: string;
}
```

**Update `_bmad-output/project-context.md` — add section after "Shared Utilities":**

```markdown
### Frontmatter-Native Relationship Model

- **ALL entity-to-entity wiki-links MUST be written to frontmatter arrays, not body sections.**
  Canonical relation keys are defined in `src/types/relations.types.ts`.
- Mutations MUST use `src/utils/frontmatter-relations.ts` (`addRelation`, `removeRelation`,
  `setScalar`) — never inline `matter.stringify()` for relationship changes.
- Body sections (`## 1on1s`, `## Performance Reviews`, `## Team Members`, etc.) are
  retained ONLY for human prose; they MUST NOT receive auto-generated wiki-links from any
  command or service.
- Read paths support a one-release fallback: read frontmatter first, then body (legacy)
  if frontmatter is empty. After v2.0.0, the body fallback is removed.

### Anti-Pattern (Critical)

**DO NOT** call `SectionParserService.appendToFile(profilePath, sectionName, wikiLink)`
or `appendToHashSection(content, sectionName, '- [[...]]')` from any service that
writes an entity-to-entity relationship. Use `addRelation()` from
`src/utils/frontmatter-relations.ts` instead.
```

#### Acceptance Criteria

- `src/types/relations.types.ts` exports the three interfaces
- `project-context.md` contains the new section before "Usage Guidelines"
- A grep for `appendToFile.*wikiLink` and `appendToHashSection.*\[\[` in `src/services/` returns zero hits after stories 9.28–9.34 land

#### Files Modified

- `src/types/relations.types.ts` *(new)*
- `_bmad-output/project-context.md`

---

### Story 9.28: `tmr member add <email> --team` updates team members frontmatter

**As a** user adding a team member via `member add`,
**I want** the team's `<team>-members.md` updated automatically,
**So that** the team page shows the member without needing a second command.

#### Change Proposals

**`src/services/member.service.ts` — `addMember`:** after writing the profile, append the member's wiki-link to the team-members file's frontmatter `members:` array (when `opts.team`).

```typescript
if (opts.team) {
  const teamMembersPath = path.join(
    workspaceRoot, 'my-teams', 'teams', normalizeSlug(opts.team), `${normalizeSlug(opts.team)}-members.md`,
  );
  if (await this._fs.exists(teamMembersPath)) {
    const link = formatWikiLink(profilePath, teamMembersPath, normalizedEmail);
    await addRelation(teamMembersPath, 'members', link, this._fs);
  }
}
```

**`src/services/team.service.ts` — `buildMembersMd()`:** scaffold with frontmatter shell:

```typescript
function buildMembersMd(): string {
  return `---\nmembers: []\n---\n\n# Team Members\n`;
}
```

#### Acceptance Criteria

- **Given** team `backend` exists, **When** `tmr member add new@co.com --team backend` runs, **Then** `my-teams/teams/backend/backend-members.md` frontmatter `members:` contains `[[my-teams/members/new@co.com/new@co.com.md|new@co.com]]`
- **Given** the link already exists, **When** the same command runs again, **Then** the array is unchanged (idempotent)
- **Given** `--team` is omitted, **Then** no team-members file is touched

#### Files Modified

- `src/services/member.service.ts`
- `src/services/team.service.ts`
- `tests/services/member.service.test.ts`

---

### Story 9.29: Relationship frontmatter vocabulary on all entity profiles

**As a** vault owner,
**I want** every entity profile (member, contractor, company-member, leadership) to use a consistent relationship vocabulary in frontmatter,
**So that** managers, peers, projects, and history are all queryable as structured graph edges.

#### Change Proposals

**`src/services/member.service.ts` — `addMember`:** all member profiles get the full relationship vocabulary in frontmatter, with scope-specific defaults:

```typescript
const isDirectReport = !!opts.team && !opts.contractor;
const currentManagerLink = isDirectReport
  ? await this._resolveManagerLink(profilePath, workspaceRoot) // points to self/me
  : ''; // company-member and contractor — left empty for user to fill (decision #6)

const fm: Record<string, unknown> = {
  email: normalizedEmail,
  name: opts.name ?? '',
  role: opts.role ?? '',
  gender: opts.gender ?? '',
  location: opts.location ?? '',
  relationship: opts.contractor ? 'contractor' : opts.team ? 'direct-report' : 'company-member',
  date_added: todayIso(),
  start_date: '',                  // user-fillable
  current_manager: currentManagerLink,
  previous_manager: [],
  other_leaderships: [],
  ...(isDirectReport ? { teams: [/* team wiki-link */] } : {}),
  projects: [],
};
```

**Reciprocal write to self-profile `direct_reports:`** — only for direct-report scope (`opts.team && !opts.contractor`). Company and contractor scopes do NOT update self profile.

**`src/services/team.service.ts` — `buildMemberProfileMd`:** same field set as above, plus `teams: ["[[...|<team>]]"]`. Remove `action_items_gdoc`, all empty `##` sections except the body kept-list in schema #2.

#### Acceptance Criteria

- **Given** `tmr member add jane@co.com --team backend`, **Then** `jane@co.com.md` frontmatter has `current_manager: "[[...|me@co.com]]"`, `previous_manager: []`, `other_leaderships: []`, `start_date: ""`, `projects: []`, `teams: ["[[...|backend]]"]` AND `my-career/me@co.com.md` `direct_reports:` contains the link to jane
- **Given** `tmr member add bob@co.com` (company-scoped, no team), **Then** `bob@co.com.md` frontmatter has `current_manager: ""` (empty), `previous_manager: []`, `other_leaderships: []`, `start_date: ""`, `projects: []` AND my self-profile `direct_reports:` is **not** updated (decision #6)
- **Given** `tmr member add ext@vendor.com --contractor`, **Then** `ext@vendor.com.md` frontmatter has `current_manager: ""` (empty), same other defaults, AND my `direct_reports:` is not updated
- **Given** any of the above runs twice, **Then** the second run is a no-op (idempotent — existing profile not overwritten)

#### Files Modified

- `src/services/member.service.ts`
- `src/services/team.service.ts` (`buildMemberProfileMd`)
- `src/types/relations.types.ts`
- `tests/services/member.service.test.ts`
- `tests/services/team.service.test.ts`

---

### Story 9.30: Leadership add — bidirectional reciprocal frontmatter

**As a** vault owner,
**I want** `tmr leadership add` to update both the leader's profile and mine with the full relationship vocabulary,
**So that** the upward and downward edges of my org graph exist on both sides with the same field schema as members.

#### Change Proposals

**`src/services/leadership.service.ts` — `buildLeadershipProfileMd`:** scaffold the full relationship vocabulary in frontmatter:

```typescript
const frontmatter: ILeadershipFrontmatter = {
  email, name, role, ...(location ? { location } : {}), ...(gender ? { gender } : {}),
  areas_of_responsibility: opts.areas_of_responsibility ?? '',
  relationship: 'leadership',
  date_added: date,
  start_date: '',                  // user-fillable
  current_manager: '',             // user-fillable (their boss above them)
  previous_manager: [],
  other_leaderships: [],
  direct_reports: [],              // populated reciprocally below
  projects: [],
};
```

**`addLeadership`:** after writing leader profile, append reciprocals:

```typescript
const selfProfile = await this._findSelfProfile(workspaceRoot);
if (selfProfile) {
  // Leader gets me in their direct_reports
  const selfLinkOnLeader = formatWikiLink(selfProfile, profilePath, path.basename(selfProfile, '.md'));
  await addRelation(profilePath, 'direct_reports', selfLinkOnLeader, this._fs);

  // I get the leader as current_manager IF I don't already have one,
  // otherwise the leader goes into my leadership[] (skip-level / upward chain)
  const leaderLinkOnMe = formatWikiLink(profilePath, selfProfile, normalizedEmail);
  const selfFm = await this._readFrontmatter(selfProfile);
  if (!selfFm.current_manager) {
    await setScalar(selfProfile, 'current_manager', leaderLinkOnMe, this._fs);
  } else {
    await addRelation(selfProfile, 'leadership', leaderLinkOnMe, this._fs);
  }
}
```

#### Acceptance Criteria

- **Given** `tmr leadership add cto@co.com` runs and self profile has no `current_manager`, **Then** `cto@co.com.md` frontmatter has `direct_reports: ["[[...|me@co.com]]"]` AND self profile frontmatter has `current_manager: "[[...|cto@co.com]]"`
- **Given** I already have `current_manager` set, **When** `tmr leadership add ceo@co.com` runs, **Then** self profile `leadership:` array gets the CEO appended; `current_manager` is unchanged
- **Given** the leader profile is created, **Then** it has frontmatter `start_date: ""`, `current_manager: ""`, `previous_manager: []`, `other_leaderships: []`, `projects: []` (all user-fillable defaults)
- **Given** the command runs twice, **Then** all frontmatter arrays are idempotent

#### Files Modified

- `src/services/leadership.service.ts`
- `src/types/leadership.types.ts`
- `tests/services/leadership.service.test.ts`

---

### Story 9.31: Dated artifact frontmatter + body wiki-link + last_* scalar

**As an** LLM agent reading a dated artifact,
**I want** the file's frontmatter to declare its subject, reviewer, and type,
**So that** I can identify the relationship without parsing the filename — while keeping the profile's frontmatter compact by tracking only `last_<type>` scalars and appending the dated wiki-link to a body section.

#### Change Proposals

**`src/services/template.service.ts` — all dated templates get frontmatter:**

```typescript
// 1on1 template (member or leadership)
function build1on1(date, subjectEmail, withEmail, subjectPath, withPath, filePath): string {
  const fm = {
    type: '1on1',
    date,
    subject: formatWikiLink(subjectPath, filePath, subjectEmail),
    with: formatWikiLink(withPath, filePath, withEmail),
  };
  return matter.stringify(`\n# 1on1 — ${date}\n\n## Topics\n\n## Action Items\n`, fm);
}

// feedback template — uses `from:` (reviewer); defaults to self-email if --from omitted
// assessment / performance-review — `type`, `date`, `subject`, `with`
```

**`src/services/member.service.ts` — `createMemberFile`:**
1. Auto-resolve `fromEmail` via `EmailResolutionService.resolve()` (auto-creates reviewer profile if missing — fixes B5)
2. Write dated file with frontmatter via template
3. **Append `- [[<subdir>/<file>]]` to the appropriate body section** (`## 1on1s`, `## Feedbacks`, etc.) via existing `SectionParserService.appendToFile()` — this stays in body per decision #2
4. **Update `last_<type>` scalar in profile frontmatter** via `setScalar()`

```typescript
const subjectResolution = await this._emailResolver.resolve(normalizedEmail, workspaceRoot);
const reviewerResolution = options.fromEmail
  ? await this._emailResolver.resolve(options.fromEmail, workspaceRoot)  // fixes B5
  : null;

// Write dated file with frontmatter (subject, with/from)
await this._fs.writeFile(filePath, content);

// Body wiki-link (existing pattern — kept per decision #2)
const wikiLink = `- [[${config.subDir}/${fileName}]]`;
await this._sectionParser.appendToFile(profilePath, config.sectionName, wikiLink);

// Frontmatter scalar (new)
const scalarKey = `last_${type === '1on1' ? '1on1' : type}`;
await setScalar(profilePath, scalarKey as never, date, this._fs);
```

**`src/services/leadership.service.ts` — `add1on1`:** same pattern.

#### Acceptance Criteria

- **Given** `tmr member add 1on1 jane@co.com` runs, **Then** the dated file frontmatter has `type: 1on1`, `date: <iso>`, `subject: [[...|jane@co.com]]`, `with: [[...|me@co.com]]` AND `jane@co.com.md` BODY `## 1on1s` section has `- [[1on1s/<file>]]` appended AND `jane@co.com.md` FRONTMATTER has `last_1on1: <iso>` scalar
- **Given** `tmr member add feedback jane@co.com --from peer@co.com` runs and `peer@co.com.md` does NOT exist, **Then** a company-member stub for `peer@co.com` is auto-created via `EmailResolutionService.resolve()` AND the feedback file frontmatter has `from: [[...|peer@co.com]]` AND jane's body `## Feedbacks` is updated AND jane's frontmatter `last_feedback` is set
- **Given** `tmr leadership add 1on1 cto@co.com` runs, **Then** dated file has `subject: [[...|cto@co.com]]`, `with: [[...|me@co.com]]` AND cto's body `## 1on1s` is updated AND cto's frontmatter `last_1on1` is set
- **Given** the profile's frontmatter is inspected after 12 monthly 1on1s, **Then** the frontmatter contains a SINGLE `last_1on1` scalar (NOT a 12-entry array)

#### Files Modified

- `src/services/template.service.ts`
- `src/services/member.service.ts`
- `src/services/leadership.service.ts`
- Multiple test files

---

### Story 9.32: `tmr myself add performance-review` — body wiki-link + frontmatter scalar

**As a** vault owner,
**I want** my self-profile's `## Performance Reviews` body section updated with each review and a `last_performance_review` scalar in frontmatter,
**So that** my profile stays compact while preserving the chronological list.

#### Change Proposals

**`src/services/myself.service.ts` — `addPerformanceReview`:**
- Keep existing `SectionParserService.appendToFile(profilePath, 'Performance Reviews', wikiLink)` (the body append is correct per decision #2)
- Add `setScalar(profilePath, 'last_performance_review', datePrefix, this._fs)` (NEW)
- Update the dated file's frontmatter via TemplateService (story 9.31) to include `type: performance-review`, `date`, `subject`

#### Acceptance Criteria

- **Given** `tmr myself add performance-review` runs, **Then** `my-career/<email>.md` BODY `## Performance Reviews` section has `- [[performance-reviews/<file>]]` appended AND FRONTMATTER has `last_performance_review: YYYY-MM` scalar
- **Given** the dated file is created, **Then** it has frontmatter `type: performance-review`, `date: YYYY-MM`, `subject: [[...|me@co.com]]`
- **Given** the command runs twice with the same date, **Then** the body wiki-link is deduplicated (existing behavior of `SectionParserService.appendToFile`)

#### Files Modified

- `src/services/myself.service.ts`
- `tests/services/myself.service.test.ts`

---

### Story 9.33: `tmr project link-member` / `link-stakeholder` — frontmatter both sides

**As a** project owner,
**I want** project ↔ entity links stored in frontmatter on both files,
**So that** the project graph is visible in Obsidian and queryable by Dataview without body parsing.

#### Change Proposals

**`src/services/project.service.ts` — `linkMember`, `linkStakeholder`:** replace `appendToHashSection(content, 'Team Members', wikiLink)` with `addRelation(overviewPath, 'members', wikiLink, this._fs)` (or `'stakeholders'`). Replace `writeProjectBackLink` body append with `addRelation(entityPath, 'projects', projectLink, this._fs)`.

**`src/services/template.service.ts` — `getProjectOverviewTemplate`:** scaffold frontmatter `members: []`, `stakeholders: []`; remove or de-emphasize body `# Team Members` / `# Stakeholders` sections (keep as empty optional human-prose headers).

**`listProjects` and `countHashSection`:** read frontmatter `members`/`stakeholders` arrays **only**. No body fallback (hard cutover — confirmed decision). Rename `countHashSection` callers to count array length directly.

#### Acceptance Criteria

- **Given** project `foo-project` exists, **When** `tmr project link-member foo-project jane@co.com` runs, **Then** `foo-project.md` frontmatter `members:` contains `[[...|jane@co.com]]` AND `jane@co.com.md` frontmatter `projects:` contains `[[...|foo-project]]`
- **Given** `tmr project list` runs against a frontmatter vault, **Then** counts come from frontmatter arrays
- **Given** `tmr project list` runs against an unmigrated (body-only) vault, **Then** counts are zero AND a warning is printed instructing the user to run `tmr doctor --fix-frontmatter`

#### Files Modified

- `src/services/project.service.ts`
- `src/services/template.service.ts`
- `tests/services/project.service.test.ts`

---

### Story 9.34: `tmr team fire/archive` — frontmatter cleanup (mark-only) + manager history

**As a** vault owner archiving a team member,
**I want** the archived profile's frontmatter to clearly show archival state and move the manager into history,
**So that** queries can distinguish active vs archived AND the historical reporting line is preserved without polluting `current_manager`.

#### Change Proposals

**`src/services/team.service.ts` — `archiveMember`:**
- Use `setScalar(archivedProfile, 'archived', true, fs)` and `setScalar(archivedProfile, 'archived_date', todayIso(), fs)` (replaces existing inline `matter.stringify`)
- **Move `current_manager` → append to `previous_manager[]`, then `current_manager: ""`** (preserve history)
- Set `teams: []` (clear the array — the member is no longer on any active team)
- `_removeWikiLink` is updated to use `removeRelation(teamMembersPath, 'members', wikiLink, fs)`
- **Reciprocal cleanup on self-profile:** remove archived member from `direct_reports:` (this IS done — minimal back-edge cleanup since me-as-manager is now explicitly false)
- **Do NOT walk vault to remove other reverse links** (projects, leader's direct_reports if matrix, etc.) — confirmed mark-only per decision; Obsidian shows stale links visually, preserving history

**`fireMember`:** same as archive plus `setScalar(archivedProfile, 'termination', true, fs)`, `termination_date`, `termination_note`.

#### Acceptance Criteria

- **Given** `tmr team fire backend jane@co.com` runs and jane's profile had `current_manager: "[[...|me@co.com]]"`, **Then** the archived profile has frontmatter `archived: true`, `archived_date: <iso>`, `termination: true`, `termination_date: <iso>`, `teams: []`, `previous_manager: ["[[...|me@co.com]]"]`, `current_manager: ""`
- **Given** the team's `<team>-members.md` had `members:` frontmatter containing jane, **When** archive runs, **Then** that entry is removed from the frontmatter array
- **Given** my self-profile had jane in `direct_reports`, **When** archive runs, **Then** jane is removed from `direct_reports` (reciprocal cleanup)
- **Given** other files in the vault (projects, leader's `direct_reports` if matrix, etc.) reference jane, **Then** those references remain (mark-only — confirmed decision)
- **Given** the same syntax `tmr team fire <team> <email>` is used, **Then** both positional args are read and no prompt appears

#### Files Modified

- `src/services/team.service.ts`
- `tests/services/team.service.test.ts`

---

### Story 9.35: `tmr init` — frontmatter-native self & leader profiles + tasks/goals graph edges

**As a** new user running `tmr init`,
**I want** my self-profile to be born with frontmatter relationships in place,
**So that** the Obsidian graph is immediately wired from day one.

#### Change Proposals

**`src/services/init.service.ts` — `writeUserProfile`:** remove `## Leadership` body section; place leader in frontmatter `current_manager:` (NOT `leadership[]` — the immediate leader given at init IS the current manager). Add `tasks`, `today`, `this_week`, `this_month`, `this_quarter` scalars pointing to corresponding `my-tasks/` shell files. Add `start_date` user-fillable field.

```typescript
const filePath = path.join(vaultPath, 'my-career', `${email}.md`);
const fm: Record<string, unknown> = {
  email, name: opts.name, role: opts.role,
  relationship: 'self',
  date_added: todayIso(),
  start_date: '',                 // user-fillable
  current_manager: '',            // set below if leader provided
  previous_manager: [],
  leadership: [],                 // skip-level / upward chain — populated by subsequent `tmr leadership add`
  other_leaderships: [],
  direct_reports: [],
  projects: [],
  tasks: formatWikiLink(path.join(vaultPath, 'my-tasks', 'tasks.md'), filePath, 'tasks'),
  today: formatWikiLink(path.join(vaultPath, 'my-tasks', 'today.md'), filePath, 'today'),
  this_week: formatWikiLink(path.join(vaultPath, 'my-tasks', 'this-week.md'), filePath, 'this-week'),
  this_month: formatWikiLink(path.join(vaultPath, 'my-tasks', 'this-month.md'), filePath, 'this-month'),
  this_quarter: formatWikiLink(path.join(vaultPath, 'my-tasks', 'this-quarter.md'), filePath, 'this-quarter'),
};
if (opts.leaderEmail?.trim()) {
  const leaderEmail = opts.leaderEmail.trim().toLowerCase();
  const leaderFile = path.join(vaultPath, 'my-leadership', leaderEmail, `${leaderEmail}.md`);
  fm.current_manager = formatWikiLink(leaderFile, filePath, leaderEmail);
}
const body = '\n# Career Profile\n\n## Notes\n\n## Performance Reviews\n';
await this._fs.writeFile(filePath, matter.stringify(body, fm));
```

**Also:** when init writes the leader profile via `LeadershipService.addLeadership`, that call (post-story-9.30) automatically reciprocates `direct_reports:` back to the user's profile AND respects the "current_manager already set" logic so the leader is NOT also added to `leadership[]`. Init must run user-profile write **before** leader-profile write.

**`team.service.buildMemberProfileMd`:** strip empty `##` body sections (except those kept per schema #2: `## 1on1s`, `## Feedbacks`, `## Assessments`, `## Performance Reviews`, `## Notes`) + the hardcoded action-items wiki-link + the unused `action_items_gdoc` frontmatter field.

**Vault scaffold (`VAULT_DIRS`):** ensure `my-tasks/` shell files (`tasks.md`, `today.md`, `this-week.md`, `this-month.md`, `this-quarter.md`) are created with minimal frontmatter:

```yaml
---
type: tasks            # or today/this-week/this-month/this-quarter
owner: "[[my-career/<email>.md|<email>]]"
---

# Tasks
```

#### Acceptance Criteria

- **Given** `tmr init` runs, **Then** `my-career/<email>.md` frontmatter has all five scalars: `tasks`, `today`, `this_week`, `this_month`, `this_quarter`, plus empty defaults for `start_date`, `previous_manager`, `leadership`, `other_leaderships`, `direct_reports`, `projects`
- **Given** init runs with a leader email, **Then** `my-career/<email>.md` frontmatter has `current_manager: "[[...|leader@co.com]]"` AND `leadership: []` (NOT containing the leader) AND `my-leadership/leader@co.com/leader@co.com.md` frontmatter has `direct_reports: ["[[...|me@co.com]]"]`
- **Given** init runs, **Then** `my-tasks/tasks.md`, `today.md`, `this-week.md`, `this-month.md`, `this-quarter.md` exist with frontmatter `type: <name>` and `owner: [[...|me@co.com]]`
- **Given** init runs and team-members are added, **Then** member profiles have no empty `##` sections (except the kept body list) and no `action_items_gdoc:` frontmatter

#### Files Modified

- `src/services/init.service.ts`
- `src/services/team.service.ts` (`buildMemberProfileMd`)
- `src/templates/onboarding.templates.ts` (task shell templates)
- `tests/services/init.service.test.ts`

---

### Story 9.36: `tmr doctor --fix-frontmatter` migration command

**As a** user with an existing vault on the old body-link pattern,
**I want** a one-shot command that lifts body wiki-links into frontmatter,
**So that** I can adopt the new pattern without manual editing.

#### Change Proposals

**`src/services/doctor.service.ts`:** add `migrateFrontmatter(workspaceRoot: string): Promise<{scanned: number; migrated: number}>`. Walks every entity profile (self, members, contractors, leadership, archived) and migrates **only structural relationships** from body to frontmatter (dated artifact body sections stay as-is per decision #2):

Canonical migration map:
- Body `## Current Manager` (single `- [[...]]` line) → frontmatter `current_manager` scalar
- Body `## Previous Managers` (multiple `- [[...]]` lines) → frontmatter `previous_manager` array
- Body `## Leadership` (multiple lines) → frontmatter `leadership` array
- Body `## Other Leaderships` (multiple lines) → frontmatter `other_leaderships` array
- Body `## Projects` (multiple lines) → frontmatter `projects` array
- Body `## Direct Reports` (multiple lines) → frontmatter `direct_reports` array
- Body `## Action Items` line `- [[action-items-<email>|...]]` → **strip** (deprecated)
- Body `frontmatter` `manager:` → rename to `current_manager:` (key rename)
- Body `frontmatter` `action_items_gdoc:` → **strip** (deprecated)
- Body wiki-links under `## 1on1s`, `## Feedbacks`, `## Assessments`, `## Performance Reviews` → **untouched** (kept in body per decision #2). BUT: detect the latest date in each section and set `last_<type>:` frontmatter scalar.

**Strip migrated lines from body** but keep the empty `##` headers for human notes.

Also migrates team-members files (body `- [[...]]` lines → frontmatter `members:`) and project files (body `# Team Members`/`# Stakeholders` → frontmatter `members:`/`stakeholders:`).

**Also add `detectLegacyBodyLinks(workspaceRoot)`** — quick scan returning the count of profiles that still contain body `- [[...]]` lines in the canonical section names. Used by `tmr doctor` (without `--fix-frontmatter`) to print a prominent warning:

```
⚠ 12 profiles contain legacy body-style wiki-links.
  Run `tmr doctor --fix-frontmatter` to migrate them to frontmatter.
  Without migration, `tmr team list`, `tmr project list`, and similar commands
  will show empty results.
```

**`src/commands/doctor.command.ts`:** add `--fix-frontmatter` flag. When set, run migration and print summary (`Scanned 42 profiles, migrated 18 (24 already up to date). Renamed 'manager'→'current_manager' on 12 profiles.`). When not set, run `detectLegacyBodyLinks` and emit warning if any are found.

**Idempotent:** safe to re-run; second run reports 0 migrations.

**README / post-init summary** — mention the migration command for users upgrading from prior versions.

#### Acceptance Criteria

- **Given** a vault with old body-style wiki-links in `## 1on1s`, **When** `tmr doctor --fix-frontmatter` runs, **Then** the wiki-links appear in frontmatter `one_on_ones:` array and are removed from body
- **Given** the same command runs twice, **Then** the second run reports `0 migrated`
- **Given** a profile already uses frontmatter, **Then** it is reported as `scanned` but not `migrated`
- **Given** a profile has both body and frontmatter (partial migration), **Then** body lines are merged into frontmatter (deduplicated) and body lines are stripped

#### Files Modified

- `src/services/doctor.service.ts`
- `src/commands/doctor.command.ts`
- `tests/services/doctor.service.test.ts`
- README.md (document the migration command)

---

## Section 5: Implementation Handoff

**Change scope classification: Major**

Architectural pattern shift across 6 services plus a migration script and project-context rules. Requires coordinated implementation order and a one-release read-side compatibility shim.

**Handoff path:**

1. **PM/Architect review** (this proposal) — confirm scope, ordering, and naming conventions
2. **Developer agent** implements stories in dependency order:
   - **Wave 1 (foundation):** 9.26, 9.27 — utility + types + rules
   - **Wave 2 (parallel command fixes):** 9.28, 9.29, 9.30, 9.31, 9.32, 9.33, 9.34
   - **Wave 3 (onboarding + migration):** 9.35, 9.36
3. **Test architect (Murat)** validates read-side fallback and migration idempotence before each wave merges

**Deliverables:**

| Story | Deliverable |
|---|---|
| 9.26 | `src/utils/frontmatter-relations.ts` + tests |
| 9.27 | `src/types/relations.types.ts` + project-context.md updates |
| 9.28 | `member add --team` writes to team-members frontmatter; team-members file scaffolded with frontmatter shell |
| 9.29 | All member scopes get `manager:` frontmatter; team members get reciprocal in self-profile `direct_reports:` |
| 9.30 | Leadership add writes reciprocals on both sides via frontmatter |
| 9.31 | Dated files have `type`, `date`, `subject`, `with`/`from` frontmatter; profiles get `<type>s:` arrays + `last_<type>` scalars; reviewer auto-create on `--from` |
| 9.32 | Self-profile `performance_reviews:` frontmatter array; dated file has `type: performance-review` |
| 9.33 | Project ↔ entity links in frontmatter on both sides; templates scaffold empty arrays |
| 9.34 | Archive/fire sets `archived: true`, clears `teams: []`, removes from team-members frontmatter (mark-only — confirmed) |
| 9.35 | Init writes frontmatter-native self profile (`tasks`, `goals`, `leadership` arrays); member template stripped of empty sections; my-tasks shell files exist with frontmatter |
| 9.36 | `tmr doctor --fix-frontmatter` migrates old vaults; `tmr doctor` (no flag) warns when legacy body links are detected; idempotent; documented |

**Success criteria:**

1. After `tmr init`, the Obsidian graph for `my-career/<email>.md` shows edges to: my current_manager, my tasks/today/this_week/this_month/this_quarter — all from frontmatter scalars
2. After `tmr member add jane@co.com --team backend`, the graph shows: me → jane (`direct_reports`), jane → me (`current_manager`), backend → jane (members), jane → backend (`teams`)
3. After `tmr member add bob@co.com` (company-scoped), `bob@co.com.md` has `current_manager: ""` (empty, user fills) — confirms decision #6
4. After `tmr member add feedback jane@co.com --from peer@co.com` (peer not yet existing), `peer@co.com.md` exists as company-member stub AND the feedback file has `from: [[...|peer@co.com]]` frontmatter AND jane's BODY `## Feedbacks` has the wiki-link appended AND jane's FRONTMATTER has `last_feedback:` scalar (no `feedbacks: []` array — confirms decision #2 revised)
5. After 12 monthly 1-on-1s with jane, jane's profile frontmatter has a SINGLE `last_1on1: <iso>` scalar (NOT a 12-entry array); body `## 1on1s` has 12 wiki-link lines
6. After `tmr project link-member foo-project jane@co.com`, both `foo-project.md` (frontmatter `members:`) and `jane@co.com.md` (frontmatter `projects:`) have the relationship; `tmr project list` shows the count
7. After `tmr team fire backend jane@co.com`, archived profile has `archived: true`, `teams: []`, `termination: true`, `previous_manager: ["[[...|me@co.com]]"]`, `current_manager: ""`; team-members frontmatter no longer includes jane; my self-profile `direct_reports:` no longer includes jane
8. After `tmr doctor --fix-frontmatter` on a pre-migration vault: body `## Current Manager`, `## Previous Managers`, `## Leadership`, `## Projects`, `## Direct Reports` sections are lifted to frontmatter; `manager:` frontmatter key renamed to `current_manager:`; body `## 1on1s` etc. stay as-is but `last_<type>:` scalars are computed from the most recent dated entry; second run is a no-op
9. `npm run validate` passes (lint + typecheck + test + build) for every story before merge
10. **Hard cutover verified**: an unmigrated vault running `tmr team list` after upgrade shows zero members AND a warning instructing the user to run `tmr doctor --fix-frontmatter`. After migration, full results return.

---

*Workflow: bmad-correct-course | Decisions: (1) extend Epic 9; (2) **dated artifacts stay in body** + `last_<type>` scalar in frontmatter — structural relationships only in frontmatter; (3) auto-migration via doctor; (4) archive mark-only + move current_manager → previous_manager[]; (5) hard cutover (frontmatter-only reads); (6) company/contractor `current_manager: ""` (user-fillable); (7) field vocabulary: current_manager / previous_manager / leadership / other_leaderships / direct_reports / teams / projects / start_date + self: tasks / today / this_week / this_month / this_quarter scalars.*
