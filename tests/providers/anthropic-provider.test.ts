import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockMessagesCreate = jest.fn<() => Promise<unknown>>();

jest.unstable_mockModule('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockMessagesCreate },
  })),
}));

const { AnthropicProvider } = await import('../../src/providers/anthropic-provider.js');
const { AIProviderError } = await import('../../src/providers/ai-provider.interface.js');

let provider: InstanceType<typeof AnthropicProvider>;

beforeEach(() => {
  provider = new AnthropicProvider('test-key');
  mockMessagesCreate.mockReset();
});

describe('AnthropicProvider — testConnection', () => {
  it('returns true when messages.create succeeds', async () => {
    mockMessagesCreate.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
    expect(await provider.testConnection()).toBe(true);
  });

  it('returns false when messages.create throws', async () => {
    mockMessagesCreate.mockRejectedValue(new Error('auth error'));
    expect(await provider.testConnection()).toBe(false);
  });
});

describe('AnthropicProvider — generateText', () => {
  it('calls messages.create with correct params', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Hello from Claude!' }],
    });
    const result = await provider.generateText('Say hello', {
      model: 'claude-3-haiku-20240307',
    });
    expect(result).toBe('Hello from Claude!');
    expect(mockMessagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-3-haiku-20240307' }),
    );
  });

  it('uses default model when none specified', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
    });
    await provider.generateText('hi');
    expect(mockMessagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-3-5-sonnet-20241022' }),
    );
  });

  it('uses default max_tokens of 1024', async () => {
    mockMessagesCreate.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
    await provider.generateText('hi');
    expect(mockMessagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ max_tokens: 1024 }),
    );
  });

  it('passes systemPrompt as system field', async () => {
    mockMessagesCreate.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
    await provider.generateText('hello', { systemPrompt: 'You are concise.' });
    expect(mockMessagesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ system: 'You are concise.' }),
    );
  });

  it('wraps SDK error as AIProviderError', async () => {
    mockMessagesCreate.mockRejectedValue(new Error('overloaded'));
    await expect(provider.generateText('hi')).rejects.toBeInstanceOf(AIProviderError);
  });

  it('retries on 429 and succeeds on second attempt', async () => {
    const rateLimitErr = Object.assign(new Error('rate limit'), { status: 429 });
    mockMessagesCreate
      .mockRejectedValueOnce(rateLimitErr)
      .mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });

    (provider as unknown as { sleep: (ms: number) => Promise<void> }).sleep = async () => {};

    const result = await provider.generateText('hi');
    expect(result).toBe('ok');
    expect(mockMessagesCreate).toHaveBeenCalledTimes(2);
  });
});

describe('AnthropicProvider — streamText', () => {
  it('yields text from text_delta events', async () => {
    async function* fakeStream(): AsyncGenerator<{
      type: string;
      delta?: { type: string; text?: string };
    }> {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } };
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ' Claude' } };
      yield { type: 'message_stop' };
    }
    mockMessagesCreate.mockResolvedValue(fakeStream());

    const chunks: string[] = [];
    for await (const chunk of provider.streamText('hi')) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['Hello', ' Claude']);
  });

  it('skips non-text events', async () => {
    async function* fakeStream(): AsyncGenerator<{
      type: string;
      delta?: { type: string; text?: string };
    }> {
      yield { type: 'message_start' };
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hi' } };
    }
    mockMessagesCreate.mockResolvedValue(fakeStream());

    const chunks: string[] = [];
    for await (const chunk of provider.streamText('hi')) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['Hi']);
  });
});
