import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// ── Mock fetch (used by testConnection) ───────────────────────────────────────

const mockFetch = jest.fn<() => Promise<Response>>();
jest.unstable_mockModule('node:fetch', () => ({ default: mockFetch }));
(globalThis as unknown as Record<string, unknown>).fetch = mockFetch;

// ── Mock @google/generative-ai (used by generateText / streamText) ────────────

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

function makeResponse(status: number, body = ''): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  provider = new GeminiProvider('test-key');
  mockFetch.mockReset();
  mockGenerateContent.mockReset();
  mockGenerateContentStream.mockReset();
});

describe('GeminiProvider — testConnection', () => {
  it('returns true when ListModels responds 200', async () => {
    mockFetch.mockResolvedValue(makeResponse(200, '{"models":[]}'));
    expect(await provider.testConnection()).toBe(true);
  });

  it('returns true when ListModels responds 429 (quota = key is valid)', async () => {
    mockFetch.mockResolvedValue(makeResponse(429, 'quota exceeded'));
    expect(await provider.testConnection()).toBe(true);
  });

  it('throws only the error message when ListModels responds 401', async () => {
    const body = JSON.stringify({
      error: { message: 'API key not valid. Please pass a valid API key.' },
    });
    mockFetch.mockResolvedValue(makeResponse(401, body));
    await expect(provider.testConnection()).rejects.toThrow(
      'API key not valid. Please pass a valid API key.',
    );
  });

  it('throws only the error message when ListModels responds 403', async () => {
    const body = JSON.stringify({ error: { message: 'Permission denied on resource.' } });
    mockFetch.mockResolvedValue(makeResponse(403, body));
    await expect(provider.testConnection()).rejects.toThrow('Permission denied on resource.');
  });

  it('falls back to raw body when response is not JSON', async () => {
    mockFetch.mockResolvedValue(makeResponse(500, 'Internal Server Error'));
    await expect(provider.testConnection()).rejects.toThrow('Internal Server Error');
  });

  it('calls ListModels with the API key as query param', async () => {
    mockFetch.mockResolvedValue(makeResponse(200));
    await provider.testConnection();
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('key=test-key'));
  });
});

describe('GeminiProvider — generateText', () => {
  it('calls getGenerativeModel with correct model', async () => {
    mockGenerateContent.mockResolvedValue({ response: { text: () => 'Hello Gemini' } });
    const result = await provider.generateText('Say hello', { model: 'gemini-1.5-pro' });
    expect(result).toBe('Hello Gemini');
    expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-1.5-pro' });
  });

  it('uses default model gemini-2.0-flash-lite when none specified', async () => {
    mockGenerateContent.mockResolvedValue({ response: { text: () => 'ok' } });
    await provider.generateText('hi');
    expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-2.0-flash-lite' });
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
