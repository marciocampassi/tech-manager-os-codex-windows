---
title: 'Test Design — QA Test Plan'
project: 'tech-manager-os'
version: '1.0'
mode: 'system-level'
generatedBy: 'TEA Master Test Architect'
generatedAt: '2026-04-27'
sourcePRD: '_bmad-output/planning-artifacts/prd.md'
sourceArchitecture: 'docs/architecture.md'
---

# Test Design — QA Test Plan

**Project:** tech-manager-os (`tmr`) — v2 Release
**PRD:** 2026-04-27 · Single-Release
**Architecture:** `docs/architecture.md`
**QA Lead:** TEA Master Test Architect
**Date:** 2026-04-27

---

## 1. Scope

This test plan covers the four change areas of the v2 release:

| Area | PRD FRs | Risk Level |
|---|---|---|
| `tmr init` full rework | FR1–FR14 | HIGH — multi-service orchestration, interactive flow |
| `tmr relationship` removal | FR32 | HIGH — regression risk to member/team |
| `tmr team` normalization + validation | FR15–FR17 | MEDIUM |
| `tmr member` restructure | FR18–FR24 | MEDIUM — routing logic, scope decisions |
| Skill management (`tmr install`) | FR25–FR27 | MEDIUM — network dependency |
| Input validation & normalization | FR28–FR31 | HIGH — cross-cutting |
| Obsidian wiki-link output | FR33 | MEDIUM — cross-cutting |

**Out of scope:** `tmr process` pipeline, `tmr watch`, `tmr config`, `tmr update`, AI provider tests (no changes).

---

## 2. Test Architecture

```
Tests
├── Unit (Jest + ts-jest)          — Service logic, validation, normalization
│   ├── tests/services/            — Per-service unit tests
│   ├── tests/commands/            — Per-command thin-wrapper tests
│   └── tests/utils/               — Utility function tests
├── Integration (Jest + ts-jest)   — Multi-service flows with real temp-dir I/O
│   └── tests/integration/         — End-to-end service orchestration
└── Negative / Regression           — Relationship removal, validation rejection
    └── tests/cli.test.ts           — CLI help output assertions
```

**Key constraints:**
- All AI calls: `MockProvider` only — no real API calls in any test
- File I/O: mocked `FileSystemService` in unit tests; real temp dir in integration tests
- Network calls: `node:https` mocked via `jest.unstable_mockModule('node:https', ...)` in all skill-registry tests
- Interactive prompts: `inquirer` mocked via `jest.unstable_mockModule('inquirer', ...)`
- ESM: `NODE_OPTIONS=--experimental-vm-modules jest`
- Timeout: 30 000 ms (existing Jest config)

---

## 3. Coverage Matrix

### 3.1 `tmr init` — Vault Initialization & Onboarding

**Risk: HIGH · FR1–FR14 · ASR-001, ASR-006, ASR-007, R-001, R-005**

| Test ID | Scenario | FR | Level | Priority | File |
|---------|----------|-----|-------|----------|------|
| INIT-UNIT-001 | InitService scaffolds correct folder structure (includes `inbox/`, `my-teams/members/`, `my-company/members/`, `my-leadership/`; excludes `/utils`, `/my-teams/feedback-templates`) | FR3 | Unit | **P0** | `tests/services/init.service.test.ts` |
| INIT-UNIT-002 | InitService generates `README.md` in vault root with correct content shape | FR12 | Unit | **P0** | `tests/services/init.service.test.ts` |
| INIT-UNIT-003 | InitService copies sample inbox files to vault `inbox/` | FR11 | Unit | **P1** | `tests/services/init.service.test.ts` |
| INIT-UNIT-004 | InitService generates `my-career/<email>.md` profile with correct frontmatter | FR4 | Unit | **P0** | `tests/services/init.service.test.ts` |
| INIT-UNIT-005 | InitService generates `my-leadership/<email>.md` with correct frontmatter | FR5 | Unit | **P0** | `tests/services/init.service.test.ts` |
| INIT-UNIT-006 | InitService emits post-init next-steps summary via `printInfo` | FR13 | Unit | **P1** | `tests/services/init.service.test.ts` |
| INIT-UNIT-007 | InitService generates `CLAUDE.md` in vault root | FR3 | Unit | **P1** | `tests/services/init.service.test.ts` |
| INIT-INT-001 | Full happy-path: init with 1 team + 2 members → correct files written to temp dir | FR1–FR13 | Integration | **P0** | `tests/integration/init.integration.test.ts` |
| INIT-INT-002 | Init with vault path = current directory (empty string → CWD default) | FR2 | Integration | **P0** | `tests/integration/init.integration.test.ts` |
| INIT-INT-003 | Init with 2 teams, members per team → all team and member files created | FR6–FR8 | Integration | **P0** | `tests/integration/init.integration.test.ts` |
| INIT-INT-004 | Init with team count = 0 → rejected with `ValidationError` before any file write | FR30 | Integration | **P0** | `tests/integration/init.integration.test.ts` |
| INIT-INT-005 | Init with invalid email (user profile) → rejected, re-prompted, no file written | FR28, FR29 | Integration | **P0** | `tests/integration/init.integration.test.ts` |
| INIT-INT-006 | Init with invalid email (leader) → rejected, re-prompted | FR28, FR29 | Integration | **P0** | `tests/integration/init.integration.test.ts` |
| INIT-INT-007 | Init with invalid email (team member) → rejected, re-prompted, flow continues | FR28, FR29 | Integration | **P0** | `tests/integration/init.integration.test.ts` |
| INIT-INT-008 | Init: empty email submitted for team member → treated as "done adding members" | FR9 | Integration | **P1** | `tests/integration/init.integration.test.ts` |
| INIT-INT-009 | Init: team name with capitals and spaces (`Backend Team`) → normalized to `backend-team` silently | FR17, FR31 | Integration | **P0** | `tests/integration/init.integration.test.ts` |
| INIT-INT-010 | Init: `tmr-inbox` skill install fails (mocked network error) → onboarding completes, error logged but not thrown | FR10, ASR-007 | Integration | **P0** | `tests/integration/init.integration.test.ts` |
| INIT-INT-011 | Init: FileSystemService `writeFile` throws mid-flow → `printError` to stderr, process does not crash silently | ASR-001, NFR | Integration | **P0** | `tests/integration/init.integration.test.ts` |
| INIT-INT-012 | README.md exists in vault root after full init flow | FR12 | Integration | **P0** | `tests/integration/init.integration.test.ts` |
| INIT-INT-013 | All entity references in generated files use wiki-link format `[[<email>]]` | FR33 | Integration | **P1** | `tests/integration/init.integration.test.ts` |

---

### 3.2 `tmr relationship` Removal

**Risk: HIGH · FR32 · ASR-003, R-003**

| Test ID | Scenario | FR | Level | Priority | File |
|---------|----------|-----|-------|----------|------|
| REL-NEG-001 | `tmr --help` output does NOT contain "relationship" | FR32 | CLI/Regression | **P0** | `tests/cli.test.ts` |
| REL-NEG-002 | `tmr relationship` invoked directly → unrecognized command error (Commander.js default) | FR32 | CLI/Regression | **P0** | `tests/cli.test.ts` |
| REL-NEG-003 | `tests/commands/relationship.command.test.ts` deleted / converted to removal smoke test | FR32 | Negative | **P0** | DELETE or convert |
| REL-NEG-004 | `tests/integration/relationship.integration.test.ts` deleted | FR32 | Negative | **P0** | DELETE |
| REL-NEG-005 | `TeamService` and `MemberService` operate correctly without `RelationshipService` dependency | FR32 | Unit | **P1** | existing service tests |

---

### 3.3 `tmr team` — Normalization & Validation

**Risk: MEDIUM · FR15–FR17 · R-007**

| Test ID | Scenario | FR | Level | Priority | File |
|---------|----------|-----|-------|----------|------|
| TEAM-UNIT-001 | `TeamService.createTeam("Backend Team")` → slug `backend-team`, correct file path | FR17, FR31 | Unit | **P0** | `tests/services/team.service.test.ts` |
| TEAM-UNIT-002 | `TeamService.createTeam("FRONTEND")` → slug `frontend` | FR17, FR31 | Unit | **P1** | `tests/services/team.service.test.ts` |
| TEAM-UNIT-003 | `TeamService.addMember(teamName, "not-an-email")` → throws `InvalidEmailError` (TMR_E103) before file write | FR16, FR28 | Unit | **P0** | `tests/services/team.service.test.ts` |
| TEAM-UNIT-004 | `TeamService.addMember(teamName, "valid@company.com")` → file written to correct path | FR16 | Unit | **P1** | `tests/services/team.service.test.ts` |
| TEAM-INT-001 | Integration: `tmr team create "My Team"` → folder and team file exist with slug `my-team` | FR15, FR17 | Integration | **P1** | `tests/integration/team.integration.test.ts` |
| TEAM-INT-002 | Integration: `tmr team add my-team "bad-email"` → rejection with `printError` before any write | FR16, FR28 | Integration | **P0** | `tests/integration/team.integration.test.ts` |

---

### 3.4 `tmr member` — Restructure

**Risk: MEDIUM · FR18–FR24 · R-007, R-008, R-009**

| Test ID | Scenario | FR | Level | Priority | File |
|---------|----------|-----|-------|----------|------|
| MEM-UNIT-001 | `MemberService.addMember(email)` (no team) → file written to `my-company/members/<email>.md` | FR18 | Unit | **P0** | `tests/services/member.service.test.ts` |
| MEM-UNIT-002 | `MemberService.addMember(email, {team: "backend"})` → file written to `my-teams/members/<email>.md` | FR19 | Unit | **P0** | `tests/services/member.service.test.ts` |
| MEM-UNIT-003 | Team-scoped member file contains `manager: [[<current-user-email>]]` from `my-career/<email>.md` | FR20 | Unit | **P0** | `tests/services/member.service.test.ts` |
| MEM-UNIT-004 | Member profile frontmatter includes `location` field when provided | FR21 | Unit | **P1** | `tests/services/member.service.test.ts` |
| MEM-UNIT-005 | Member profile frontmatter includes `location: ""` (empty string) when not provided | FR21 | Unit | **P2** | `tests/services/member.service.test.ts` |
| MEM-UNIT-006 | `MemberService.addFeedback(email)` → resolves from `my-teams/members/` first | FR22, FR23 | Unit | **P0** | `tests/services/member.service.test.ts` |
| MEM-UNIT-007 | `MemberService.addFeedback(email)` → resolves from `my-company/members/` if not in teams | FR23 | Unit | **P1** | `tests/services/member.service.test.ts` |
| MEM-UNIT-008 | `MemberService.addFeedback(email)` — email not found anywhere → auto-creates in `my-company/members/` | FR24 | Unit | **P0** | `tests/services/member.service.test.ts` |
| MEM-UNIT-009 | `MemberService.addMember("not-an-email")` → throws `InvalidEmailError` (TMR_E103) before file write | FR28 | Unit | **P0** | `tests/services/member.service.test.ts` |
| MEM-UNIT-010 | Company-scoped member file references entities using `[[email]]` wiki-link format | FR33 | Unit | **P1** | `tests/services/member.service.test.ts` |
| MEM-UNIT-011 | Team-scoped member file references manager using `[[email]]` wiki-link format | FR33 | Unit | **P1** | `tests/services/member.service.test.ts` |
| MEM-INT-001 | Integration: `tmr member add <email>` → file at `my-company/members/<email>.md` with correct frontmatter keys | FR18, FR21 | Integration | **P0** | `tests/integration/member.integration.test.ts` |
| MEM-INT-002 | Integration: `tmr member add <email> --team backend` → file at `my-teams/members/<email>.md` with manager link | FR19, FR20 | Integration | **P0** | `tests/integration/member.integration.test.ts` |
| MEM-INT-003 | Integration: `tmr member add feedback <email>` — email exists in team → feedback appended to existing file | FR22 | Integration | **P1** | `tests/integration/member.integration.test.ts` |
| MEM-INT-004 | Integration: `tmr member add feedback <email>` — email unknown → auto-create in `my-company/members/` | FR24 | Integration | **P0** | `tests/integration/member.integration.test.ts` |
| MEM-INT-005 | Integration: email lookup is case-insensitive (prevents R-008 duplicate profile) | R-008 | Integration | **P1** | `tests/integration/member.integration.test.ts` |

---

### 3.5 Skill Management (`tmr install`)

**Risk: MEDIUM · FR25–FR27 · R-006, TC-002**

| Test ID | Scenario | FR | Level | Priority | File |
|---------|----------|-----|-------|----------|------|
| SKILL-UNIT-001 | `SkillRegistryService.fetchSkillContent(name)` → HTTPS GET to correct GitHub URL | FR27 | Unit | **P1** | `tests/services/skill-registry.service.test.ts` |
| SKILL-UNIT-002 | `SkillRegistryService` — network timeout (10s) → throws descriptive error | FR27, NFR | Unit | **P0** | `tests/services/skill-registry.service.test.ts` |
| SKILL-UNIT-003 | `SkillRegistryService` — 404 response → throws with skill name in error message | FR25 | Unit | **P0** | `tests/services/skill-registry.service.test.ts` |
| SKILL-UNIT-004 | `SkillRegistryService` — malformed response body → throws without crashing | FR25 | Unit | **P0** | `tests/services/skill-registry.service.test.ts` |
| SKILL-UNIT-005 | `SkillRegistryService` — success → manifest JSON updated with new skill entry | FR25 | Unit | **P1** | `tests/services/skill-registry.service.test.ts` |
| SKILL-CMD-001 | `tmr install` command — registry error → `printError` to stderr, exit code non-zero | FR25, NFR | Unit/Command | **P0** | `tests/commands/install.command.test.ts` |
| SKILL-CMD-002 | `tmr install <skill-name>` — success → `printSuccess` with skill name | FR26 | Unit/Command | **P1** | `tests/commands/install.command.test.ts` |
| SKILL-INT-001 | Integration: install writes `SKILL.md` to correct vault path and updates manifest | FR25 | Integration | **P1** | `tests/integration/install-update.integration.test.ts` |

---

### 3.6 Input Validation & Normalization (Cross-Cutting)

**Risk: HIGH · FR28–FR31 · R-002, R-004**

| Test ID | Scenario | FR | Level | Priority | File |
|---------|----------|-----|-------|----------|------|
| VAL-UNIT-001 | `validateEmail("marco@")` → throws `InvalidEmailError` (TMR_E103) | FR28 | Unit | **P0** | `tests/utils/validation.test.ts` (create if missing) |
| VAL-UNIT-002 | `validateEmail("valid@company.com")` → passes without error | FR28 | Unit | **P0** | `tests/utils/validation.test.ts` |
| VAL-UNIT-003 | `validateEmail("not-an-email")` → throws `InvalidEmailError` | FR28 | Unit | **P0** | `tests/utils/validation.test.ts` |
| VAL-UNIT-004 | `normalizeTeamName("Backend Team")` → `"backend-team"` | FR31 | Unit | **P0** | `tests/utils/normalization.test.ts` (create if missing) |
| VAL-UNIT-005 | `normalizeTeamName("FRONTEND")` → `"frontend"` | FR31 | Unit | **P0** | `tests/utils/normalization.test.ts` |
| VAL-UNIT-006 | `normalizeTeamName("my-team")` → `"my-team"` (idempotent) | FR31 | Unit | **P1** | `tests/utils/normalization.test.ts` |
| VAL-UNIT-007 | `formatWikiLink("joao@company.com")` → `"[[joao@company.com]]"` | FR33 | Unit | **P1** | `tests/utils/wiki-link.test.ts` (create if missing) |
| VAL-UNIT-008 | `formatWikiLink("")` → throws or returns empty string (define contract) | FR33 | Unit | **P2** | `tests/utils/wiki-link.test.ts` |

---

### 3.7 NFR Test Coverage

| Test ID | Scenario | NFR | Level | Priority | File |
|---------|----------|-----|-------|----------|------|
| NFR-PERF-001 | File write operations complete within 500ms in integration tests (assert with `Date.now()`) | NFR-Perf | Integration | **P2** | `tests/integration/init.integration.test.ts` |
| NFR-ERR-001 | No command produces a raw stack trace to stdout or stderr (use `printError` for all errors) | NFR-Reliability | Unit/CLI | **P1** | `tests/cli.test.ts` + per-command tests |
| NFR-ERR-002 | Every unhandled promise rejection in command actions is caught and routed to `printError` | NFR-Reliability | Unit | **P1** | per-command tests |
| NFR-EXIT-001 | `tmr install` registry failure exits with non-zero exit code | NFR-Integration | Integration | **P0** | `tests/integration/install-update.integration.test.ts` |
| NFR-SPIN-001 | `tmr init` skill install step shows `ora` spinner before network call (mock timer assertion) | NFR-Perf (3s) | Unit | **P2** | `tests/commands/init.command.test.ts` |

---

## 4. Test Priorities Summary

| Priority | Count | Criteria | Gate |
|---|---|---|---|
| **P0** | 36 | Blocks core functionality; no workaround | 100% pass required |
| **P1** | 24 | Critical paths; medium/high risk | ≥95% pass required |
| **P2** | 5 | Secondary flows; low/medium risk | ≥80% pass required |
| **P3** | 0 | Nice-to-have (not assigned in this release) | — |

**Total scenarios:** 65

---

## 5. Execution Strategy

### PR Gate (all commits)
Run full Jest suite: `npm run test:coverage`

- All functional tests must pass
- Coverage thresholds must be maintained: Branches ≥60%, Functions/Lines/Statements ≥78%
- Expected runtime: <5 minutes

### Pre-Release Gate
- Run `npm run validate` (lint + typecheck + test + build)
- All P0 tests: 100% pass
- All P1 tests: ≥95% pass
- R-001 through R-006 mitigations verified closed

---

## 6. Resource Estimates

| Tier | Scope | Estimate |
|---|---|---|
| P0 tests (36) | New + modified init, member, team, relationship removal, install, validation | ~30–45 hours |
| P1 tests (24) | Integration breadth, wiki-link, normalization, NFR errors | ~15–25 hours |
| P2 tests (5) | Perf assertions, edge normalization | ~3–6 hours |
| Fixture infrastructure | `initPromptFixture`, member builders, wiki-link utility | ~5–8 hours |
| **Total** | | **~53–84 hours** |

---

## 7. Quality Gates

### Release Gate: PASS / CONCERNS / FAIL

| Condition | Decision |
|---|---|
| Any P0 test failing | FAIL |
| R-001 (partial vault state) unmitigated | FAIL |
| R-002 (email validation gap) unmitigated | FAIL |
| R-003 (relationship still in help) unmitigated | FAIL |
| R-005 (brittle prompt test) unmitigated | CONCERNS |
| R-006 (install silent failure) unmitigated | FAIL |
| P1 pass rate < 95% | CONCERNS |
| Coverage below thresholds | FAIL (CI gate blocks) |
| All P0 pass, R-001–R-003 R-006 mitigated | PASS |

---

## 8. NFR Testability Requirements

### Based on ADR Quality Readiness Checklist

| Criterion | Status | Gap/Requirement | Risk if Unmet |
|---|---|---|---|
| Isolation: Services testable with deps mocked | ✅ Covered | `MockProvider`, injectable `FileSystemService` | N/A |
| Headless: 100% logic via service layer | ✅ Covered | Commands are thin wrappers | N/A |
| State Control: Seeding / temp dirs | ✅ Covered | Real temp dirs in integration tests | N/A |
| Test Data Segregation | ✅ Covered | Temp dirs isolated per test; no shared state | N/A |
| Test Data Generation | ✅ Covered | No prod data; factory patterns used | N/A |
| Teardown/Cleanup | ✅ Covered | `afterAll` temp dir cleanup in integration tests | N/A |
| Security: API keys in tests | ✅ Covered | `MockProvider` only; no real keys in test code | N/A |
| Prompt spinner timing assertion | ⚠️ Gap | Add `Date.now()` timing + `ora` spy assertion | NFR-Perf-001 blocked |
| File write timing assertion | ⚠️ Gap | Add duration measurement in integration tests | NFR-Perf-002 blocked |
| Exit code on install failure | ⚠️ Gap | Assert `process.exitCode !== 0` after install error | NFR-EXIT-001 blocked |

---

## 9. Risk-to-Test Mapping

| Risk ID | Level | Score | Covered By |
|---------|-------|-------|-----------|
| R-001 | HIGH | 6 | INIT-INT-011 (partial vault state) |
| R-002 | HIGH | 6 | INIT-INT-005/006/007, TEAM-INT-002, MEM-UNIT-009, VAL-UNIT-001/002/003 |
| R-003 | HIGH | 6 | REL-NEG-001, REL-NEG-002 |
| R-004 | HIGH | 6 | INIT-INT-013, MEM-UNIT-010/011, VAL-UNIT-007, VAL-UNIT-008 |
| R-005 | HIGH | 6 | INIT-INT-001–013 (via `initPromptFixture` helper) |
| R-006 | HIGH | 6 | SKILL-CMD-001, SKILL-INT-001, NFR-EXIT-001 |
| R-007 | MEDIUM | 4 | MEM-UNIT-001/002/003, MEM-INT-001/002 |
| R-008 | MEDIUM | 4 | MEM-INT-005 (case-insensitive lookup) |
| R-009 | MEDIUM | 4 | MEM-UNIT-004/005, MEM-INT-001/002 |
| R-010 | MEDIUM | 4 | INIT-INT-010 |
| R-011 | LOW | 2 | INIT-INT-012 |
| R-012 | LOW | 2 | INIT-UNIT-003 |

---

## 10. Test File Inventory — New / Modified

| File | Status | Reason |
|---|---|---|
| `tests/integration/init.integration.test.ts` | **Modify** | Add FR3 folder exclusions, wiki-link, location, recovery flows |
| `tests/commands/init.command.test.ts` | **Modify** | Add ora spinner assertion, README generation coverage |
| `tests/services/member.service.test.ts` | **Modify** | Add company/team routing, feedback auto-create, location, wiki-link |
| `tests/integration/member.integration.test.ts` | **Modify** | Add routing integration, case-insensitive lookup |
| `tests/services/team.service.test.ts` | **Modify** | Add normalization, email validation |
| `tests/integration/team.integration.test.ts` | **Modify** | Add normalization + email validation integration |
| `tests/commands/install.command.test.ts` | **Modify** | Verify `node:https` mock present; add error path assertions |
| `tests/integration/install-update.integration.test.ts` | **Modify** | Add timeout, 404, malformed JSON, exit-code scenarios |
| `tests/services/skill-registry.service.test.ts` | **Modify** | Add 404, timeout, malformed response scenarios |
| `tests/cli.test.ts` | **Modify** | Add relationship-absent assertion |
| `tests/commands/relationship.command.test.ts` | **Delete** | Relationship removed |
| `tests/services/relationship.service.test.ts` | **Delete** | Relationship removed |
| `tests/integration/relationship.integration.test.ts` | **Delete** | Relationship removed |
| `tests/utils/validation.test.ts` | **Create** | Email validation unit tests (create if not exists) |
| `tests/utils/normalization.test.ts` | **Create** | Team name normalization unit tests |
| `tests/utils/wiki-link.test.ts` | **Create** | `formatWikiLink()` utility tests |
| `tests/fixtures/init-prompts.ts` | **Create** | Reusable inquirer mock sequences for init scenarios |
