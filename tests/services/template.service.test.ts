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

  it('substitutes different dates and emails correctly', () => {
    const result = svc.getTemplate('1on1', '2025-12-01', 'alice@example.com');
    expect(result).toContain('date: 2025-12-01');
    expect(result).toContain('member: alice@example.com');
    expect(result).toContain('# 1:1 with alice@example.com');
  });
});
