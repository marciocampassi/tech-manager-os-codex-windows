import { describe, it, expect } from '@jest/globals';
import {
  generateActionItemsTemplate,
  generateTeamMemberProfile,
  generateVaultReadme,
  INBOX_SAMPLE_FILES,
} from '../../src/templates/onboarding.templates.js';
import type { TeamMember } from '../../src/types/onboarding.types.js';

describe('generateActionItemsTemplate', () => {
  const EMAIL = 'dev@example.com';

  it('includes the email in frontmatter with quoted wiki-link notation', () => {
    const result = generateActionItemsTemplate(EMAIL);
    expect(result).toContain(`email: "[[${EMAIL}]]"`);
  });

  it('sets type: action-items in frontmatter', () => {
    const result = generateActionItemsTemplate(EMAIL);
    expect(result).toContain('type: action-items');
  });

  it('includes updated date in frontmatter', () => {
    const result = generateActionItemsTemplate(EMAIL);
    expect(result).toMatch(/updated: \d{4}-\d{2}-\d{2}/);
  });

  it('includes ## ACTION ITEMS TRACKER heading', () => {
    const result = generateActionItemsTemplate(EMAIL);
    expect(result).toContain('## ACTION ITEMS TRACKER');
  });

  it('includes Review Frequency checkboxes', () => {
    const result = generateActionItemsTemplate(EMAIL);
    expect(result).toContain('- [ ] Weekly');
    expect(result).toContain('- [ ] Bi-weekly');
    expect(result).toContain('- [ ] Monthly');
  });

  it('includes ## STATUS section with table', () => {
    const result = generateActionItemsTemplate(EMAIL);
    expect(result).toContain('## STATUS');
    expect(result).toContain('Not Started');
    expect(result).toContain('In Progress');
    expect(result).toContain('Blocked');
    expect(result).toContain('Complete');
    expect(result).toContain('On Hold');
  });

  it('includes ## PRIORITY LEVELS section with table', () => {
    const result = generateActionItemsTemplate(EMAIL);
    expect(result).toContain('## PRIORITY LEVELS');
    expect(result).toContain('High');
    expect(result).toContain('Medium');
    expect(result).toContain('Low');
  });

  it('includes ## ACTION ITEMS TABLE with empty rows', () => {
    const result = generateActionItemsTemplate(EMAIL);
    expect(result).toContain('## ACTION ITEMS TABLE');
    expect(result).toContain(
      '| Action Item | Owner/Assignee | Priority | Status | Comments | Follow-up Date |',
    );
  });

  it('includes ## DETAILED ACTION ITEM CARDS section', () => {
    const result = generateActionItemsTemplate(EMAIL);
    expect(result).toContain('## DETAILED ACTION ITEM CARDS');
    expect(result).toContain('DO NOT CHANGE THIS');
  });

  it('generates consistent output for the same email (snapshot-style)', () => {
    const result1 = generateActionItemsTemplate(EMAIL);
    const result2 = generateActionItemsTemplate(EMAIL);
    // Both should have same structure (date may differ in theory, but same run = same date)
    expect(result1.replace(/updated: \d{4}-\d{2}-\d{2}/, 'updated: DATE')).toBe(
      result2.replace(/updated: \d{4}-\d{2}-\d{2}/, 'updated: DATE'),
    );
  });

  it('substitutes different emails correctly', () => {
    const email1 = 'alice@co.com';
    const email2 = 'bob@co.com';
    const r1 = generateActionItemsTemplate(email1);
    const r2 = generateActionItemsTemplate(email2);
    expect(r1).toContain(`email: "[[${email1}]]"`);
    expect(r2).toContain(`email: "[[${email2}]]"`);
    expect(r1).not.toContain(email2);
  });
});

describe('generateTeamMemberProfile', () => {
  const member: TeamMember = {
    email: 'dev@example.com',
    name: 'Dev User',
    gender: 'Male',
    role: 'Engineer',
  };
  const managerEmail = 'manager@example.com';

  it('includes action_items_gdoc frontmatter field', () => {
    const result = generateTeamMemberProfile(member, managerEmail);
    expect(result).toContain("action_items_gdoc: ''");
  });

  it('includes ## Action Items section after ## Feedbacks', () => {
    const result = generateTeamMemberProfile(member, managerEmail);
    expect(result).toContain('## Action Items');
    const feedbacksIdx = result.indexOf('## Feedbacks');
    const actionItemsIdx = result.indexOf('## Action Items');
    expect(actionItemsIdx).toBeGreaterThan(feedbacksIdx);
  });

  it('includes wiki-link to action-items tracker file', () => {
    const result = generateTeamMemberProfile(member, managerEmail);
    expect(result).toContain(`[[action-items-${member.email}|Action Items Tracker]]`);
  });

  it('preserves existing fields (email, name, role, gender)', () => {
    const result = generateTeamMemberProfile(member, managerEmail);
    expect(result).toContain(`"[[${member.email}]]"`);
    expect(result).toContain(member.name);
    expect(result).toContain(member.role);
    expect(result).toContain(member.gender);
  });
});

describe('INBOX_SAMPLE_FILES', () => {
  it('exports exactly two sample files', () => {
    expect(INBOX_SAMPLE_FILES).toHaveLength(2);
  });

  it('first file is 2026-04-10-Marlon-Alex.md', () => {
    expect(INBOX_SAMPLE_FILES[0]?.filename).toBe('2026-04-10-Marlon-Alex.md');
  });

  it('second file is 2026-04-15-Team-Sync.md', () => {
    expect(INBOX_SAMPLE_FILES[1]?.filename).toBe('2026-04-15-Team-Sync.md');
  });

  it('each file contains Granola frontmatter', () => {
    for (const { content } of INBOX_SAMPLE_FILES) {
      expect(content).toContain('granola_id:');
    }
  });

  it('each file contains a top-level markdown heading', () => {
    for (const { content } of INBOX_SAMPLE_FILES) {
      expect(content).toMatch(/^# /m);
    }
  });
});

describe('generateVaultReadme', () => {
  it('contains a README heading', () => {
    const result = generateVaultReadme();
    expect(result).toMatch(/^# /m);
    expect(result.toLowerCase()).toContain('readme');
  });

  it('contains tmr init command reference', () => {
    const result = generateVaultReadme();
    expect(result).toContain('tmr init');
  });

  it('contains tmr project add command reference', () => {
    const result = generateVaultReadme();
    expect(result).toContain('tmr project add');
  });

  it('contains tmr --help command reference', () => {
    const result = generateVaultReadme();
    expect(result).toContain('tmr --help');
  });
});
