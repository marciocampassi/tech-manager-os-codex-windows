---
title: 'Email similarity guard — require matching first local-part char to cut false positives'
type: 'fix'
created: '2026-06-15'
status: 'done'
baseline_commit: aa4ced5
context: []
---

## Changelog

- 2026-06-15: Added a first-character gate to `findSimilarEmail` — a candidate is only
  considered when its local-part shares the same first character as the typed email (in
  addition to same-domain + Levenshtein ≤ 2). Eliminates the `carlos@co.com` → `marlon@co.com`
  false positive while keeping all real-typo detection. 3 tests added (carlos/marlon → null,
  jon/ron → null, usr/user1 dist-2 still matches); full suite green (tsc + eslint + 1468 jest +
  build). All ACs met. Verified end-to-end via `scripts/e2e/smoke.sh`.

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The "Did you mean …?" similarity guard fires on emails that are obviously
different people. `findSimilarEmail` (`src/utils/email-similarity.ts`) flags any candidate in
the same domain whose local-part is within Levenshtein distance ≤ 2. Because the threshold is a
flat `≤ 2` regardless of length, two unrelated short names collide: `carlos@co.com` vs
`marlon@co.com` have edit distance exactly 2 (`c`→`m`, `s`→`n`), so adding `carlos@co.com`
prompts *"Did you mean marlon@co.com?"*. This was observed during the E2E smoke run
(`scripts/e2e/smoke.sh`) and is a real UX false positive: it interrupts a legitimate add and,
in non-interactive contexts, the prompt can't be answered.

**Root cause:** Distance ≤ 2 is too permissive for short local-parts where 2 edits can change
~33% of the characters and still leave a shared middle substring, even when the first and last
characters both differ.

**Approach:** Keep the existing same-domain + Levenshtein ≤ 2 rule, but additionally require the
**first character of the local-part to match** the candidate's first character. Real typos
(insertions, deletions, single substitutions, fat-finger duplicates) almost always preserve the
first character (`usr1`→`user1`, `user2`→`user1`, `filpe`→`filipe`, `jon`→`john`), while
genuinely different names that merely share an interior substring (`carlos`/`marlon`) do not.
This is a minimal, deterministic tightening — no fuzzy ratios, no new dependency.

**Considered & rejected (scope):**
- *Length-relative threshold* (e.g. `≤ 1` for short locals): would break the existing
  `usr@co.com` → `user1@co.com` (len 3, dist 2) contract asserted in tests.
- *Damerau-Levenshtein / transposition-aware distance*: larger change, not needed for the
  reported false positive.

## Boundaries & Constraints

**Always:**
- Preserve all current behavior except the new first-char gate: same-domain only, exact match
  returns `null` (no self-warning), best (lowest-distance) candidate wins, `≤ 2` ceiling.
- First-character comparison uses the already-lowercased local-parts (case-insensitive).
- Pure function, synchronous, no new imports/deps. `resolveEmailWithSimilarCheck`
  (`src/utils/email-guard.ts`) is unchanged — it just receives fewer false hits.

**Never:**
- Do not change the scan directories, the distance algorithm, the `≤ 2` ceiling, or the
  domain-equality requirement.
- Do not alter the prompt wording or the command call sites.

## I/O & Edge-Case Matrix

| Scenario | Existing email | Typed email | Expected |
|----------|---------------|-------------|----------|
| Reported false positive | `marlon@co.com` | `carlos@co.com` | `null` (first char `c`≠`m`) |
| Single substitution typo | `user1@co.com` | `user2@co.com` | `user1@co.com` (first char `u`=`u`, dist 1) |
| Deletion typo (dist 2, short) | `user1@co.com` | `usr@co.com` | `user1@co.com` (first char `u`=`u`) — **must still match** |
| Deletion typo (dist 1) | `user1@co.com` | `usr1@co.com` | `user1@co.com` |
| Too far | `user1@co.com` | `abc@co.com` | `null` (unchanged) |
| Different first char, dist ≤ 2 | `ron@co.com` | `jon@co.com` | `null` (new behavior; `j`≠`r`) |
| Exact match | `user1@co.com` | `user1@co.com` | `null` (unchanged) |
| Different domain | `user1@co.com` | `user1@other.com` | `null` (unchanged) |
| Empty local-part / malformed | — | `notanemail` | `null` (unchanged) |

## Code Map

| File | Change |
|------|--------|
| `src/utils/email-similarity.ts` | In the candidate loop, after the domain check and before/with the `dist <= 2` check, add a guard: skip the candidate when `localPart[0] !== candLocal[0]`. Keep best-match selection logic intact. |
| `tests/utils/email-similarity.test.ts` | ADD regression test: seed `marlon@co.com`, assert `findSimilarEmail('carlos@co.com', ws)` is `null`. ADD test: different first char within dist 2 (e.g. `jon` vs seeded `ron`) → `null`. Verify all existing cases still pass (they all share the first char). |

## Tasks

1. Add the first-character gate in `findSimilarEmail`'s candidate loop.
2. Add regression + first-char-divergence tests; run the full `email-similarity` suite.
3. Validate: `npm run validate` (tsc + eslint + jest + build).

## Acceptance Criteria

- AC1: `findSimilarEmail('carlos@co.com', ws)` returns `null` when `marlon@co.com` exists.
- AC2: All previously-passing `email-similarity.test.ts` cases still pass (matching-first-char
  typos at dist 1 and dist 2 are still detected).
- AC3: A candidate whose local-part first character differs from the typed email is never
  returned, even at distance ≤ 2.
- AC4: No change to scan dirs, distance ceiling, domain rule, prompt, or call sites.
- AC5: tsc + eslint + full jest pass.

</frozen-after-approval>
