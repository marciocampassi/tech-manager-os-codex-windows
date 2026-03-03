import Anthropic from '@anthropic-ai/sdk';
import { BaseAIProvider } from './base-ai-provider.js';
import { AIProviderError } from './ai-provider.interface.js';
import type { GenerateOptions } from './ai-provider.interface.js';

export class AnthropicProvider extends BaseAIProvider {
  // Architecture specifies 'claude' as the canonical provider key (database-schema.md, components.md)
  readonly name = 'claude' as const;
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    super();
    this.client = new Anthropic({ apiKey });
  }

  async testConnection(): Promise<boolean> {
    try {
      // Use models.list — no tokens consumed, no model-name dependency.
      await this.client.models.list();
      return true;
    } catch (err) {
      // 429 = quota/rate-limited but the key IS valid — treat as connected.
      if ((err as { status?: number }).status === 429) return true;
      throw err;
    }
  }

  async generateText(prompt: string, options?: GenerateOptions): Promise<string> {
    try {
      await this.enforceRateLimit();
      const response = await this.withRetry(() =>
        this.client.messages.create({
          model: options?.model ?? 'claude-3-5-sonnet-20241022',
          max_tokens: options?.maxTokens ?? 1024,
          ...(options?.systemPrompt ? { system: options.systemPrompt } : {}),
          messages: [{ role: 'user', content: prompt }],
        }),
      );
      const block = response.content[0];
      return block?.type === 'text' ? block.text : '';
    } catch (err) {
      if (err instanceof AIProviderError) throw err;
      throw new AIProviderError(
        err instanceof Error ? err.message : 'Anthropic request failed',
        this.name,
        err,
      );
    }
  }

  async *streamText(prompt: string, options?: GenerateOptions): AsyncGenerator<string> {
    try {
      await this.enforceRateLimit();
      const stream = await this.withRetry(() =>
        this.client.messages.create({
          model: options?.model ?? 'claude-3-5-sonnet-20241022',
          max_tokens: options?.maxTokens ?? 1024,
          ...(options?.systemPrompt ? { system: options.systemPrompt } : {}),
          messages: [{ role: 'user', content: prompt }],
          stream: true,
        }),
      );
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield event.delta.text;
        }
      }
    } catch (err) {
      if (err instanceof AIProviderError) throw err;
      throw new AIProviderError(
        err instanceof Error ? err.message : 'Anthropic stream failed',
        this.name,
        err,
      );
    }
  }
}
