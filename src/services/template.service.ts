import type { FileType, IDatedFileLinks } from '../types/member.types.js';
import { formatWikiLink } from '../utils/wiki-link.js';

/**
 * Escapes a value for embedding inside a double-quoted YAML scalar.
 * Mirrors `EmailResolutionService`'s `safeEmail` so a `"` or `\` in a wiki-link
 * (e.g. from an unusual email-derived path/label) cannot corrupt the frontmatter.
 */
function yamlQuote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Builds the dated-file frontmatter block (without the `---` fences) for Story 9.31.
 * Emits `type`, `date`, `subject`, and either `with` (1on1/assessment/performance-review)
 * or `from` (feedback). Wiki-link values are double-quoted because `[[` is a YAML
 * flow indicator.
 */
function datedFrontmatter(type: string, date: string, links: IDatedFileLinks): string {
  const lines = [`type: ${type}`, `date: ${date}`, `subject: ${yamlQuote(links.subject)}`];
  if (links.from) lines.push(`from: ${yamlQuote(links.from)}`);
  else if (links.with) lines.push(`with: ${yamlQuote(links.with)}`);
  return lines.join('\n');
}

/**
 * Generates markdown file templates for member and relationship documents.
 * Pure functions — no IO.
 */
export class TemplateService {
  getProjectOverviewTemplate(name: string, date: string): string {
    return `---
name: ${name}
type: project
date_created: ${date}
members: []
stakeholders: []
---

# ${name}

## Overview

## Goals

## Timeline

## Notes
`;
  }

  getStandupTemplate(date: string, name: string, overviewPath?: string, fromPath?: string): string {
    const projectField =
      overviewPath && fromPath ? `"${formatWikiLink(overviewPath, fromPath, name)}"` : name;
    return `---
date: ${date}
project: ${projectField}
type: standup
---

# ${name} Standup — ${date}

## Yesterday

## Today

## Blockers
`;
  }

  getLeadership1on1Template(
    date: string,
    email: string,
    links?: { subject: string; with?: string },
  ): string {
    const fm = links
      ? datedFrontmatter('1on1', date, links)
      : `date: ${date}\nmember: ${email}\ntype: leadership-1on1`;
    return `---
${fm}
---

# 1:1 with ${email}

## Alignment Topics

## Support Needed

## Feedback Requested

## Notes
`;
  }

  getRelationship1on1Template(date: string, email: string): string {
    return `---
date: ${date}
member: ${email}
type: 1on1
---

# 1:1 with ${email}

## Alignment Topics

## Support Needed

## Feedback Requested

## Notes
`;
  }

  getTemplate(type: FileType, date: string, email: string, links?: IDatedFileLinks): string {
    switch (type) {
      case '1on1':
        return this._oneonone(date, email, links);
      case 'feedback':
        return this._feedback(date, email, links);
      case 'assessment':
        return this._assessment(date, email, links);
      case 'performance-review':
        return this._performanceReview(date, email, links);
    }
  }

  private _oneonone(date: string, email: string, links?: IDatedFileLinks): string {
    const fm = links
      ? datedFrontmatter('1on1', date, links)
      : `date: ${date}\nmember: ${email}\ntype: 1on1`;
    return `---
${fm}
---

# 1:1 with ${email}

## Check-in

## Discussion Topics

## Action Items

## Notes
`;
  }

  private _feedback(date: string, email: string, links?: IDatedFileLinks): string {
    const fm = links
      ? datedFrontmatter('feedback', date, links)
      : `date: ${date}\nmember: ${email}\ntype: feedback`;
    return `---
${fm}
---

# Feedback — ${email}

## Situation

## Behavior

## Impact

## Notes
`;
  }

  private _assessment(date: string, email: string, links?: IDatedFileLinks): string {
    const fm = links
      ? datedFrontmatter('assessment', date, links)
      : `date: ${date}\nmember: ${email}\ntype: assessment`;
    return `---
${fm}
---

# Skills Assessment — ${email}

## Technical Skills

## Soft Skills

## Growth Areas

## Strengths

## Notes
`;
  }

  private _performanceReview(date: string, email: string, links?: IDatedFileLinks): string {
    const fm = links
      ? datedFrontmatter('performance-review', date, links)
      : `date: ${date}\nmember: ${email}\ntype: performance-review`;
    return `---
${fm}
---

# Performance Review — ${email}

## Accomplishments

## Growth Areas

## Goals for Next Period

## Manager Notes
`;
  }
}

export const templateService = new TemplateService();
