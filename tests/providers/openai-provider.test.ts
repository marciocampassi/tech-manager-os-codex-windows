import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockCreate = jest.fn<() => Promise<unknown>>();
const mockModelsList = jest.fn<() => Promise<unknown>>();

jest.unstable_mockModule('openai', () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
    models: { list: mockModelsList },
  })),
}));

const { OpenAIProvider } = await import('../../src/providers/openai-provider.js');
const { AIProviderError } = await import('../../src/providers/ai-provider.interface.js');

let provider: InstanceType<typeof OpenAIProvider>;

beforeEach(() => {
  provider = new OpenAIProvider('test-key');
  mockCreate.mockReset();
  mockModelsList.mockReset();
});

describe('OpenAIProvider — testConnection', () => {
  it('returns true when models.list succeeds', async () => {
    mockModelsList.mockResolvedValue({ data: [] });
    expect(await provider.testConnection()).toBe(true);
  });

  it('returns true when models.list throws 429 (quota = key is valid)', async () => {
    const rateLimitErr = Object.assign(new Error('rate limit'), { status: 429 });
    mockModelsList.mockRejectedValue(rateLimitErr);
    expect(await provider.testConnection()).toBe(true);
  });

  it('throws when models.list returns a non-429 error', async () => {
    const authErr = Object.assign(new Error('invalid api key'), { status: 401 });
    mockModelsList.mockRejectedValue(authErr);
    await expect(provider.testConnection()).rejects.toThrow('invalid api key');
  });
});

describe('OpenAIProvider — generateText', () => {
  it('calls chat.completions.create with correct params', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Hello!' } }],
    });
    const result = await provider.generateText('Say hello', { model: 'gpt-4o' });
    expect(result).toBe('Hello!');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o', stream: false }),
    );
  });

  it('uses default model when none specified', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'ok' } }] });
    await provider.generateText('hi');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o-mini' }),
    );
  });

  it('includes system message when systemPrompt provided', async () => {
    mockCreate.mockResolvedValue({ choices: [{ message: { content: 'ok' } }] });
    await provider.generateText('hello', { systemPrompt: 'You are helpful.' });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          { role: 'system', content: 'You are helpful.' },
        ]),
      }),
    );
  });

  it('wraps SDK error as AIProviderError', async () => {
    mockCreate.mockRejectedValue(new Error('quota exceeded'));
    await expect(provider.generateText('hi')).rejects.toBeInstanceOf(AIProviderError);
  });

  it('retries on 429 and succeeds on second attempt', async () => {
    const rateLimitErr = Object.assign(new Error('rate limit'), { status: 429 });
    mockCreate
      .mockRejectedValueOnce(rateLimitErr)
      .mockResolvedValue({ choices: [{ message: { content: 'ok' } }] });

    // Override sleep to be instant
    (provider as unknown as { sleep: (ms: number) => Promise<void> }).sleep = async () => {};

    const result = await provider.generateText('hi');
    expect(result).toBe('ok');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});

describe('OpenAIProvider — streamText', () => {
  it('yields text chunks from stream', async () => {
    async function* fakeStream(): AsyncGenerator<{ choices: { delta: { content?: string } }[] }> {
      yield { choices: [{ delta: { content: 'Hello' } }] };
      yield { choices: [{ delta: { content: ' world' } }] };
    }
    mockCreate.mockResolvedValue(fakeStream());

    const chunks: string[] = [];
    for await (const chunk of provider.streamText('hi')) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['Hello', ' world']);
  });

  it('skips chunks with no content', async () => {
    async function* fakeStream(): AsyncGenerator<{ choices: { delta: { content?: string } }[] }> {
      yield { choices: [{ delta: {} }] };
      yield { choices: [{ delta: { content: 'hi' } }] };
    }
    mockCreate.mockResolvedValue(fakeStream());

    const chunks: string[] = [];
    for await (const chunk of provider.streamText('test')) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['hi']);
  });
});
