---
baseline_commit: 60a7432
---

# Story 9.30: Leadership Add — Bidirectional Reciprocal Frontmatter

Status: done

## Story

As a vault owner,
I want `tmr leadership add` to update both the leader's profile and my self-profile with the full relationship vocabulary,
So that the upward and downward edges of my org graph exist on both sides with the same field schema established in stories 9.28 and 9.29.

## Acceptance Criteria

**AC1 — Leader profile — full vocabulary:** When `tmr leadership add <email>` runs, the created leader profile's frontmatter contains `start_date: ""`, `current_manager: ""`, `previous_manager: []`, `other_leaderships: []`, `direct_reports: []`, and `projects: []` (all user-fillable defaults), in addition to the existing `email`, `name`, `role`, `relationship: leadership`, `date_added`, optional `location`, `gender`, `areas_of_responsibility` fields.

**AC2 — Reciprocal: leader gets `direct_reports += me`:** After writing the leader profile, `addRelation(profilePath, 'direct_reports', selfLinkOnLeader, fs)` is called to append my self-profile wiki-link to the leader's `direct_reports:` array. `selfLinkOnLeader` format: `[[<relative-path-from-leader-profile-to-self-profile>|<my-email>]]`.

**AC3 — Reciprocal: self gets `current_manager = leader` when no current_manager:** If my self-profile (`my-career/<email>.md`) has `current_manager` empty or absent, `setScalar(selfProfile, 'current_manager', leaderLinkOnMe, fs)` sets it to the leader's wiki-link. `leaderLinkOnMe` format: `[[<relative-path-from-self-to-leader-profile>|<leader-email>]]`.

**AC4 — Reciprocal: self gets `leadership += leader` when current_manager already set:** If my self-profile already has a non-empty `current_manager`, the new leader is appended to my `leadership:` array via `addRelation(selfProfile, 'leadership', leaderLinkOnMe, fs)`. `current_manager` is NOT changed.

**AC5 — Idempotent:** Running `tmr leadership add <email>` twice (after the profile already exists) returns `{ created: false }` immediately, with NO repeated frontmatter mutations. All frontmatter arrays remain unchanged (idempotency guaranteed by early-return guard at top of `addLeadership`).

**AC6 — Self profile absent:** When `my-career/` does not exist or contains no `.md` files, `_getSelfProfilePath` returns `null` and ALL reciprocal writes are silently skipped. The leader profile is still created correctly with the full vocabulary and default arrays.

**AC7 — TypeScript:** Zero new type errors (`npm run typecheck` passes). `ILeadershipFrontmatter` is updated to include all new fields.

## Tasks / Subtasks

- [x] Task 1 — Expand `ILeadershipFrontmatter` in `src/types/leadership.types.ts` (AC: 1, 7)
  - [x] Add `start_date: string` (empty default — user fillable)
  - [x] Add `current_manager: string` (empty default — their boss above them)
  - [x] Add `previous_manager: string[]` (empty default — user managed)
  - [x] Add `other_leaderships: string[]` (empty default — user managed)
  - [x] Add `direct_reports: string[]` (empty default — auto-populated by `addLeadership`)
  - [x] Add `projects: string[]` (empty default)

- [x] Task 2 — Add imports to `src/services/leadership.service.ts` (AC: 2, 3, 4)
  - [x] Import `addRelation`, `setScalar` from `'../utils/frontmatter-relations.js'`
  - [x] Import `formatWikiLink` from `'../utils/wiki-link.js'`
  - [x] `matter` and `path` are already imported — do not re-add

- [x] Task 3 — Expand `buildLeadershipProfileMd` with full relationship vocabulary (AC: 1)
  - [x] Add the six new fields to the `ILeadershipFrontmatter` object (see Dev Notes for exact shape)
  - [x] Keep all existing fields unchanged
  - [x] Body stays as `'\n# Leadership — <email>\n\n## Notes\n\n## 1on1s\n'`

- [x] Task 4 — Add `_getSelfProfilePath` private helper to `LeadershipService` (AC: 2, 3, 4, 6)
  - [x] Scan `<workspaceRoot>/my-career/` for `.md` files using `this._fs.listFiles`
  - [x] Return first path found or `null` if directory missing or empty
  - [x] (Pattern mirrors `MemberService._getSelfProfilePath` from 9.29 — do NOT merge into a shared utility yet; deferred)

- [x] Task 5 — Add reciprocal writes in `addLeadership` after `writeFile` (AC: 2, 3, 4, 6)
  - [x] Call `_getSelfProfilePath(workspaceRoot)` → if null, skip all reciprocals
  - [x] Compute `selfLinkOnLeader` via `formatWikiLink(selfProfile, profilePath, path.basename(selfProfile, '.md'))`
  - [x] Call `addRelation(profilePath, 'direct_reports', selfLinkOnLeader, this._fs)` (leader gets me)
  - [x] Compute `leaderLinkOnMe` via `formatWikiLink(profilePath, selfProfile, normalizedEmail)`
  - [x] Read self-profile frontmatter via `matter(await this._fs.readFile(selfProfile)).data` to inspect `current_manager`
  - [x] If `current_manager` is empty/absent → `setScalar(selfProfile, 'current_manager', leaderLinkOnMe, this._fs)`
  - [x] If `current_manager` is already set → `addRelation(selfProfile, 'leadership', leaderLinkOnMe, this._fs)`

- [x] Task 6 — Update existing tests in `tests/services/leadership.service.test.ts` (AC: 1)
  - [x] Test "creates directory, profile, and returns created: true for new contact" — no structural change needed (self profile absent → reciprocals skipped silently; `writeFile` count unchanged)
  - [x] Test "writes profile with ## 1on1s and ## Notes sections" — still passes (body unchanged)
  - [x] **No existing test assertions will break** because: (a) existing tests use `exists.mockResolvedValue(false)` which causes `_getSelfProfilePath` to return `null` → reciprocals skipped; (b) new frontmatter fields are additive (existing content-substring checks still match)
  - [x] If any test breaks, fix it — do not remove coverage

- [x] Task 7 — Add new tests to `tests/services/leadership.service.test.ts` (AC: 1–6)
  - [x] **LEA-UNIT-030** — Leader profile has new frontmatter vocabulary fields: assert `start_date`, `current_manager`, `previous_manager`, `other_leaderships`, `direct_reports`, `projects` are present in written content
  - [x] **LEA-UNIT-031** — Reciprocal: `direct_reports` on leader updated when self profile exists: assert `addRelation` called (via `readFile` + `writeFile` on PROFILE_PATH after write) with `direct_reports` mutation
  - [x] **LEA-UNIT-032** — Reciprocal: self `current_manager` set when no existing manager: assert `writeFile` called on self profile with `current_manager: [[...|boss@co.com]]`
  - [x] **LEA-UNIT-033** — Reciprocal: self `leadership` array updated when `current_manager` already set: assert `writeFile` called on self profile with `leadership:` array containing leader link; `current_manager` unchanged
  - [x] **LEA-UNIT-034** — Self profile absent: assert reciprocals skipped (no extra `writeFile` or `readFile` calls on self profile path); leader profile still created
  - [x] **LEA-UNIT-035** — Idempotent guard: when `exists(profilePath)` returns `true` (contact already exists), verify `addLeadership` returns `{ created: false }` and does NOT call any `writeFile` or `addRelation`

- [x] Task 8 — Validate (all ACs)
  - [x] `npm run typecheck` — zero new type errors
  - [x] `npm run lint` — zero new lint errors
  - [x] `npm run test` — all tests pass (pre-existing failures unchanged; no new regressions)

### Review Findings

_Code review 2026-06-11 (Blind Hunter + Edge Case Hunter + Acceptance Auditor). Acceptance Auditor confirmed all 7 ACs satisfied and anti-pattern compliance. 1 patch, 9 deferred, 3 dismissed as noise._

- [x] [Review][Patch] New `ILeadershipFrontmatter` fields are non-optional, diverging from sibling precedent and creating a read-time type lie [src/types/leadership.types.ts:21-26] — FIXED 2026-06-11: added `?` to all six new fields (`start_date`, `current_manager`, `previous_manager`, `other_leaderships`, `direct_reports`, `projects`) to match `ITeamMemberFrontmatter` (9.29) and `IEntityRelations` (`relations.types.ts`). Eliminates the read-time type lie for pre-9.30 profiles. typecheck + lint clean; 55 leadership tests pass.

- [x] [Review][Defer] Leader's `direct_reports` unconditionally gains self even when the leader is a skip-level, not my manager [src/services/leadership.service.ts:113] — deferred, spec-prescribed. The Reciprocity Map mandates `leader: direct_reports[+=me]` regardless of whether I become the leader's report or place them in my `leadership[]`. Implementation matches spec exactly; the semantic asymmetry is a spec-design observation, not a code defect.
- [x] [Review][Defer] `_getSelfProfilePath` returns `mdFiles[0]` non-deterministically with no multi-file warning (diverges from `MemberService`) [src/services/leadership.service.ts:70-74] — deferred, pre-existing (D2). Spec explicitly defers non-deterministic self-profile selection.
- [x] [Review][Defer] Reciprocal writes are non-transactional; malformed self YAML or a mid-sequence throw leaves partial state after the leader file is written [src/services/leadership.service.ts:108-123] — deferred, consistent with the 9.28/9.29 reciprocal pattern; command layer surfaces errors per NFR2 (no stack trace to user).
- [x] [Review][Defer] No guard against adding my own email as a leadership contact (self-as-own-manager) [src/services/leadership.service.ts:109-123] — deferred, unspecified and low-probability user action.
- [x] [Review][Defer] `!selfFm['current_manager']` truthiness mishandles whitespace-only / non-string values [src/services/leadership.service.ts:118] — deferred, unspecified boundary (spec defines only "empty or absent"); low severity.
- [x] [Review][Defer] Leader can appear in both `current_manager` and `leadership[]` (no cross-field dedupe) [src/services/leadership.service.ts:118-122] — deferred, narrow edge requiring a pre-seeded self profile; low severity.
- [x] [Review][Defer] Reciprocal edges never backfilled if the self profile is created after the leader (creation-guard gates the reciprocal block) [src/services/leadership.service.ts:98-123] — deferred, backfill is Story 9.36 (`tmr doctor --fix-frontmatter`) scope.
- [x] [Review][Defer] Redundant double-write of the leader file (`build` emits `direct_reports: []`, then `addRelation` re-reads/re-writes to append) [src/services/leadership.service.ts:105-113] — deferred, micro-optimization; `addRelation` is the sanctioned idempotent path.
- [x] [Review][Defer] LEA-UNIT-034 does not assert `listFiles` is uncalled; tests coupled to helper call counts [tests/services/leadership.service.test.ts:186-321] — deferred, test polish; low value.

## Dev Notes

### Current State to Understand Before Changing

**`LeadershipService.addLeadership` (current, lines 75–94 in `src/services/leadership.service.ts`):**
```typescript
async addLeadership(
  email: string,
  opts: IAddLeadershipOptions,
  workspaceRoot: string,
): Promise<{ created: boolean }> {
  const normalizedEmail = email.toLowerCase();
  const profilePath = leadershipProfilePath(workspaceRoot, normalizedEmail);

  if (await this._fs.exists(profilePath)) {
    return { created: false };
  }

  const oneOnOneDir = path.join(leadershipDir(workspaceRoot, normalizedEmail), '1on1s');
  await this._fs.createDirectory(oneOnOneDir);

  const content = buildLeadershipProfileMd(normalizedEmail, opts);
  await this._fs.writeFile(profilePath, content);

  return { created: true };
}
```
Currently returns immediately after `writeFile`. Story 9.30 inserts the reciprocal writes between `writeFile` and `return { created: true }`.

**`buildLeadershipProfileMd` (current, lines 34–47):**
```typescript
function buildLeadershipProfileMd(email: string, opts: IAddLeadershipOptions): string {
  const date = opts.date ?? todayIso();
  const frontmatter: ILeadershipFrontmatter = {
    email,
    name: opts.name ?? '',
    role: opts.role ?? '',
    ...(opts.location ? { location: opts.location } : {}),
    ...(opts.gender ? { gender: opts.gender } : {}),
    areas_of_responsibility: opts.areas_of_responsibility ?? '',
    relationship: 'leadership',
    date_added: date,
  };
  return matter.stringify(`\n# Leadership — ${email}\n\n## Notes\n\n## 1on1s\n`, frontmatter);
}
```
Missing all relationship vocabulary fields. This is the function to expand.

**`ILeadershipFrontmatter` (current, `src/types/leadership.types.ts` lines 11–20):**
```typescript
export interface ILeadershipFrontmatter {
  email: string;
  name: string;
  role: string;
  location?: string;
  gender?: string;
  areas_of_responsibility: string;
  relationship: 'leadership';
  date_added: string;
}
```
Does NOT have `start_date`, `current_manager`, `previous_manager`, `other_leaderships`, `direct_reports`, or `projects`.

### Exact Change: `buildLeadershipProfileMd` — Add Relationship Vocabulary

After Task 1 (types updated), replace the `frontmatter` object body:

```typescript
function buildLeadershipProfileMd(email: string, opts: IAddLeadershipOptions): string {
  const date = opts.date ?? todayIso();
  const frontmatter: ILeadershipFrontmatter = {
    email,
    name: opts.name ?? '',
    role: opts.role ?? '',
    ...(opts.location ? { location: opts.location } : {}),
    ...(opts.gender ? { gender: opts.gender } : {}),
    areas_of_responsibility: opts.areas_of_responsibility ?? '',
    relationship: 'leadership',
    date_added: date,
    start_date: '',           // user-fillable: when they started in their current role
    current_manager: '',      // user-fillable: their boss above them in the org chart
    previous_manager: [],
    other_leaderships: [],
    direct_reports: [],       // populated reciprocally when addLeadership runs
    projects: [],
  };
  return matter.stringify(`\n# Leadership — ${email}\n\n## Notes\n\n## 1on1s\n`, frontmatter);
}
```

No changes to the body template.

### New Private Helper: `LeadershipService._getSelfProfilePath`

Add this BEFORE the `addLeadership` method (or after `findLeadership`):

```typescript
private async _getSelfProfilePath(workspaceRoot: string): Promise<string | null> {
  const careerRoot = path.join(workspaceRoot, 'my-career');
  if (!(await this._fs.exists(careerRoot))) return null;
  const mdFiles = await this._fs.listFiles(careerRoot, '.md');
  return mdFiles.length > 0 ? (mdFiles[0] as string) : null;
}
```

This is the same pattern as `MemberService._getSelfProfilePath` and `TeamService._getSelfProfilePath` (both added in 9.29). Do NOT extract to a shared utility yet — that's a deferred DRY nit (D3, pre-existing deferred pattern from 9.29).

**Important:** Uses `listFiles` (NOT `listDirectories`) because `my-career/` uses a flat profile structure: the profile lives at `my-career/<email>.md`. `mdFiles[0]` is the self profile.

### Exact Change: `addLeadership` — Reciprocal Writes

Replace `return { created: true };` with:

```typescript
    // ── Reciprocal writes ──────────────────────────────────────────────────────
    const selfProfile = await this._getSelfProfilePath(workspaceRoot);
    if (selfProfile) {
      // Leader gets me in their direct_reports[]
      const selfEmail = path.basename(selfProfile, '.md');
      const selfLinkOnLeader = formatWikiLink(selfProfile, profilePath, selfEmail);
      await addRelation(profilePath, 'direct_reports', selfLinkOnLeader, this._fs);

      // I get the leader as current_manager (if none set) or as leadership[] (skip-level)
      const leaderLinkOnMe = formatWikiLink(profilePath, selfProfile, normalizedEmail);
      const selfContent = await this._fs.readFile(selfProfile);
      const selfFm = matter(selfContent).data as Record<string, unknown>;
      if (!selfFm['current_manager']) {
        await setScalar(selfProfile, 'current_manager', leaderLinkOnMe, this._fs);
      } else {
        await addRelation(selfProfile, 'leadership', leaderLinkOnMe, this._fs);
      }
    }

    return { created: true };
```

**Call sequence when self profile exists:**
1. `_getSelfProfilePath(workspaceRoot)` → `this._fs.exists(careerRoot)` + `this._fs.listFiles(careerRoot)`
2. `formatWikiLink(selfProfile, profilePath, selfEmail)` — pure, no I/O
3. `addRelation(profilePath, 'direct_reports', selfLinkOnLeader, this._fs)`:
   - `this._fs.exists(profilePath)` → true (just written)
   - `this._fs.readFile(profilePath)` → leader profile content
   - `this._fs.writeFile(profilePath, updatedContent)`
4. `formatWikiLink(profilePath, selfProfile, normalizedEmail)` — pure, no I/O
5. `this._fs.readFile(selfProfile)` → self profile content
6. `matter(selfContent).data` → inspect `current_manager`
7a. If empty: `setScalar(selfProfile, 'current_manager', ...)`:
   - `this._fs.exists(selfProfile)` → true
   - `this._fs.readFile(selfProfile)` → self content
   - `this._fs.writeFile(selfProfile, updatedContent)`
7b. If set: `addRelation(selfProfile, 'leadership', ...)`:
   - `this._fs.exists(selfProfile)` → true
   - `this._fs.readFile(selfProfile)` → self content
   - `this._fs.writeFile(selfProfile, updatedContent)`

### Required Imports in `leadership.service.ts`

Add to the import block (after existing imports):

```typescript
import { addRelation, setScalar } from '../utils/frontmatter-relations.js';
import { formatWikiLink } from '../utils/wiki-link.js';
```

`matter` is already imported at line 2. `path` is already imported at line 1.

### Updated `ILeadershipFrontmatter` (Task 1 — exact shape)

```typescript
export interface ILeadershipFrontmatter {
  email: string;
  name: string;
  role: string;
  location?: string;
  gender?: string;
  areas_of_responsibility: string;
  relationship: 'leadership';
  date_added: string;
  // ── Story 9.30: Relationship vocabulary ──
  start_date: string;           // YYYY-MM-DD or '' — user-fillable
  current_manager: string;      // wiki-link or '' — their manager above them
  previous_manager: string[];   // append-only historical managers
  other_leaderships: string[];  // matrix / dotted-line
  direct_reports: string[];     // auto-populated by addLeadership
  projects: string[];           // populated by tmr project link-* (Story 9.33)
}
```

### Test Mock Setup — New Tests (LEA-UNIT-031 through LEA-UNIT-034)

The key challenge is `exists(profilePath)` must return **false** on the first call (guard check) but **true** on the second call (inside `addRelation` after the profile is written).

Use `mockResolvedValueOnce` for the ordered call sequence:

```typescript
const SELF_PROFILE = path.join(WS, 'my-career', 'me@co.com.md');
const CAREER_ROOT = path.join(WS, 'my-career');
const LEADER_PROFILE_MD = matter.stringify(
  '\n# Leadership — boss@co.com\n\n## Notes\n\n## 1on1s\n',
  {
    email: EMAIL,
    name: '',
    role: '',
    areas_of_responsibility: '',
    relationship: 'leadership',
    date_added: '2026-06-11',
    start_date: '',
    current_manager: '',
    previous_manager: [],
    other_leaderships: [],
    direct_reports: [],
    projects: [],
  },
);
const SELF_PROFILE_NO_MANAGER = '---\nemail: me@co.com\ncurrent_manager: ""\n---\n';
const SELF_PROFILE_HAS_MANAGER = '---\nemail: me@co.com\ncurrent_manager: "[[my-leadership/other@co.com/other@co.com.md|other@co.com]]"\n---\n';

// --- LEA-UNIT-031 / LEA-UNIT-032 setup (new contact, self profile exists, no current_manager):
mockFS.exists
  .mockResolvedValueOnce(false)   // exists(profilePath): profile doesn't exist → create
  .mockResolvedValueOnce(true)    // exists(careerRoot): in _getSelfProfilePath
  .mockResolvedValueOnce(true)    // exists(profilePath): inside addRelation(direct_reports)
  .mockResolvedValueOnce(true)    // exists(selfProfile): inside setScalar(current_manager)
  ;
mockFS.listFiles.mockResolvedValue([SELF_PROFILE]);
mockFS.readFile
  .mockResolvedValueOnce(LEADER_PROFILE_MD)  // addRelation reads leader profile
  .mockResolvedValueOnce(SELF_PROFILE_NO_MANAGER)   // readFile for current_manager check
  .mockResolvedValueOnce(SELF_PROFILE_NO_MANAGER);  // setScalar reads self profile

// For LEA-UNIT-033 (current_manager already set → leadership[]):
// Change SELF_PROFILE_NO_MANAGER → SELF_PROFILE_HAS_MANAGER in readFile mocks
// And the 4th exists is still true (for addRelation on self profile's leadership array)
```

**LEA-UNIT-034 (self profile absent):**
```typescript
mockFS.exists
  .mockResolvedValueOnce(false)   // profilePath → create
  .mockResolvedValueOnce(false);  // careerRoot → absent → _getSelfProfilePath returns null
// listFiles and readFile should NOT be called
```
Assert: `writeFile` called exactly once (for leader profile only). `readFile` NOT called. `listFiles` NOT called.

**LEA-UNIT-035 (idempotent guard — already exists):**
```typescript
mockFS.exists.mockResolvedValue(true);  // all exists → profile already exists
```
Assert: `writeFile` NOT called. `createDirectory` NOT called. `addRelation` NOT called. Returns `{ created: false }`.

### What Tests Are NOT Expected to Break

Existing tests use `mockFS.exists.mockResolvedValue(false)` globally. With the new code:
- `exists(profilePath)` → false → profile doesn't exist → create it
- `createDirectory` → OK
- `writeFile` → OK
- `_getSelfProfilePath`: `exists(careerRoot)` → false → returns null → skip reciprocals
- returns `{ created: true }`

**No regression** — all existing test assertions pass unchanged.

The only test that could change behavior is "creates directory, profile, and returns created: true for new contact" — which still passes because the reciprocal block is entirely skipped when self profile is absent.

### Architecture Compliance

- **Layer:** Service → utilities (`addRelation`, `setScalar`, `formatWikiLink`) — correct
- **Anti-pattern prevented:** NO `SectionParserService.appendToFile` for structural links (leadership ↔ self relationship)
- **Anti-pattern prevented:** NO inline `matter.stringify` for relationship changes — uses `addRelation`/`setScalar`
- **Body sections kept correct:** `## 1on1s` and `## Notes` body sections in leadership profiles are untouched — dated 1on1 links stay in body per decision #2
- **`no-console`:** Never use `console.log` — use `logger` for warnings if needed
- **ESM imports:** All new imports use `.js` extension (e.g. `'../utils/frontmatter-relations.js'`)
- **`explicit-function-return-type`:** Private methods must declare return types (e.g. `Promise<string | null>`)

### Cross-Cutting Reciprocity — What This Story Covers

From the sprint change proposal reciprocity map:

| Command | Writes to subject file | Writes to reciprocal file(s) |
|---|---|---|
| `tmr leadership add <email>` | leader: `direct_reports[+=me]` | self: `current_manager=leader` (if not set) OR `leadership[+=leader]` (if already has manager) |

**Not in scope for 9.30:**
- `tmr init` leader add (story 9.35 scope) — init will call `LeadershipService.addLeadership` which will then auto-handle reciprocals via story 9.30's code
- `last_1on1` scalar on leader profile (story 9.31 scope)
- `tmr leadership add 1on1` dated file frontmatter (story 9.31 scope)

### Scope Boundary — What This Story Does NOT Change

- **`LeadershipService.add1on1`** — not touched; dated file creation, section appending stays as-is (story 9.31 scope)
- **`LeadershipService.listLeadership`** — not touched
- **`MemberService`** — not touched
- **`TeamService`** — not touched
- **`tmr init` leader profile creation** — `InitService.writeUserProfile` and the leader add during init are story 9.35 scope; story 9.35 will call the updated `LeadershipService.addLeadership` which now automatically handles reciprocals
- **`IAddLeadershipOptions`** — no changes needed
- **`ILeadershipSummary`** — no changes needed
- **`frontmatter-relations.ts`** — do NOT modify (already complete from 9.26)
- **`relations.types.ts`** — do NOT modify (already complete from 9.27)

### Pre-existing Deferred Items (Do Not Fix)

- **D1:** `getManagerEmail()` uses `listDirectories` → null on flat `my-career/`. Pre-existing; do NOT fix here.
- **D2:** `_getSelfProfilePath` picks `mdFiles[0]` non-deterministically if multiple `.md` files exist in `my-career/`. Pre-existing; do NOT fix here.
- **D3:** `_getSelfProfilePath` duplicated in `MemberService`, `TeamService`, and now `LeadershipService`. DRY nit, deferred.

### References

- [Source: `sprint-change-proposal-2026-06-09-frontmatter-relationships.md` § Story 9.30 — Change proposals and ACs]
- [Source: `sprint-change-proposal-2026-06-09-frontmatter-relationships.md` § Section 3.5 — Schema #5 (Leadership profile)]
- [Source: `sprint-change-proposal-2026-06-09-frontmatter-relationships.md` § Cross-Cutting Reciprocity Map]
- [Source: `project-context.md` § Frontmatter-Native Relationship Model — anti-pattern rule, field vocabulary]
- [Source: `project-context.md` § Vault Folder Structure — Self: `my-career/<email>.md` (flat, not nested)]
- [Source: `src/services/leadership.service.ts` — current `addLeadership`, `buildLeadershipProfileMd`]
- [Source: `src/types/leadership.types.ts` — current `ILeadershipFrontmatter` shape]
- [Source: `src/utils/frontmatter-relations.ts` — `addRelation` (RelationKey includes `direct_reports`, `leadership`), `setScalar` (ScalarKey includes `current_manager`), `SCALAR_KEYS` (includes `current_manager`)]
- [Source: `src/utils/wiki-link.ts` — `formatWikiLink(resolvedPath, fromPath, displayName)`]
- [Source: `_bmad-output/implementation-artifacts/9-29-relationship-frontmatter-vocabulary-on-all-entity-profiles.md` — Dev Notes: `_getSelfProfilePath` pattern, deferred items D1/D2]
- [Source: `tests/services/leadership.service.test.ts` — existing test suite structure and patterns]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (Cursor)

### Debug Log References

- No issues encountered. Existing tests required no structural changes: all use `exists.mockResolvedValue(false)` globally, which causes `_getSelfProfilePath` to return null → reciprocals silently skipped → all prior assertions still hold.
- `CAREER_ROOT` constant removed from test block after static analysis — it was declared but never referenced directly in assertions (path-based mocks reference `WS` and `SELF_PROFILE` instead).
- Full suite: 76 suites, 1327 tests — all pass.

### Completion Notes List

- **AC1 (full vocabulary on leader profile):** `buildLeadershipProfileMd` now emits `start_date: ""`, `current_manager: ""`, `previous_manager: []`, `other_leaderships: []`, `direct_reports: []`, `projects: []` via `ILeadershipFrontmatter`. LEA-UNIT-030 verifies all six keys.
- **AC2 (leader gets `direct_reports += me`):** `addRelation(profilePath, 'direct_reports', selfLinkOnLeader, this._fs)` called after profile write when self profile found. LEA-UNIT-031 verifies the `writeFile[1]` on the leader profile contains the self email.
- **AC3 (self gets `current_manager = leader`):** `setScalar(selfProfile, 'current_manager', leaderLinkOnMe, this._fs)` called when `selfFm['current_manager']` is falsy. LEA-UNIT-032 verifies `writeFile[2]` on self profile contains leader email in `current_manager`.
- **AC4 (self gets `leadership += leader`):** `addRelation(selfProfile, 'leadership', leaderLinkOnMe, this._fs)` called when `selfFm['current_manager']` is truthy. LEA-UNIT-033 verifies `writeFile[2]` on self profile contains leader email in `leadership` and original `other@co.com` is preserved.
- **AC5 (idempotent):** Early return on `exists(profilePath) === true` prevents any reciprocal writes. LEA-UNIT-035 verifies no `writeFile` or `readFile` calls.
- **AC6 (self profile absent):** `_getSelfProfilePath` returns null when `careerRoot` doesn't exist → entire reciprocal block skipped. LEA-UNIT-034 asserts exactly one `writeFile` call (initial profile) and no `readFile` calls.
- **AC7 (TypeScript):** `npm run typecheck` → 0 errors. `ILeadershipFrontmatter` expanded with correct required field types.

### File List

- `src/services/leadership.service.ts` — modified: imports (`addRelation`, `setScalar`, `formatWikiLink`), `buildLeadershipProfileMd` (6 new frontmatter fields), new `_getSelfProfilePath` private helper, reciprocal writes block in `addLeadership`
- `src/types/leadership.types.ts` — modified: `ILeadershipFrontmatter` — added `start_date`, `current_manager`, `previous_manager`, `other_leaderships`, `direct_reports`, `projects`
- `tests/services/leadership.service.test.ts` — modified: added LEA-UNIT-030 through LEA-UNIT-035 (6 new tests; 17 tests → 28 tests total in suite)

## Change Log

- 2026-06-11: Story 9.30 implementation — leadership add bidirectional reciprocal frontmatter. `buildLeadershipProfileMd` now scaffolds full relationship vocabulary; `addLeadership` writes reciprocals on both sides (leader `direct_reports` += me; self `current_manager` = leader or `leadership[]` += leader). 6 new unit tests added (LEA-UNIT-030–035). TypeScript clean, lint clean, 76 suites / 1327 tests all pass.
- 2026-06-11: Code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor). Acceptance Auditor confirmed all 7 ACs satisfied + anti-pattern compliant. Addressed 1 patch finding (made 6 new `ILeadershipFrontmatter` fields optional to match 9.29/`relations.types.ts` precedent); 9 findings deferred (logged in `deferred-work.md`), 3 dismissed as noise.
