# Story 6.2: `tmr-myself-config update` — Delta Review Mode

Status: done

## Story

As an engineering manager whose context has changed over time,
I want to run `/tmr-myself-config update` and have a lightweight review conversation that asks only about what changed in my priorities, team, and projects,
So that my profile and `CLAUDE.md` stay accurate without re-running the full setup.

## Acceptance Criteria

1. Given `/tmr-myself-config update` is invoked, when BOOTSTRAP completes, then the skill presents a structured summary of current known context: priorities, team, projects, contractors, collaborators; and shows the last-updated timestamp from `CLAUDE.md ## Manager Context` (FR47, SKILL-MYSELF-003).

2. Given the delta review runs, when the user answers each section question, then sections answered "no change" or skipped with Enter are not written; only changed sections trigger file updates (FR47).

3. Given delta questions cover all four change categories, when the review completes, then priorities, direct report changes (joins/leaves), project status changes (new/wrapped/archived), and contractor changes are all addressable in a single update run (FR47, SKILL-MYSELF-004).

4. Given new direct reports or projects are discovered during update, when WRITE runs, then new members and project files are created using the same templates as the setup flow (FR47).

5. Given no changes are collected across all sections, when the update completes, then the skill prints "Nothing to update — your context is current." and exits without writing any file (FR47).

## Tasks / Subtasks

- [x] Verify UPDATE section in `skills/tmr-myself-config/SKILL.md` satisfies all 5 ACs (AC: 1–5)
  - [x] AC1 check: U3 step shows structured summary with last-updated timestamp (SKILL-MYSELF-003)
  - [x] AC2 check: U4 skip-on-no-change and U5 write-only-changed-sections
  - [x] AC3 check: U4 covers four categories — priorities, team joins/leaves, project status, contractor changes (SKILL-MYSELF-004)
  - [x] AC4 check: U5 uses same templates as setup flow for new members/projects
  - [x] AC5 check: U5 prints exact message "Nothing to update — your context is current."
- [x] Fix departure handling gap in the UPDATE section (AC: 3)
  - [x] In Step U4 Team changes: add explicit write action for departed direct reports (`status: former` + `departure_date:` in frontmatter, same pattern as contractor departures)
  - [x] In Step U4 Collaborator changes: add explicit write action for departed collaborators (same `status: former` pattern)
- [x] Bump skill version to `1.1.0` in `skills/tmr-myself-config/SKILL.md` (AC: 1–5)
- [x] Update `skills/index.json` — no change needed (version is in SKILL.md, not the index)
- [x] Update sprint-status.yaml: story 6-2 → review, epic-6 in-progress

### Review Findings (AI)

**Decision-Needed:**
- [x] [Review][Decision] CLAUDE.md and manager profile not updated after departures — Fixed: U5 now explicitly states that departures trigger a re-write of `## My Team`/`## Key Collaborators` in `my-career/<email>.md` and the corresponding tables in `CLAUDE.md ## Manager Context`.
- [x] [Review][Decision] Departure date always today — Fixed: U4 departure steps now include an optional "When did [name] leave? (press Enter for today)" prompt.
- [x] [Review][Decision] `departure_date` overwrite when field already exists — Fixed: U4 step 4 guard prevents overwrite; informs user of existing date and skips update.

**Patches:**
- [x] [Review][Patch] Name-only departure has no file-resolution protocol — Fixed: U4 departure step 1 adds explicit lookup-by-name-frontmatter with disambiguation prompt.
- [x] [Review][Patch] No fallback when departure file does not exist in vault — Fixed: U4 departure step 2 adds skip-with-warning.
- [x] [Review][Patch] Contractor departures inconsistent — no `departure_date`, absent from U5 CONFIRM block — Fixed: contractor departures now use the same resolution/date-prompt/guard steps; `DEPARTURES (contractors)` block added to U5 CONFIRM.
- [x] [Review][Patch] CONFIRM template uses `<date>` but departure write prose uses `<YYYY-MM-DD>` — Fixed: CONFIRM template updated to `<YYYY-MM-DD>`.
- [x] [Review][Patch] No "edit" path for departures in CONFIRM — Fixed: U5 now includes "say 'edit departures' to return to U4".

**Deferred:**
- [x] [Review][Defer] Collaborator who is actually a contractor uses wrong departure path — deferred, pre-existing routing complexity
- [x] [Review][Defer] Project team roster not updated after direct-report departure — deferred, pre-existing gap outside story scope
- [x] [Review][Defer] Same-session addition + departure conflict for same email — deferred, AI discretion handles
- [x] [Review][Defer] U3 summary does not filter already-departed (status: former) members — deferred, pre-existing issue in B3 step
- [x] [Review][Defer] Person with dual filing in both my-teams/ and my-company/ — deferred, pre-existing routing complexity

---

## Dev Notes

### What This Story Produces

One file with targeted changes — no TypeScript changes, no test files required:

1. **`skills/tmr-myself-config/SKILL.md`** — version bumped to `1.1.0`; UPDATE section enhanced with explicit departure handling for direct reports and collaborators

The source document at `docs/TMR-MYSELF-CONFIG-SKILL.md` needs a parallel update to stay in sync with the registry copy.

### Context from Story 6.1

Story 6.1 published `skills/tmr-myself-config/SKILL.md` with version `1.0.0`. Importantly, the dev agent for 6.1 explicitly noted:

> "docs/TMR-MYSELF-CONFIG-SKILL.md existed and was complete — covers both setup (Story 6.1) and update (Story 6.2) flows"

This means the UPDATE section (`## UPDATE`, Steps U1–U5) is **already present** in both `docs/TMR-MYSELF-CONFIG-SKILL.md` and `skills/tmr-myself-config/SKILL.md`. Story 6.2 is not creating it from scratch — it is validating and refining it.

### AC Verification Map

Verify each AC against the existing UPDATE section before making any changes:

| AC | Covered by | Status |
|----|------------|--------|
| AC1 (SKILL-MYSELF-003): Structured summary + timestamp | Step U2 reads timestamp from `_Last updated by /tmr-myself-config:` in CLAUDE.md; Step U3 prints full summary | ✓ Satisfied |
| AC2: No-change sections skip writes | Step U4 says "If the user answers 'no' or presses Enter, skip to the next"; Step U5 says "run CONFIRM and WRITE for only the changed sections" | ✓ Satisfied |
| AC3 (SKILL-MYSELF-004): Four change categories | Step U4 covers priorities, team (joins/leaves), projects (status), contractors, and collaborators | ⚠ Gap: "leaves" for direct reports/collaborators has no explicit write action |
| AC4: New members/projects use setup templates | Step U5 says "Use the same merge strategy as setup" | ✓ Satisfied |
| AC5: "Nothing to update" exit | Step U5 says exactly: `"Nothing to update — your context is current."` | ✓ Satisfied |

### The Departure Handling Gap (AC3)

The existing UPDATE section has an asymmetry in how departures are handled:

**Contractor departures (EXPLICIT — correct):**
```
"Any changes to your contractors?"
If yes: collect additions or mark departures (add `status: former` to their profile frontmatter).
```

**Direct report departures (IMPLICIT — gap):**
```
"Anyone joined or left your direct reports since your last update?"
If yes: collect additions (email, name, role) and removals (name or email).
```
→ The "removals" are collected but there is **no write action specified**. The WRITE step (U5) delegates to the setup flow's W3, which only handles new profiles.

**Collaborator departures (IMPLICIT — gap):**
```
"Any new regular collaborators, or people who are no longer relevant?"
If yes: collect additions or note departures.
```
→ Same issue: departures are noted but no write action is given.

**The fix** — apply the same pattern as contractor departures to both sections:
- For **direct report removals**: update `my-teams/members/<email>.md` frontmatter — add `status: former` and `departure_date: <YYYY-MM-DD>` (today's date).
- For **collaborator removals**: update `my-company/members/<email>.md` frontmatter — add `status: former` and `departure_date: <YYYY-MM-DD>`.

This closes AC3's "leaves" requirement and makes the behavior consistent across all three person types.

### Registry File Format Rules (from Story 6.1)

- Version comment MUST be the first line: `<!-- version: 1.1.0 -->`
- No YAML frontmatter in the registry copy (frontmatter lives only in `docs/`)
- `SkillRegistryService` version regex: `/<!--\s*version:\s*(\S+)\s*-->/`

### Version Bump Rationale

- `1.0.0` → `1.1.0` (minor bump): the UPDATE section gets a backward-compatible behavioral addition (explicit departure handling). No breaking changes to the setup flow.

### docs/ vs skills/ Sync Rule

Any change to `skills/tmr-myself-config/SKILL.md` MUST be mirrored to `docs/TMR-MYSELF-CONFIG-SKILL.md` to keep the source of truth in sync:

| File | Role | Change |
|------|------|--------|
| `docs/TMR-MYSELF-CONFIG-SKILL.md` | Source doc — YAML frontmatter, human-readable | Update UPDATE section (same content) |
| `skills/tmr-myself-config/SKILL.md` | Registry distribution — version comment first line, no frontmatter | Bump version to 1.1.0; same UPDATE section changes |

### What MUST NOT Change

- The BOOTSTRAP, ARCHETYPE, BASE-CONTEXT, PRODUCT-BRANCH, PEOPLE-BRANCH, CONTRACTOR-CHECK, CONFIRM, or WRITE sections — Story 6.1 delivered those; do not regress them
- `skills/tmr-inbox/SKILL.md` — out of scope
- `skills/index.json` — skill name unchanged; index does not track versions
- Any `src/` TypeScript files
- No new test files required

### Previous Story Learnings (6.1)

- The registry copy strips YAML frontmatter — start with `<!-- version: X.Y.Z -->` then the skill title `# tmr-myself-config`
- Do NOT add version comment to `docs/` copy (frontmatter block in docs is enough)
- `skills/index.json` already correct: `["tmr-inbox", "tmr-myself-config"]`
- `npm run lint && npm run typecheck` — always run to verify no regressions even for doc-only stories

---

## Dev Agent Record

### Agent Model

claude-sonnet-4-6 (Cursor)

### Debug Log

- Documentation/skill-authoring story: no TypeScript changes, no new test files required
- UPDATE section was already present in `skills/tmr-myself-config/SKILL.md` (published in Story 6.1) — confirmed all 5 ACs satisfied by existing U1–U5 steps
- Identified departure handling gap (AC3 "leaves"): contractor departures had explicit `status: former` write action; direct report and collaborator departures only collected names/emails with no write action specified
- Fixed gap in both `skills/tmr-myself-config/SKILL.md` and `docs/TMR-MYSELF-CONFIG-SKILL.md`: Step U4 Team changes and Collaborator changes now specify `status: former` + `departure_date: <YYYY-MM-DD>` write action (consistent with contractor pattern)
- Added departure summary block to Step U5 CONFIRM output so user can verify departures before writes execute
- Version bumped from `1.0.0` → `1.1.0` (minor: backward-compatible addition)
- `npm run lint && npm run typecheck` — exit 0; no regressions

### Completion Notes

- All 5 ACs verified against UPDATE section — AC1 (structured summary + timestamp, SKILL-MYSELF-003), AC2 (skip unchanged sections), AC3 (four categories incl. joins/leaves, SKILL-MYSELF-004), AC4 (same templates as setup), AC5 ("Nothing to update" exit message)
- Fixed the only gap found: departure handling for direct reports and collaborators now has explicit `status: former` + `departure_date:` frontmatter write actions (consistent with contractor departures)
- `skills/tmr-myself-config/SKILL.md` bumped to `<!-- version: 1.1.0 -->`
- `docs/TMR-MYSELF-CONFIG-SKILL.md` mirrored with the same U4/U5 content changes (no version comment in docs — frontmatter is the docs identifier)

---

## File List

- `skills/tmr-myself-config/SKILL.md` — updated; version bumped to 1.2.0; Step U4 departure handling comprehensive (resolve/check/date-prompt/guard for all 3 person types); Step U5 CONFIRM all-3-types departure blocks + CLAUDE.md update note + edit path
- `docs/TMR-MYSELF-CONFIG-SKILL.md` — updated; mirrored all U4/U5 changes from registry copy

---

## Change Log

- 2026-05-11: Implemented Story 6.2 — validated all 5 UPDATE mode ACs; fixed departure handling gap for direct reports and collaborators; bumped skill to v1.1.0
- 2026-05-11: Code review pass — applied 8 patches: full departure resolution protocol (name lookup, file-not-found guard, optional date prompt, no-overwrite guard), contractor departure parity, CONFIRM template consistency, CLAUDE.md+profile update on departure, edit-departures escape hatch; bumped skill to v1.2.0
