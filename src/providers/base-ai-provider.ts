import type { AIProvider, GenerateOptions } from './ai-provider.interface.js';

export abstract class BaseAIProvider implements AIProvider {
  abstract readonly name: string;
  abstract testConnection(): Promise<boolean>;
  abstract generateText(prompt: string, options?: GenerateOptions): Promise<string>;
  // Note: withRetry covers only the initial stream-setup call (the Promise that opens the
  // connection). Mid-stream chunk errors cannot be retried without restarting the full
  // request, so providers iterate the stream outside the retry boundary. (QA-1.4-04)
  abstract streamText(prompt: string, options?: GenerateOptions): AsyncGenerator<string>;

  protected lastCallTime = 0;
  protected minIntervalMs = 0;

  protected async sleep(ms: number): Promise<void> {
    await new Promise<void>(resolve => setTimeout(resolve, ms));
  }

  protected async enforceRateLimit(): Promise<void> {
    if (this.minIntervalMs === 0) return;
    const elapsed = Date.now() - this.lastCallTime;
    if (elapsed < this.minIntervalMs) {
      await this.sleep(this.minIntervalMs - elapsed);
    }
    this.lastCallTime = Date.now();
  }

  protected async withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (!this.isRetryable(err) || attempt === maxRetries) throw err;
        const delay = Math.min(1000 * Math.pow(2, attempt), 10_000);
        await this.sleep(delay);
      }
    }
    // Unreachable — satisfies TypeScript control flow
    throw new Error('withRetry: exhausted all attempts');
  }

  private isRetryable(err: unknown): boolean {
    const status = (err as { status?: number }).status;
    return status === 429 || (typeof status === 'number' && status >= 500);
  }
}
