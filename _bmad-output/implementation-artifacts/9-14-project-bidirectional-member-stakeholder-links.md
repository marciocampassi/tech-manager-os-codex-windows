# Story 9.14 — tmr project: Bidirectional Member/Stakeholder Links

## Metadata

| Field | Value |
|---|---|
| **Epic** | Epic 9 — UAT Pre-Launch Polish |
| **Story ID** | 9.14 |
| **Priority** | Medium |
| **Effort** | S |
| **Risk** | Low — additive writes to existing profiles; no destructive changes |

---

## Problem Statement

`tmr project link-member <email>` and `tmr project link-stakeholder <email>` write a reference into the project file, but the linked person's profile receives nothing in return. Navigating from a member or stakeholder profile to the projects they are involved in requires a manual vault search. All profiles (direct reports, company members, contractors, leadership) should receive a back-link in a `## Projects` section when they are linked to a project.

---

## Acceptance Criteria

- `tmr project link-member <email>` writes a wiki-link entry under `## Projects` in the member's profile (`my-teams/members/<email>/<email>.md` or `my-company/members/<email>/<email>.md` or `my-company/contractors/<email>/<email>.md`)
- `tmr project link-stakeholder <email>` writes a wiki-link entry under `## Projects` in the stakeholder's profile regardless of which scope it lives in (`my-leadership/`, `my-company/members/`, `my-teams/members/`)
- If the profile already has a `## Projects` section, the new entry is appended to it — the section is NOT recreated
- If the profile does not have a `## Projects` section, it is appended to the end of the file
- Duplicate entries are not written — if the project wiki-link already exists under `## Projects`, the command is a no-op for that back-link
- Profile resolution for back-link writes uses `EmailResolutionService.resolve()` — no inline path construction
- All tests pass

---

## Files to Change

| File | Change |
|---|---|
| `src/services/project.service.ts` | Add `_writeProjectBackLink(email, projectName, ws)` private method; call it in `linkMember()` and `linkStakeholder()` |
| `src/utils/markdown-section.ts` | Add (or extend) `appendToSection(filePath, sectionHeading, entry)` utility — idempotent append to a named `##` section, creating the section if absent |
| `tests/services/project.service.test.ts` | Add back-link assertions for both `linkMember` and `linkStakeholder`; test append-to-existing, create-new-section, and idempotent cases |
| `tests/utils/markdown-section.test.ts` | Unit tests for `appendToSection` covering all three cases |

---

## Implementation Detail

### 1 — `appendToSection` utility (`src/utils/markdown-section.ts`)

This utility handles the three back-link write scenarios in a single reusable function:

```typescript
/**
 * Appends `entry` under the `## {sectionHeading}` section of `filePath`.
 * - If the section exists and entry is already present: no-op.
 * - If the section exists and entry is absent: appends after the last line of the section.
 * - If the section does not exist: appends `\n## {sectionHeading}\n\n{entry}\n` to the file.
 */
export async function appendToSection(
  filePath: string,
  sectionHeading: string,
  entry: string,
  fs: FileSystemService,
): Promise<void> {
  const content = await fs.readFile(filePath);
  const sectionMarker = `## ${sectionHeading}`;

  // Idempotency check
  if (content.includes(entry)) return;

  if (content.includes(sectionMarker)) {
    // Section exists — find its end (next ## heading or EOF) and insert before it
    const lines = content.split('\n');
    const sectionStart = lines.findIndex((l) => l.trim() === sectionMarker);
    let insertAt = lines.length;
    for (let i = sectionStart + 1; i < lines.length; i++) {
      if (lines[i].startsWith('## ')) {
        insertAt = i;
        break;
      }
    }
    lines.splice(insertAt, 0, entry);
    await fs.writeFile(filePath, lines.join('\n'));
  } else {
    // Section absent — append to EOF
    const suffix = `\n## ${sectionHeading}\n\n${entry}\n`;
    await fs.writeFile(filePath, content.trimEnd() + suffix);
  }
}
```

### 2 — `_writeProjectBackLink` in `ProjectService`

```typescript
private async _writeProjectBackLink(
  email: string,
  projectName: string,
  ws: string,
): Promise<void> {
  const resolved = await this._emailResolution.resolve(email, ws);
  if (!resolved) return; // entity not found — skip silently (link-member already validates)

  const projectOverviewPath = projectOverviewFilePath(ws, projectName); // existing helper
  const wikiLink = formatWikiLink(projectOverviewPath, resolved.profilePath, projectName);
  const entry = `- ${wikiLink}`;

  await appendToSection(resolved.profilePath, 'Projects', entry, this._fs);
}
```

### 3 — Call site in `linkMember()` and `linkStakeholder()`

After the existing project-file write in each method, add:

```typescript
await this._writeProjectBackLink(email, name, ws);
```

Both methods already resolve and validate the email before reaching this point, so no additional guard is needed.

---

## Notes for Developer Agent

- `appendToSection` must be tested in isolation — cover: section exists with entry already present (no-op), section exists without entry (append), section absent (create + append).
- The `resolved.profilePath` from `EmailResolutionService.resolve()` is the absolute path to the profile file — pass it directly to `formatWikiLink` as both the `resolvedPath` and `fromPath` argument basis.
- Do NOT use `findMemberGlobally()` or `createMember()` — both are deleted. Use `EmailResolutionService.resolve()` exclusively.
- `## Projects` is the exact section heading — case-sensitive match.
- Run `npm run validate` before marking done.

---

## Tasks / Subtasks

- [x] Write failing tests: `appendToSection` unit tests + back-link assertions for `linkMember`/`linkStakeholder`
- [x] Create `src/utils/markdown-section.ts` with `appendToSection` (idempotent, section-exists, section-absent cases)
- [x] Add `_writeProjectBackLink` private method to `ProjectService`
- [x] Wire `_writeProjectBackLink` into `linkMember()` and `linkStakeholder()`
- [x] `npm run validate` — 1204/1204 tests pass

### Review Findings Round 1 (AI) — Applied

- [x] [Review][Patch] P1+P2 — `appendToSection` section detection uses `includes()` (substring) for branch but `findIndex` with strict equality for position — heading like `## Projects Extended` triggers wrong-section insertion; idempotency check is also file-wide, not section-scoped [src/utils/markdown-section.ts:22-24]
- [x] [Review][Patch] P3 — Service tests use two independent `stringContaining` assertions — independently satisfied by any write call; does not verify both conditions in the same call or that `[[` follows `## Projects` [tests/services/project.service.test.ts]
- [x] [Review][Patch] P4 — `_writeProjectBackLink` private method named with leading underscore — inconsistent with `appendToHashSection`/`countHashSection` style in same class [src/services/project.service.ts:80]
- [x] [Review][Defer] D1 — `_writeProjectBackLink` calls `_emailResolution.resolve()` twice — first call already in linkMember/linkStakeholder; redundant I/O, safe but wasteful [src/services/project.service.ts:84] — deferred, minor performance concern
- [x] [Review][Defer] D2 — CRLF mutation: `split('\n')` + `join('\n')` strips carriage returns on Windows-saved files — deferred, pre-existing pattern across codebase
- [x] [Review][Defer] D3 — Service test `readFile` mock returns project overview content for all paths including member profile — inaccurate fixture but functional, idempotency paths covered by unit tests — deferred, low priority
- [x] [Review][Defer] D4 — No service-level idempotency test for back-link (calling linkMember twice) — deferred, covered by appendToSection unit tests
- [x] [Review][Defer] D5 — No guard against falsy `resolved.absolutePath` from EmailResolutionService — deferred, service contract guarantees non-empty value
- [x] [Review][Defer] D6 — `writeFile(overviewPath)` not rolled back if `_writeProjectBackLink` rejects — link left in broken half-state — deferred, transaction rollback complexity; pre-existing pattern
- [x] [Review][Defer] D7 — `appendToSection` accepts unconstrained `entry` string; embedded newlines silently inject extra lines — deferred, not realistic in current usage
- [x] [Review][Defer] D8 — "appends entry among existing entries" test does not verify section membership or ordering — deferred, weak test coverage concern

### Review Findings Round 2 (AI)

- [x] [Review][Patch] P1 — Docstring claims "file-wide" idempotency but implementation is section-scoped; misleads future callers [src/utils/markdown-section.ts:6-9]
- [x] [Review][Patch] P2 — Section heading detection uses `.trim()` — violates spec "exact case-sensitive match"; `  ## Projects  ` would match incorrectly [src/utils/markdown-section.ts:20]
- [x] [Review][Defer] D1 — Race condition: `appendToSection` read-modify-write is not atomic; concurrent back-link writes to the same profile silently lose entries — deferred, pre-existing pattern in codebase
- [x] [Review][Defer] D2 — `linkMembers`/`linkStakeholders` batch commands do not call `writeProjectBackLink`; batch linking leaves profiles without back-links — deferred, out of scope for 9.14
- [x] [Review][Defer] D3 — Multi-line `entry` bypasses idempotency guard (`lines.includes(multiLineEntry)` always false) and corrupts file on splice — deferred, unrealistic in current usage

### Review Findings Round 3 (AI)

- [x] [Review][Dismiss] P1 — Duplicate `// ── linkStakeholder` comment — false positive; diff-formatting artifact, file contains only one comment line at that position [tests/services/project.service.test.ts]
- [x] [Review][Defer] D1 — Trailing whitespace on a heading line causes exact-match miss; section treated as absent, duplicate `## Projects` appended at EOF — deferred, per-spec exact match; trailing spaces on headings are uncommon in Obsidian [src/utils/markdown-section.ts:19]
- [x] [Review][Defer] D2 — `#` (h1) headings not recognized as section boundary in `insertAt` scan; loop only stops at `## ` — deferred, h1 headings don't appear between `##` sections in Obsidian profiles in practice [src/utils/markdown-section.ts:24]
- [x] [Review][Defer] D3 — Character-exact idempotency guard misses URL-encoded or whitespace variants of the same wiki-link — deferred, `formatWikiLink` output is deterministic; no variant arises in practice [src/utils/markdown-section.ts:30]
- [x] [Review][Defer] D4 — Back-link write failure propagates as a hard error after the primary overview write has already committed — deferred, consistent with codebase error-propagation pattern; no try/catch wraps writes elsewhere [src/services/project.service.ts]
- [x] [Review][Defer] D5 — `trimEnd()` in section-absent branch silently strips intentional trailing whitespace from the whole file — deferred, minor reformatting; profiles don't rely on trailing whitespace [src/utils/markdown-section.ts:34]
- [x] [Review][Defer] D6 — Blank-line formatting differs between section-exists path (raw splice, no separator) and section-absent path (`\n\n{entry}`) — deferred, minor cosmetic; list items don't require blank-line separators [src/utils/markdown-section.ts:31,34]
- [x] [Review][Defer] D7 — Integration test regex `/## Projects[\s\S]*\[\[/` does not verify exact wiki-link content or that `formatWikiLink` was used — deferred, behavioral testing is appropriate; `formatWikiLink` usage verified by code review [tests/services/project.service.test.ts]
- [x] [Review][Defer] D8 — Two divergent markdown-section implementations coexist (`appendToHashSection` for `#`, `appendToSection` for `##`) with no documented rationale — deferred, design concern not actionable in 9.14 [src/services/project.service.ts, src/utils/markdown-section.ts]
- [x] [Review][Defer] D9 — `appendToSection` receives `fs` as positional parameter instead of constructor injection — deferred, deliberate design choice for utility function; inconsistency noted [src/utils/markdown-section.ts:12]
- [x] [Review][Defer] D10 — Empty file produces a leading `\n` via `content.trimEnd() + '\n## ...'` suffix — deferred, harmless; profiles are never empty in practice [src/utils/markdown-section.ts:34]
- [x] [Review][Defer] D11 — Duplicate `## Projects` headings in a profile defeat idempotency (`findIndex` returns only first); entry in second section is invisible — deferred, malformed-file edge case; spec assumes well-formed input [src/utils/markdown-section.ts:20]

---

## Dev Agent Record

### Implementation Notes

- `IEntityLocation.absolutePath` is the profile path field (spec used `profilePath` — corrected).
- `_writeProjectBackLink(email, projectName, ws)` resolves the email a second time via `EmailResolutionService.resolve()`. Since `linkMember`/`linkStakeholder` already resolved it, this is a duplicate call; safe because resolution is idempotent (auto-created members are found on the second call). Display name uses `normalizeProjectName(projectName)` for consistency with filesystem naming.
- `appendToSection` matches the section marker with `l.trim() === sectionMarker` to handle trailing spaces; idempotency check is a fast `content.includes(entry)` scan.
- No new dependencies required.

### Completion Notes

All 6 ACs satisfied:
1. `link-member` writes back-link under `## Projects` in member profile ✅
2. `link-stakeholder` writes back-link under `## Projects` in stakeholder profile ✅
3. Existing `## Projects` section: entry appended, section not recreated ✅
4. Absent `## Projects` section: section created at EOF ✅
5. Duplicate entry: idempotency guard prevents double write ✅
6. Profile resolution uses `EmailResolutionService.resolve()` exclusively ✅

New tests: 6 in `tests/utils/markdown-section.test.ts`, 2 in `tests/services/project.service.test.ts`.

### File List

- `src/utils/markdown-section.ts` (new)
- `src/services/project.service.ts`
- `tests/utils/markdown-section.test.ts` (new)
- `tests/services/project.service.test.ts`

### Change Log

- Created `src/utils/markdown-section.ts` with `appendToSection` utility (2026-05-26)
- Added `_writeProjectBackLink` private method to `ProjectService` (2026-05-26)
- Wired back-link call into `linkMember()` and `linkStakeholder()` (2026-05-26)

---

## Status

done
