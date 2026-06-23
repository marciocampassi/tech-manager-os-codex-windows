# Story 9.25: Obsidian Open Hint in Post-Init Summary

Status: done

## Story

As a user who just ran `tmr init`,
I want the next-steps summary to show me a copy-pasteable command to open the vault in Obsidian,
so that I can get into Obsidian immediately without manual navigation.

## Acceptance Criteria

**AC1:** Given `tmr init` completes successfully,
When the post-init summary is printed,
Then step 1 includes platform-specific commands to open the vault in Obsidian
And the vault path is embedded in each command string
And a manual fallback instruction is included for cases where the CLI command is unavailable.

**AC2:** The macOS/Linux open command appears as:
`macOS/Linux → run: open -a Obsidian "<vaultPath>"`

**AC3:** The Windows open command appears as:
`Windows     → run: start "" "obsidian://<vaultPath>"`

**AC4:** A plain-text fallback line appears as:
`Or open Obsidian and navigate to: <vaultPath>`

**AC5:** All other lines in the next-steps summary are unchanged — steps 2–5, Skills installed, and Obsidian plugins installed sections remain identical.

## Tasks / Subtasks

- [x] Task 1 — Update `printPostInitSummary` in `src/services/init.service.ts` (AC: 1, 2, 3, 4, 5)
  - [x] Locate the array in `printPostInitSummary` (lines ~354–372), specifically the line:
        `` `  1. Open ${vaultPath} in Obsidian — plugins are ready`, ``
  - [x] Replace that single line with the four-line block:
        `` `  1. Open this vault in Obsidian:`, ``
        `` `       macOS/Linux → run: open -a Obsidian "${vaultPath}"`, ``
        `` `       Windows     → run: start "" "obsidian://${vaultPath}"`, ``
        `` `       Or open Obsidian and navigate to: ${vaultPath}`, ``
  - [x] Verify no other lines in the array are modified

- [x] Task 2 — Update or add tests for `printPostInitSummary` (AC: 1–5)
  - [x] Locate existing test(s) for `printPostInitSummary` in `tests/services/init.service.test.ts`
  - [x] Update assertion to expect the new four-line block instead of the old single line
  - [x] Confirm remaining lines in the output are still asserted (steps 2–5, skills, plugins)

## Dev Notes

### Exact Change Location

**File:** `src/services/init.service.ts`
**Method:** `printPostInitSummary(vaultPath: string, plain: boolean): void` (line ~352)
**Target line (current):**
```typescript
`  1. Open ${vaultPath} in Obsidian — plugins are ready`,
```
**Replace with:**
```typescript
`  1. Open this vault in Obsidian:`,
`       macOS/Linux → run: open -a Obsidian "${vaultPath}"`,
`       Windows     → run: start "" "obsidian://${vaultPath}"`,
`       Or open Obsidian and navigate to: ${vaultPath}`,
```

The array elements are joined with `'\n'` before being passed to `printInfo()` — no join-separator change is needed. The four replacement lines are strings with template literals and will be joined correctly by the existing `.join('\n')` call.

### Full Context of `printPostInitSummary` (current state as of commit `c171979`)

```typescript
printPostInitSummary(vaultPath: string, plain: boolean): void {
  printSuccess(`Workspace created at ${vaultPath}`, plain);
  printInfo(
    [
      '',
      'Next steps:',
      `  1. Open ${vaultPath} in Obsidian — plugins are ready`,  // ← CHANGE THIS LINE ONLY
      '  2. Run /tmr-myself-config in Claude Code to personalize your AI context (do this first)',
      '  3. Run /tmr-inbox in Claude Code to process your inbox meeting notes',
      '  4. Run `tmr project add` to add your first project',
      '  5. Run `tmr --help` to explore all commands',
      '',
      'Skills installed:',
      '  /tmr-myself-config      — personalize AI context across your vault',
      '  /tmr-inbox              — process inbox meeting notes into structured entries',
      '  /tmr-project-impact     — detect which docs are affected when a project changes',
      '',
      'Obsidian plugins installed: obsidian-git, granola-sync, terminal, dataview',
    ].join('\n'),
    plain,
  );
}
```

After the change, the array becomes:
```typescript
[
  '',
  'Next steps:',
  '  1. Open this vault in Obsidian:',
  `       macOS/Linux → run: open -a Obsidian "${vaultPath}"`,
  `       Windows     → run: start "" "obsidian://${vaultPath}"`,
  `       Or open Obsidian and navigate to: ${vaultPath}`,
  '  2. Run /tmr-myself-config in Claude Code to personalize your AI context (do this first)',
  // ... rest unchanged
]
```

### Output Contract Constraints

- `printInfo` comes from `src/utils/display.ts` — always pass `plain` as the second argument. **Never** use `console.log` or `chalk` directly.
- The `plain` parameter suppresses ANSI colors. The change does not affect this — no color codes are embedded in the step 1 string, so no change to `plain` handling is required.
- The change is purely additive within the existing `printInfo` call — no new display helper calls needed.

### What MUST Be Preserved

- Steps 2–5 content and numbering remain unchanged.
- The "Skills installed" and "Obsidian plugins installed" sections remain unchanged.
- The empty-string `''` sentinel lines at the top and between sections remain unchanged.
- `printSuccess` call for `Workspace created at ${vaultPath}` remains unchanged.

### Architecture Compliance

- **Layer:** `InitService` is a service — this is a purely presentational output change within a service method. No command-layer changes needed.
- **No new imports** — `printInfo` is already imported at the top of `init.service.ts`.
- **No new dependencies** — this story adds zero runtime dependencies.
- **ESM imports:** All existing imports remain correct; no import changes needed.
- **TypeScript:** No type changes. The method signature `printPostInitSummary(vaultPath: string, plain: boolean): void` does not change.

### Project Structure Notes

- Source file: `src/services/init.service.ts` — UPDATE
- Test file: `tests/services/init.service.test.ts` — UPDATE (assertion for `printPostInitSummary`)
- No other files touched.

### Previous Story Intelligence (9.21 — Done)

Story 9.21 (`vault-not-found-abort-on-missing-vault.md`) established that:
- `getWorkspaceRoot()` now **throws** `VaultNotFoundError` instead of returning a fallback CWD.
- The CLI catch block handles `VaultNotFoundError` specially to show the hint.
- This story (9.25) is about `tmr init` output — `InitCommand` does **NOT** call `getWorkspaceRoot()` (confirmed: `tmr init` is unaffected by the vault guard, per Story 9.21 AC5). No interaction.

Story 9.21 review findings flagged a deferred `myself.command.ts` local catch intercepts `VaultNotFoundError` — still unresolved, but irrelevant to 9.25.

### Git Context (latest commits)

- `c171979` — "Added bug fixes round" (most likely 9.22–9.24 implementations)
- `7912e84` — "Fixed post-init message" (post-init summary already touched recently — verify current line content before patching)
- `fef0da8` — story-9.21 implementation
- `3d71468` — story-9.20 implementation

> **Caution:** Commit `7912e84` ("Fixed post-init message") means the `printPostInitSummary` function was recently modified. The exact current content is captured above — verify line 358 before applying the change to ensure no drift from the spec.

### Testing Requirements

**Test file:** `tests/services/init.service.test.ts`

Find the existing `printPostInitSummary` test block (search for `"printPostInitSummary"` or `"post-init"` in the test file).

The key assertions to update:
1. Assert that step 1 output contains `'Open this vault in Obsidian:'`
2. Assert the output contains `` `open -a Obsidian "${vaultPath}"` `` (macOS/Linux line)
3. Assert the output contains `` `obsidian://${vaultPath}` `` (Windows line)
4. Assert the output contains `Or open Obsidian and navigate to:` (fallback)
5. Assert step 2 (`/tmr-myself-config`) is still present — regression guard

Mocking pattern (already in use in `init.service.test.ts`): mock `printSuccess` and `printInfo` from `src/utils/display.ts` using Jest `jest.mock`. Capture the string argument passed to `printInfo` and assert `toContain` for each new line.

**Coverage thresholds to maintain:** Lines 78%, Functions 78%, Branches 60% (see project-context.md). This change is in an existing covered method — updating the test assertion maintains coverage.

**Run tests with:**
```bash
NODE_OPTIONS=--experimental-vm-modules npx jest tests/services/init.service.test.ts
```

### References

- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-06-09-post-uat-bugs-3.md` § Story 9.25]
- [Source: `src/services/init.service.ts` lines 352–373 — `printPostInitSummary`]
- [Source: `_bmad-output/project-context.md` § CLI Output Contract — printInfo, plain flag]
- [Source: `_bmad-output/project-context.md` § Architecture & Framework Rules — Layered CLI]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-5

### Debug Log References

### Completion Notes List

Story was implemented manually by the user, due to its simplicity

### File List
