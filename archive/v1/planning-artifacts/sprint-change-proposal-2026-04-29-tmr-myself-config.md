# Sprint Change Proposal — tmr-myself-config & Contractor Support

**Project:** tech-manager-os
**Date:** 2026-04-29
**Sprint Status at Change:** Epic 1 in-progress (Story 1.1 done; Stories 1.2–1.4 backlog). Epics 2–5 fully backlog.
**Change Scope:** Moderate — new Epic 6, targeted additions to backlog stories in Epics 2 and 3
**Routed To:** Developer agent (Epic 2/3 AC additions — backlog, no rework); Skill author (Epic 6 — skill document)

---

## Section 1: Issue Summary

### Problem Statement

Two related gaps identified from real-world vault usage:

**Gap 1 — No self-profile commands after init.** `tmr init` creates `my-career/<email>.md` with only name, email, and role. There are no post-init commands or skills to enrich the profile with working style, projects, team context, or AI communication preferences. This leaves AI skills (`/tmr-inbox`, `/tmr-project-impact`) operating without user context, producing generic rather than assertive responses.

**Gap 2 — No contractor concept in the vault.** All people are either direct reports (`my-teams/members/`) or company contacts (`my-company/members/`). There is no place for contractors, embedded agency staff, or external collaborators. Managers at consultancies, hybrid organizations, or companies using contractors have no structured way to track these relationships.

### Context

Both gaps were identified by Marlon during real-world daily usage of the vault. The contractor gap is especially acute for engineering managers at consultancies and agencies, where the majority of people they interact with may be external to their organization.

**`tmr-myself-config` as a skill (not a CLI command):** After evaluating the complexity of the adaptive questionnaire — which must handle product managers, people managers, hybrid scenarios, contractors, and multiple company types — a Claude Code skill is the correct implementation. The conversational nature of the problem is a better fit for natural language interaction than rigid inquirer branching. The skill is auto-installed during `tmr init`, consistent with `tmr-inbox` and `tmr-project-impact`.

### Discovery

Identified by Marlon from direct daily usage on 2026-04-29, during planning for the broader vault expansion.

---

## Section 2: Impact Analysis

### Epic Impact

| Epic | Impact |
|------|--------|
| Epic 1 (Shared Utilities & Relationship Removal) | None — Stories 1.2–1.4 unaffected |
| Epic 2 (tmr init Rework) | **AC additions** to Stories 2.1, 2.2, 2.4 — all backlog, zero rework |
| Epic 3 (Team & Member Management) | **AC addition** to Story 3.2 — backlog, zero rework |
| Epics 4–5 | None |
| **Epic 6 (new)** | New epic: `tmr-myself-config` skill + update mode. Placed after Epic 4. |

### Story Impact

| Story | Change Type | Detail |
|-------|-------------|--------|
| 2.1 Vault Scaffold | AC addition | Add `my-company/contractors/members/` to folder structure (FR38); add `## Manager Context` placeholder to `CLAUDE.md` template (FR44) |
| 2.2 User Profile & Leader Prompts | AC addition | Write `config/organization.yaml` with user's email domain after profile collection (FR39); optional prompt for additional internal domains (FR40) |
| 2.4 Sample Files, Skill Install, README | AC addition | Install `tmr-myself-config` alongside `tmr-inbox` and `tmr-project-impact` (FR43); update post-init next-steps to recommend `/tmr-myself-config` as Step 1 (FR45) |
| 3.2 Company-Scoped vs Team-Scoped Member Routing | AC addition | Domain-based routing check against `config/organization.yaml`; external domains prompt for contractor vs. company routing; `--contractor` flag as explicit override (FR41, FR42) |
| **6.1 NEW** — `tmr-myself-config` Setup Flow | New story | Full adaptive questionnaire skill: BOOTSTRAP → ARCHETYPE → BASE-CONTEXT → PRODUCT/PEOPLE branches → CONTRACTOR-CHECK → CONFIRM → WRITE (FR46) |
| **6.2 NEW** — `tmr-myself-config update` | New story | Delta review mode: reads current enriched state, asks what changed (priorities, team, projects, contractors), merges updates (FR47) |

### Artifact Conflicts

| Artifact | Change |
|----------|--------|
| `_bmad-output/planning-artifacts/prd.md` | Add FRs 38–47; update FR13, FR36, FR13 Must-Have; add Contractor Management and Self Profile sections |
| `_bmad-output/planning-artifacts/epics.md` | Add FRs to inventory; update coverage map; update Stories 2.1/2.2/2.4/3.2 ACs; add Epic 6 with Stories 6.1/6.2 |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Add Epic 6 entries |
| `docs/architecture.md` | Note contractor routing via `config/organization.yaml` in MemberService section |
| `docs/TMR-MYSELF-CONFIG-SKILL.md` | New file — skill design document |

### Technical Impact

**Contractor support (CLI changes):**
- `MemberService.addMember()` reads `<vault>/config/organization.yaml` to check email domain
- External domain → confirmation prompt: "Route to contractors or company members?"
- `--contractor` flag bypasses domain check and routes directly
- Contractor profiles: same frontmatter structure as `my-company/members/` plus `contractor: true` and `company: <their org>` fields
- `InitService` writes `config/organization.yaml` during init (Story 2.2)

**`tmr-myself-config` (skill only — no CLI TypeScript changes):**
- Single skill document: `docs/TMR-MYSELF-CONFIG-SKILL.md`
- Added to `tmr init` auto-install list in `SkillRegistryService` (same pattern as existing skills)
- No new TypeScript services, commands, or tests
- CLAUDE.md `## Manager Context` placeholder written by `InitService` (Story 2.1 template update)

---

## Section 3: Recommended Approach

**Option selected: Direct Adjustment**

All affected stories (2.1, 2.2, 2.4, 3.2) are backlog — zero implementation started. Changes are additive. Epic 6 is new, not a restructuring of existing epics. No rollback required anywhere.

| Dimension | Assessment |
|-----------|------------|
| Effort | Medium — contractor routing is new logic; skill document is significant authoring work |
| Risk | Low for CLI changes (follow established MemberService patterns); Low-Medium for skill (prompts can be iterated without code changes) |
| Timeline impact | Minor — Epic 6 placed after Epic 4, non-blocking for Epics 1–5 |
| Maintainability | High — skill is a Markdown prompt file, updatable without releases |

---

## Section 4: Detailed Change Proposals

### New FRs — Contractor Support

**FR38:** Vault scaffold includes `my-company/contractors/members/` directory, created during `tmr init` alongside all other folders.

**FR39:** After collecting the user's email during `tmr init`, the system writes `<vault>/config/organization.yaml` with the user's email domain as the initial internal domain entry:
```yaml
internal_domains:
  - techcorp.com
```

**FR40:** `tmr init` optionally prompts: *"Any other email domains belong to your organization? (press Enter to skip)"* — each entered domain is appended to `config/organization.yaml`. The user can skip this prompt entirely.

**FR41:** `tmr member add <email>` checks the email domain against `config/organization.yaml`:
- Internal domain → routes to `my-company/members/` (existing behavior)
- External domain → prompts: *"[email] looks external ([domain]). Route to: [c]ontractors or [m]embers?"* — default is contractors
- `--contractor` flag bypasses domain detection and routes directly to `my-company/contractors/members/` without prompting

**FR42:** Contractor profiles written to `my-company/contractors/members/<email>.md` use the same Markdown template as `my-company/members/` with two additional frontmatter fields: `contractor: true` and `company: <their organization name>` (prompted during member add when routing to contractors).

---

### New FRs — `tmr-myself-config` Skill

**FR43:** `tmr init` auto-installs the `tmr-myself-config` skill during onboarding via `SkillRegistryService`, alongside `tmr-inbox` and `tmr-project-impact`. Install failure is logged but does not abort onboarding.

**FR44:** The default `CLAUDE.md` template written during `tmr init` (Story 2.1) includes a `## Manager Context` placeholder section:
```markdown
## Manager Context

<!-- Run /tmr-myself-config in Claude Code to populate this section with your
     working style, projects, team, and priorities. This enables AI skills to
     give you assertive, personalized responses. -->
```

**FR45:** `tmr init` post-init next-steps summary (FR13 update) includes as its first step:
> *"Step 1: Run `/tmr-myself-config` in Claude Code to personalize AI responses with your working style, projects, and team context."*

**FR46:** `/tmr-myself-config` (setup mode) conducts a full adaptive questionnaire:
- BOOTSTRAP: reads `my-career/`, `my-leadership/`, `my-teams/members/`, `my-company/projects/`, `config/organization.yaml` before asking questions
- ARCHETYPE: determines manager type (product / people / hybrid) via single branching question
- BASE-CONTEXT: collects company name, working style, technical background, current priorities, AI communication format preference
- PRODUCT-BRANCH (product/hybrid): collects owned products — name, description, status, tech stack, team members per product
- PEOPLE-BRANCH (people/hybrid): collects direct reports (shows existing, asks for additions) + client/project assignment per report + regular collaborators
- CONTRACTOR-CHECK: for every collected email, cross-checks against `config/organization.yaml`; external domains prompt for contractor classification
- CONFIRM: presents full summary of planned writes before any file is touched
- WRITE: writes enriched `my-career/<email>.md` (merge), updated `CLAUDE.md ## Manager Context` (section-level merge), scaffolded project files (full `<name>-project.md` + `deps.yaml`), new member/contractor profiles with wiki-links

**FR47:** `/tmr-myself-config update` (update mode) conducts a lightweight delta review:
- BOOTSTRAP: reads current enriched state from `my-career/<email>.md` and `CLAUDE.md`
- Presents summary of current context: priorities, team, projects, contractors
- Asks section-by-section: "Any changes to your priorities?" / "Anyone joined or left your team?" / "Any projects wrapped up or new ones started?" / "Any contractor changes?"
- Skips unchanged sections entirely
- Merges only changed sections using the same non-destructive merge strategy as setup

---

### Story 2.1 AC Additions

```
Given InitService creates the folder structure
When the scaffold completes
Then my-company/contractors/members/ is created (FR38)

Given the CLAUDE.md is written to the vault root
When its content is inspected
Then it includes a ## Manager Context placeholder section with a CTA to run
/tmr-myself-config (FR44)
```

### Story 2.2 AC Additions

```
Given InitService collects the user's email during the profile prompt
When the profile file is written to my-career/
Then config/organization.yaml is written to the vault root with the user's
email domain under internal_domains: (FR39)

Given InitService has written config/organization.yaml
When the optional domain prompt is displayed
Then the user can enter zero or more additional internal domains; each is
appended to internal_domains: in config/organization.yaml; empty input
skips the step (FR40)
```

### Story 2.4 AC Additions

```
Given InitService installs tmr-myself-config via SkillRegistryService
When the network call succeeds
Then the skill is written to <workspace>/.claude/skills/tmr-myself-config/ (FR43)

Given InitService installs tmr-myself-config via SkillRegistryService
When the network call fails
Then the error is logged but onboarding continues (FR43)

Given InitService completes all steps
When the post-init summary is printed
Then Step 1 of the summary directs the user to run /tmr-myself-config in
Claude Code for AI personalization (FR45)
```

### Story 3.2 AC Additions

```
Given tmr member add external@agency.com is run (domain not in
config/organization.yaml internal_domains)
When MemberService checks the domain
Then the user is prompted: "external@agency.com looks external. Route to:
[c]ontractors or [m]embers?" with contractors as the default (FR41)

Given the user selects contractors at the routing prompt
When MemberService writes the profile
Then it is written to my-company/contractors/members/external@agency.com.md
with contractor: true and company: <prompted company name> fields (FR42)

Given tmr member add external@agency.com --contractor is run
When MemberService processes the flag
Then it routes directly to my-company/contractors/members/ without any
domain-check prompt (FR41)

Given tmr member add internal@techcorp.com is run (domain in internal_domains)
When MemberService checks the domain
Then it routes to my-company/members/ with no additional prompts (existing
FR18 behavior, unaffected)
```

### Story 6.1 — `tmr-myself-config` Setup Flow

```
As an engineering manager running /tmr-myself-config for the first time,
I want a guided adaptive conversation that learns my role, working style,
products, and team,
So that my profile is enriched and every AI skill in my vault gives
assertive, personalized responses.

ACs:
- docs/TMR-MYSELF-CONFIG-SKILL.md authored and registered in the skill registry
- BOOTSTRAP reads my-career/, my-leadership/, my-teams/members/,
  my-company/projects/, config/organization.yaml before prompting
- ARCHETYPE question branches correctly to PRODUCT-BRANCH, PEOPLE-BRANCH, or both
- BASE-CONTEXT collects company, working_style, background, priorities,
  ai_communication_style for all archetypes
- PRODUCT-BRANCH collects owned products with description, status, tech,
  and per-product team members
- PEOPLE-BRANCH shows existing direct reports, asks for additions, collects
  per-person project assignment, and asks for additional collaborators
- CONTRACTOR-CHECK cross-references every collected email against
  config/organization.yaml; external domains prompt for contractor classification
- CONFIRM presents full summary of planned writes before any file is touched;
  user can edit or cancel
- WRITE outputs: enriched my-career/<email>.md (merge), CLAUDE.md
  ## Manager Context (section-level replace), project folders with full
  <name>-project.md + deps.yaml, member/contractor profiles with wiki-links
```

### Story 6.2 — `tmr-myself-config update` Delta Review

```
As an engineering manager whose context has changed,
I want /tmr-myself-config update to check what's changed since my last
config run and merge only the updated sections,
So that my profile stays accurate without re-running the full setup.

ACs:
- BOOTSTRAP reads current enriched state from my-career/<email>.md and CLAUDE.md
- Skill presents a clear summary of current known context
- Delta questions cover: priorities, direct report changes (joins/leaves),
  project status (new/wrapped), contractor changes
- Sections with no changes are explicitly skipped
- All writes use the same section-level merge as setup (non-destructive)
- New direct reports and projects discovered during update are created with
  the same file structure as the setup flow
```

---

## Section 5: Implementation Handoff

**Scope classification: Moderate**

| Work item | Handler | Action |
|-----------|---------|--------|
| Story 2.1 ACs | Developer agent | Add `my-company/contractors/members/` to scaffold; update `CLAUDE.md` template with Manager Context placeholder |
| Story 2.2 ACs | Developer agent | Write `config/organization.yaml` after profile collection; add optional domain prompt |
| Story 2.4 ACs | Developer agent | Add `tmr-myself-config` to skill install list; update post-init summary string |
| Story 3.2 ACs | Developer agent | Add domain-check logic to `MemberService.addMember()`; add `--contractor` flag; read `config/organization.yaml`; write contractor profiles |
| Story 6.1 | Skill author | Author `docs/TMR-MYSELF-CONFIG-SKILL.md` — full setup flow |
| Story 6.2 | Skill author | Add `update` mode section to `docs/TMR-MYSELF-CONFIG-SKILL.md` |

**Success criteria:**

- `INIT-UNIT-001` extended: `my-company/contractors/members/` exists after scaffold
- `INIT-UNIT-007/008` extended: `CLAUDE.md` contains `## Manager Context` placeholder
- `MEM-INT-006` (new): external domain email routes to contractors with confirmation
- `MEM-INT-007` (new): `--contractor` flag routes directly without prompt
- `MEM-UNIT-012` (new): contractor profile has `contractor: true` and `company:` fields
- `SKILL-MYSELF-001` (new): `docs/TMR-MYSELF-CONFIG-SKILL.md` covers all archetype branches
- `SKILL-MYSELF-002` (new): update mode delta questions cover all four change categories
- `npm run validate` passes for all CLI changes

---

*Approved by: Marlon — 2026-04-29*
*Generated by: Correct Course workflow*
