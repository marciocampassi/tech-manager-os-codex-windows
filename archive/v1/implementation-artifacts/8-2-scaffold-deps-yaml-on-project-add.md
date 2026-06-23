# Story 8.2: Scaffold stub deps.yaml when tmr project add runs

Status: done

## Story

As a `tmr` user who just created a project via `tmr project add`,
I want a stub `deps.yaml` automatically created in the project folder,
so that I can run `/tmr-project-impact <project-path> deps` at any time to set up dependency tracking without any manual file creation step.

## Acceptance Criteria

1. After `tmr project add <name>`, a file `deps.yaml` exists at `my-company/projects/<name>-project/deps.yaml`.
2. `deps.yaml` contains a header comment block explaining its purpose and how to populate it (`/tmr-project-impact <project-path> deps`) plus a valid empty `sources: {}` block.
3. PROJ-UNIT-001: The unit test for `addProject` verifies `deps.yaml` is written to the correct path with the correct content.
4. The integration test for `addProject` verifies `deps.yaml` exists on the real filesystem with the correct content.
5. `addProject` remains idempotent — if the project already exists (`created: false`), `deps.yaml` is not written again (no extra write calls).
6. No existing passing tests are broken.

## Tasks / Subtasks

- [x] Task 1 — Add `deps.yaml` write to `ProjectService.addProject()` (AC: #1, #2, #5)
  - [x] After the `createDirectory(projectMeetingsDir)` call in `addProject()`, add `this._fs.writeFile(depsYamlPath, DEPS_YAML_STUB)` where `depsYamlPath = path.join(projectBaseDir(ws, name), 'deps.yaml')`
  - [x] Define `DEPS_YAML_STUB` as a module-level constant in `project.service.ts` (not a TemplateService method — it takes no params and is a static string)
  - [x] Confirm the write is inside the `if (!(await this._fs.exists(overviewPath)))` guard so it only runs on first creation
- [x] Task 2 — Add unit test (PROJ-UNIT-001) to `tests/services/project.service.test.ts` (AC: #3)
  - [x] Add test inside existing `describe('addProject')` block
  - [x] Assert `mockFS.writeFile` was called with path matching `deps.yaml`
  - [x] Assert written content contains `sources: {}` and the header comment
- [x] Task 3 — Add integration test to `tests/integration/project.integration.test.ts` (AC: #4)
  - [x] Add test that calls `svc.addProject('platform', workspace)` on real filesystem
  - [x] Assert `deps.yaml` exists at the expected path
  - [x] Assert `deps.yaml` content contains `sources: {}` and the header comment
- [x] Task 4 — Run tests and confirm no regressions (AC: #6)
  - [x] Run `npm test -- --testPathPattern="project"` to confirm all project tests pass (59/59)
  - [x] Run `npm test` to confirm no regressions across the full suite (1078/1078, 68 suites)

## Dev Notes

### DEPS_YAML_STUB exact content

```yaml
# deps.yaml — project dependency manifest
# Populated automatically by /tmr-project-impact <project-path> deps
# Run that command to set up structured dependency tracking for this project.
# Do not edit manually unless you understand the schema.

sources: {}
```

**Important**: the stub uses `sources: {}` (NOT `dependencies: []`). This matches the exact spec from epics.md Story 2.5 AC: "a valid empty `sources: {}` block ready for the interactive tool to populate". The sprint change proposal draft incorrectly said `dependencies: []` — use `sources: {}`.

### Exact change to `ProjectService.addProject()`

Current code (lines 111–130 of `src/services/project.service.ts`):

```typescript
async addProject(name: string, ws: string): Promise<{ created: boolean }> {
  const overviewPath = projectOverviewPath(ws, name);

  if (await this._fs.exists(overviewPath)) {
    return { created: false };
  }

  const normalized = normalizeProjectName(name);
  const date = todayIso();

  await this._fs.writeFile(
    overviewPath,
    this._template.getProjectOverviewTemplate(normalized, date),
  );

  await this._fs.createDirectory(projectStandupsDir(ws, name));
  await this._fs.createDirectory(projectMeetingsDir(ws, name));

  return { created: true };
}
```

Target code (add the `writeFile` for `deps.yaml` after the directory creation calls):

```typescript
// Add at module level (above the class, near DEPS_YAML_STUB):
const DEPS_YAML_STUB = `# deps.yaml — project dependency manifest
# Populated automatically by /tmr-project-impact <project-path> deps
# Run that command to set up structured dependency tracking for this project.
# Do not edit manually unless you understand the schema.

sources: {}
`;

// Inside addProject(), after createDirectory(projectMeetingsDir):
await this._fs.writeFile(
  path.join(projectBaseDir(ws, name), 'deps.yaml'),
  DEPS_YAML_STUB,
);
```

### Path for deps.yaml

Using existing path helpers already in the file:
- `projectBaseDir(ws, name)` returns `path.join(ws, 'my-company', 'projects', normalizeProjectName(name))`
- So `deps.yaml` lives at `{ws}/my-company/projects/{name}-project/deps.yaml`

Do NOT add a new helper function — just use `path.join(projectBaseDir(ws, name), 'deps.yaml')` inline.

### Unit test pattern

Follow the exact mock FS pattern already in `tests/services/project.service.test.ts`. The key test (PROJ-UNIT-001):

```typescript
it('PROJ-UNIT-001: writes deps.yaml stub with sources: {} and header comment', async () => {
  mockFS.exists.mockResolvedValue(false);
  await svc.addProject(NAME, WS);

  const allWriteCalls = mockFS.writeFile.mock.calls as [string, string][];
  const depsCall = allWriteCalls.find(([p]) => p.endsWith('deps.yaml'));
  expect(depsCall).toBeDefined();
  expect(depsCall?.[1]).toContain('sources: {}');
  expect(depsCall?.[1]).toContain('tmr-project-impact');
});
```

Also update the existing test "returns created: true and creates overview file and correct directories" — it currently doesn't check `deps.yaml` but may need to account for the extra `writeFile` call count.

### Integration test pattern

Follow the real-filesystem pattern in `tests/integration/project.integration.test.ts`. All tests use `workspace = fs.mkdtempSync(...)` in `beforeEach` and clean up in `afterEach`. Use the Node.js `fs` (`fs-extra`) to check file existence and read content:

```typescript
it('PROJ-UNIT-001 (integration): deps.yaml is created with correct content', async () => {
  await svc.addProject('platform', workspace);

  const depsPath = path.join(workspace, 'my-company', 'projects', 'platform-project', 'deps.yaml');
  expect(fs.existsSync(depsPath)).toBe(true);

  const content = fs.readFileSync(depsPath, 'utf8');
  expect(content).toContain('sources: {}');
  expect(content).toContain('tmr-project-impact');
});
```

### Idempotency

The `deps.yaml` write is INSIDE the `if (!(await this._fs.exists(overviewPath)))` guard. When `addProject` is called on an existing project, it returns `{ created: false }` immediately without any file writes — `deps.yaml` is therefore also not rewritten. This is correct and automatic, no extra guard needed.

### Architecture Compliance

- `ProjectService` already uses `this._fs.writeFile` for all writes — follow the same pattern
- No new dependencies — `path.join` is already imported
- No changes to `TemplateService` — the stub content is a static string constant, not parameterized
- Follow the `// ── Section Name ──` comment divider convention from project-context.md
- No `console.log` — display is handled by the command layer (existing behavior)
- ESM imports: no changes to import list needed

### Previous Story Intelligence (Story 8.1)

- All 68 test suites now visible and passing — run the full suite to verify no regressions
- Mock FS pattern is solid — the `writeFile.mock.calls` approach works well for asserting file content in unit tests
- Integration tests use `fs-extra` real filesystem — same approach applies here

### References

- [Source: `src/services/project.service.ts` lines 111–130] — `addProject()` to modify
- [Source: `tests/services/project.service.test.ts` lines 83–157] — existing `addProject` unit tests
- [Source: `tests/integration/project.integration.test.ts` lines 50–76] — AC1 integration test pattern
- [Source: `_bmad-output/planning-artifacts/epics.md` Story 2.5] — FR37, PROJ-UNIT-001 spec
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-19-uat-bug-fixes.md` Story 8.2]
- [Source: `_bmad-output/implementation-artifacts/uat-bug-report.md` BUG-003]

### Review Findings

- [x] [Review][Patch] P1 — Remove misplaced `expect(firstContent).toContain('sources: {}')` from idempotency test — this asserts the first write (already covered elsewhere) not idempotency [tests/integration/project.integration.test.ts]
- [x] [Review][Patch] P2 — Rename new integration tests from `PROJ-UNIT-001 (integration): ...` prefix to `AC1b`/`AC1c` format, matching the established `AC#` naming convention [tests/integration/project.integration.test.ts]
- [x] [Review][Patch] P3 — Add `deps.yaml` existence assertion to the existing `AC1: creates overview...` integration test — it is the canonical project-creation test and must reflect the full created structure [tests/integration/project.integration.test.ts]
- [x] [Review][Patch] P4 — Strengthen unit test: add path assertion (`expect.stringContaining('my-company/projects/platform-project/deps.yaml')`) and assert at least one additional header line beyond `tmr-project-impact` [tests/services/project.service.test.ts]
- [x] [Review][Patch] P5 — Strengthen integration content test: assert the remaining two header lines (`deps.yaml — project dependency manifest` and `Do not edit manually`) to protect all four comment lines from silent regression [tests/integration/project.integration.test.ts]
- [x] [Review][Patch] P6 — Remove or merge redundant unit test `PROJ-UNIT-001: deps.yaml is not written when project already exists` — it is a strict subset of the existing `returns created: false when project already exists` which already asserts `mockFS.writeFile.not.toHaveBeenCalled()` [tests/services/project.service.test.ts]
- [x] [Review][Defer] D1 — Idempotency is structurally tied to overview file guard, not a deps.yaml-specific guard — real future evolution risk but spec-chosen design [src/services/project.service.ts:136] — deferred, pre-existing
- [x] [Review][Defer] D2 — Stub comment references a "schema" that does not exist anywhere in the repo — misleading to users but a product copy decision [src/services/project.service.ts:54] — deferred, pre-existing
- [x] [Review][Defer] D3 — No example of a populated `sources` entry in the stub — reduces self-service value but out of scope for this story [src/services/project.service.ts:54] — deferred, pre-existing
- [x] [Review][Defer] D4 — No test or rollback for partial-creation failure (`writeFile` throw after directories created) — pre-existing service design gap [src/services/project.service.ts:136] — deferred, pre-existing

## Dev Agent Record

### Agent Model Used

Sonnet 4.6

### Debug Log References

None required — single-pass implementation.

### Completion Notes List

- Added `DEPS_YAML_STUB` module-level constant to `project.service.ts` with `sources: {}` and a 4-line header comment.
- One new `writeFile` call inside `addProject()` — placed after the two `createDirectory` calls, inside the existing idempotency guard, so it is never invoked when the project already exists.
- Added 2 unit tests and 2 integration tests covering: successful write, content assertions, and idempotency.
- Full suite: 68/68 suites, 1078/1078 tests. No regressions.

### File List

- `src/services/project.service.ts` — MODIFIED (added `DEPS_YAML_STUB` constant + `deps.yaml` write in `addProject()`)
- `tests/services/project.service.test.ts` — MODIFIED (added 2 PROJ-UNIT-001 tests in `describe('addProject')`)
- `tests/integration/project.integration.test.ts` — MODIFIED (added 2 integration tests for `deps.yaml` creation and idempotency)
- `_bmad-output/implementation-artifacts/8-2-scaffold-deps-yaml-on-project-add.md` — MODIFIED (status, tasks, agent record)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — MODIFIED (status: review)
