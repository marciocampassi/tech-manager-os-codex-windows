import { GoogleGenerativeAI } from '@google/generative-ai';
import { BaseAIProvider } from './base-ai-provider.js';
import { AIProviderError } from './ai-provider.interface.js';
import type { GenerateOptions } from './ai-provider.interface.js';

export class GeminiProvider extends BaseAIProvider {
  readonly name = 'gemini';
  private readonly genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    super();
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async testConnection(): Promise<boolean> {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      await model.generateContent('ping');
      return true;
    } catch {
      return false;
    }
  }

  async generateText(prompt: string, options?: GenerateOptions): Promise<string> {
    try {
      await this.enforceRateLimit();
      const model = this.genAI.getGenerativeModel({
        model: options?.model ?? 'gemini-1.5-flash',
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
        model: options?.model ?? 'gemini-1.5-flash',
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
