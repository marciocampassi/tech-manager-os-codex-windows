import type { OnboardingData, TeamMember } from '../types/onboarding.types.js';

function today(): string {
  return new Date().toISOString().split('T')[0];
}

export function generateCareerProfile(data: OnboardingData): string {
  const { profile } = data;
  return `---
name: ${profile.name}
email: ${profile.email}
role: ${profile.role}
teams: []
reports_to: []
updated: ${today()}
---

## About

${profile.name} is a ${profile.role}.

`;
}

export function generatePdp(data: OnboardingData): string {
  const { profile } = data;
  const date = today();
  return `---
name: ${profile.name}
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
manager_name: ${leadershipContext.managerName}
manager_email: ${leadershipContext.managerEmail}
updated: ${date}
_note: >
  Bootstrap file created by \`tmr init\`. Full email-anchored folder structure
  (my-leadership/{email}/) is established in Epic 2.
---

## Manager Overview

**Name:** ${leadershipContext.managerName}
**Email:** ${leadershipContext.managerEmail}

## Alignment Notes

_Add alignment notes after 1:1s._
`;
}

export function generateTeamMemberProfile(member: TeamMember): string {
  const date = today();
  return `---
name: ${member.name}
email: ${member.email}
gender: ${member.gender}
role: ${member.role}
created: ${date}
updated: ${date}
---

## Profile

**Name:** ${member.name}
**Email:** ${member.email}
**Gender:** ${member.gender}
**Role:** ${member.role}

## Notes

_Add notes about this team member here._
`;
}

export function generateCursorRule(agentName: string): string {
  return `---
description: Tech Manager OS — ${agentName}
---

> **Placeholder**: This agent definition is populated by \`tmr sync-agents\` (coming in Epic 2).
> Do not edit manually.
`;
}

export function generateAgentStub(agentName: string): string {
  return `# Tech Manager OS — ${agentName}

> **Placeholder**: This agent definition is populated by \`tmr sync-agents\` (coming in Epic 2).
> Do not edit manually.
`;
}
