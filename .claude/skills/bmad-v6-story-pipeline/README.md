# BMAD Story Pipeline

An agent skill that orchestrates the **BMAD story implementation pipeline** — from backlog to done — in a single command, dispatching a fresh subagent for each stage.

## What it does

Runs three sequential pipeline stages automatically, detecting where to start based on story status and skipping stages already complete:

| Stage            | What happens                                                  | Model               |
| ---------------- | ------------------------------------------------------------- | ------------------- |
| 1. Create Story  | Generates a story file and transitions it to ready-for-dev    | default             |
| 2. Dev Story     | Implements the feature with passing tests                     | default             |
| 3. Code Review   | Reviews, auto-fixes issues, and marks story done              | claude-opus-4-8-thinking-high |

## Install

### Cursor (project-scoped)

```bash
cp -r . .cursor/skills/bmad-v6-story-pipeline
```

Or clone directly:

```bash
git clone https://github.com/marlonvidal/bmad-v6-story-pipeline \
  .cursor/skills/bmad-v6-story-pipeline
```

### Claude Code (personal)

```bash
cp -r . ~/.claude/skills/bmad-v6-story-pipeline
```

## Usage

Once installed, trigger the skill by saying any of:

- `run story pipeline`
- `implement next story`
- `bmad-story-pipeline`

To target a specific story:

- `run story pipeline for 1-2-integrate-earnings-dashboard`

## Requirements

This skill requires a BMAD project with:

- `_bmad/bmm/config.yaml` — project configuration
- `{impl}/sprint-status.yaml` — sprint backlog with story statuses
- The following sibling skills installed: `bmad-create-story`, `bmad-dev-story`, `bmad-code-review`

## How it works

The orchestrator reads `sprint-status.yaml` to find the next actionable story (prioritizing `in-progress` → `review` → `ready-for-dev` → `backlog`), resolves any artifacts from previously completed stages, then dispatches each remaining stage as an independent subagent.

Each stage has a **gate condition** — a verifiable artifact or status check — that must pass before the next stage starts. If a gate fails, the pipeline halts and reports exactly where and why.

Code Review is intentionally dispatched on a more capable thinking model (`claude-opus-4-8-thinking-high`) to maximize review depth and auto-fix quality.

## License

MIT
