---
baseline_commit: 5e151df
---

# Story 9.35: `tmr init` — frontmatter-native self & leader profiles + tasks graph edges

Status: done

## Story

As a new user running `tmr init`,
I want my self-profile to be born with frontmatter relationships in place (current manager + task graph edges),
so that the Obsidian graph is immediately wired from day one — no migration needed.

## Context & Rationale

This is **Wave 3** of the frontmatter-native relationship migration (sprint change proposal 2026-06-09). Stories 9.26–9.34 migrated the per-command write paths. 9.35 makes `tmr init` produce frontmatter-native profiles from the start so freshly-created vaults never need `tmr doctor --fix-frontmatter` (9.36).

**Core principle (decision #2):** Frontmatter holds **structural relationships** (the finite org/task graph). Body holds **dated chronological artifacts** (`## 1on1s`, `## Performance Reviews`, etc.). The self-profile's manager and task-file edges must live in frontmatter so Obsidian's graph view shows them.

**Three deliverables:**
1. **Self profile** (`InitService.writeUserProfile`) — full frontmatter-native shape: `current_manager` scalar (replaces the old `## Leadership` body section), five task-graph scalars (`tasks`, `today`, `this_week`, `this_month`, `this_quarter`), and empty-default arrays for the rest of the relationship vocabulary.
2. **Task shell files** (`my-tasks/*.md`) — minimal frontmatter (`type:` + `owner:` wiki-link back to self) so the `self → tasks` graph edges resolve to real nodes.
3. **Member profiles** — already frontmatter-native (done in 9.29); AC4 just needs a verifying test.

### ⚠️ Critical discovery (read before implementing)

The sprint change proposal (line 987) **assumes** `LeadershipService.addLeadership` already "respects the 'current_manager already set' logic so the leader is NOT also added to `leadership[]`." **This assumption is FALSE in the current code.** `addLeadership` (`src/services/leadership.service.ts:118-122`) does:

```typescript
if (!selfFm['current_manager']) {
  await setScalar(selfProfile, 'current_manager', leaderLinkOnMe, this._fs);
} else {
  await addRelation(selfProfile, 'leadership', leaderLinkOnMe, this._fs); // ← appends leader to leadership[]!
}
```

So if `writeUserProfile` pre-sets `current_manager` to the leader (as the spec code block instructs), then `writeLeaderProfile → addLeadership` runs afterward, sees `current_manager` already set, and **wrongly appends the same leader to `leadership[]`** — violating AC5 (`leadership: []` must NOT contain the leader). See **D-9.35-3** for the resolution (a small, correct idempotency guard in `addLeadership`).

## Acceptance Criteria

**AC1 — Self profile frontmatter is fully scaffolded:** After `tmr init`, `my-career/<email>.md` frontmatter contains all five task scalars (`tasks`, `today`, `this_week`, `this_month`, `this_quarter`) as wiki-links to the corresponding `my-tasks/*.md` files, PLUS empty defaults for `start_date` (`''`), `previous_manager` (`[]`), `leadership` (`[]`), `other_leaderships` (`[]`), `direct_reports` (`[]`), and `projects` (`[]`). The frontmatter also retains `email`, `name`, `role`, `relationship: self`, `date_added`.

**AC2 — `## Leadership` and `## Goals` body sections removed:** The self-profile body no longer contains a `## Leadership` section (the manager now lives in `current_manager` frontmatter) nor a `## Goals` section. Body is `# Career Profile` + `## Notes` + `## Performance Reviews`.

**AC3 — Leader → `current_manager` scalar (NOT `leadership[]`):** When init runs with a leader email, `my-career/<email>.md` frontmatter has `current_manager: "[[...|leader@co.com]]"` AND `leadership: []` (empty — the leader is the current manager, not a skip-level). When no leader email is provided, `current_manager` is `''`.

**AC4 — Leader profile reciprocal `direct_reports`:** After init with a leader email, `my-leadership/<leader>/<leader>.md` frontmatter has `direct_reports: ["[[...|me@co.com]]"]` (reciprocated by `addLeadership`).

**AC5 — Leader NOT duplicated into `leadership[]`:** After init with a leader email, the self profile's `leadership[]` array is empty — the current manager is recorded ONLY in `current_manager`, never also in `leadership[]`. (Requires the D-9.35-3 idempotency guard.)

**AC6 — Task shell files have owner frontmatter:** After init, `my-tasks/tasks.md`, `today.md`, `this-week.md`, `this-month.md`, `this-quarter.md` each exist with frontmatter `type: <name>` (`tasks` / `today` / `this-week` / `this-month` / `this-quarter`) and `owner:` set to a wiki-link pointing at `my-career/<email>.md`.

**AC7 — Member profiles already clean (verify, no regression):** Team-member profiles created during init have no empty `##` sections beyond the kept body list (`## 1on1s`, `## Feedbacks`, `## Assessments`, `## Performance Reviews`, `## Notes`) and no `action_items_gdoc:` frontmatter field. (Already satisfied by `team.service.buildMemberProfileMd` since 9.29 — add/confirm a test.)

**AC8 — Validation:** `npx tsc --noEmit`, `npx eslint src/`, and the full `jest` suite all pass — zero new type/lint errors and no regressions. Existing `writeUserProfile` tests that assert the old `## Leadership` body section must be updated.

## Tasks / Subtasks

- [x] **Task 1 — Rewrite `InitService.writeUserProfile` to be frontmatter-native** (AC: 1, 2, 3)
  - [x] Replace the minimal `fm` object with the full frontmatter shape (preserve `email`, `name`, `role`, `relationship: 'self'`, `date_added: todayIso()`), adding in order: `start_date: ''`, `current_manager: ''`, `previous_manager: []`, `leadership: []`, `other_leaderships: []`, `direct_reports: []`, `projects: []`, then the five task scalars.
  - [x] Compute each task scalar via `formatWikiLink(path.join(vaultPath, 'my-tasks', '<file>.md'), filePath, '<label>')` where `filePath` is the self-profile path. Labels/files: `tasks`→`tasks.md`, `today`→`today.md`, `this_week`→`this-week.md`, `this_month`→`this-month.md`, `this_quarter`→`this-quarter.md`. (Frontmatter KEYS use underscores: `this_week`; FILE names use hyphens: `this-week.md`; display labels match the file stem: `this-week`.)
  - [x] When `opts.leaderEmail?.trim()` is set: compute `leaderFile = path.join(vaultPath, 'my-leadership', leaderEmail, ` + "`${leaderEmail}.md`" + `)` and set `fm.current_manager = formatWikiLink(leaderFile, filePath, leaderEmail)`. (Use `Record<string, unknown>` typing for `fm` so the wiki-link string assignment type-checks.)
  - [x] Change the body to exactly `'\n# Career Profile\n\n## Notes\n\n## Performance Reviews\n'` — remove the old `## Goals` line and the conditional `## Leadership` block entirely.
  - [x] Keep email lowercasing and the `my-career/<email>.md` flat path unchanged.

- [x] **Task 2 — Add idempotency guard to `LeadershipService.addLeadership`** (AC: 5; supports AC3, AC4)
  - [x] In the reciprocal-writes block (`src/services/leadership.service.ts:118-122`), change the `else` branch so the leader is only appended to `leadership[]` when the existing `current_manager` is set to a **different** leader:
    ```typescript
    if (!selfFm['current_manager']) {
      await setScalar(selfProfile, 'current_manager', leaderLinkOnMe, this._fs);
    } else if (selfFm['current_manager'] !== leaderLinkOnMe) {
      await addRelation(selfProfile, 'leadership', leaderLinkOnMe, this._fs);
    }
    // else: leader already IS the current_manager — no-op (prevents duplicate in leadership[])
    ```
  - [x] Leave the unconditional `direct_reports` reciprocal write (line 113) untouched — the leader must always gain `me` as a direct report regardless of the manager/skip-level distinction.
  - [x] Verify `leaderLinkOnMe` (computed in `addLeadership`) is byte-identical to the `current_manager` value written by `writeUserProfile` — both are `formatWikiLink(<leader-profile-path>, <self-profile-path>, <leader-email>)`, so the `!==` comparison correctly detects equality. (Confirmed during story prep; assert in a test.)

- [x] **Task 3 — Task shell files get `type:` + `owner:` frontmatter** (AC: 6)
  - [x] In `src/templates/onboarding.templates.ts`, change `generateTaskFileTemplate` to accept the file type and an owner wiki-link and emit frontmatter. Suggested signature: `generateTaskFileTemplate(type: 'tasks' | TaskPeriod, ownerWikiLink: string): string` producing:
    ```
    ---
    type: <type>
    owner: "<ownerWikiLink>"
    ---

    # Tasks — <Label>
    ```
    (Add a `tasks` label, e.g. `# Tasks`, to `TASK_PERIOD_LABELS` handling or special-case `type === 'tasks'`.)
  - [x] In `src/commands/init.command.ts`, remove the body-only `TASKS_MD_TEMPLATE` constant and build all five task files through the updated template. Compute the owner link ONCE: `const ownerLink = formatWikiLink(join(workspacePath, 'my-career', ` + "`${answers.email.toLowerCase()}.md`" + `), join(workspacePath, 'my-tasks', '<file>.md'), answers.email.toLowerCase())`. Since all task files share the `my-tasks/` directory, the relative path to the self profile is identical for all five (`../my-career/<email>.md`), so a single owner link value is correct for every file.
  - [x] Preserve the existing idempotent guard (`if (!(await fileSystemService.exists(filePath)))`) and the parallel-write pattern.
  - [x] Keep the five filenames exactly: `tasks.md`, `today.md`, `this-week.md`, `this-month.md`, `this-quarter.md`.

- [x] **Task 4 — Update / add tests** (AC: 8, and coverage for all ACs)
  - [x] `tests/services/init.service.test.ts` — rewrite the two `## Leadership` tests (lines ~264-279):
    - Replace `'includes ## Leadership section…'` with a test asserting that with `leaderEmail`, the parsed frontmatter has `current_manager` containing the leader email AND `leadership` equal to `[]` AND body does NOT contain `## Leadership`.
    - Replace `'does NOT include ## Leadership…'` with a test asserting that without `leaderEmail`, `current_manager` is `''`.
    - Add a test: frontmatter contains all five task scalars (`tasks`/`today`/`this_week`/`this_month`/`this_quarter`) as `[[../my-tasks/...]]` wiki-links.
    - Add a test: frontmatter contains empty-default arrays (`previous_manager`, `leadership`, `other_leaderships`, `direct_reports`, `projects`) and `start_date: ''`.
    - Add a test: body equals/contains `## Performance Reviews` and does NOT contain `## Goals`.
  - [x] `tests/services/leadership.service.test.ts` — add a test: when self profile already has `current_manager` set to the SAME leader being added, `addLeadership` does NOT append to `leadership[]` (stays `[]`) but still writes `direct_reports` on the leader. Add a contrasting test: a DIFFERENT leader (skip-level) IS appended to `leadership[]`.
  - [x] `tests/templates/onboarding.templates.test.ts` — update `generateTaskFileTemplate` tests for the new signature; assert emitted frontmatter has `type:` and `owner:`.
  - [x] `tests/commands/init.command.test.ts` and/or `tests/integration/init.integration.test.ts` — assert the five `my-tasks/*.md` files are written with `type:` + `owner:` frontmatter, and (integration) that after a full init with a leader, the self profile has `current_manager` set + `leadership: []` and the leader profile has `direct_reports: [me]`.
  - [x] `tests/services/team.service.test.ts` (or existing member-profile test) — confirm AC7: a newly built member profile has no `action_items_gdoc` and no body sections beyond the kept five. (Likely already covered — verify and add an explicit assertion if missing.)

- [x] **Task 5 — Validate** (AC: 8)
  - [x] `npx tsc --noEmit` — zero type errors
  - [x] `npx eslint src/` — zero lint errors
  - [x] `NODE_OPTIONS=--experimental-vm-modules npx jest --no-coverage` — full suite green

### Review Findings

_Code review 2026-06-13 (Blind Hunter + Edge Case Hunter + Acceptance Auditor). All 8 ACs SATISFIED; no Critical/High acceptance violations. 1 decision-needed, 3 patch, 4 deferred, 5 dismissed as noise._

- [x] [Review][Decision] `goals` scope contradiction — RESOLVED 2026-06-13: keep goals omitted (no code change), per the concrete ACs and D-9.35-6. The title/proposal "tasks/goals" wording is aspirational and may be cleaned up separately. (No user objection raised.)

- [x] [Review][Patch] Email whitespace asymmetry produces dangling task `owner` back-links — FIXED: `init.command` now uses `answers.email.trim().toLowerCase()` so the owner wiki-links match the trimmed self-profile path [src/commands/init.command.ts:133]
- [x] [Review][Patch] Task-file frontmatter leaks into `tmr today/this-week/...` output — FIXED: `TaskViewService.readTaskFile` now strips YAML frontmatter via `gray-matter` before rendering (+2 tests) [src/services/task-view.service.ts:21]
- [x] [Review][Patch] `addLeadership` omits `.trim()` on the leader email — FIXED: now `email.trim().toLowerCase()`, aligning with `writeUserProfile` so AC5's byte-identity guard is robust [src/services/leadership.service.ts:95]

- [x] [Review][Defer] AC4 leader-side `direct_reports` reciprocity is only unit-tested (LEA-UNIT-031), never exercised through the real `tmr init` orchestration (integration harness makes `_getSelfProfilePath` return null) [tests/integration/init.integration.test.ts] — deferred, test-coverage enhancement
- [x] [Review][Defer] `writeUserProfile` writes the self profile unconditionally (no `if (!exists)` guard), unlike the task-file loop — a re-run could overwrite manual edits [src/services/init.service.ts:196] — deferred, pre-existing behavior (init is guarded upstream by vault detection)
- [x] [Review][Defer] Task files created by a prior version (no frontmatter) are never upgraded — the `if (!exists)` guard skips them, leaving a mixed population [src/commands/init.command.ts:145] — deferred, pre-existing migration concern out of 9.35 scope
- [x] [Review][Defer] Dead `generateTeamMemberProfile` + its test still emit/assert `action_items_gdoc` and `## Action Items` (the anti-pattern AC7 forbids) [src/templates/onboarding.templates.ts:103] — deferred, dead code (live flow uses `buildMemberProfileMd`), out of scope

## Dev Notes

### Decision Log (read first)

- **D-9.35-1 — `writeUserProfile` sets `current_manager` inline (per spec) AND we fix `addLeadership` (D-9.35-3).** Two approaches were considered: (A) set `current_manager` inline in `writeUserProfile` + add an idempotency guard to `addLeadership`; (B) leave `current_manager: ''` in `writeUserProfile` and let `addLeadership` populate it. **Chosen: A.** It honors the spec's `writeUserProfile` code block, makes the self profile correct immediately (robust even if the later leader-profile write fails), and fixes a genuine latent bug in `addLeadership` (adding your existing manager via `tmr leadership add` would otherwise duplicate them into `leadership[]`). The cost is a 1-line change to a shared service + a test.

- **D-9.35-2 — Task `owner` and self `tasks` scalars use `formatWikiLink` (file-anchored relative), NOT vault-root-relative.** The proposal's task-file YAML example (line 996) shows a vault-root-relative `[[my-career/<email>.md|<email>]]`, but every other frontmatter-native write in this epic (9.30–9.34) uses `formatWikiLink`, which produces file-anchored relative links (`[[../my-career/<email>.md|<email>]]`). Consistency wins — use `formatWikiLink` everywhere. The AC text uses `[[...]]` as a placeholder, so either format satisfies it; `formatWikiLink` is the project convention (see project-context anti-patterns).

- **D-9.35-3 — `addLeadership` idempotency guard.** Change the `else` to `else if (selfFm['current_manager'] !== leaderLinkOnMe)`. This makes the spec's stated assumption true and is correct beyond init: re-adding the current manager is a no-op for `leadership[]`, while a different (skip-level) leader is still appended. `direct_reports` reciprocity is unconditional and unchanged.

- **D-9.35-4 — Member-profile cleanup (AC7) is already done.** `team.service.buildMemberProfileMd` (`src/services/team.service.ts:81-123`) is ALREADY frontmatter-native: clean body (`## 1on1s / ## Feedbacks / ## Assessments / ## Performance Reviews / ## Notes`), no `action_items_gdoc`, no `## Action Items` link. This was completed in story 9.29. **Do NOT re-implement** — just add/confirm an assertion. The spec's mention of modifying `buildMemberProfileMd` is stale.

- **D-9.35-5 — Legacy `onboarding.templates.ts` profile generators are DEAD CODE — out of scope.** `generateCareerProfile`, `generatePdp`, `generateLeadershipProfile`, and `generateTeamMemberProfile` (the one with `action_items_gdoc: ''` and the old `## Action Items` section) are NOT referenced anywhere in `src/**` (only in their own test file). The live init flow uses `InitService.writeUserProfile`, `TeamService.addMember`, and `LeadershipService.addLeadership`. Leave these dead generators untouched in this story (a separate cleanup story can delete them). ONLY touch the TASK template (`generateTaskFileTemplate`) in this file.

- **D-9.35-6 — `goals` scalar is out of scope despite the story title.** The story title says "tasks/goals" and `SCALAR_KEYS` (defined in 9.27) includes `'goals'`, but the 9.35 concrete spec (code block + ACs) only writes the five task scalars — there is NO `goals` scalar in the self profile and NO `my-tasks/goals.md` shell file. Follow the ACs: do NOT add a `goals` scalar or file. (See "Open Questions" — flagged for the user.)

### Current State to Understand Before Changing

**`InitService.writeUserProfile` (`src/services/init.service.ts:159-184`) — current behavior:**
```typescript
const fm = { email, name, role, relationship: 'self', date_added: todayIso() };   // minimal
let body = '\n# Career Profile\n\n## Notes\n\n## Goals\n';
if (opts.leaderEmail?.trim()) {
  // appends a `## Leadership` body section with a wiki-link  ← REMOVE
}
```
Must become: full frontmatter shape + `current_manager` scalar + body without `## Goals`/`## Leadership`.

**`tmr init` write order (`src/commands/init.command.ts`):** scaffold → task files (135-151) → org config → **writeUserProfile (167)** → **writeLeaderProfile (184)** → teams → members. The user-profile-before-leader-profile order required by the spec is **already correct**. Task files are written before the profile, but that is fine: the `owner` link only needs the email string (`answers.email`), not the profile file to exist on disk.

**`LeadershipService.addLeadership` (`src/services/leadership.service.ts:90-125`):** creates the leader profile, then reciprocates: always `addRelation(leader, 'direct_reports', me)`; then `current_manager` empty → set it, else → append to `leadership[]` (the branch to guard per D-9.35-3).

**`generateTaskFileTemplate` (`src/templates/onboarding.templates.ts:175-178`):** currently `(period: TaskPeriod) => '# Tasks — <Label>\n\n_Run `tmr process`…_\n'` — no frontmatter, no `tasks` type. `TASK_PERIOD_LABELS` covers only the 4 periods.

**`buildMemberProfileMd` (`src/services/team.service.ts:81-123`):** already clean (D-9.35-4).

### Relationship Schema (target self-profile frontmatter)

```yaml
---
email: me@co.com
name: My Name
role: Engineering Manager
relationship: self
date_added: 2026-06-13
start_date: ''                                              # user-fillable
current_manager: "[[../my-leadership/boss@co.com/boss@co.com.md|boss@co.com]]"   # '' if no leader
previous_manager: []
leadership: []                                              # skip-level chain — populated by later `tmr leadership add`
other_leaderships: []
direct_reports: []
projects: []
tasks: "[[../my-tasks/tasks.md|tasks]]"
today: "[[../my-tasks/today.md|today]]"
this_week: "[[../my-tasks/this-week.md|this-week]]"
this_month: "[[../my-tasks/this-month.md|this-month]]"
this_quarter: "[[../my-tasks/this-quarter.md|this-quarter]]"
---

# Career Profile

## Notes

## Performance Reviews
```

Task shell file (e.g. `my-tasks/this-week.md`):
```yaml
---
type: this-week
owner: "[[../my-career/me@co.com.md|me@co.com]]"
---

# Tasks — This Week
```

### Testing Patterns

- `init.service.test.ts` uses a mocked `FileSystemService` (`mockFS`); tests parse written content with `gray-matter` (`matter(call![1]).data`). `WS` is the workspace root constant; `svc` is the `InitService` under test.
- Wiki-link values are double-quoted in YAML (`[[` is a YAML flow indicator) — `gray-matter` round-trips them; assert on parsed `data` rather than raw string matching where possible.
- For the `addLeadership` idempotency test, pre-write a self profile whose `current_manager` equals the `formatWikiLink` the service will compute, then assert `leadership` stays `[]`.

### Anti-Patterns to Avoid

- **DO NOT** write the manager into a `## Leadership` body section — it belongs in `current_manager` frontmatter.
- **DO NOT** use `appendToSection`/body manipulation for any structural relationship — use frontmatter (set inline at creation, or `setScalar`/`addRelation` for edits).
- **DO NOT** add a `goals` scalar or `my-tasks/goals.md` (D-9.35-6).
- **DO NOT** re-implement member-profile cleanup or touch the dead `generateTeamMemberProfile` (D-9.35-4, D-9.35-5).
- **DO NOT** use vault-root-relative wiki-links — use `formatWikiLink` (D-9.35-2).

### References

- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-09-frontmatter-relationships.md` — Story 9.35 (lines 949-1014), Schema (lines 179-190, 407-412), Decision #2 (line 150)]
- [Source: `src/services/init.service.ts:159-184` — `writeUserProfile`]
- [Source: `src/services/leadership.service.ts:90-125` — `addLeadership` reciprocal writes]
- [Source: `src/commands/init.command.ts:135-151` — task file creation; `:165-192` — profile write order]
- [Source: `src/templates/onboarding.templates.ts:168-178` — task templates]
- [Source: `src/services/team.service.ts:81-123` — `buildMemberProfileMd` (already clean — AC7)]
- [Source: `_bmad-output/implementation-artifacts/9-34-team-fire-archive-frontmatter-cleanup-plus-manager-history.md` — previous story, frontmatter conventions + `formatWikiLink` usage]

### Open Questions (for the user — non-blocking)

1. **`goals` graph edge:** The story title and `SCALAR_KEYS` mention `goals`, but the concrete 9.35 spec omits it. Story is scoped WITHOUT a `goals` scalar/file (D-9.35-6). Confirm this is intended, or whether a `my-tasks/goals.md` + `goals` self-scalar should be added (would mirror the `tasks` pattern).
2. **`addLeadership` shared-service change:** Task 2 modifies `leadership.service.ts` (a 9.30 file not in the spec's "Files Modified" list) to satisfy AC5. This is a necessary, correct idempotency fix. Confirm acceptable, or prefer the alternative (leave `current_manager: ''` in `writeUserProfile` and let `addLeadership` set it — keeps changes purely in init but is less robust to leader-write failure).

## Dev Agent Record

### Agent Model Used

Claude Opus 4.8 (Cursor) — bmad-dev-story workflow.

### Debug Log References

- `npx tsc --noEmit` → clean
- `npx eslint src/` → clean (note: `eslint tests/` glob is not configured in this repo, expected)
- `NODE_OPTIONS=--experimental-vm-modules npx jest --no-coverage` → 76 suites / 1374 tests pass (+14 new vs. 1360 baseline)

### Completion Notes List

- **Task 1:** Rewrote `InitService.writeUserProfile` to emit a full frontmatter-native self profile — `start_date`, `current_manager`, `previous_manager: []`, `leadership: []`, `other_leaderships: []`, `direct_reports: []`, `projects: []`, plus the five `my-tasks/*` task-graph scalars. Body reduced to `# Career Profile / ## Notes / ## Performance Reviews`; the old `## Goals` and conditional `## Leadership` body block were removed. `current_manager` is set inline from `leaderEmail` (no body section). `fm` typed as `Record<string, unknown>` so the wiki-link assignment type-checks.
- **Task 2:** Added the idempotency guard in `LeadershipService.addLeadership` — the leader is appended to `leadership[]` only when `current_manager` is a *different* leader (`else if (selfFm['current_manager'] !== leaderLinkOnMe)`); when it already IS the current manager it is a no-op, satisfying AC5. The unconditional `direct_reports` reciprocal write is untouched.
- **Task 3:** `generateTaskFileTemplate(type, ownerWikiLink)` now emits `type` + quoted `owner` frontmatter; `init.command.ts` computes a single owner wiki-link (identical relative path for all five files) and writes `tasks/today/this-week/this-month/this-quarter` through it. Removed the dead `TASKS_MD_TEMPLATE` constant.
- **Task 4:** Replaced the two obsolete `## Leadership` tests in `init.service.test.ts` with frontmatter-native assertions (current_manager, empty-default arrays, five task scalars, `## Performance Reviews` body, no `## Goals`); added `generateTaskFileTemplate` coverage in `onboarding.templates.test.ts`; added the same-leader no-op idempotency test in `leadership.service.test.ts` (the existing `LEA-UNIT-033` already covers the skip-level/different-leader case); added task-file frontmatter + self-profile reciprocity assertions in `init.integration.test.ts`.
- **AC7:** Already satisfied by existing 9.29 member-profile tests (no `action_items_gdoc`, no `## Action Items`); no new test required.
- **Open questions (from story prep) — resolved per documented defaults:** D-9.35-6 — no `goals` scalar/file added (followed the concrete ACs). D-9.35-3 — the cross-service `addLeadership` idempotency fix was implemented within story scope (Task 2) since AC5 depends on it.
- **Integration nuance:** in `init.integration.test.ts`, `addLeadership` reciprocity is skipped (the static `readFile` stub makes `_getSelfProfilePath` return null), so leader-side `direct_reports` reciprocity is asserted via the `leadership.service` unit tests instead; the integration test asserts the self-side `current_manager`/`leadership` written inline by `writeUserProfile`.

### File List

- `src/services/init.service.ts`
- `src/services/leadership.service.ts`
- `src/templates/onboarding.templates.ts`
- `src/commands/init.command.ts`
- `src/services/task-view.service.ts` (code-review patch — strip task-file frontmatter from views)
- `tests/services/init.service.test.ts`
- `tests/services/leadership.service.test.ts`
- `tests/templates/onboarding.templates.test.ts`
- `tests/integration/init.integration.test.ts`
- `tests/services/task-view.service.test.ts` (code-review patch tests)

### Change Log

- 2026-06-13 — Implemented Story 9.35: frontmatter-native `tmr init` self & leader profiles + task-graph edges. Rewrote `writeUserProfile`, added `addLeadership` idempotency guard, gave task shell files `type`/`owner` frontmatter. Tests: 1374 pass (+14). Status → review.
- 2026-06-13 — Code review (3 layers). 8/8 ACs satisfied. Decision resolved (goals stay omitted per ACs/D-9.35-6). Applied 3 patches: email trim in `init.command`, frontmatter stripping in `TaskViewService`, `.trim()` in `addLeadership`. 4 deferred to `deferred-work.md`. Tests: 1376 pass (+2). Status → done.
