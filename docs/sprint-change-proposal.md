# Sprint Change Proposal — Epic Reordering & CLI-First Architecture

**Date:** 2026-03-04
**Submitted by:** John (PM Agent)
**Status:** ✅ APPROVED & IMPLEMENTED — ⚠️ SUPERSEDED

> **Note for developers:** This proposal was approved and fully implemented. It has since been superseded by a further strategic pivot documented in [`docs/ARCHITECTURE-PIVOT-2026-04.md`](./ARCHITECTURE-PIVOT-2026-04.md) (April 2026).
>
> Key differences from the current plan:
> - The folder paths in this document (`_members/`, `_teams/`, `my-company/relationships/`) have been corrected to match the TECH-MANAGER-OS-TEMPLATE (see `docs/TECH-MANAGER-OS-TEMPLATE`)
> - Epics 4–7 (agent commands) documented below were subsequently removed in the April 2026 pivot
> - A new Epic 4 (Skills-Based Architecture Pivot) and a renumbered Epic 5 (Publish) replaced them
>
> Read `docs/ARCHITECTURE-PIVOT-2026-04.md` for the current state of the product plan.

---

## Executive Summary

Reorder epic sequence to prioritize complete CLI foundation before Process Intelligence and agent implementation. This architectural shift enables token-optimized agent design where agents invoke CLI commands for file manipulation rather than reading/parsing files directly.

**Key Changes:**
- ✅ New Epic 2: Complete Command-Line Interface Implementation (6 stories)
- ✅ Process Intelligence moved to Epic 3 (depends on Epic 2)
- ✅ All agent epics renumbered (Epic 3→4, 4→5, 5→6, 6→7, 7→8)
- ✅ Renamed "cycle" → "process" throughout codebase
- ✅ Multi-team structure finalized (Option A: _members/ + _teams/)

---

## Analysis Summary

### Original Issue

Current epic structure sequences Process Intelligence (Epic 2) before foundational CLI commands exist. This creates:
- **Agent implementation complexity:** Agents manipulating files directly
- **Token inefficiency:** Reading full files for small updates
- **Testing challenges:** No CLI layer to unit test
- **Architectural debt:** File manipulation logic embedded in agents

### Root Cause

Architectural insight revealed during design: agents should leverage CLI commands for CRUD operations to optimize token usage. Current epic order doesn't support this pattern.

### Impact on MVP

**No MVP scope reduction.** This change enhances the delivery path without changing deliverables. All features remain intact, but implementation order shifts to support better architecture.

---

## Epic Impact Details

### Epic Sequence Changes

| Original | New | Title | Change Type |
|----------|-----|-------|-------------|
| Epic 1 | Epic 1 | Foundation & CLI Infrastructure | ✅ No change |
| Epic 2 | **Epic 3** | Process Intelligence Engine | ⬇️ Moved down, dependencies added |
| - | **Epic 2** | **Complete Command-Line Interface** | 🆕 **NEW** |
| Epic 3 | Epic 4 | People Management Agent | ⬆️ Renumbered |
| Epic 4 | Epic 5 | Leader's Career & Leadership Agent | ⬆️ Renumbered |
| Epic 5 | Epic 6 | Project Management Agent | ⬆️ Renumbered |
| Epic 6 | Epic 7 | BMAD Builder Integration | ⬆️ Renumbered |
| Epic 7 | Epic 8 | Polish, Testing & Distribution | ⬆️ Renumbered |

### New Epic 2 Story Breakdown

**Epic 2: Complete Command-Line Interface Implementation**

Stories:
1. **Story 2.1:** Team Management Commands (create, add, list, archive, fire, show)
2. **Story 2.2:** Member File Management Commands (add 1on1, feedback, assessment, performance-review)
3. **Story 2.3:** Relationship Management Commands (add, add 1on1, batch operations)
4. **Story 2.4:** Leadership Management Commands (add, add 1on1)
5. **Story 2.5:** Project Management Commands (add, link-member/stakeholder, add standup/discussion/presentation)
6. **Story 2.6:** Email Resolution Service (hierarchy lookup, auto-create)

**Total estimated stories: 6** (vs. 7 in original Epic 2)

### Dependencies Updated

- **Epic 3 (Process Intelligence)** now depends on Epic 2 CLI completion
- **Epics 4-6 (Agent Systems)** leverage Epic 2 CLI commands
- No circular dependencies introduced
- Clean separation: Epic 2 = CRUD layer, Epics 4-6 = Intelligence layer

---

## Artifact Changes Implemented

### 1. Epic Documentation

**File:** `docs/prd/epic-list.md`
- ✅ Inserted new Epic 2 description
- ✅ Updated all epic goals to reflect CLI-first approach
- ✅ Renumbered Epics 2-7 → 3-8

**File:** `docs/prd/epic-details.md`
- ✅ Inserted complete Epic 2 with 6 detailed stories
- ✅ Renamed all "cycle" references → "process"
- ✅ Renumbered all stories (2.x → 3.x, 3.x → 4.x, etc.)
- ✅ Updated Story 3.3 to reflect CLI injection approach
- ✅ Updated all agent stories to mention CLI usage
- ✅ Removed lifecycle commands from Epic 4 (now in Epic 2)
- ✅ Updated Epic 7 agent definitions to use "process-agent" instead of "cycle-agent"

### 2. Source Code

**File:** `src/commands/init.command.ts`
- ✅ Lines 73-82: Renamed `cycle-agent` → `process-agent` (3 occurrences)

**File:** `tests/commands/init.command.test.ts`
- ✅ Lines 276-277: Updated test expectations for `process-agent`

**File:** `tests/integration/init.integration.test.ts`
- ✅ Lines 192-199: Updated integration test names and expectations
- ✅ Line 242-243: Updated assertion variable names

### 3. Design Decisions

**Multi-Team Structure (Option A - Approved):**

> ⚠️ Folder names below use underscores (`_members/`, `_teams/`) as originally designed. These were subsequently renamed without underscores (`members/`, `teams/`) in the April 2026 pivot to align with TECH-MANAGER-OS-TEMPLATE. The structure and logic are otherwise unchanged.

```
/my-teams/
  members/              ← was _members/ (corrected April 2026)
    {email}/            ← Single source of truth
      {email}.md        ← Profile with teams array in frontmatter
      1on1s/
      feedbacks/        ← was feedback/ (corrected April 2026)
      assessments/
      performance-reviews/
  teams/                ← was _teams/ (corrected April 2026)
    {team-name}/
      {team-name}-context.md   ← Team-level info
      {team-name}-members.md   ← Wiki-links to members
```

**Benefits:**
- Email uniqueness naturally enforced
- Multi-team support via frontmatter array
- No symlinks or complex linking
- Clean Obsidian wiki-link structure

---

## Command Specifications

### Team Management

| Command | Interactive Mode | Auto-Creates |
|---------|-----------------|--------------|
| `tmr team create <team-name>` | ✅ Yes | Team structure |
| `tmr team add <team-name> <email> --role --location` | ✅ Yes | Team + member |
| `tmr team list [team-name]` | ❌ No | - |
| `tmr team archive <team-name> <email>` | ✅ Yes | - |
| `tmr team fire <team-name> <email>` | ✅ Yes | - |
| `tmr show <email>` | ❌ No | - |

### Member File Operations

| Command | Creates File | Updates Profile Section |
|---------|-------------|------------------------|
| `tmr member <email> add 1on1` | ✅ Yes | ## 1on1s |
| `tmr member <email> add feedback` | ✅ Yes | ## Feedbacks |
| `tmr member <email> add assessment` | ✅ Yes | ## Assessments |
| `tmr member <email> add performance-review` | ✅ Yes | ## Performance Reviews |

### Relationship & Leadership

| Command | Batch Support | Auto-Creates Structure |
|---------|--------------|----------------------|
| `tmr relationship add <email-list>` | ✅ Yes | ✅ Yes |
| `tmr relationship <email> add 1on1` | ❌ No | ❌ No (requires existing) |
| `tmr leadership add <email>` | ❌ No | ✅ Yes |
| `tmr leadership <email> add 1on1` | ❌ No | ❌ No (requires existing) |

### Project Management

| Command | Batch Support | Email Resolution |
|---------|--------------|------------------|
| `tmr project add <project-name>` | ❌ No | - |
| `tmr project <project> link-member <email>` | ❌ No | ✅ Hierarchical |
| `tmr project <project> link-members <email-list>` | ✅ Yes | ✅ Hierarchical |
| `tmr project <project> link-stakeholder <email>` | ❌ No | ✅ Hierarchical |
| `tmr project <project> link-stakeholders <email-list>` | ✅ Yes | ✅ Hierarchical |
| `tmr project <project> add standup` | ❌ No | - |
| `tmr project <project> add discussion` | ❌ No | - |
| `tmr project <project> add presentation --topic` | ✅ Yes | - |

### Email Resolution Hierarchy

For all linking commands:
1. Check `/my-teams/members/{email}/` (team member) *(path corrected in April 2026 pivot)*
2. Check `/my-leadership/{email}/` (leadership)
3. Check `/my-company/members/{email}/` (company member) *(was `relationships/` — corrected in April 2026 pivot)*
4. If not found: Execute `tmr relationship add <email>` (auto-create)

---

## Token Optimization Strategy

### Before (Without CLI Layer)

**Agent workflow for updating context:**
1. Read full profile file (500-2000 tokens)
2. Parse markdown structure
3. Find target section
4. Generate new content
5. Merge with existing
6. Write back full file

**Token cost per operation:** ~1500-3000 tokens

### After (With CLI Layer)

**Agent workflow:**
1. Generate new content only
2. Execute CLI command: `tmr member <email> add 1on1`
3. CLI handles all file operations

**Token cost per operation:** ~300-500 tokens

**Estimated savings:** 70-85% token reduction for context updates

---

## Risk Assessment

| Risk | Severity | Mitigation | Status |
|------|----------|-----------|--------|
| Epic 2 scope creep | Medium | Well-defined stories, unit test boundaries | ✅ Mitigated |
| CLI command interface changes | Low | Interface design complete, documented | ✅ Mitigated |
| Agent implementation delays | Low | Epic 2 enables parallelization of agent work | ✅ Mitigated |
| Multi-team structure complexity | Low | Option A is simplest, well-tested pattern | ✅ Mitigated |

---

## Testing Strategy

### Epic 2 Testing (CLI Layer)

**Unit Tests (per story AC):**
- All commands with parameter validation
- Interactive mode flows
- Error handling (not found, already exists, invalid input)
- File system operations (creation, updates, atomic writes)
- Email resolution hierarchy
- Wiki-link generation

**Integration Tests:**
- Full command workflows end-to-end
- Multi-command sequences (add → link → show)
- Batch operations
- Edge cases (special characters, long emails, concurrent operations)

### Epic 3+ Testing (Agent Layer)

**Integration Tests:**
- Agent commands invoking CLI
- CLI output parsing
- Error propagation from CLI to agents
- Token usage validation

---

## Implementation Checklist

### ✅ Completed

- [x] Epic-list.md updated
- [x] Epic-details.md updated (all epics renumbered)
- [x] Source code renamed (cycle → process)
- [x] Test files updated
- [x] Multi-team structure finalized
- [x] Command specifications documented
- [x] Sprint Change Proposal created

### ✅ Approved (2026-03-04)

- [x] User approved epic reordering
- [x] User approved multi-team structure (Option A)
- [x] User approved command specifications
- [x] User approved token optimization approach

### 📋 Next Steps (After Approval)

1. **No rollback needed** — changes are additive
2. **No story completion affected** — Story 1.1 already done, no conflicts
3. **Ready to proceed** with Story 1.2 or Epic 2 stories

---

## Success Criteria

### Definition of Done

- ✅ All epic documentation updated
- ✅ No "cycle" references remain (renamed to "process")
- ✅ All stories renumbered consistently
- ✅ Multi-team structure documented
- ✅ Command specifications complete
- ✅ Source code updated and tests passing
- ✅ Sprint Change Proposal approved by user

### Validation

Run after approval:
```bash
# Verify no "cycle" references remain
rg -i "cycle" --glob "*.{ts,md}" --glob "!node_modules" --glob "!sprint-change-proposal.md"

# Verify tests pass
npm test

# Verify story numbering consistency
grep -E "^### Story [0-9]\.[0-9]:" docs/prd/epic-details.md
```

---

## Agent Handoff Plan

### After Approval

**No handoff needed for immediate next steps.**

This is a planning change that doesn't require architect or designer involvement. Development can proceed immediately with either:
- Continue Epic 1 stories (1.2-1.6)
- Start Epic 2 stories (2.1-2.6)

### For Future Epics

**Epic 3+ (Agent Implementation):**
- Agent development can reference Epic 2 CLI commands
- Clear interface contracts established
- Token optimization patterns documented

---

## Appendix: Change Summary by File

### Documentation Changes

| File | Lines Changed | Change Type |
|------|--------------|-------------|
| `docs/prd/epic-list.md` | ~30 | Complete rewrite |
| `docs/prd/epic-details.md` | ~400 | Epic 2 insertion + renumbering |

### Code Changes

| File | Lines Changed | Change Type |
|------|--------------|-------------|
| `src/commands/init.command.ts` | 6 | Rename cycle → process |
| `tests/commands/init.command.test.ts` | 2 | Update expectations |
| `tests/integration/init.integration.test.ts` | 4 | Update test names |

### Total Changes

- **Files modified:** 5
- **Lines changed:** ~442
- **New stories added:** 6 (Epic 2)
- **Stories renumbered:** 36 (Epics 3-8)

---

## Approval Record

All items below were approved on 2026-03-04 and implemented:

1. ✅ Epic reordering (Epic 2 → Epic 3, new Epic 2 for CLI)
2. ✅ Multi-team structure (Option A: _members/ + _teams/)
3. ✅ Command specifications (all commands documented above)
4. ✅ Token optimization approach (CLI injection pattern)
5. ✅ "cycle" → "process" rename

> **Subsequent changes:** The April 2026 pivot (see `docs/ARCHITECTURE-PIVOT-2026-04.md`) further corrected folder paths and removed Epics 4–7. The multi-team folder structure documented above uses `_members/` and `_teams/` prefixes which were later renamed to `members/` and `teams/` (without underscores) to align with the TECH-MANAGER-OS-TEMPLATE.

---

**End of Sprint Change Proposal**
