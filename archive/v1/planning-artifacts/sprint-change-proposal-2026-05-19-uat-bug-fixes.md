# Sprint Change Proposal — UAT Bug Fixes

| Field | Value |
|---|---|
| **Proposal ID** | SCP-2026-05-19-UAT |
| **Date** | 2026-05-19 |
| **Raised by** | Filipe (UAT Tester) |
| **Reviewed by** | Marlon |
| **Status** | Approved |
| **Change Scope** | Minor — Direct implementation by Developer agent |

---

## Section 1: Issue Summary

During UAT session on 2026-05-18/19, a systematic end-to-end test of the `tech-manager-os` CLI (v1.0.0) against a real vault identified **4 confirmed bugs**. All four are gaps in the implementation of existing, fully specified requirements (FRs). No new requirements were discovered — the PRD and epics already contain the expected behaviour; it simply was not coded.

The full evidence is documented in:
- `_bmad-output/implementation-artifacts/uat-bug-report.md`
- `_bmad-output/implementation-artifacts/uat-summary-report.md`

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Status before | Impact | Action |
|---|---|---|---|
| Epic 2 — tmr init Rework | done | Story 2.4 did not implement FR37 (`deps.yaml` creation) | Add corrective Story 8.2 |
| Epic 3 — Team & Member Management | done | Story 3.2 did not implement FR41/FR42 (domain check + contractor routing) | Add corrective Story 8.3 |
| Epic 4 — Skill Ecosystem Access | done | Story 4.1 did not publish `tmr-project-impact` to the registry | Add corrective Story 8.4 |
| Test Infrastructure | cross-cutting | `jest-md-transformer.cjs` exists but not wired into `jest.config.ts` — 9 test suites fail | Add corrective Story 8.1 |

No epics are invalidated. No existing stories need to be rolled back. No MVP scope changes.

### Artifact Conflicts

| Artifact | Conflict | Resolution |
|---|---|---|
| PRD / epics.md | None — FRs already defined | No changes needed |
| Architecture | None — patterns already specified | No changes needed |
| UX Specs | N/A — CLI tool | N/A |
| `jest.config.ts` | Missing `.md` transform rule | Updated in Story 8.1 |

### Technical Impact

- **BUG-002** fix is a 1-line config change with zero logic risk.
- **BUG-003** fix is additive only — writes one additional file, no existing logic touched.
- **BUG-001** fix modifies routing logic in `MemberService` — medium risk, requires care to preserve internal-domain happy path.
- **BUG-004** fix is a registry data change — updates `skills/index.json`, no service logic changes.

---

## Section 3: Recommended Approach

**Direct Adjustment (Option 1)** — Add a new **Epic 8: UAT Bug Fixes** with 4 corrective stories, one per confirmed bug. This approach:

- Maintains full traceability between bugs, FRs, and stories
- Does not disrupt in-progress Epics 6 and 7
- Can be implemented and verified independently of AI-pipeline features
- Closes all 4 gaps before next release

**Effort estimate:** Low–Medium overall
**Risk:** Low — three of the four fixes are isolated and additive; only Story 8.3 modifies existing routing logic and is scoped to `MemberService`

---

## Section 4: Detailed Change Proposals

### Story 8.1 — Wire jest-md-transformer.cjs into jest.config.ts

**Trigger:** BUG-002

| Field | Detail |
|---|---|
| **FR** | Test infrastructure (no FR, infra) |
| **File** | `jest.config.ts` |
| **Change** | Add `'\\.md$': '<rootDir>/jest-md-transformer.cjs'` to the `transform` block |
| **Test** | Run `npm test` — all 9 previously failing suites must load and execute |
| **Risk** | Minimal — isolated config change |
| **Effort** | XS |

**Before:**
```typescript
transform: {
  '^.+\\.tsx?$': ['ts-jest', { ... }],
},
```

**After:**
```typescript
transform: {
  '^.+\\.tsx?$': ['ts-jest', { ... }],
  '\\.md$': '<rootDir>/jest-md-transformer.cjs',
},
```

---

### Story 8.2 — Scaffold stub deps.yaml when tmr project add runs

**Trigger:** BUG-003 — FR37 not implemented

| Field | Detail |
|---|---|
| **FR** | FR37 |
| **File** | `src/services/project.service.ts` |
| **Change** | Write `deps.yaml` stub (`dependencies: []`) inside the new project directory |
| **Test** | `tests/services/project.service.test.ts` — assert `deps.yaml` exists with correct content after `addProject()` |
| **Risk** | Low — additive write only |
| **Effort** | S |

**Acceptance criteria:**
- After `tmr project add "My Project"`, the directory `my-company/projects/my-project/` contains `deps.yaml`
- `deps.yaml` content: `dependencies: []` (valid YAML stub)
- `/tmr-project-impact` can be invoked without any manual file creation step

---

### Story 8.3 — Implement domain check and contractor routing in MemberService

**Trigger:** BUG-001 — FR41 and FR42 not implemented

| Field | Detail |
|---|---|
| **FR** | FR41, FR42 |
| **Files** | `src/services/member.service.ts`, `src/commands/member.command.ts` |
| **Change** | Check email domain against `config/organization.yaml`; prompt for routing on external domains; respect `--contractor` flag |
| **Test** | `tests/services/member.service.test.ts` — 3 new cases (external+prompt, external+flag, internal+no-prompt) |
| **Risk** | Medium — modifies routing logic; must not break internal-domain happy path |
| **Effort** | M |

**Logic:**
1. Read `config/organization.yaml` → get internal domains list
2. If email domain NOT in list AND `--contractor` flag NOT set → prompt user for routing
3. If `--contractor` flag set → route directly to `my-company/contractors/members/`, no prompt
4. Contractor profiles: `contractor: true` + `company: <domain>` in frontmatter (FR42)

**Acceptance criteria:**
- `tmr member add external@partner.com` → prompts "Route as: [1] Contractor [2] Company member"
- `tmr member add external@partner.com --contractor` → no prompt, creates `my-company/contractors/members/external@partner.com.md` with `contractor: true`
- `tmr member add alice@gmail.com` (domain in org.yaml) → no prompt, normal routing
- Contractor profile frontmatter includes `contractor: true` and `company: partner.com`

---

### Story 8.4 — Publish tmr-project-impact to the official skill registry

**Trigger:** BUG-004 — FR25/FR27 partially implemented

| Field | Detail |
|---|---|
| **FR** | FR25, FR27 |
| **Files** | `skills/index.json`, skill manifest for `tmr-project-impact` |
| **Change** | Add `tmr-project-impact` entry to registry index with a proper semantic version (≥ 1.0.0) |
| **Test** | `tests/services/skill-registry.service.test.ts` — `tmr update` resolves `tmr-project-impact` without error |
| **Risk** | Low — registry data change, no service logic changes |
| **Effort** | S |

**Acceptance criteria:**
- `tmr update` output shows `✔ tmr-project-impact` updated (or already up to date)
- `skills/index.json` contains entry for `tmr-project-impact` with version ≥ 1.0.0
- `tmr install tmr-project-impact` also resolves correctly

---

## Section 5: Implementation Handoff

**Scope classification:** Minor — all 4 stories are direct implementations of already-specified FRs with no architectural decisions required.

**Handoff:** Developer agent (`bmad-dev-story`)

**Implementation order (recommended):**

| Order | Story | Reason |
|---|---|---|
| 1st | 8.1 — Jest transformer | Unblocks test suite; all other stories benefit from passing tests |
| 2nd | 8.2 — deps.yaml | Lowest risk, easiest win |
| 3rd | 8.4 — Registry publish | Data-only change, no logic risk |
| 4th | 8.3 — Domain routing | Highest risk story; implement last so full test suite is green first |

**Success criteria:**
- `npm test` passes with 0 suite failures
- `tmr project add` always creates `deps.yaml` in new project directories
- `tmr member add <external-email>` prompts for routing; `--contractor` flag bypasses prompt
- `tmr update` resolves all 3 skills (`tmr-inbox`, `tmr-myself-config`, `tmr-project-impact`) without error

---

*Generated by bmad-correct-course · 2026-05-19*
