import { GoogleGenerativeAI } from '@google/generative-ai';
import { BaseAIProvider } from './base-ai-provider.js';
import { AIProviderError } from './ai-provider.interface.js';
import type { GenerateOptions } from './ai-provider.interface.js';

const DEFAULT_MODEL = 'gemini-2.0-flash-lite';
const LIST_MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiProvider extends BaseAIProvider {
  readonly name = 'gemini';
  private readonly genAI: GoogleGenerativeAI;
  private readonly apiKey: string;

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async testConnection(): Promise<boolean> {
    // Use ListModels — no tokens consumed, no model-name dependency.
    const response = await fetch(`${LIST_MODELS_URL}?key=${this.apiKey}`);

    // 429 = quota exceeded on free tier, but the key IS valid.
    if (response.status === 429) return true;

    if (!response.ok) {
      const body = await response.text();
      let message: string;
      try {
        const parsed = JSON.parse(body) as { error?: { message?: string } };
        message = parsed.error?.message ?? body;
      } catch {
        message = body;
      }
      throw new Error(message);
    }
    return true;
  }

  async generateText(prompt: string, options?: GenerateOptions): Promise<string> {
    try {
      await this.enforceRateLimit();
      const model = this.genAI.getGenerativeModel({
        model: options?.model ?? DEFAULT_MODEL,
      });
      const result = await this.withRetry(() => model.generateContent(prompt));
      return result.response.text();
    } catch (err) {
      if (err instanceof AIProviderError) throw err;
      throw new AIProviderError(
        err instanceof Error ? err.message : 'Gemini request failed',
        this.name,
        err,
      );
    }
  }

  async *streamText(prompt: string, options?: GenerateOptions): AsyncGenerator<string> {
    try {
      await this.enforceRateLimit();
      const model = this.genAI.getGenerativeModel({
        model: options?.model ?? DEFAULT_MODEL,
      });
      const result = await this.withRetry(() => model.generateContentStream(prompt));
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) yield text;
      }
    } catch (err) {
      if (err instanceof AIProviderError) throw err;
      throw new AIProviderError(
        err instanceof Error ? err.message : 'Gemini stream failed',
        this.name,
        err,
      );
    }
  }
}
