---
name: bmad-v6-story-pipeline
description: >-
  Orchestrates the BMAD story implementation pipeline
  (create-story, dev-story, code-review) in a single command using
  subagents per step. Use when the user says "run story pipeline",
  "implement next story", or "bmad-story-pipeline".
---

# BMAD Story Pipeline Orchestrator

Run the complete story lifecycle — from backlog to done — in one command by dispatching a fresh subagent for each stage. Automatically detects story status and skips stages that are already complete.

## Pipeline Stages

| # | Stage | Skill invoked | Produces | Status transition |
|---|-------|---------------|----------|-------------------|
| 1 | Create Story | `bmad-create-story` | `{impl}/{{story_key}}.md` | backlog → ready-for-dev |
| 2 | Dev Story | `bmad-dev-story` | implemented code, tests green | ready-for-dev → review |
| 3 | Code Review | `bmad-code-review` | review findings, auto-fix | review → done (or in-progress) |

## Initialization

### 1. Load configuration

Read `{project-root}/_bmad/bmm/config.yaml` and resolve:
- `project_name`, `user_name`
- `communication_language`, `document_output_language`
- `implementation_artifacts` (abbrev `{impl}`)
- `output_folder`
- `planning_artifacts`

### 2. Discover next story

Read the FULL `{impl}/sprint-status.yaml`.

**If the user provided a specific story key:** use that key directly. Look up its current status in `development_status`. This lets a team member explicitly pick a story even if another story has higher priority by status.

**If no story key provided:** auto-discover using priority-based search. Scan `development_status` entries top-to-bottom (only keys matching pattern `N-N-slug`, not `epic-N` or `*-retrospective`) in this priority order:

1. First story with status `in-progress` (resume interrupted work)
2. If none, first story with status `review`
3. If none, first story with status `ready-for-dev`
4. If none, first story with status `backlog`

If no story found in any of those statuses, report to the user that all stories are complete (or no stories exist) and HALT.

Extract from the selected story:
- `story_key` — the full key (e.g. `1-2-integrate-earnings-dashboard`)
- `story_id` — `{epic_num}-{story_num}` (e.g. `1-2`)
- `epic_key` — `epic-{epic_num}`
- `story_status` — the current status value

### 3. Verify epic status

If `epic_key` status is `backlog`, note it will be transitioned to `in-progress` by the create-story subagent. If `done`, HALT with error.

### 4. Determine start stage

Based on `story_status`, determine which pipeline stage to begin at. Resolve any artifacts that earlier (skipped) stages would have produced by finding them on disk.

**`done`:**
Report to the user:
> Story `{{story_key}}` is already complete. To process the next incomplete story, run `bmad-story-pipeline` without arguments. To revisit this story, run individual skills manually (e.g. `bmad-code-review`).

HALT — do not proceed.

**`review`:**
- Skip Stages 1 and 2
- Resolve `{{story_file}}` = `{impl}/{{story_key}}.md` (verify it exists)
- Start at **Stage 3**

**`in-progress`:**
- Skip Stage 1
- Resolve `{{story_file}}` = `{impl}/{{story_key}}.md` (verify it exists)
- Start at **Stage 2**

**`ready-for-dev`:**
- Skip Stage 1
- Resolve `{{story_file}}` = `{impl}/{{story_key}}.md` (verify it exists)
- Start at **Stage 2**

**`backlog`:**
- Start at **Stage 1** (no stages skipped, no artifacts to resolve)

Record which stages will be skipped and which will be executed for the finalization report.

## Pipeline Execution

Start from the stage determined above. Stages before the start stage are skipped — their artifacts were resolved from disk during the Determine Start Stage step.

Execute the remaining stages sequentially. Between each stage the orchestrator verifies the expected artifact exists before dispatching the next subagent.

**Critical rules:**
- Dispatch each stage as a `Task` subagent (`subagent_type: "generalPurpose"`)
- Read the prompt template from `./prompts/0N-*.md`
- Replace all `{{placeholders}}` with resolved values before dispatching
- After each subagent returns, verify the gate condition
- If a gate fails, report the failure stage and HALT — do not proceed
- **Stage 3 (Code Review) MUST use model `claude-opus-4-8-thinking-high`** — set `model` on the Task subagent

### Stage 1 — Create Story

1. Read `./prompts/01-create-story.md`
2. Replace `{{story_key}}`, `{{story_id}}`, `{{epic_num}}`, `{{story_num}}`, `{{impl}}`
3. Dispatch subagent
4. **Gate:** glob for `{impl}/{{story_key}}.md` — file must exist and contain `Status: ready-for-dev`
5. Store the full path as `{{story_file}}`

### Stage 2 — Dev Story

1. Read `./prompts/02-dev-story.md`
2. Replace `{{story_file}}`, `{{story_key}}`
3. Dispatch subagent
4. **Gate:** read `{{story_file}}` — Status must be `review`
5. Read `{impl}/sprint-status.yaml` — `{{story_key}}` must be `review`

### Stage 3 — Code Review

1. Read `./prompts/03-code-review.md`
2. Replace `{{story_file}}`, `{{story_key}}`
3. Dispatch subagent using model `claude-opus-4-8-thinking-high`
4. **Gate:** read `{{story_file}}` — Status must be `done` or `in-progress`
5. If `in-progress` (review left action items): report findings to user and HALT
6. If `done`: proceed

## Finalization

1. Read `{impl}/sprint-status.yaml` (full file)
2. Verify `{{story_key}}` status is `done`
3. If not already `done`, update it to `done` and set `last_updated`
4. Save the file preserving all comments and structure

Report to user:

> **Story Pipeline Complete**
>
> **Story:** {{story_key}}
> **Status:** done
> **Stages executed:** (list executed stage numbers and names)
> **Stages skipped:** (list skipped stage numbers and names, with reason)
> **Artifacts:**
> - Story file: {{story_file}}
>
> **Next:** Run `bmad-story-pipeline` again to process the next incomplete story, or check sprint status.

## Error Handling

If any stage fails:
1. Report which stage failed and why
2. Report what artifacts were successfully created so far
3. Suggest how to resume (e.g., manually fix and re-run a specific skill)
4. Do NOT attempt to continue past a failed gate
