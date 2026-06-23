---
title: 'Test Design — Architecture & Testability Review'
project: 'tech-manager-os'
version: '1.0'
mode: 'system-level'
generatedBy: 'TEA Master Test Architect'
generatedAt: '2026-04-27'
sourcePRD: '_bmad-output/planning-artifacts/prd.md'
---

# Test Design — Architecture & Testability Review

**Project:** tech-manager-os (`tmr`) — Local-First CLI for Engineering Managers
**PRD Version:** 2026-04-27 · Single-Release
**Architect:** TEA Master Test Architect (Murat)
**Date:** 2026-04-27

---

## 1. System Overview

`tmr` is a Node.js/TypeScript CLI tool following the **Command → Service → Provider** layered pattern. This release (`v2`) delivers four change areas:

| Area | Scope |
|---|---|
| `tmr init` rework | Guided onboarding — profile, leader, teams, members, skill install, README, sample files |
| `tmr relationship` removal | Full deletion from codebase, CLI help, and tests |
| `tmr team` normalization | Lowercase/kebab-case + email validation |
| `tmr member` restructure | Company-scoped vs team-scoped routing, location field, feedback auto-create |

**New commands:** `tmr install`, `tmr install <skill-name>`

---

## 2. Architecture Testability Review

### 2.1 Testability Concerns 🚨

#### TC-001 — `tmr init` Interactive Prompt Orchestration (ACTIONABLE)

**Description:** `tmr init` drives a multi-step interactive session via `inquirer` with nested loops (team count → per-team member loop). Testing this flow requires precise mock sequencing of `inquirer.prompt` across multiple sequential calls with varying response shapes.

**Evidence:** `tests/commands/init.command.test.ts` already uses `jest.unstable_mockModule('inquirer', ...)` — this works but forces complex per-call return value stacks with `mockResolvedValueOnce`.

**Risk if unaddressed:** Test suite becomes brittle; a single prompt reorder breaks the entire integration test chain.

**Required action:**
- [ ] Create a dedicated `initPromptFixture(scenario)` helper in `tests/fixtures/init-prompts.ts` that returns pre-wired mock sequences for common scenarios (happy path, email error recovery, zero team-count rejection)
- [ ] Document the call-order contract for `inquirer.prompt` within `InitService`

---

#### TC-002 — `tmr install` Network Dependency (ACTIONABLE)

**Description:** `SkillRegistryService` performs HTTPS calls to the GitHub registry. Without explicit network mocking in every test that exercises `tmr install`, tests will make real network calls or flake on CI.

**Evidence:** `tests/services/skill-registry.service.test.ts` already mocks `node:https` via `jest.unstable_mockModule('node:https', ...)` — the pattern exists but must be applied consistently to `install.command.test.ts` and any integration tests.

**Risk if unaddressed:** CI flakiness on network timeouts; accidental registry calls from test runs.

**Required action:**
- [ ] Verify `tests/commands/install.command.test.ts` mocks `node:https` — add if missing
- [ ] Add integration test for registry failure path (timeout, 404, malformed JSON) in `tests/integration/install-update.integration.test.ts`

---

#### TC-003 — Wiki-Link Output Consistency (ACTIONABLE)

**Description:** FR33 mandates `[[email]]` wiki-link format in all Markdown files that reference entities. This output contract spans `InitService`, `MemberService`, `LeadershipService`, and `TeamService`. No centralized formatter is referenced in project-context.md.

**Risk if unaddressed:** Inconsistent wiki-link format across services; regressions silently produce plain email strings.

**Required action:**
- [ ] Assert wiki-link format (`[[<email>]]`) in unit and integration tests for all services that write Markdown referencing people
- [ ] Consider extracting a `formatWikiLink(email: string): string` utility and testing it in isolation

---

#### TC-004 — `tmr relationship` Removal Verification (ACTIONABLE)

**Description:** FR32 requires complete elimination: command file, `cli.ts` registration, help text, and tests. Incomplete removal leaves dead code, orphaned tests, or ghost help entries that confuse users.

**Risk if unaddressed:** A command the docs say doesn't exist still appears in `tmr --help`.

**Required action:**
- [ ] Add a negative test to `tests/cli.test.ts`: assert that `relationship` does not appear in `tmr --help` output
- [ ] Remove or convert `tests/commands/relationship.command.test.ts` and `tests/services/relationship.service.test.ts` to verify removal (they should fail with "not found" or be deleted)
- [ ] Remove `tests/integration/relationship.integration.test.ts`

---

### 2.2 Testability Strengths ✅

| Area | Assessment |
|---|---|
| **Isolation** | `MockProvider` exists for all AI calls. `FileSystemService` is injectable — mocked in unit tests, real temp-dir in integration tests. Pattern is solid and consistently applied. |
| **Headless CLI logic** | 100% of business logic is accessible via service layer — no UI framework dependency. Commands are thin wrappers; services are fully testable without CLI invocation. |
| **ESM/Jest compatibility** | `jest.unstable_mockModule` pattern is established and working. `moduleNameMapper` resolves `.js` → `.ts`. ESM guard in `cli.ts` (`JEST_WORKER_ID`) prevents entrypoint execution. |
| **Network isolation** | `node:https` mock pattern exists in `SkillRegistryService` tests. Consistent reuse prevents real network calls. |
| **State control** | Integration tests use temp directories (real file I/O, isolated per-test). Unit tests use mocked `FileSystemService`. No shared mutable singletons between tests. |
| **Display contract** | `--plain` / `--json` output flags provide testable output contracts — structured assertions possible without parsing ANSI codes. |
| **Coverage infrastructure** | Jest coverage with enforced thresholds (78% lines/functions/statements, 60% branches) — CI gate in place. |

---

## 3. Architecturally Significant Requirements (ASRs)

| ASR ID | Requirement | Status | Type |
|--------|------------|--------|------|
| ASR-001 | `tmr init` must not leave vault in partial state on any write failure | ⚠️ Gap — no atomic rollback mechanism in current architecture | ACTIONABLE |
| ASR-002 | Email validation must occur before any file system operation | ⚠️ Gap — validation scope across all commands not verified | ACTIONABLE |
| ASR-003 | `tmr relationship` must be fully removed (command, service, CLI help, tests) | ⚠️ Gap — requires explicit negative coverage | ACTIONABLE |
| ASR-004 | `SkillRegistryService` abstracts external registry URL | ✅ Covered — abstracted behind service, no hardcoded URLs | FYI |
| ASR-005 | Wiki-link (`[[email]]`) as default output across all entity-referencing Markdown files | ⚠️ Gap — no centralized formatter, cross-service consistency unverified | ACTIONABLE |
| ASR-006 | All interactive prompt errors must be catchable and re-promptable without data loss | ⚠️ Gap — recovery from mid-flow validation errors needs explicit test coverage | ACTIONABLE |
| ASR-007 | `tmr init` skill install (`tmr-inbox`) must be silently resilient — failures must not abort onboarding | ⚠️ Gap — silent failure behavior needs verified test coverage | ACTIONABLE |

---

## 4. NFR Testability Assessment

*Based on the ADR Quality Readiness Checklist (8 categories, 29 criteria)*

### 4.1 Assessment Summary

| Category | Status | Criteria Met | Key Gap |
|---|---|---|---|
| 1. Testability & Automation | ✅ PASS | 4/4 | None — MockProvider, injectable FS, DI pattern solid |
| 2. Test Data Strategy | ✅ PASS | 3/3 | Faker via factory helpers, temp dirs, no prod data |
| 3. Scalability & Availability | ✅ PASS (N/A) | 3/3 | Local CLI — no distributed scalability concerns |
| 4. Disaster Recovery | ✅ PASS (N/A) | 2/3 | Local CLI — no RTO/RPO; partial vault state (ASR-001) is the relevant DR concern |
| 5. Security | ✅ PASS | 4/4 | AES-256 `conf` encryption, `redact.ts` helper, no plaintext keys |
| 6. Monitorability | ⚠️ CONCERNS | 2/4 | Winston file logger exists; no RED metrics (N/A for CLI), no config toggle without redeploy |
| 7. QoS & QoE | ⚠️ CONCERNS | 2/4 | 3s prompt spinner NFR defined; 500ms file write NFR defined but not load-tested |
| 8. Deployability | ✅ PASS | 3/3 | npm publish, `tsup` ESM-only, `dist/` only published |

**Overall:** 23/29 criteria met (79%) → ✅ PASS with noted concerns

### 4.2 Detailed NFR Test Requirements

#### Category 7: QoS / QoE

| Criterion | Status | Test Requirement |
|---|---|---|
| Prompt spinner ≤ 3s | ⚠️ Not tested | Add timing assertion: `tmr init` skill install spinner must appear within 3s of a mocked 2s network delay |
| File write ≤ 500ms | ⚠️ Not tested | Add perf assertion in integration tests using `Date.now()` before/after write; mark as P2 |
| No stack trace to user | ✅ Covered | `TmrError` catch pattern + `printError` to stderr; verify in unit tests that error messages are user-facing strings |

---

## 5. Risk Assessment Matrix

*Scoring: Probability (1–3) × Impact (1–3) = Risk Score. Score ≥ 6 requires mitigation.*

| Risk ID | Title | Category | P | I | Score | Level | Status |
|---------|-------|----------|---|---|-------|-------|--------|
| R-001 | `tmr init` leaves vault in partial state on mid-flow write failure | BUS | 2 | 3 | **6** | HIGH | OPEN |
| R-002 | Email validation missing or inconsistent across one or more commands | BUS | 2 | 3 | **6** | HIGH | OPEN |
| R-003 | `tmr relationship` command/help entry not fully removed | TECH | 2 | 3 | **6** | HIGH | OPEN |
| R-004 | Wiki-link format inconsistent across services (some emit plain emails) | BUS | 3 | 2 | **6** | HIGH | OPEN |
| R-005 | `tmr init` inquirer prompt test sequence becomes order-dependent and brittle | TECH | 3 | 2 | **6** | HIGH | OPEN |
| R-006 | `tmr install` fails silently without surfacing error or non-zero exit code | OPS | 2 | 3 | **6** | HIGH | OPEN |
| R-007 | Team-scoped member file written to wrong directory (company vs team routing error) | DATA | 2 | 2 | **4** | MEDIUM | OPEN |
| R-008 | `tmr member add feedback` creates duplicate profile when email case differs | DATA | 2 | 2 | **4** | MEDIUM | OPEN |
| R-009 | Location field missing from member profile frontmatter on some code paths | DATA | 2 | 2 | **4** | MEDIUM | OPEN |
| R-010 | `tmr init` skill install failure aborts onboarding instead of continuing silently | OPS | 2 | 2 | **4** | MEDIUM | OPEN |
| R-011 | README.md not generated in vault root after `tmr init` | BUS | 1 | 2 | **2** | LOW | OPEN |
| R-012 | Sample inbox files not copied during init | BUS | 1 | 2 | **2** | LOW | OPEN |

### 5.1 High-Risk Mitigation Plans

| Risk ID | Owner | Mitigation | Deadline |
|---------|-------|-----------|----------|
| R-001 | Developer | Add integration test asserting that a mocked write failure mid-init triggers `printError` to stderr and does not create partial output files; consider atomic write pattern (write to temp → rename) | Before sprint close |
| R-002 | Developer + QA | Add email validation unit tests for every command that accepts email input; add integration test asserting rejection before file creation | Before sprint close |
| R-003 | Developer | Add negative test in `tests/cli.test.ts` asserting `relationship` absent from `--help`; delete or stub `relationship` test files | Before sprint close |
| R-004 | Developer | Extract `formatWikiLink()` utility; add unit tests; add assertion in all service write-tests | During implementation |
| R-005 | Developer | Create `initPromptFixture` helper with named scenarios; document prompt call order | During implementation |
| R-006 | QA | Add integration test in `tests/integration/install-update.integration.test.ts` covering: timeout, 404, malformed JSON — all must surface `printError` and exit non-zero | Before sprint close |

---

## 6. Test Infrastructure Requirements

| Requirement | Priority | Action |
|---|---|---|
| `tests/fixtures/init-prompts.ts` — reusable inquirer mock sequences | P1 | Create before init integration tests |
| `tests/fixtures/member-profiles.ts` — reusable member data builders with email/team/location variants | P1 | Create before member integration tests |
| Negative test for `tmr relationship` removal in `tests/cli.test.ts` | P0 | Required as part of removal story |
| `formatWikiLink()` isolated utility test | P1 | Required for FR33 coverage |
| `tmr install` network error scenarios in integration test | P1 | Required before release |

---

## 7. Open Assumptions

| ID | Assumption | Impact if Wrong |
|----|-----------|----------------|
| OA-001 | No architecture doc or ADR is available beyond `project-context.md` — tech spec inferred from PRD + project context | May miss architectural decisions not documented |
| OA-002 | `tmr init` will continue to use `inquirer` prompt mocking (not real TTY) for automated testing | If real TTY is added, test strategy requires Playwright process-spawn integration |
| OA-003 | `SkillRegistryService` registry URL (`https://raw.githubusercontent.com/marlonvidal/tech-manager-os/main/skills`) is hardcoded in the service per `docs/architecture.md` — `node:https` mock at the module level is the correct isolation strategy (already used in `skill-registry.service.test.ts`) | If mock is incomplete, CI makes real GitHub calls |
| OA-004 | `conf` AES-256 encryption is not tested directly — encrypted values are treated as opaque in tests | Encryption correctness relies on `conf` library's own tests |
