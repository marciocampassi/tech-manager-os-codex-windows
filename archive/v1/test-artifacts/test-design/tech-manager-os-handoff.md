---
title: 'TEA Test Design → BMAD Handoff Document'
version: '1.0'
workflowType: 'testarch-test-design-handoff'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - 'docs/architecture.md'
  - '_bmad-output/project-context.md'
sourceWorkflow: 'testarch-test-design'
generatedBy: 'TEA Master Test Architect'
generatedAt: '2026-04-27'
projectName: 'tech-manager-os'
---

# TEA → BMAD Integration Handoff

## Purpose

This document bridges TEA's test design outputs with BMAD's epic/story decomposition workflow (`create-epics-and-stories`). It provides structured integration guidance so that quality requirements, risk assessments, and test strategies flow into implementation planning.

---

## TEA Artifacts Inventory

| Artifact | Path | BMAD Integration Point |
|---|---|---|
| Architecture & Testability Review | `_bmad-output/test-artifacts/test-design/test-design-architecture.md` | Epic quality gates, tech debt items |
| QA Test Plan | `_bmad-output/test-artifacts/test-design/test-design-qa.md` | Story acceptance criteria, test file assignments |
| This Handoff Document | `_bmad-output/test-artifacts/test-design/tech-manager-os-handoff.md` | BMAD epic/story creation input |

---

## Epic-Level Integration Guidance

### Risk References (P0/P1 — Must Appear as Epic Quality Gates)

| Risk ID | Category | Score | Description | Epic Recommendation |
|---------|----------|-------|-------------|---------------------|
| R-001 | BUS | 6 | `tmr init` partial vault state on write failure | Epic: Init Rework — add "atomic write behavior" quality gate |
| R-002 | BUS | 6 | Email validation missing/inconsistent across commands | Epic: Input Validation — gate: all email inputs validated pre-write |
| R-003 | TECH | 6 | `tmr relationship` not fully removed | Epic: Relationship Removal — gate: negative CLI test passes |
| R-004 | BUS | 6 | Wiki-link format inconsistent across services | Epic: Wiki-Link Output — gate: `formatWikiLink()` utility in use everywhere |
| R-005 | TECH | 6 | Init prompt test sequence brittle | Epic: Init Rework — requires `initPromptFixture` helper before story implementation |
| R-006 | OPS | 6 | `tmr install` fails silently | Epic: Skill Management — gate: non-zero exit on registry failure |

### Quality Gates per Epic

| Epic Area | Quality Gate |
|---|---|
| `tmr init` rework | ✅ INIT-INT-001 (happy path) passes · ✅ INIT-INT-004/005 (validation rejection) passes · ✅ INIT-INT-010 (skill install resilience) passes · ✅ INIT-INT-011 (partial write failure) passes |
| `tmr relationship` removal | ✅ REL-NEG-001 (`--help` absent) passes · ✅ REL-NEG-002 (command unrecognized) passes |
| `tmr team` normalization | ✅ TEAM-UNIT-001/002 (name normalization) passes · ✅ TEAM-UNIT-003 (email rejection) passes |
| `tmr member` restructure | ✅ MEM-UNIT-001/002 (routing) passes · ✅ MEM-UNIT-003 (manager link) passes · ✅ MEM-UNIT-008 (feedback auto-create) passes |
| `tmr install` | ✅ SKILL-CMD-001 (error → non-zero exit) passes · ✅ SKILL-UNIT-002/003/004 (failure modes) pass |
| Input validation | ✅ VAL-UNIT-001/003 (invalid email rejection) pass · ✅ VAL-UNIT-004/005 (normalization) pass |
| Wiki-link output | ✅ VAL-UNIT-007 (`formatWikiLink`) passes · ✅ MEM-UNIT-010/011 (wiki-link in files) pass |

---

## Story-Level Integration Guidance

### P0/P1 Test Scenarios → Story Acceptance Criteria

Each story implementing these areas MUST include the following acceptance criteria derived from P0 test scenarios:

#### Story: `tmr init` — Scaffold + Profile + Leader

| Acceptance Criterion | Derived From |
|---|---|
| `tmr init` creates vault folder structure excluding `/utils` and `/my-teams/feedback-templates` | INIT-UNIT-001 |
| `tmr init` generates `my-career/<email>.md` with correct frontmatter | INIT-UNIT-004 |
| `tmr init` generates `my-leadership/<email>.md` with correct frontmatter | INIT-UNIT-005 |
| Invalid email input is rejected with `ValidationError` before any file is written | INIT-INT-005/006 |
| Vault path defaults to CWD when empty input is submitted | INIT-INT-002 |
| `README.md` exists in vault root after successful init | INIT-INT-012 |

#### Story: `tmr init` — Teams + Members + Skill Install

| Acceptance Criterion | Derived From |
|---|---|
| Team count of 0 is rejected with descriptive error before any file write | INIT-INT-004 |
| Team name with capitals/spaces is normalized to lowercase/kebab-case silently | INIT-INT-009 |
| Invalid team member email is rejected and re-prompted without losing progress | INIT-INT-007 |
| Empty email ends member-add loop for that team | INIT-INT-008 |
| Skill install failure (network error) does NOT abort onboarding | INIT-INT-010 |
| Mid-flow file write failure surfaces `printError` to stderr; no silent partial state | INIT-INT-011 |
| All entity references in generated files use `[[email]]` wiki-link format | INIT-INT-013 |

#### Story: `tmr relationship` Removal

| Acceptance Criterion | Derived From |
|---|---|
| `tmr --help` does not contain the word "relationship" | REL-NEG-001 |
| `tmr relationship` produces "unrecognized command" error | REL-NEG-002 |
| All `tests/commands/relationship.command.test.ts`, `tests/services/relationship.service.test.ts`, `tests/integration/relationship.integration.test.ts` are deleted | REL-NEG-003/004 |

#### Story: `tmr member` Restructure

| Acceptance Criterion | Derived From |
|---|---|
| `tmr member add <email>` (no `--team`) writes to `my-company/members/` | MEM-UNIT-001, MEM-INT-001 |
| `tmr member add <email> --team <name>` writes to `my-teams/members/` with manager link | MEM-UNIT-002/003, MEM-INT-002 |
| `tmr member add feedback <email>` for unknown email auto-creates in `my-company/members/` | MEM-UNIT-008, MEM-INT-004 |
| Invalid email is rejected before any file operation | MEM-UNIT-009 |
| `location` field is present in member profile frontmatter | MEM-UNIT-004 |

#### Story: `tmr install` Skill Management

| Acceptance Criterion | Derived From |
|---|---|
| Registry network failure produces `printError` to stderr and non-zero exit code | SKILL-CMD-001, NFR-EXIT-001 |
| Registry 404 produces descriptive error message naming the skill | SKILL-UNIT-003 |
| Registry timeout after 10s produces error without hanging indefinitely | SKILL-UNIT-002 |

#### Story: Email Validation + Normalization (Cross-Cutting)

| Acceptance Criterion | Derived From |
|---|---|
| `validateEmail()` rejects `"marco@"`, `"not-an-email"`, `""` with `InvalidEmailError` (TMR_E103) | VAL-UNIT-001/003 |
| `normalizeTeamName()` converts `"Backend Team"` → `"backend-team"` | VAL-UNIT-004 |
| `formatWikiLink("email@co.com")` → `"[[email@co.com]]"` | VAL-UNIT-007 |

### Test Infrastructure Required Before Story Implementation

These fixtures/utilities must be created as prerequisite tasks before the stories that depend on them:

| Artifact | Required By | Priority |
|---|---|---|
| `tests/fixtures/init-prompts.ts` — inquirer mock sequence helper | `tmr init` stories | P0 — create first |
| `tests/fixtures/member-profiles.ts` — member data builders | `tmr member` stories | P1 |
| `src/utils/wiki-link.ts` — `formatWikiLink()` utility | All entity-writing services | P1 — create before implementation |
| `tests/utils/wiki-link.test.ts` | Above utility | P1 |

---

## Risk-to-Story Mapping

| Risk ID | Category | P×I | Recommended Story/Epic | Test Level |
|---------|----------|-----|----------------------|-----------|
| R-001 | BUS | 2×3=6 | Epic: Init Rework / Story: Init Scaffold | Integration |
| R-002 | BUS | 2×3=6 | Epic: Input Validation / Story: Email Validation (cross-cutting) | Unit + Integration |
| R-003 | TECH | 2×3=6 | Epic: Relationship Removal / Story: Remove Command | CLI/Regression |
| R-004 | BUS | 3×2=6 | Epic: Wiki-Link Output / Story: formatWikiLink utility | Unit (all services) |
| R-005 | TECH | 3×2=6 | Epic: Init Rework / Story: Init Prompt Fixture (prerequisite) | Unit/Integration |
| R-006 | OPS | 2×3=6 | Epic: Skill Management / Story: Install Command | Integration |
| R-007 | DATA | 2×2=4 | Epic: Member Restructure / Story: Member Routing | Unit |
| R-008 | DATA | 2×2=4 | Epic: Member Restructure / Story: Feedback Auto-Create | Integration |
| R-009 | DATA | 2×2=4 | Epic: Member Restructure / Story: Member Profile Fields | Unit |
| R-010 | OPS | 2×2=4 | Epic: Init Rework / Story: Init Skill Install Resilience | Integration |
| R-011 | BUS | 1×2=2 | Epic: Init Rework / Story: Init README Generation | Unit |
| R-012 | BUS | 1×2=2 | Epic: Init Rework / Story: Init Sample Files | Unit |

---

## Recommended BMAD → TEA Workflow Sequence

1. **TEA Test Design** (`TD`) → this handoff document ✅ *Complete*
2. **BMAD Create Epics & Stories** → consumes this handoff, embeds quality gates and acceptance criteria from §Story-Level Integration Guidance
3. **TEA ATDD** (`AT`) → generates failing acceptance tests per story (P0/P1 scenarios)
4. **BMAD Implementation** → developers implement with test-first guidance
5. **TEA Automate** (`TA`) → expands test coverage for P2/P3 scenarios
6. **TEA Trace** (`TR`) → validates coverage completeness against this QA plan

---

## Phase Transition Quality Gates

| From Phase | To Phase | Gate Criteria |
|---|---|---|
| Test Design | Epic/Story Creation | All P0 risks (R-001–R-006) have documented mitigation strategy |
| Epic/Story Creation | ATDD | Stories have acceptance criteria from §Story-Level Integration Guidance |
| ATDD | Implementation | Failing acceptance tests exist for all P0/P1 scenarios (36 P0 tests red) |
| Implementation | Test Automation | All P0 tests pass; coverage ≥78% maintained |
| Test Automation | Release | Trace matrix shows ≥80% coverage of P0/P1 requirements · `npm run validate` clean |

---

## Architectural Debt to Carry Forward

| Item | Source | Recommendation |
|---|---|---|
| ARCH-DEBT-003: `JEST_WORKER_ID` guard in `cli.ts` | `docs/architecture.md` | Update to `VITEST` when migrating test runner |
| Deprecated `AppConfig.provider` / `AppConfig.apiKey` | `project-context.md` | Remove after all callers migrated; add negative test asserting new fields used |
