---
title: 'Dated member files — make frontmatter `date:` match the artifact cadence'
type: 'fix'
created: '2026-06-15'
status: 'done'
baseline_commit: aa4ced5
context: []
---

## Changelog

- 2026-06-15: `MemberService.createMemberFile` now passes the cadence-correct `prefix` (not the
  raw full `date`) to `TemplateService.getTemplate`, so the dated file's frontmatter `date:`
  matches its filename and the profile `last_*` scalar — `YYYY-MM` for feedback/assessment/
  performance-review, `YYYY-MM-DD` for 1on1 (unchanged). One-line service change + 4 tests added
  (one per type). Confirmed no consumer reads these files' `date:` as a full date. Full suite
  green (tsc + eslint + 1468 jest + build). All ACs met. Verified via `scripts/e2e/smoke.sh`.

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Within a single feedback/assessment/performance-review file created by
`tmr member add`, the three date representations disagree:
- the **filename** uses a `YYYY-MM` prefix (`2026-06-feedback-novo@co.com-jane@co.com.md`),
- the profile **`last_*` scalar** uses `YYYY-MM` (`last_feedback: 2026-06`),
- but the file's own frontmatter **`date:`** is a full `YYYY-MM-DD` (`date: 2026-06-15`).

So the same artifact is "June 2026" by filename/scalar yet "June 15, 2026" by its own
frontmatter. 1on1 files are day-level by design and are internally consistent; the bug is only
the month-cadence types (feedback / assessment / performance-review) carrying a day-precise
`date:`.

**Root cause:** `MemberService.createMemberFile` computes
`prefix = filePrefix(type, date)` (full date for `1on1`, `YYYY-MM` for the others) and uses
`prefix` for the filename and the `last_*` scalar — but passes the **raw full `date`** to
`this._template.getTemplate(type, date, …)` for the frontmatter `date:` field
(`src/services/member.service.ts:325`). The self path already does this correctly:
`MyselfService.addPerformanceReview` passes `datePrefix` to the template
(`src/services/myself.service.ts:109`).

**Approach:** Pass `prefix` (the cadence-correct value already computed at
`member.service.ts:298`) to `getTemplate` instead of the raw `date`. After the change, for each
type the filename, the frontmatter `date:`, and the `last_*` scalar all agree:
- `1on1` → `YYYY-MM-DD` (unchanged; `prefix` is the full date for 1on1),
- `feedback` / `assessment` / `performance-review` → `YYYY-MM`.
This also makes member-created performance reviews consistent with self-created ones.

**Decision (granularity direction):** Align *down* to the artifact cadence (`YYYY-MM` for the
monthly types) rather than forcing everything to day-precision. Month cadence is the original
9.31 intent — these types are bucketed one-per-period and same-period entries deliberately share
a prefix; the day-precise `date:` was an accidental deviation.

**Safety check (done during investigation):** No code reads the `date:` frontmatter field of
these dated files (`rg` for `.date` / `data.date` / `fm.date` found only `date_added` reads and
option inputs), so narrowing the granularity has no downstream parser impact.

## Boundaries & Constraints

**Always:**
- Keep `1on1` day-level (`YYYY-MM-DD`) and unchanged.
- Keep filename and `last_*` scalar exactly as today (already use `prefix`).
- One-line behavioral change: the template receives `prefix`, not `date`.

**Never:**
- Do not change `filePrefix`, the filename builder, or the `last_*` scalar.
- Do not touch `MyselfService` (already correct) or leadership 1on1 templates.
- Do not change the `--date` input contract (`YYYY-MM` or `YYYY-MM-DD` still accepted; the value
  is normalized to the cadence prefix exactly as it already is for filename/scalar).

## I/O & Edge-Case Matrix

| Type | `--date` input | Filename prefix | Frontmatter `date:` (after) | `last_*` scalar |
|------|----------------|-----------------|------------------------------|-----------------|
| 1on1 | (none → today) | `2026-06-15` | `2026-06-15` | `2026-06-15` |
| feedback | (none → today) | `2026-06` | `2026-06` (was `2026-06-15`) | `2026-06` |
| assessment | `2026-06-20` | `2026-06` | `2026-06` (was `2026-06-20`) | `2026-06` |
| performance-review | `2026-06` | `2026-06` | `2026-06` | `2026-06` |
| 1on1 | `2026-06` | `2026-06`* | `2026-06`* | `2026-06`* |

\* When a user passes a month-only `--date` for a 1on1, `prefix` is whatever `filePrefix`
returns today — no change in behavior, just now mirrored into `date:` as well (still internally
consistent).

## Code Map

| File | Change |
|------|--------|
| `src/services/member.service.ts` | At the `getTemplate` call (~line 325), pass `prefix` instead of `date` as the template's date argument. |
| `tests/services/member.service.test.ts` | UPDATE/ADD assertions: feedback/assessment/performance-review files have `date: YYYY-MM` (matching filename + `last_*`); 1on1 keeps `date: YYYY-MM-DD`. Adjust any existing test that asserted a full `date:` for the monthly types. |

## Tasks

1. Pass `prefix` to `getTemplate` in `createMemberFile`.
2. Update/add member.service tests asserting `date:` granularity per type + internal consistency.
3. Validate: `npm run validate` (tsc + eslint + jest + build).

## Acceptance Criteria

- AC1: For feedback/assessment/performance-review created via `tmr member add`, the frontmatter
  `date:` equals the `YYYY-MM` filename prefix and the `last_*` scalar.
- AC2: For 1on1, the frontmatter `date:` remains `YYYY-MM-DD` and equals the filename prefix.
- AC3: Filename builder, `last_*` scalar, `--date` parsing, `MyselfService`, and leadership
  templates are unchanged.
- AC4: tsc + eslint + full jest pass.

</frozen-after-approval>
