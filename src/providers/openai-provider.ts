import OpenAI from 'openai';
import { BaseAIProvider } from './base-ai-provider.js';
import { AIProviderError } from './ai-provider.interface.js';
import type { GenerateOptions } from './ai-provider.interface.js';

export class OpenAIProvider extends BaseAIProvider {
  readonly name = 'openai';
  private readonly client: OpenAI;

  constructor(apiKey: string) {
    super();
    this.client = new OpenAI({ apiKey });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  async generateText(prompt: string, options?: GenerateOptions): Promise<string> {
    try {
      await this.enforceRateLimit();
      const response = await this.withRetry(() =>
        this.client.chat.completions.create({
          model: options?.model ?? 'gpt-4o-mini',
          messages: [
            ...(options?.systemPrompt
              ? [{ role: 'system' as const, content: options.systemPrompt }]
              : []),
            { role: 'user' as const, content: prompt },
          ],
          max_tokens: options?.maxTokens,
          temperature: options?.temperature,
          stream: false,
        }),
      );
      return response.choices[0]?.message?.content ?? '';
    } catch (err) {
      if (err instanceof AIProviderError) throw err;
      throw new AIProviderError(
        err instanceof Error ? err.message : 'OpenAI request failed',
        this.name,
        err,
      );
    }
  }

  async *streamText(prompt: string, options?: GenerateOptions): AsyncGenerator<string> {
    try {
      await this.enforceRateLimit();
      const stream = await this.withRetry(() =>
        this.client.chat.completions.create({
          model: options?.model ?? 'gpt-4o-mini',
          messages: [
            ...(options?.systemPrompt
              ? [{ role: 'system' as const, content: options.systemPrompt }]
              : []),
            { role: 'user' as const, content: prompt },
          ],
          max_tokens: options?.maxTokens,
          temperature: options?.temperature,
          stream: true,
        }),
      );
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) yield text;
      }
    } catch (err) {
      if (err instanceof AIProviderError) throw err;
      throw new AIProviderError(
        err instanceof Error ? err.message : 'OpenAI stream failed',
        this.name,
        err,
      );
    }
  }
}
