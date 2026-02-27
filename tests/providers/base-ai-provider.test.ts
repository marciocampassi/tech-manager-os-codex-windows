import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BaseAIProvider } from '../../src/providers/base-ai-provider.js';
import type { GenerateOptions } from '../../src/providers/ai-provider.interface.js';

// Concrete subclass with instant sleep to avoid real delays in tests
class TestProvider extends BaseAIProvider {
  readonly name = 'mock' as const;

  async testConnection(): Promise<boolean> {
    return true;
  }

  async generateText(_prompt: string, _options?: GenerateOptions): Promise<string> {
    return '';
  }

  async *streamText(_prompt: string, _options?: GenerateOptions): AsyncGenerator<string> {
    yield '';
  }

  protected override async sleep(_ms: number): Promise<void> {
    // no-op in tests — avoids real delays
  }

  // Expose protected methods for testing
  async runWithRetry<T>(fn: () => Promise<T>, maxRetries?: number): Promise<T> {
    return this.withRetry(fn, maxRetries);
  }

  async runEnforceRateLimit(): Promise<void> {
    return this.enforceRateLimit();
  }

  setMinIntervalMs(ms: number): void {
    this.minIntervalMs = ms;
  }
}

let provider: TestProvider;

beforeEach(() => {
  provider = new TestProvider();
});

describe('BaseAIProvider — withRetry', () => {
  it('returns result immediately when fn succeeds on first attempt', async () => {
    const fn = jest.fn<() => Promise<string>>().mockResolvedValue('ok');
    const result = await provider.runWithRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable error and succeeds on second attempt', async () => {
    const retryableError = Object.assign(new Error('rate limit'), { status: 429 });
    const fn = jest
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValue('ok');
    const result = await provider.runWithRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries twice and succeeds on third attempt', async () => {
    const retryableError = Object.assign(new Error('server error'), { status: 503 });
    const fn = jest
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(retryableError)
      .mockRejectedValueOnce(retryableError)
      .mockResolvedValue('ok');
    const result = await provider.runWithRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws immediately on non-retryable error (401)', async () => {
    const authError = Object.assign(new Error('unauthorized'), { status: 401 });
    const fn = jest.fn<() => Promise<string>>().mockRejectedValue(authError);
    await expect(provider.runWithRetry(fn)).rejects.toMatchObject({ status: 401 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws immediately on non-retryable error (400)', async () => {
    const badRequest = Object.assign(new Error('bad request'), { status: 400 });
    const fn = jest.fn<() => Promise<string>>().mockRejectedValue(badRequest);
    await expect(provider.runWithRetry(fn)).rejects.toMatchObject({ status: 400 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws after exhausting all retries (maxRetries=2)', async () => {
    const retryableError = Object.assign(new Error('rate limit'), { status: 429 });
    const fn = jest.fn<() => Promise<string>>().mockRejectedValue(retryableError);
    await expect(provider.runWithRetry(fn, 2)).rejects.toMatchObject({ status: 429 });
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});

describe('BaseAIProvider — enforceRateLimit', () => {
  it('does nothing when minIntervalMs is 0', async () => {
    provider.setMinIntervalMs(0);
    await expect(provider.runEnforceRateLimit()).resolves.toBeUndefined();
  });

  it('does nothing when enough time has passed', async () => {
    provider.setMinIntervalMs(10);
    // lastCallTime defaults to 0, so elapsed is large — should not sleep
    await expect(provider.runEnforceRateLimit()).resolves.toBeUndefined();
  });

  it('sleeps when called twice within the interval window', async () => {
    const sleepSpy = jest.spyOn(provider as unknown as { sleep: () => Promise<void> }, 'sleep');
    provider.setMinIntervalMs(500);
    // First call — sets lastCallTime; elapsed from epoch is huge so no sleep
    await provider.runEnforceRateLimit();
    // Second call immediately after — elapsed < 500ms so sleep should be called
    await provider.runEnforceRateLimit();
    expect(sleepSpy).toHaveBeenCalledTimes(1);
    expect(sleepSpy).toHaveBeenCalledWith(expect.any(Number));
  });
});
