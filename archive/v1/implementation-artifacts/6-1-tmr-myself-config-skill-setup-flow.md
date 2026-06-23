# Story 6.1: `tmr-myself-config` Skill — Setup Flow

Status: done

## Story

As an engineering manager setting up their vault for the first time,
I want to run `/tmr-myself-config` in Claude Code and have a guided adaptive conversation that learns about my role, working style, products, and team,
So that my profile is enriched, my vault graph is built, and every AI skill gives me assertive, personalized responses from day one.

## Acceptance Criteria

1. `docs/TMR-MYSELF-CONFIG-SKILL.md` is authored and registered in the skill registry. When the skill is invoked as `/tmr-myself-config`, it follows the BOOTSTRAP → ARCHETYPE → BASE-CONTEXT → PRODUCT/PEOPLE branches → CONTRACTOR-CHECK → CONFIRM → WRITE flow as specified in the skill document (FR46, SKILL-MYSELF-001).

2. BOOTSTRAP reads the vault: `my-career/<email>.md`, `my-leadership/`, `my-teams/members/`, `my-company/projects/`, `config/organization.yaml`; greets the user with a summary of what was found; and skips questions for already-known fields (FR46, SKILL-MYSELF-001).

3. ARCHETYPE step: user selects product / people / hybrid. PRODUCT-BRANCH is executed for product/hybrid; PEOPLE-BRANCH is executed for people/hybrid (FR46).

4. CONFIRM shows the full planned write summary before any file is written; user can approve, edit, or cancel (FR46).

5. WRITE produces: enriched `my-career/<email>.md` (merged — no existing fields overwritten); `CLAUDE.md ## Manager Context` section replaced; new project folders with `<slug>-project.md` + `deps.yaml`; new member profiles in `my-teams/members/`, `my-company/members/`, or `my-company/contractors/members/` as appropriate; all entity references use `[[relative/path|Name]]` wiki-link format (FR46, SKILL-MYSELF-002).

6. CONTRACTOR-CHECK: email with external domain → user classifies → profile written to `my-company/contractors/members/<email>.md` with `contractor: true` and `company:` fields (FR46).

## Tasks / Subtasks

- [x] Publish `skills/tmr-myself-config/SKILL.md` to the skill registry (AC: 1–6)
  - [x] Add `<!-- version: 1.0.0 -->` as the first line (version comment required by registry)
  - [x] Strip YAML frontmatter from source doc (registry copy must not have frontmatter)
  - [x] Copy all sections from `docs/TMR-MYSELF-CONFIG-SKILL.md`: EXECUTION, BOOTSTRAP, ARCHETYPE, BASE-CONTEXT, PRODUCT-BRANCH, PEOPLE-BRANCH, CONTRACTOR-CHECK, CONFIRM, WRITE, UPDATE (AC: 1–6)
  - [x] Verify AC alignment: all 6 ACs covered in skill content
- [x] Create/update `skills/index.json` to include `"tmr-myself-config"` (AC: 1)
- [x] Update sprint-status.yaml: story 6-1 → review, epic-6 → in-progress

---

## Dev Notes

### What This Story Produces

Two file operations — no TypeScript changes, no tests required:

1. **`skills/tmr-myself-config/SKILL.md`** — registry copy of the skill
2. **`skills/index.json`** — updated registry index

The source document at `docs/TMR-MYSELF-CONFIG-SKILL.md` already exists and is complete. This story is primarily about publishing it to the registry in the correct format.

### Registry File Format

The `SkillRegistryService` in `src/services/skill-registry.service.ts` extracts skill versions using:
```typescript
const VERSION_COMMENT_RE = /<!--\s*version:\s*(\S+)\s*-->/;
```

The version comment **must be the first line** of the registry SKILL.md file. Without it, `parseVersion()` returns `"unknown"` and the install manifest records `version: "unknown"`.

The `docs/TMR-MYSELF-CONFIG-SKILL.md` source has a YAML frontmatter block:
```yaml
---
name: tmr-myself-config
description: Adaptive setup conversation...
---
```

The **registry copy must NOT have this YAML frontmatter**. The frontmatter is for documentation tooling in `docs/`, not for the registry. The registry copy starts with the version comment, then the skill content.

### Registry Index Format

`skills/index.json` does not yet exist. It must be created as a JSON array of skill name strings:
```json
["tmr-inbox", "tmr-myself-config"]
```

Order: alphabetical or insertion order both acceptable. `tmr-inbox` must remain in the array (it is the existing registered skill).

### docs/ vs skills/ Distinction

| Location | Purpose |
|----------|---------|
| `docs/TMR-MYSELF-CONFIG-SKILL.md` | Source / development doc — YAML frontmatter, human-readable |
| `skills/tmr-myself-config/SKILL.md` | Registry distribution — version comment first line, no frontmatter |

Do NOT modify `docs/TMR-MYSELF-CONFIG-SKILL.md`. It is the canonical source; the registry copy is derived from it.

### Skill Content Alignment Check (ACs 1–6)

Before publishing, verify each AC is covered in the skill document:

| AC | Covered by section |
|----|--------------------|
| AC1: Full flow sequence (BOOTSTRAP → ARCHETYPE → … → WRITE) | `## EXECUTION` — explicitly lists the flow order |
| AC2: BOOTSTRAP reads vault files, greets, skips known fields | `## BOOTSTRAP` — B1–B4 steps |
| AC3: ARCHETYPE product/people/hybrid routing | `## ARCHETYPE` — A1 step + PRODUCT-BRANCH and PEOPLE-BRANCH sections |
| AC4: CONFIRM with no writes yet | `## CONFIRM` — explicitly states "Before writing any file" |
| AC5: WRITE with merge strategy and wiki-link format | `## WRITE` — W1–W6, wiki-link format documented |
| AC6: CONTRACTOR-CHECK external domain → contractors/ | `## CONTRACTOR-CHECK` — routing to `my-company/contractors/members/` |

### `skills/tmr-inbox/SKILL.md` Reference

The existing `skills/tmr-inbox/SKILL.md` does NOT have a version comment (pre-existing inconsistency — the inbox skill predates the version requirement in CONTRIBUTING.md). Do NOT add a version comment to the inbox skill as part of this story — that is out of scope.

### Previous Story Intelligence (Stories 4.1, 5.1)

- Story 4.1 implemented `SkillRegistryService` and the registry infrastructure. The registry is at `https://raw.githubusercontent.com/marlonvidal/tech-manager-os/main/skills`. Local path: `skills/<name>/SKILL.md`.
- Story 5.1 documented the skill registry structure and submission process in `CONTRIBUTING.md`. The version comment requirement (`<!-- version: 1.0.0 -->`) is documented there.
- `skills/index.json` was referenced in Story 4.1 as the registry index file. It does not yet exist in the repo.

### What MUST NOT Change

- No changes to any `src/` TypeScript files
- No changes to `docs/TMR-MYSELF-CONFIG-SKILL.md` (source doc — leave as is)
- No changes to `skills/tmr-inbox/SKILL.md`
- No new test files required (skill files are documentation, not testable code)

---

## Dev Agent Record

### Agent Model
claude-sonnet-4-6 (Cursor)

### Debug Log
- Documentation/skill-authoring story: no TypeScript changes, no test changes required
- `docs/TMR-MYSELF-CONFIG-SKILL.md` existed and was complete — covers both setup (Story 6.1) and update (Story 6.2) flows
- Source doc had YAML frontmatter (`name`, `description`) — stripped for registry copy; frontmatter is for docs tooling, not for Claude Code skill execution
- `skills/index.json` did not exist — created with `["tmr-inbox", "tmr-myself-config"]`
- `VERSION_COMMENT_RE = /<!--\s*version:\s*(\S+)\s*-->/` confirmed in `skill-registry.service.ts` — version comment added as line 1
- `skills/tmr-inbox/SKILL.md` has no version comment (pre-existing inconsistency) — left unchanged per story scope
- AC alignment verified: all 6 ACs satisfied by skill sections (see Dev Notes table)
- `npm run lint && npm run typecheck` — exit 0; no regressions

### Completion Notes
- Created `skills/tmr-myself-config/SKILL.md` with `<!-- version: 1.0.0 -->` as line 1, followed by all skill sections from `docs/TMR-MYSELF-CONFIG-SKILL.md` (YAML frontmatter stripped)
- Created `skills/index.json` with `["tmr-inbox", "tmr-myself-config"]`
- All 6 story ACs satisfied: EXECUTION flow sequence (AC1), BOOTSTRAP vault reads + greeting (AC2), ARCHETYPE product/people/hybrid routing (AC3), CONFIRM before-write gate (AC4), WRITE merge strategy + wiki-link format (AC5), CONTRACTOR-CHECK external domain routing (AC6)

---

## File List

- `skills/tmr-myself-config/SKILL.md` — created; registry copy of tmr-myself-config skill with version comment
- `skills/index.json` — created; registry index `["tmr-inbox", "tmr-myself-config"]`

---

## Change Log

- 2026-05-11: Implemented Story 6.1 — published `skills/tmr-myself-config/SKILL.md` v1.0.0 to skill registry; created `skills/index.json`
