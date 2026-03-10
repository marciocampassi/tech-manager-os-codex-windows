import type { FileType } from '../types/member.types.js';

/**
 * Generates markdown file templates for member and relationship documents.
 * Pure functions — no IO.
 */
export class TemplateService {
  getLeadership1on1Template(date: string, email: string): string {
    return `---
date: ${date}
member: ${email}
type: leadership-1on1
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

  getTemplate(type: FileType, date: string, email: string): string {
    switch (type) {
      case '1on1':
        return this._oneonone(date, email);
      case 'feedback':
        return this._feedback(date, email);
      case 'assessment':
        return this._assessment(date, email);
      case 'performance-review':
        return this._performanceReview(date, email);
    }
  }

  private _oneonone(date: string, email: string): string {
    return `---
date: ${date}
member: ${email}
type: 1on1
---

# 1:1 with ${email}

## Check-in

## Discussion Topics

## Action Items

## Notes
`;
  }

  private _feedback(date: string, email: string): string {
    return `---
date: ${date}
member: ${email}
type: feedback
---

# Feedback — ${email}

## Situation

## Behavior

## Impact

## Notes
`;
  }

  private _assessment(date: string, email: string): string {
    return `---
date: ${date}
member: ${email}
type: assessment
---

# Skills Assessment — ${email}

## Technical Skills

## Soft Skills

## Growth Areas

## Strengths

## Notes
`;
  }

  private _performanceReview(date: string, email: string): string {
    return `---
date: ${date}
member: ${email}
type: performance-review
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
