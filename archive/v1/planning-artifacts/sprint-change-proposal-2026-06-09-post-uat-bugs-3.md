# Sprint Change Proposal — Post-UAT Bug Fixes & Polish (Round 3)

**Date:** 2026-06-09  
**Prepared by:** Developer Agent (Correct Course workflow)  
**Status:** Approved

---

## Section 1: Issue Summary

### Problem Statement

Four bugs and improvements identified during active development and manual QA of the post-UAT codebase:

**Bug A — `tmr init` asks company domain twice:**  
After the user provides their email, `promptAdditionalDomains()` displays the inferred domain and asks for extras. Immediately after, `promptRoleAndCompany()` asks "Your company / domain (e.g. acme.com)" — a redundant question covering the same concept under a different label.

**Bug B — `my-career` performance-review written to wrong path:**  
`MyselfService.addPerformanceReview()` writes to `my-career/<YYYY-MM>-performance-review-<email>.md` (flat). The file should be placed under `my-career/performance-reviews/` to match the typed-subdirectory convention used by every other entity scope. Additionally, `VAULT_DIRS` in `init.service.ts` does not include `my-career/performance-reviews`, so the directory is never created during scaffold.

**Bug C — Email similarity confirmation does nothing:**  
`warnIfSimilarEmail()` is duplicated verbatim in all four command files (`member`, `leadership`, `team`, `project`). When the user confirms "yes, I meant the similar email," the caller receives `false` and returns immediately — nothing happens. Expected: the command continues using the found (corrected) email. Secondary issue: the function is a copy-paste violation; it must be a shared utility.

**Enhancement D — Obsidian open hint in `postInitSummary`:**  
Step 1 of the post-init next-steps summary says "Open `<path>` in Obsidian" but gives no actionable command. Users must manually open Obsidian and navigate. A platform-specific CLI hint makes onboarding faster.

### Discovery Context

All four issues were identified during manual testing of the post-UAT v2 codebase (Epic 9 scope, following sprint-change-proposal-2026-06-04-v2-post-uat-bugs.md).

### Evidence

| # | Location | Root Cause |
|---|----------|------------|
| A | `onboarding.prompts.ts` `promptRoleAndCompany()` | `company` field asks for domain already inferred from email |
| B | `myself.service.ts:76` + `init.service.ts:VAULT_DIRS` | `path.join(careerRoot, fileName)` — no `performance-reviews/` segment; subdirectory never scaffolded |
| C | All 4 `*.command.ts` files | `warnIfSimilarEmail` returns `false` on confirm → caller `if (!shouldContinue) return` → silent exit |
| D | `init.service.ts` `printPostInitSummary()` | Step 1 message lacks platform-specific open command |

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Impact |
|------|--------|
| **Epic 2** (`tmr init`) | Bug A and Enhancement D are in the init flow. No spec change — implementation fix only. |
| **Epic 9** (UAT Pre-Launch Polish) | [!] Four corrective stories (9.22–9.25) added. |
| **Story 9.16** (`myself add performance-review`) | [!] Bug B changes the output path and wiki-link format. Test coverage needs updating. |
| **Story 9.8** (email-similarity-warning) | [!] Bug C supersedes the original implementation. Shared utility replaces duplicated guards. |
| **All other epics** | [N/A] |

### Story Impact

| Story | Impact |
|-------|--------|
| Story 9.3 (`my-career` flat structure) | [x] Flat rule preserved — only the profile `<email>.md` stays flat; typed subdirs are now allowed |
| Story 9.4 (organization.yaml + domain inference) | [x] Bug A fix aligns prompt flow more tightly with the already-inferred domain from Story 9.4 |
| Stories 9.1–9.15, 9.17–9.21 | [N/A] — not affected |

### Artifact Conflicts

| Artifact | Conflict | Resolution |
|----------|----------|------------|
| `epics.md` | Stories 9.22–9.25 missing | Append all four to Epic 9 |
| `sprint-status.yaml` | Stories 9.22–9.25 missing | Append with status `backlog` |
| `project-context.md` | No rule against duplicated interactive guards | Add anti-pattern rule |

### Technical Impact

| Component | Change |
|-----------|--------|
| `src/workflows/onboarding.prompts.ts` | Remove `company` field from `promptRoleAndCompany`; update `RoleAndCompanyAnswers` interface |
| `src/commands/init.command.ts` | Derive `company` from `inferredDomain` instead of prompt answer |
| `src/services/init.service.ts` | Add `my-career/performance-reviews` to `VAULT_DIRS`; update `printPostInitSummary` step 1 |
| `src/services/myself.service.ts` | Write to `my-career/performance-reviews/<file>.md`; update wiki-link path |
| `src/utils/email-guard.ts` | **New file** — `resolveEmailWithSimilarCheck()` shared utility |
| `src/commands/member.command.ts` | Remove local guard; import + use `resolveEmailWithSimilarCheck` |
| `src/commands/leadership.command.ts` | Remove local guard; import + use `resolveEmailWithSimilarCheck` |
| `src/commands/team.command.ts` | Remove local guard; import + use `resolveEmailWithSimilarCheck` |
| `src/commands/project.command.ts` | Remove local guard; import + use `resolveEmailWithSimilarCheck` |
| `_bmad-output/project-context.md` | Add anti-pattern rule for duplicated interactive guard functions |

---

## Section 3: Recommended Approach

**Selected approach: Direct Adjustment (Option 1)**

All four changes are self-contained implementation fixes. No PRD goals are affected, no architectural changes are needed, and MVP scope is unchanged. Four corrective stories added to Epic 9 are sufficient.

**Rationale:**
- **Effort:** Low — Bug A is a one-line removal; Bug B is a path change + one VAULT_DIR entry; Bug C is a shared utility extraction; Enhancement D is a string update
- **Risk:** Low — no new architecture, no new dependencies, no behavioral changes for happy paths
- **Timeline:** Minimal — all four completable within the current sprint
- **MVP:** Unaffected — all features were in scope and correctly spec'd; only implementations need correction

---

## Section 4: Detailed Change Proposals

---

### Story 9.22: Remove duplicate company domain prompt from `tmr init`

**As a user running `tmr init`,**  
I want to be asked about my company domain only once,  
So that the setup flow is concise and not confusing.

#### Change Proposals

**`src/workflows/onboarding.prompts.ts` — remove `company` from `promptRoleAndCompany`:**

```typescript
// OLD:
export interface RoleAndCompanyAnswers {
  role: string;
  company: string;
}

export async function promptRoleAndCompany(): Promise<RoleAndCompanyAnswers> {
  return inquirer.prompt<RoleAndCompanyAnswers>([
    { type: 'input', name: 'role', message: 'Your current role / title:', ... },
    { type: 'input', name: 'company', message: 'Your company / domain (e.g. acme.com):', ... },
  ]);
}

// NEW:
export interface RoleAndCompanyAnswers {
  role: string;
}

export async function promptRoleAndCompany(): Promise<RoleAndCompanyAnswers> {
  return inquirer.prompt<RoleAndCompanyAnswers>([
    { type: 'input', name: 'role', message: 'Your current role / title:', ... },
  ]);
}
```

**`src/commands/init.command.ts` — derive `company` from `inferredDomain`:**

```typescript
// OLD:
const roleCompany = await promptRoleAndCompany();
const answers: { name: string; email: string; role: string; company: string } = {
  ...nameEmail,
  ...roleCompany,
};

// NEW:
const roleCompany = await promptRoleAndCompany();
const answers: { name: string; email: string; role: string; company: string } = {
  ...nameEmail,
  ...roleCompany,
  company: inferredDomain,
};
```

#### Acceptance Criteria

**Given** user runs `tmr init` and provides their work email  
**When** the prompt sequence runs  
**Then** the company domain question ("Your company / domain") does NOT appear  
**And** `company` in the config is set to the domain inferred from the user's email  
**And** all downstream uses of `answers.company` (CLAUDE.md, config store) receive the correct inferred domain

#### Files Modified

- `src/workflows/onboarding.prompts.ts`
- `src/commands/init.command.ts`

---

### Story 9.23: `my-career` performance-review subfolder

**As a user running `tmr myself add performance-review`,**  
I want the performance review file created under `my-career/performance-reviews/`,  
So that `my-career/` stays clean and follows the same typed-subdirectory convention as all other entity scopes.

#### Change Proposals

**`src/services/init.service.ts` — add to `VAULT_DIRS`:**

```typescript
// Add after 'my-career':
'my-career/performance-reviews',
```

**`src/services/myself.service.ts` — update output path and wiki-link:**

```typescript
// OLD:
const filePath = path.join(careerRoot, fileName);
const wikiLink = `- [[${fileName}]]`;

// NEW:
const filePath = path.join(careerRoot, 'performance-reviews', fileName);
const wikiLink = `- [[performance-reviews/${fileName}]]`;
```

#### Acceptance Criteria

**Given** `tmr init` runs  
**When** vault is scaffolded  
**Then** `my-career/performance-reviews/` directory exists

**Given** user runs `tmr myself add performance-review`  
**When** the command succeeds  
**Then** the file is written to `my-career/performance-reviews/YYYY-MM-performance-review-<email>.md`  
**And** the wiki-link appended to the self-profile reads `[[performance-reviews/YYYY-MM-performance-review-<email>.md]]`  
**And** `my-career/<email>.md` (the self-profile) remains flat and unaffected

#### Files Modified

- `src/services/init.service.ts`
- `src/services/myself.service.ts`

---

### Story 9.24: Email similarity guard — shared utility and use-found-email fix

**As a user adding a member/leader/team-member/project stakeholder,**  
I want the "did you mean X?" prompt to actually use the found email when I confirm it,  
So that I don't need to re-run the command with the corrected email.

#### Change Proposals

**New file `src/utils/email-guard.ts`:**

```typescript
import inquirer from 'inquirer';
import { findSimilarEmail } from './email-similarity.js';
import { printWarning } from './display.js';

/**
 * Checks for a similar email in the vault. If found, prompts the user to
 * confirm whether they meant the existing email or want to continue with
 * the typed one. Returns the email to use — either the similar one or the
 * original. Never aborts; the caller always gets a valid email back.
 */
export async function resolveEmailWithSimilarCheck(
  email: string,
  workspaceRoot: string,
): Promise<string> {
  const similar = findSimilarEmail(email, workspaceRoot);
  if (!similar) return email;

  printWarning(`Similar email already exists: ${similar}`);
  const { useSimilar } = await inquirer.prompt<{ useSimilar: boolean }>([
    {
      type: 'confirm',
      name: 'useSimilar',
      message: `Did you mean "${similar}"? (Y = use "${similar}", N = continue with "${email}")`,
      default: false,
    },
  ]);
  return useSimilar ? similar : email;
}
```

**All 4 command files — remove local `warnIfSimilarEmail` + `findSimilarEmail` import. Replace with:**

```typescript
import { resolveEmailWithSimilarCheck } from '../utils/email-guard.js';
```

**All standard call sites (member, leadership, team, project):**

```typescript
// OLD:
const shouldContinue = await warnIfSimilarEmail(email, ws);
if (!shouldContinue) return;

// NEW:
email = await resolveEmailWithSimilarCheck(email, ws);
```

**`project.command.ts` batch loops (2 places):**

```typescript
// OLD:
for (const email of emails) {
  const shouldContinue = await warnIfSimilarEmail(email, ws);
  if (shouldContinue) filteredEmails.push(email);
}

// NEW:
for (const rawEmail of emails) {
  filteredEmails.push(await resolveEmailWithSimilarCheck(rawEmail, ws));
}
```

#### Acceptance Criteria

**Given** user types a near-miss email (e.g. `jhon@company.com`) and `john@company.com` exists  
**When** the similar-email prompt appears and user answers Y  
**Then** the command continues using `john@company.com` (the found email)  
**And** the file or profile is created for `john@company.com`, not `jhon@company.com`

**Given** user answers N to the similar-email prompt  
**When** the command continues  
**Then** it proceeds with the originally typed email unchanged

**Given** no similar email exists  
**When** any add command runs  
**Then** no prompt appears and the command proceeds normally

**Given** a developer adds a new interactive email guard in a command file  
**When** the guard logic is needed in more than one command  
**Then** the shared function in `src/utils/email-guard.ts` MUST be used (enforced by project-context rule)

#### Files Modified

- `src/utils/email-guard.ts` *(new)*
- `src/commands/member.command.ts`
- `src/commands/leadership.command.ts`
- `src/commands/team.command.ts`
- `src/commands/project.command.ts`

---

### Story 9.25: Obsidian open hint in post-init summary

**As a user who just ran `tmr init`,**  
I want the next-steps summary to show me a copy-pasteable command to open the vault in Obsidian,  
So that I can get into Obsidian immediately without manual navigation.

#### Change Proposal

**`src/services/init.service.ts` — update step 1 in `printPostInitSummary`:**

```typescript
// OLD:
`  1. Open ${vaultPath} in Obsidian — plugins are ready`,

// NEW:
`  1. Open this vault in Obsidian:`,
`       macOS/Linux → run: open -a Obsidian "${vaultPath}"`,
`       Windows     → run: start "" "obsidian://${vaultPath}"`,
`       Or open Obsidian and navigate to: ${vaultPath}`,
```

#### Acceptance Criteria

**Given** `tmr init` completes successfully  
**When** the post-init summary is printed  
**Then** step 1 includes a platform-specific command to open the vault in Obsidian  
**And** the vault path is embedded in the command string  
**And** a manual fallback instruction is included for cases where the CLI command is unavailable

#### Files Modified

- `src/services/init.service.ts`

---

## Section 5: Implementation Handoff

**Change scope classification: Minor**

All four stories are self-contained, surgical fixes with no cross-service dependencies. The Developer agent can implement directly.

**Handoff recipient:** Developer agent

**Deliverables:**

| Story | Deliverable |
|-------|-------------|
| 9.22 | `promptRoleAndCompany` no longer asks for company; `answers.company` = inferred domain |
| 9.23 | `my-career/performance-reviews/` created on scaffold; `tmr myself add performance-review` writes there |
| 9.24 | `src/utils/email-guard.ts` created; all 4 command files use it; confirming similar email continues with it |
| 9.25 | `printPostInitSummary` step 1 shows platform-specific Obsidian open commands |

**Success criteria:**
1. `tmr init` — company domain prompt appears exactly once
2. `tmr myself add performance-review` — file lands in `my-career/performance-reviews/`
3. `tmr member add jhon@co.com` (when `john@co.com` exists, user says Y) — creates/updates for `john@co.com`
4. `tmr init` post-summary — step 1 shows `open -a Obsidian` / `start "" "obsidian://"` commands

---

*Workflow: bmad-correct-course | Correct Course workflow complete — routed to Developer agent.*
