import { describe, it, expect } from '@jest/globals';
import { TemplateService } from '../../src/services/template.service.js';

const DATE = '2026-03-07';
const EMAIL = 'john@co.com';

describe('TemplateService', () => {
  const svc = new TemplateService();

  describe('getTemplate("1on1")', () => {
    it('returns content with correct frontmatter', () => {
      const result = svc.getTemplate('1on1', DATE, EMAIL);
      expect(result).toContain(`date: ${DATE}`);
      expect(result).toContain(`member: ${EMAIL}`);
      expect(result).toContain('type: 1on1');
    });

    it('includes all required sections', () => {
      const result = svc.getTemplate('1on1', DATE, EMAIL);
      expect(result).toContain('## Check-in');
      expect(result).toContain('## Discussion Topics');
      expect(result).toContain('## Action Items');
      expect(result).toContain('## Notes');
    });

    it('includes email in title', () => {
      const result = svc.getTemplate('1on1', DATE, EMAIL);
      expect(result).toContain(`# 1:1 with ${EMAIL}`);
    });
  });

  describe('getTemplate("feedback")', () => {
    it('returns content with correct frontmatter', () => {
      const result = svc.getTemplate('feedback', DATE, EMAIL);
      expect(result).toContain(`date: ${DATE}`);
      expect(result).toContain(`member: ${EMAIL}`);
      expect(result).toContain('type: feedback');
    });

    it('includes SBI sections', () => {
      const result = svc.getTemplate('feedback', DATE, EMAIL);
      expect(result).toContain('## Situation');
      expect(result).toContain('## Behavior');
      expect(result).toContain('## Impact');
    });
  });

  describe('getTemplate("assessment")', () => {
    it('returns content with correct frontmatter', () => {
      const result = svc.getTemplate('assessment', DATE, EMAIL);
      expect(result).toContain('type: assessment');
    });

    it('includes skills sections', () => {
      const result = svc.getTemplate('assessment', DATE, EMAIL);
      expect(result).toContain('## Technical Skills');
      expect(result).toContain('## Soft Skills');
      expect(result).toContain('## Growth Areas');
      expect(result).toContain('## Strengths');
    });
  });

  describe('getTemplate("performance-review")', () => {
    it('returns content with correct frontmatter', () => {
      const result = svc.getTemplate('performance-review', DATE, EMAIL);
      expect(result).toContain('type: performance-review');
    });

    it('includes review sections', () => {
      const result = svc.getTemplate('performance-review', DATE, EMAIL);
      expect(result).toContain('## Accomplishments');
      expect(result).toContain('## Growth Areas');
      expect(result).toContain('## Goals for Next Period');
      expect(result).toContain('## Manager Notes');
    });
  });

  describe('getRelationship1on1Template', () => {
    it('returns content with correct frontmatter', () => {
      const result = svc.getRelationship1on1Template(DATE, EMAIL);
      expect(result).toContain(`date: ${DATE}`);
      expect(result).toContain(`member: ${EMAIL}`);
      expect(result).toContain('type: 1on1');
    });

    it('includes relationship-specific sections', () => {
      const result = svc.getRelationship1on1Template(DATE, EMAIL);
      expect(result).toContain('## Alignment Topics');
      expect(result).toContain('## Support Needed');
      expect(result).toContain('## Feedback Requested');
      expect(result).toContain('## Notes');
    });

    it('does NOT include member-1on1-specific sections', () => {
      const result = svc.getRelationship1on1Template(DATE, EMAIL);
      expect(result).not.toContain('## Check-in');
      expect(result).not.toContain('## Discussion Topics');
      expect(result).not.toContain('## Action Items');
    });
  });

  describe('getLeadership1on1Template', () => {
    it('returns content with correct frontmatter', () => {
      const result = svc.getLeadership1on1Template(DATE, EMAIL);
      expect(result).toContain(`date: ${DATE}`);
      expect(result).toContain(`member: ${EMAIL}`);
      expect(result).toContain('type: leadership-1on1');
    });

    it('includes leadership-specific sections', () => {
      const result = svc.getLeadership1on1Template(DATE, EMAIL);
      expect(result).toContain('## Alignment Topics');
      expect(result).toContain('## Support Needed');
      expect(result).toContain('## Feedback Requested');
      expect(result).toContain('## Notes');
    });

    it('does NOT include team member 1on1-specific sections', () => {
      const result = svc.getLeadership1on1Template(DATE, EMAIL);
      expect(result).not.toContain('## Check-in');
      expect(result).not.toContain('## Discussion Topics');
      expect(result).not.toContain('## Action Items');
    });

    it('uses type: leadership-1on1, distinct from relationship type: 1on1', () => {
      const leadership = svc.getLeadership1on1Template(DATE, EMAIL);
      const relationship = svc.getRelationship1on1Template(DATE, EMAIL);
      expect(leadership).toContain('type: leadership-1on1');
      expect(relationship).toContain('type: 1on1');
      expect(leadership).not.toContain('type: 1on1');
    });
  });

  describe('getProjectOverviewTemplate', () => {
    it('returns correct frontmatter and sections', () => {
      const result = svc.getProjectOverviewTemplate('platform', DATE);
      expect(result).toContain('name: platform');
      expect(result).toContain('type: project');
      expect(result).toContain(`date_created: ${DATE}`);
      expect(result).toContain('# platform');
      expect(result).toContain('## Overview');
      expect(result).toContain('## Goals');
      expect(result).toContain('## Timeline');
      expect(result).toContain('## Notes');
    });
  });

  describe('getProjectCompositionTemplate', () => {
    it('returns both single-hash section headers', () => {
      const result = svc.getProjectCompositionTemplate();
      expect(result).toContain('# Team Members');
      expect(result).toContain('# Stakeholders');
    });
  });

  describe('getStandupTemplate', () => {
    it('returns correct frontmatter and sections', () => {
      const result = svc.getStandupTemplate(DATE, 'platform');
      expect(result).toContain(`date: ${DATE}`);
      expect(result).toContain('project: platform');
      expect(result).toContain('type: standup');
      expect(result).toContain('## Yesterday');
      expect(result).toContain('## Today');
      expect(result).toContain('## Blockers');
    });
  });

  describe('getDiscussionTemplate', () => {
    it('returns correct frontmatter and sections', () => {
      const result = svc.getDiscussionTemplate(DATE, 'platform');
      expect(result).toContain('type: discussion');
      expect(result).toContain('## Topic');
      expect(result).toContain('## Attendees');
      expect(result).toContain('## Decisions');
      expect(result).toContain('## Action Items');
    });
  });

  describe('getPresentationTemplate', () => {
    it('returns correct frontmatter including topic', () => {
      const result = svc.getPresentationTemplate(DATE, 'platform', 'Q1 Review');
      expect(result).toContain('type: presentation');
      expect(result).toContain('topic: Q1 Review');
      expect(result).toContain('# platform — Q1 Review');
      expect(result).toContain('## Slides Outline');
      expect(result).toContain('## Talking Points');
      expect(result).toContain('## Q&A');
    });
  });

  it('substitutes different dates and emails correctly', () => {
    const result = svc.getTemplate('1on1', '2025-12-01', 'alice@example.com');
    expect(result).toContain('date: 2025-12-01');
    expect(result).toContain('member: alice@example.com');
    expect(result).toContain('# 1:1 with alice@example.com');
  });
});
