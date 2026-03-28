/**
 * Integration tests for CategorizationService.
 *
 * Uses a real temp filesystem and InboxService.parseFile() to produce
 * actual InboxFile objects, then processes them with CategorizationService
 * backed by a MockAIProvider. This validates the full categorization
 * pipeline without requiring a live AI API key.
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { CategorizationService } from '../../src/services/categorization.service.js';
import { MockAIProvider } from '../../src/providers/mock-provider.js';
import type { CategorizationContext } from '../../src/types/categorization.types.js';

// Dynamic import of InboxService (no fs-extra mock in this integration file)
const { InboxService } = await import('../../src/services/inbox.service.js');
const { fileSystemService } = await import('../../src/services/file-system.service.js');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FIXTURE_MD = `---
granola_id: abc123
title: "1:1 with John Doe"
date: 2026-03-01
attendees:
  - john.doe@co.com
  - manager@co.com
type: meeting
---

# 1:1 with John Doe

## Transcript

John mentioned he wants to grow into a senior role within the next 6 months.
He's concerned about the timeline for the api-redesign project.
Action: Manager to set up a career growth plan by Friday.
`;

const FIXTURE_TXT = `Quick note from standup:
Jane Smith gave an excellent presentation.
The platform-v2 demo was well received.
No action items.
`;

function makeValidAIResponse(type: string, confidence: number): string {
  return JSON.stringify({
    type,
    members: ['John Doe'],
    projects: ['api-redesign'],
    insights: {
      'John Doe': ['Wants to grow into senior role in 6 months'],
      'api-redesign': ['Timeline concern raised'],
    },
    destinations: ['my-teams/alpha/john.doe@co.com/1on1s/'],
    suggestedActions: ['Set up career growth plan by Friday'],
    confidence,
  });
}

function makeContext(overrides: Partial<CategorizationContext> = {}): CategorizationContext {
  return {
    members: [
      { email: 'john.doe@co.com', name: 'John Doe', team: 'alpha' },
      { email: 'jane.smith@co.com', name: 'Jane Smith', team: 'beta' },
    ],
    projects: [
      { name: 'api-redesign', displayName: 'API Redesign Initiative' },
      { name: 'platform-v2', displayName: 'Platform v2 Rewrite' },
    ],
    ...overrides,
  };
}

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('CategorizationService (integration)', () => {
  let tmpDir: string;
  let inboxDir: string;
  let inboxSvc: InstanceType<typeof InboxService>;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmr-cat-int-test-'));
    inboxDir = path.join(tmpDir, 'inbox');
    fs.ensureDirSync(inboxDir);
    inboxSvc = new InboxService(fileSystemService);
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  it('categorizes a real .md fixture file end-to-end', async () => {
    const filePath = path.join(inboxDir, 'meeting-john.md');
    fs.writeFileSync(filePath, FIXTURE_MD, 'utf-8');

    const parsedResult = await inboxSvc.parseFile(filePath);
    expect(parsedResult.success).toBe(true);
    if (!parsedResult.success) return;

    const ai = new MockAIProvider(() => makeValidAIResponse('1on1_session', 0.92));
    const catSvc = new CategorizationService(ai);

    const result = await catSvc.categorize(parsedResult.data, makeContext());

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.type).toBe('1on1_session');
    expect(result.data.members).toContain('John Doe');
    expect(result.data.projects).toContain('api-redesign');
    expect(result.data.destinations.length).toBeGreaterThan(0);
    expect(result.data.suggestedActions.length).toBeGreaterThan(0);
    expect(result.data.needsReview).toBe(false); // 0.92 >= 0.75
    expect(result.data.confidence).toBe(0.92);
  });

  it('categorizes a real .txt fixture file end-to-end', async () => {
    const filePath = path.join(inboxDir, 'standup-note.txt');
    fs.writeFileSync(filePath, FIXTURE_TXT, 'utf-8');

    const parsedResult = await inboxSvc.parseFile(filePath);
    expect(parsedResult.success).toBe(true);
    if (!parsedResult.success) return;

    const ai = new MockAIProvider(() =>
      JSON.stringify({
        type: 'team_meeting',
        members: ['Jane Smith'],
        projects: ['platform-v2'],
        insights: {
          'Jane Smith': ['Excellent presentation'],
          'platform-v2': ['Demo well received'],
        },
        destinations: ['my-teams/beta/meetings/'],
        suggestedActions: [],
        confidence: 0.88,
      }),
    );
    const catSvc = new CategorizationService(ai);

    const result = await catSvc.categorize(parsedResult.data, makeContext());

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.type).toBe('team_meeting');
    expect(result.data.members).toContain('Jane Smith');
    expect(result.data.needsReview).toBe(false);
  });

  it('flags needsReview when AI returns low confidence for a real file', async () => {
    const filePath = path.join(inboxDir, 'ambiguous.md');
    fs.writeFileSync(filePath, '# Notes\n\nSome vague notes here.', 'utf-8');

    const parsedResult = await inboxSvc.parseFile(filePath);
    expect(parsedResult.success).toBe(true);
    if (!parsedResult.success) return;

    const ai = new MockAIProvider(() =>
      JSON.stringify({
        type: 'general_note',
        members: [],
        projects: [],
        insights: {},
        destinations: [],
        suggestedActions: [],
        confidence: 0.45,
      }),
    );
    const catSvc = new CategorizationService(ai);

    const result = await catSvc.categorize(
      parsedResult.data,
      makeContext({ members: [], projects: [] }),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.needsReview).toBe(true);
    expect(result.data.confidence).toBe(0.45);
  });

  it('returns error result when AI response is malformed (integration)', async () => {
    const filePath = path.join(inboxDir, 'note.md');
    fs.writeFileSync(filePath, '# Note\n\nSome content.', 'utf-8');

    const parsedResult = await inboxSvc.parseFile(filePath);
    expect(parsedResult.success).toBe(true);
    if (!parsedResult.success) return;

    const ai = new MockAIProvider(() => 'not-valid-json');
    const catSvc = new CategorizationService(ai);

    const result = await catSvc.categorize(parsedResult.data, makeContext());

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('invalid JSON');
  });
});
