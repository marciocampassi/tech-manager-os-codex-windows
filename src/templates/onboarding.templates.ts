import type { OnboardingData, TeamMember } from '../types/onboarding.types.js';
import type { TaskPeriod } from '../types/task.types.js';

function today(): string {
  return new Date().toISOString().split('T')[0];
}

// Wiki-links in this file use vault-root relative paths (no leading `../`).
// Obsidian resolves `[[my-leadership/...]]` from the vault root, not from the file's directory.
export function generateCareerProfile(data: OnboardingData): string {
  const { profile, leadershipContext } = data;
  const date = today();
  const locationLine = profile.location ? `location: ${profile.location}\n` : '';
  return `---
email: "[[${profile.email}]]"
name: ${profile.name}
role: ${profile.role}
${locationLine}teams: []
reports_to: "[[${leadershipContext.managerEmail}]]"
date_added: ${date}
updated: ${date}
---

## About

${profile.name} is a ${profile.role}.

## Current Manager

- [[my-leadership/${leadershipContext.managerEmail}/${leadershipContext.managerEmail}|${leadershipContext.managerEmail}]]

## Previous Managers

## Performance Reviews

## 1on1s

## Assessments

## Feedbacks
`;
}

export function generatePdp(data: OnboardingData): string {
  const { profile } = data;
  const date = today();
  return `---
name: ${profile.name}
email: "[[${profile.email}]]"
role: ${profile.role}
created: ${date}
updated: ${date}
---

## Career Goals

### Short-Term (Next 6 Months)

_Add your short-term goals here._

### Long-Term (1–3 Years)

_Add your long-term goals here._

## Development Plan

| Area | Action | Timeline | Status |
|------|--------|----------|--------|

## Milestones

_Add milestones as you progress._
`;
}

export function generateLeadershipProfile(data: OnboardingData): string {
  const { leadershipContext } = data;
  const date = today();
  return `---
email: "[[${leadershipContext.managerEmail}]]"
name: ${leadershipContext.managerName}
role: ''
areas_of_responsibility: []
date_added: ${date}
updated: ${date}
---

## Overview

**Name:** ${leadershipContext.managerName}
**Email:** [[${leadershipContext.managerEmail}]]

## 1on1s

## Alignment Notes

_Add alignment notes after 1:1s._
`;
}

export function generateTeamMemberProfile(member: TeamMember, managerEmail: string): string {
  const date = today();
  const locationLine = member.location ? `location: ${member.location}\n` : `location: ''\n`;
  return `---
email: "[[${member.email}]]"
name: ${member.name}
role: ${member.role}
gender: ${member.gender}
${locationLine}teams: [default]
action_items_gdoc: ''
date_added: ${date}
updated: ${date}
---

## Current Manager

- [[../../my-career/${managerEmail}/${managerEmail}|${managerEmail}]]

## Previous Managers

## Other Leaderships

## Previous Leaderships

## Performance Reviews

## 1on1s

## Assessments

## Feedbacks

## Action Items

- [[action-items-${member.email}|Action Items Tracker]]
`;
}

export function generateDefaultTeamContext(): string {
  const date = today();
  return `---
team: default
created: ${date}
updated: ${date}
---
`;
}

export function generateDefaultTeamMembers(members: TeamMember[]): string {
  const lines = members
    .map((m) => `- [[../../members/${m.email}/${m.email}|${m.email}]]`)
    .join('\n');
  return `# Team Members\n\n${lines.length > 0 ? lines + '\n' : ''}`;
}

export function generateCursorRule(agentName: string): string {
  return `---
description: Tech Manager OS — ${agentName}
---

> **Placeholder**: This agent definition is populated by \`tmr sync-agents\` (coming in Epic 2).
> Do not edit manually.
`;
}

const TASK_PERIOD_LABELS: Record<TaskPeriod, string> = {
  today: 'Today',
  'this-week': 'This Week',
  'this-month': 'This Month',
  'this-quarter': 'This Quarter',
};

export function generateTaskFileTemplate(period: TaskPeriod): string {
  const label = TASK_PERIOD_LABELS[period];
  return `# Tasks — ${label}\n\n_Run \`tmr process\` to populate this file from your inbox._\n`;
}

export function generateAgentStub(agentName: string): string {
  return `# Tech Manager OS — ${agentName}

> **Placeholder**: This agent definition is populated by \`tmr sync-agents\` (coming in Epic 2).
> Do not edit manually.
`;
}

export function generateActionItemsTemplate(email: string): string {
  const date = today();
  return `---
email: "[[${email}]]"
type: action-items
updated: ${date}
---

## ACTION ITEMS TRACKER

**Review Frequency:**

- [ ] Weekly
- [ ] Bi-weekly
- [ ] Monthly

---

## STATUS

| Status | Definition |
| :----- | :--------- |
| Not Started | Task has been assigned but work has not begun |
| In Progress | Work is actively underway |
| Blocked | Task is paused due to dependencies or obstacles |
| Complete | Task has been finished and verified |
| On Hold | Task is temporarily suspended pending decision/resource |

---

## PRIORITY LEVELS

| Priority | Definition | Response Time |
| :------- | :--------- | :------------ |
| High | Critical to business; impacts multiple areas | Review weekly |
| Medium | Important; impacts specific area | Review bi-weekly |
| Low | Nice-to-have; limited impact | Review monthly |

---

## ACTION ITEMS TABLE

| Action Item | Owner/Assignee | Priority | Status | Comments | Follow-up Date |
| :---------- | :------------- | :------- | :----- | :------- | :------------- |
| | | | | | |
| | | | | | |
| | | | | | |

---

## DETAILED ACTION ITEM CARDS

> **DO NOT CHANGE THIS. COPY AND PASTE ABOVE THIS LINE, USE IT AS A TEMPLATE**
>
> **Action Item #:** ___
> **Title:** ___________________
> **Owner:** ___________________
> **Department:** ___________________
>
> **Description:**
> [Provide context and background]
>
> **Objective/Expected Outcome:**
> [What success looks like]
>
> **Due Date:** ___________________
>
> **Priority:**
> - [ ] High
> - [ ] Medium
> - [ ] Low
>
> **Status:**
> - [ ] Not Started
> - [ ] In Progress
> - [ ] Blocked
> - [ ] Complete
>
> **Progress Notes:**
>
> | Date | Update | % Complete | Blocker/Risk |
> | :--- | :----- | :--------- | :----------- |
> | | | | |
>
> **Comments & Follow-ups:**
>
> | Date | Comment | Action Required | By Whom |
> | :--- | :------ | :-------------- | :------ |
> | | | | |
>
> **Blockers/Risks:**
>
> **Next Steps:**
> 1.
> 2.
`;
}
