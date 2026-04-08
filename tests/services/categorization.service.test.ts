import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { CategorizationService, SYSTEM_PROMPT } from '../../src/services/categorization.service.js';
import { MockAIProvider } from '../../src/providers/mock-provider.js';
import { AIProviderError } from '../../src/providers/ai-provider.interface.js';
import {
  LOW_CONFIDENCE_THRESHOLD,
  NOTE_TYPES,
  type NoteType,
  type CategorizationContext,
} from '../../src/types/categorization.types.js';
import type { InboxFile } from '../../src/types/inbox.types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeFile(overrides: Partial<InboxFile> = {}): InboxFile {
  return {
    filepath: '/workspace/inbox/meeting.md',
    content: '# 1:1 with John\n\nDiscussed career growth and roadmap.',
    timestamp: new Date('2026-03-01T09:00:00Z'),
    ...overrides,
  };
}

function makeContext(overrides: Partial<CategorizationContext> = {}): CategorizationContext {
  return {
    members: [{ email: 'john.doe@co.com', name: 'John Doe', team: 'alpha' }],
    projects: [{ name: 'api-redesign', displayName: 'API Redesign Initiative' }],
    ...overrides,
  };
}

function makeValidPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: '1on1_session',
    members: ['John Doe'],
    projects: [],
    insights: { 'John Doe': ['Career growth discussed', 'Wants more mentorship'] },
    destinations: ['my-teams/alpha/john.doe@co.com/1on1s/'],
    suggestedActions: ['Follow up on career plan by Friday'],
    confidence: 0.92,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('CategorizationService', () => {
  let svc: CategorizationService;

  beforeEach(() => {
    svc = new CategorizationService(new MockAIProvider(() => JSON.stringify(makeValidPayload())));
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('returns a successful CategorizationResult for a valid AI response', async () => {
    const result = await svc.categorize(makeFile(), makeContext());

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.type).toBe('1on1_session');
    expect(result.data.members).toEqual(['John Doe']);
    expect(result.data.projects).toEqual([]);
    expect(result.data.insights).toEqual({
      'John Doe': ['Career growth discussed', 'Wants more mentorship'],
    });
    expect(result.data.destinations).toEqual(['my-teams/alpha/john.doe@co.com/1on1s/']);
    expect(result.data.suggestedActions).toEqual(['Follow up on career plan by Friday']);
    expect(result.data.confidence).toBe(0.92);
    expect(result.data.needsReview).toBe(false); // 0.92 >= 0.75
  });

  // ── All NoteType values ───────────────────────────────────────────────────

  it.each([...NOTE_TYPES])('correctly round-trips NoteType "%s"', async (noteType) => {
    const ai = new MockAIProvider(() => JSON.stringify(makeValidPayload({ type: noteType })));
    const result = await new CategorizationService(ai).categorize(makeFile(), makeContext());

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.type).toBe(noteType as NoteType);
  });

  // ── Confidence / needsReview ──────────────────────────────────────────────

  it('sets needsReview=true when confidence is below the default threshold', async () => {
    const ai = new MockAIProvider(() => JSON.stringify(makeValidPayload({ confidence: 0.6 })));
    const result = await new CategorizationService(ai).categorize(makeFile(), makeContext());

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.needsReview).toBe(true);
    expect(result.data.confidence).toBe(0.6);
  });

  it('sets needsReview=false when confidence equals the threshold exactly', async () => {
    const ai = new MockAIProvider(() =>
      JSON.stringify(makeValidPayload({ confidence: LOW_CONFIDENCE_THRESHOLD })),
    );
    const result = await new CategorizationService(ai).categorize(makeFile(), makeContext());

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.needsReview).toBe(false); // 0.75 is NOT below 0.75
  });

  it('sets needsReview=false when confidence is above the default threshold', async () => {
    const ai = new MockAIProvider(() => JSON.stringify(makeValidPayload({ confidence: 0.9 })));
    const result = await new CategorizationService(ai).categorize(makeFile(), makeContext());

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.needsReview).toBe(false);
  });

  it('uses a custom confidence threshold passed to the constructor', async () => {
    const ai = new MockAIProvider(() => JSON.stringify(makeValidPayload({ confidence: 0.8 })));
    // Custom threshold of 0.90 → 0.80 < 0.90 → needsReview
    const custom = new CategorizationService(ai, 0.9);
    const result = await custom.categorize(makeFile(), makeContext());

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.needsReview).toBe(true);
  });

  // ── Empty context ─────────────────────────────────────────────────────────

  it('produces a valid result when context has no members or projects', async () => {
    const result = await svc.categorize(makeFile(), makeContext({ members: [], projects: [] }));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.type).toBe('1on1_session');
  });

  // ── Malformed AI response ─────────────────────────────────────────────────

  it('returns error result when AI returns invalid JSON', async () => {
    const ai = new MockAIProvider(() => 'this is not json at all');
    const result = await new CategorizationService(ai).categorize(makeFile(), makeContext());

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('invalid JSON');
  });

  it('returns error result when AI returns JSON with missing required fields', async () => {
    const ai = new MockAIProvider(
      () => JSON.stringify({ type: '1on1_session', confidence: 0.9 }), // missing members, projects, etc.
    );
    const result = await new CategorizationService(ai).categorize(makeFile(), makeContext());

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('missing required fields');
  });

  it('returns error result when AI returns an invalid NoteType value', async () => {
    const ai = new MockAIProvider(() => JSON.stringify(makeValidPayload({ type: 'unknown_type' })));
    const result = await new CategorizationService(ai).categorize(makeFile(), makeContext());

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('missing required fields');
  });

  it('returns error result when AI returns confidence outside [0, 1]', async () => {
    const ai = new MockAIProvider(() => JSON.stringify(makeValidPayload({ confidence: 1.5 })));
    const result = await new CategorizationService(ai).categorize(makeFile(), makeContext());

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('missing required fields');
  });

  it('returns error result when insights contains non-string-array values', async () => {
    const ai = new MockAIProvider(() =>
      JSON.stringify(makeValidPayload({ insights: { 'John Doe': 'not an array' } })),
    );
    const result = await new CategorizationService(ai).categorize(makeFile(), makeContext());

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('missing required fields');
  });

  // ── AI provider errors ────────────────────────────────────────────────────

  it('returns error result when AI generateText throws AIProviderError', async () => {
    const mockGenerateFn = jest
      .fn<() => Promise<string>>()
      .mockRejectedValue(new AIProviderError('Rate limit exceeded', 'mock'));
    const ai = new MockAIProvider();
    jest.spyOn(ai, 'generateText').mockImplementation(mockGenerateFn);
    const result = await new CategorizationService(ai).categorize(makeFile(), makeContext());

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('Rate limit exceeded');
  });

  it('returns error result when AI generateText throws a generic Error', async () => {
    const mockGenerateFn = jest
      .fn<() => Promise<string>>()
      .mockRejectedValue(new Error('Network timeout'));
    const ai = new MockAIProvider();
    jest.spyOn(ai, 'generateText').mockImplementation(mockGenerateFn);
    const result = await new CategorizationService(ai).categorize(makeFile(), makeContext());

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('Network timeout');
  });

  it('returns error result when AI generateText throws a non-Error value', async () => {
    const mockGenerateFn = jest.fn<() => Promise<string>>().mockRejectedValue('string rejection');
    const ai = new MockAIProvider();
    jest.spyOn(ai, 'generateText').mockImplementation(mockGenerateFn);
    const result = await new CategorizationService(ai).categorize(makeFile(), makeContext());

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe('AI provider request failed');
  });

  // ── Prompt contents ───────────────────────────────────────────────────────

  it('includes file content and member info in the generated prompt', async () => {
    let capturedPrompt = '';
    const ai = new MockAIProvider((prompt) => {
      capturedPrompt = prompt;
      return JSON.stringify(makeValidPayload());
    });
    const file = makeFile({ content: 'Super important meeting content' });
    const ctx = makeContext({
      members: [{ email: 'jane@co.com', name: 'Jane Smith', team: 'beta' }],
    });

    await new CategorizationService(ai).categorize(file, ctx);

    expect(capturedPrompt).toContain('Super important meeting content');
    expect(capturedPrompt).toContain('Jane Smith');
    expect(capturedPrompt).toContain('jane@co.com');
    expect(capturedPrompt).toContain('beta');
  });

  it('includes project info in the generated prompt', async () => {
    let capturedPrompt = '';
    const ai = new MockAIProvider((prompt) => {
      capturedPrompt = prompt;
      return JSON.stringify(makeValidPayload());
    });
    const ctx = makeContext({
      projects: [{ name: 'platform-v2', displayName: 'Platform v2 Rewrite' }],
    });

    await new CategorizationService(ai).categorize(makeFile(), ctx);

    expect(capturedPrompt).toContain('platform-v2');
    expect(capturedPrompt).toContain('Platform v2 Rewrite');
  });

  it('shows (none) for members when context has no members', async () => {
    let capturedPrompt = '';
    const ai = new MockAIProvider((prompt) => {
      capturedPrompt = prompt;
      return JSON.stringify(makeValidPayload());
    });
    await new CategorizationService(ai).categorize(makeFile(), makeContext({ members: [] }));

    expect(capturedPrompt).toContain('(none)');
  });

  // ── Markdown fence stripping ──────────────────────────────────────────────

  it('correctly parses AI response wrapped in ```json fences', async () => {
    const payload = makeValidPayload();
    const fencedResponse = `\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``;
    const ai = new MockAIProvider(() => fencedResponse);
    const result = await new CategorizationService(ai).categorize(makeFile(), makeContext());

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.type).toBe('1on1_session');
  });

  it('correctly parses AI response wrapped in plain ``` fences', async () => {
    const payload = makeValidPayload();
    const fencedResponse = `\`\`\`\n${JSON.stringify(payload)}\n\`\`\``;
    const ai = new MockAIProvider(() => fencedResponse);
    const result = await new CategorizationService(ai).categorize(makeFile(), makeContext());

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.type).toBe('1on1_session');
  });

  // ── SYSTEM_PROMPT export ──────────────────────────────────────────────────

  it('exports a non-empty SYSTEM_PROMPT constant', () => {
    expect(typeof SYSTEM_PROMPT).toBe('string');
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(50);
    expect(SYSTEM_PROMPT).toContain('1on1_session');
  });
});
