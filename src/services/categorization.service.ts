import type { AIProvider } from '../providers/ai-provider.interface.js';
import type { InboxFile } from '../types/inbox.types.js';
import {
  NOTE_TYPES,
  LOW_CONFIDENCE_THRESHOLD,
  type NoteType,
  type CategorizationContext,
  type CategorizationResult,
} from '../types/categorization.types.js';

type Result<T> = { success: true; data: T } | { success: false; error: string };

/**
 * System prompt used for every categorization call.
 * Instructs the model to return ONLY a JSON object — no markdown fences or explanation.
 */
export const SYSTEM_PROMPT = `You are an expert categorization assistant for an engineering manager's workspace.
Analyze the provided note and respond with ONLY a valid JSON object — no markdown, no explanation, no code fences.
The JSON must have this exact structure:
{
  "type": "<one of: 1on1_session|feedback_positive|feedback_constructive|pip_concern|project_status|project_risk|team_meeting|leadership_meeting|candidate_interview|general_note>",
  "members": ["array of member names explicitly mentioned"],
  "projects": ["array of project names explicitly mentioned"],
  "insights": { "<member_or_project_name>": ["key insight 1", "key insight 2"] },
  "destinations": ["workspace-relative path for filing this note, e.g. my-teams/members/john@co.com/1on1s/"],
  "suggestedActions": ["specific follow-up action item"],
  "confidence": 0.95
}
Rules:
- "type" must be one of the exact values listed above
- "confidence" must be a number between 0 and 1 representing your certainty
- "destinations" must use known member emails and team names from the provided context
- If uncertain about routing, lower the confidence score; do not guess member emails
- All array fields must be present (use empty arrays when nothing applies)
- "insights" keys should match member names or project names mentioned in the note`;

/** Internal shape of the raw AI payload before `needsReview` is appended. */
type RawAIPayload = Omit<CategorizationResult, 'needsReview'>;

/**
 * Runtime type-guard for the raw AI JSON payload.
 * Validates structure without Zod (not installed in project).
 */
function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((item) => typeof item === 'string');
}

function isStringRecord(v: unknown): v is Record<string, string[]> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  return Object.values(v as Record<string, unknown>).every(isStringArray);
}

function isValidNoteType(v: unknown): v is NoteType {
  return typeof v === 'string' && NOTE_TYPES.has(v as NoteType);
}

function isRawAIPayload(obj: unknown): obj is RawAIPayload {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    isValidNoteType(o['type']) &&
    isStringArray(o['members']) &&
    isStringArray(o['projects']) &&
    isStringRecord(o['insights']) &&
    isStringArray(o['destinations']) &&
    isStringArray(o['suggestedActions']) &&
    typeof o['confidence'] === 'number' &&
    (o['confidence'] as number) >= 0 &&
    (o['confidence'] as number) <= 1
  );
}

export class CategorizationService {
  constructor(
    private readonly _ai: AIProvider,
    private readonly _confidenceThreshold: number = LOW_CONFIDENCE_THRESHOLD,
  ) {}

  /**
   * Builds the user-facing prompt embedding identity context and file content.
   * The system prompt is passed separately via `generateText` options.
   */
  private _buildPrompt(file: InboxFile, context: CategorizationContext): string {
    const memberLines =
      context.members.length > 0
        ? context.members.map((m) => `- ${m.name} <${m.email}> (team: ${m.team})`).join('\n')
        : '(none)';

    const projectLines =
      context.projects.length > 0
        ? context.projects.map((p) => `- ${p.name} (${p.displayName})`).join('\n')
        : '(none)';

    return [
      'Known team members:',
      memberLines,
      '',
      'Known projects:',
      projectLines,
      '',
      `Note filepath: ${file.filepath}`,
      'Note content:',
      file.content,
    ].join('\n');
  }

  /**
   * Parses and validates the raw AI JSON string.
   * Returns an error result if the JSON is malformed or the shape is incorrect.
   *
   * Strips markdown code fences (```json...```) before parsing — some LLMs add
   * them despite system-prompt instructions to return bare JSON.
   */
  private _parseAIResponse(raw: string): Result<RawAIPayload> {
    let cleaned = raw.trim();
    // Strip ``` or ```json fences if present
    if (cleaned.startsWith('```')) {
      const lines = cleaned.split('\n');
      const lastLine = lines[lines.length - 1]?.trim();
      cleaned = lines.slice(1, lastLine === '```' ? -1 : undefined).join('\n');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return {
        success: false,
        error: `AI returned invalid JSON: ${raw.slice(0, 120)}`,
      };
    }

    if (!isRawAIPayload(parsed)) {
      return {
        success: false,
        error: 'AI response missing required fields or contains invalid types',
      };
    }

    return { success: true, data: parsed };
  }

  /**
   * Categorizes a single inbox file using the configured AI provider.
   *
   * - Builds a prompt embedding `context` (lightweight identity list) and `file.content`.
   * - Parses the AI's JSON response and validates its structure.
   * - Sets `needsReview = true` when `confidence < confidenceThreshold`.
   * - Returns `{ success: false, error }` on AI failure or invalid response shape.
   */
  async categorize(
    file: InboxFile,
    context: CategorizationContext,
  ): Promise<Result<CategorizationResult>> {
    const prompt = this._buildPrompt(file, context);

    let raw: string;
    try {
      raw = await this._ai.generateText(prompt, {
        systemPrompt: SYSTEM_PROMPT,
        maxTokens: 1024,
      });
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'AI provider request failed',
      };
    }

    const parsed = this._parseAIResponse(raw);
    if (!parsed.success) {
      return parsed;
    }

    const result: CategorizationResult = {
      ...parsed.data,
      needsReview: parsed.data.confidence < this._confidenceThreshold,
    };

    return { success: true, data: result };
  }
}
