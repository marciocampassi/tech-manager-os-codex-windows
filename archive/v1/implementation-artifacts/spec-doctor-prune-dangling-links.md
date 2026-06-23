---
title: 'tmr doctor --prune-links: detect & remove dangling reciprocal frontmatter links'
type: 'feature'
created: '2026-06-14'
status: 'done'
baseline_commit: b80dada
context: []
---

## Spec Change Log

- 2026-06-14 (implemented): Added `tmr doctor --prune-links` + plain-doctor dangling-link warning, mirroring the 9.36 `--fix-frontmatter` infrastructure. Service: `parseWikiLinkTarget` (pure, exported), `REPAIRABLE_RELATION_KEYS`, `_linkTargetExists`, `_pruneFileLinks` (no-write transform reused by both public methods), `pruneDanglingLinks` (writes only changed files), `detectDanglingLinks` (read-only count). Command: `--prune-links` handler (no-vault/JSON/text summary) + warning via `detectDanglingLinks`. Validation: `tsc` ✓, `eslint src` ✓, full jest 1435/1435 ✓ (21 new). Compensating rollback / transactional writes remain **deferred** (see deferred-work.md) — this ships the consistency-repair half that covers both partial-write and manual-deletion symptoms.

## Suggested Review Order

1. `src/services/doctor.service.ts:55` — `LinkRepairSummary`, `REPAIRABLE_RELATION_KEYS`, `parseWikiLinkTarget`
2. `src/services/doctor.service.ts:752` — `_linkTargetExists` / `_pruneFileLinks` / `pruneDanglingLinks` / `detectDanglingLinks`
3. `src/commands/doctor.command.ts:17` — `--prune-links` handler
4. `src/commands/doctor.command.ts:120` — plain-doctor dangling warning
5. `tests/services/doctor.frontmatter.service.test.ts` — `parseWikiLinkTarget` + prune/detect FakeFs tests
6. `tests/commands/doctor.command.test.ts` — `--prune-links` + warning tests

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Relationship writes are not atomic across the multi-file sequences in `member`/`leadership`/`myself`/`team`/`project` services (profile write → reciprocal `addRelation`/`setScalar` → body append). If a step fails mid-sequence — OR if a user later manually deletes a profile/team/project file — a **dangling reciprocal link** is left behind: a frontmatter array entry (e.g. self-profile `direct_reports`) pointing at a wiki-link target file that no longer exists. Surfaced in UAT when a member was added (after the same email was used as the vault owner in `tmr init`) and then the member file was removed, leaving a self-referential / dangling `direct_reports` entry.

**Approach:** Instead of retrofitting transactional writes across five services (invasive, only covers the mid-write-failure case), add a **consistency repair** to `tmr doctor` — mirroring the existing `--fix-frontmatter` migration infrastructure (Story 9.36):
- Plain `tmr doctor` warns when the vault contains dangling reciprocal links (read-only scan).
- `tmr doctor --prune-links` removes those dangling entries from frontmatter relation arrays.

This covers **both** root causes (partial write AND manual deletion), is **additive** (does not touch the five services' write paths), and reuses the doctor file-discovery helpers and FS injection.

## Boundaries & Constraints

**Always:**
- Only remove an array entry that (a) is a string parseable as a wiki-link `[[target|display]]` / `[[target]]` AND (b) whose target file does not exist (resolved relative to the containing file's directory).
- Scope the relation keys to exactly: `direct_reports`, `leadership`, `members`, `stakeholders`, `projects`, `teams` (the relations the human selected).
- Scan the same file universe as `--fix-frontmatter`: entity profiles (self/member/leadership/company/contractor/archived), team rosters, project overviews.
- Idempotent: a second `--prune-links` run removes nothing.
- Isolate per-file failures: an unreadable/malformed-YAML file is skipped, never aborts the run.
- Tolerate extension-less wiki-link targets (Obsidian style): a target is "present" if `<target>` OR `<target>.md` exists.

**Ask First:**
- Extending pruning to scalar relations (`current_manager`) or the non-selected arrays (`previous_manager`, `other_leaderships`). Out of scope here.

**Never:**
- Do not implement compensating rollback / transactional writes in the services (explicitly deferred — see `deferred-work.md`).
- Do not remove non-wiki-link strings, non-string entries, or entries whose target exists.
- Do not rewrite files that have no dangling links (preserve the known gray-matter date-reformat side effect to only the files actually repaired — same behavior as `--fix-frontmatter`).
- Do not change `migrateFrontmatter` / `detectLegacyBodyLinks` behavior.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Dangling entry | profile `direct_reports: [[../m/x.md\|x]]`; target file missing | Entry removed; file rewritten; counted in `removed`+`repaired` | — |
| All targets exist | every relation entry resolves | No change; `removed: 0`, `repaired: 0` | — |
| Mixed array | one valid + one dangling entry under same key | Only dangling entry dropped; valid kept | — |
| Non-wiki-link string | `projects: ["freeform note"]` | Kept (not a wiki-link) | — |
| Extension-less target | `[[../m/x\|x]]` and `../m/x.md` exists | Kept (resolves with `.md`) | — |
| Manual deletion case | member file deleted, self `direct_reports` still links it | Entry pruned | — |
| Malformed YAML file | one corrupt profile among good ones | Corrupt file skipped (`skipped++`); others processed | No throw |
| No vault configured | `--prune-links`, no workspace | Warning (or JSON error); `exitCode = 1` | Graceful |
| Plain doctor, dangling present | `tmr doctor`, vault has dangling links | Warning suggesting `--prune-links`; does NOT affect health-check exit code | — |
| JSON output | `tmr --json doctor --prune-links` | `{ scanned, repaired, removed, skipped }` | — |

## Code Map

| File | Change |
|------|--------|
| `src/services/doctor.service.ts` | ADD: `LinkRepairSummary` iface, `REPAIRABLE_RELATION_KEYS`, exported pure `parseWikiLinkTarget()`, private `_linkTargetExists()` + `_pruneFileLinks()`, public `pruneDanglingLinks()` + `detectDanglingLinks()` |
| `src/commands/doctor.command.ts` | ADD: `--prune-links` flag + handler (no-vault, JSON, text summary), plain-doctor dangling-links warning |
| `tests/services/doctor.frontmatter.service.test.ts` | ADD: `parseWikiLinkTarget` unit tests + `pruneDanglingLinks`/`detectDanglingLinks` FakeFs tests |
| `tests/commands/doctor.command.test.ts` | ADD: `--prune-links` summary/JSON/no-vault tests + plain-doctor dangling warning test |
| `README.md` | ADD: `--prune-links` doc + command table row |

## Tasks

1. Service: pure `parseWikiLinkTarget` + `REPAIRABLE_RELATION_KEYS` + `_linkTargetExists` + `_pruneFileLinks` (no-write transform) + `pruneDanglingLinks` (writes) + `detectDanglingLinks` (read-only count).
2. Command: `--prune-links` handler mirroring `--fix-frontmatter` (no-vault/JSON/text); plain-doctor warning via `detectDanglingLinks`.
3. Tests (service + command).
4. Docs (README).
5. Validate: tsc, eslint, jest.

## Acceptance Criteria

- AC1: `pruneDanglingLinks` removes only dangling wiki-link entries from the 6 relation keys and returns an accurate `{ scanned, repaired, removed, skipped }`.
- AC2: Idempotent — a second run removes nothing.
- AC3: Valid links, non-wiki-link strings, and non-string entries are never removed.
- AC4: Malformed/unreadable files are skipped, not fatal.
- AC5: `tmr doctor --prune-links` prints a summary (text + JSON) and handles no-vault with `exitCode = 1`.
- AC6: Plain `tmr doctor` warns when dangling links exist and points to `--prune-links`, without changing health-check exit semantics.
- AC7: tsc + eslint + full jest suite pass.

</frozen-after-approval>
