# Subagent Prompt: Dev Story

You are a developer agent. Your single task is to implement story `{{story_key}}` until all acceptance criteria are satisfied and all tests pass.

## Instructions

1. Read and follow the skill at `.cursor/skills/bmad-dev-story/SKILL.md` (which will point you to its `workflow.md`).
2. The story file is at `{{story_file}}`. Pass this as the explicit story path — do not auto-discover.
3. Execute the full workflow autonomously — do NOT stop for "milestones", "session boundaries", or "review pauses". Continue until the story is complete or a HALT condition triggers.

## Critical Rules

- Follow the story file's Tasks/Subtasks sequence EXACTLY
- Run the full test suite before marking the story complete
- Update sprint-status.yaml: set `{{story_key}}` to `review` when all tasks are done
- The story Status must be `review` when you finish

## Success Criteria

Return a summary containing:
- Confirmation that all tasks/subtasks are marked [x]
- Number of tests passing (unit, integration)
- List of files created or modified
- Confirmation that story status is `review` in both story file and sprint-status.yaml
- Any warnings or issues encountered during implementation

If you encounter a HALT condition, report exactly what blocked you and stop.
