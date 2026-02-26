import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockGenerateContent = jest.fn<() => Promise<unknown>>();
const mockGenerateContentStream = jest.fn<() => Promise<unknown>>();
const mockGetGenerativeModel = jest.fn<() => unknown>().mockReturnValue({
  generateContent: mockGenerateContent,
  generateContentStream: mockGenerateContentStream,
});

jest.unstable_mockModule('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}));

const { GeminiProvider } = await import('../../src/providers/gemini-provider.js');
const { AIProviderError } = await import('../../src/providers/ai-provider.interface.js');

let provider: InstanceType<typeof GeminiProvider>;

beforeEach(() => {
  provider = new GeminiProvider('test-key');
  mockGenerateContent.mockReset();
  mockGenerateContentStream.mockReset();
});

describe('GeminiProvider — testConnection', () => {
  it('returns true when generateContent succeeds', async () => {
    mockGenerateContent.mockResolvedValue({ response: { text: () => 'ok' } });
    expect(await provider.testConnection()).toBe(true);
  });

  it('returns false when generateContent throws', async () => {
    mockGenerateContent.mockRejectedValue(new Error('network error'));
    expect(await provider.testConnection()).toBe(false);
  });
});

describe('GeminiProvider — generateText', () => {
  it('calls getGenerativeModel with correct model', async () => {
    mockGenerateContent.mockResolvedValue({ response: { text: () => 'Hello Gemini' } });
    const result = await provider.generateText('Say hello', { model: 'gemini-1.5-pro' });
    expect(result).toBe('Hello Gemini');
    expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-1.5-pro' });
  });

  it('uses default model gemini-1.5-flash when none specified', async () => {
    mockGenerateContent.mockResolvedValue({ response: { text: () => 'ok' } });
    await provider.generateText('hi');
    expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-1.5-flash' });
  });

  it('wraps SDK error as AIProviderError', async () => {
    mockGenerateContent.mockRejectedValue(new Error('quota exceeded'));
    await expect(provider.generateText('hi')).rejects.toBeInstanceOf(AIProviderError);
  });

  it('retries on 500 server error and succeeds on second attempt', async () => {
    const serverErr = Object.assign(new Error('server error'), { status: 500 });
    mockGenerateContent
      .mockRejectedValueOnce(serverErr)
      .mockResolvedValue({ response: { text: () => 'ok' } });

    (provider as unknown as { sleep: (ms: number) => Promise<void> }).sleep = async () => {};

    const result = await provider.generateText('hi');
    expect(result).toBe('ok');
    expect(mockGenerateContent).toHaveBeenCalledTimes(2);
  });
});

describe('GeminiProvider — streamText', () => {
  it('yields text chunks from stream', async () => {
    async function* fakeStream(): AsyncGenerator<{ text: () => string }> {
      yield { text: () => 'Hello' };
      yield { text: () => ' Gemini' };
    }
    mockGenerateContentStream.mockResolvedValue({ stream: fakeStream() });

    const chunks: string[] = [];
    for await (const chunk of provider.streamText('hi')) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['Hello', ' Gemini']);
  });

  it('skips empty chunks', async () => {
    async function* fakeStream(): AsyncGenerator<{ text: () => string }> {
      yield { text: () => '' };
      yield { text: () => 'hi' };
    }
    mockGenerateContentStream.mockResolvedValue({ stream: fakeStream() });

    const chunks: string[] = [];
    for await (const chunk of provider.streamText('test')) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['hi']);
  });
});
