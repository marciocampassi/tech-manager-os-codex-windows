import type { OnboardingData } from '../types/onboarding.types.js';

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function yamlList(items: string[]): string {
  if (items.length === 0) return '[]';
  return '\n' + items.map((item) => `  - ${item}`).join('\n');
}

export function generateCareerProfile(data: OnboardingData): string {
  const { profile } = data;
  return `---
name: ${profile.name}
email: ${profile.email}
role: ${profile.role}
experience_years: ${profile.experienceYears}
leadership_style: ${profile.managementStyle}
teams: []
reports_to: []
strengths:${yamlList(profile.strengths)}
development_areas:${yamlList(profile.developmentAreas)}
updated: ${today()}
---

## About

${profile.name} is a ${profile.role} with ${profile.experienceYears} year${profile.experienceYears === 1 ? '' : 's'} of management experience.

## Leadership Style

${profile.managementStyle} leadership.

## Strengths

${profile.strengths.map((s) => `- ${s}`).join('\n')}

## Development Areas

${profile.developmentAreas.map((d) => `- ${d}`).join('\n')}
`;
}

export function generatePdp(data: OnboardingData): string {
  const { profile, careerGoals } = data;
  const date = today();
  return `---
name: ${profile.name}
role: ${profile.role}
created: ${date}
updated: ${date}
---

## Career Goals

### Short-Term (Next 6 Months)

${careerGoals.shortTerm}

### Long-Term (1–3 Years)

${careerGoals.longTerm}

### Target Role

${careerGoals.targetRole}

## Development Plan

| Area | Action | Timeline | Status |
|------|--------|----------|--------|
${profile.developmentAreas.map((area) => `| ${area} | _TBD_ | _TBD_ | Not started |`).join('\n')}

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
  Bootstrap file created by \`tm init\`. Full email-anchored folder structure
  (my-leadership/{email}/) is established in Epic 2.
---

## Manager Overview

**Name:** ${leadershipContext.managerName}
**Email:** ${leadershipContext.managerEmail}

## Expectations

${leadershipContext.expectations}

## Alignment Notes

_Add alignment notes after 1:1s._
`;
}

export function generateCursorRule(agentName: string): string {
  return `---
description: Tech Manager OS — ${agentName}
---

> **Placeholder**: This agent definition is populated by \`tm sync-agents\` (coming in Epic 2).
> Do not edit manually.
`;
}

export function generateAgentStub(agentName: string): string {
  return `# Tech Manager OS — ${agentName}

> **Placeholder**: This agent definition is populated by \`tm sync-agents\` (coming in Epic 2).
> Do not edit manually.
`;
}
