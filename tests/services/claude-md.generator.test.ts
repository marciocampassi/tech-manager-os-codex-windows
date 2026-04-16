import { describe, it, expect } from '@jest/globals';
import { generateClaudeMd } from '../../src/services/claude-md.generator.js';
import type { ClaudeMdData } from '../../src/services/claude-md.generator.js';

const SAMPLE_DATA: ClaudeMdData = {
  name: 'Alice Example',
  email: 'alice@example.com',
  role: 'Engineering Manager',
  company: 'example.com',
};

describe('generateClaudeMd', () => {
  describe('identity block', () => {
    it('includes the name in the identity block', () => {
      expect(generateClaudeMd(SAMPLE_DATA)).toContain('**Name:** Alice Example');
    });

    it('includes the email in the identity block', () => {
      expect(generateClaudeMd(SAMPLE_DATA)).toContain('**Email:** alice@example.com');
    });

    it('includes the role in the identity block', () => {
      expect(generateClaudeMd(SAMPLE_DATA)).toContain('**Role:** Engineering Manager');
    });

    it('includes the company in the identity block', () => {
      expect(generateClaudeMd(SAMPLE_DATA)).toContain('**Company:** example.com');
    });
  });

  describe('structure', () => {
    it('starts with the # CLAUDE.md heading', () => {
      const result = generateClaudeMd(SAMPLE_DATA);
      expect(result.startsWith('# CLAUDE.md')).toBe(true);
    });

    it('contains a ## Identity section', () => {
      expect(generateClaudeMd(SAMPLE_DATA)).toContain('## Identity');
    });

    it('contains a ## Vault Structure section with a markdown table', () => {
      const result = generateClaudeMd(SAMPLE_DATA);
      expect(result).toContain('## Vault Structure');
      expect(result).toContain('| Folder | Purpose |');
    });

    it('contains a ## Communication Style section with placeholders', () => {
      const result = generateClaudeMd(SAMPLE_DATA);
      expect(result).toContain('## Communication Style');
      expect(result).toContain('Preferred tone');
      expect(result).toContain('Meeting preferences');
      expect(result).toContain('Feedback approach');
    });

    it('contains a ## Company & Team Context section', () => {
      expect(generateClaudeMd(SAMPLE_DATA)).toContain('## Company & Team Context');
    });

    it('references my-company/ in the context section', () => {
      expect(generateClaudeMd(SAMPLE_DATA)).toContain('my-company/');
    });

    it('references my-teams/ in the context section', () => {
      expect(generateClaudeMd(SAMPLE_DATA)).toContain('my-teams/');
    });
  });

  describe('vault structure table', () => {
    it('lists inbox/ folder', () => {
      expect(generateClaudeMd(SAMPLE_DATA)).toContain('`inbox/`');
    });

    it('lists my-tasks/ folder', () => {
      expect(generateClaudeMd(SAMPLE_DATA)).toContain('`my-tasks/`');
    });

    it('lists knowledge-base/ folder', () => {
      expect(generateClaudeMd(SAMPLE_DATA)).toContain('`knowledge-base/`');
    });
  });

  describe('output format', () => {
    it('ends with a newline', () => {
      const result = generateClaudeMd(SAMPLE_DATA);
      expect(result.endsWith('\n')).toBe(true);
    });

    it('produces deterministic output for the same input', () => {
      expect(generateClaudeMd(SAMPLE_DATA)).toBe(generateClaudeMd(SAMPLE_DATA));
    });

    it('produces different output for different identities', () => {
      const other = generateClaudeMd({
        name: 'Bob',
        email: 'bob@corp.com',
        role: 'CTO',
        company: 'corp.com',
      });
      expect(generateClaudeMd(SAMPLE_DATA)).not.toBe(other);
    });
  });
});
