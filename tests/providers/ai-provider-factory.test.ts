import { describe, it, expect, jest } from '@jest/globals';

jest.unstable_mockModule('openai', () => ({
  default: jest.fn().mockImplementation(() => ({})),
}));

jest.unstable_mockModule('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({})),
}));

jest.unstable_mockModule('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({})),
}));

const { AIProviderFactory } = await import(
  '../../src/providers/ai-provider-factory.js'
);
const { AIProviderError } = await import(
  '../../src/providers/ai-provider.interface.js'
);

describe('AIProviderFactory.create()', () => {
  it('creates OpenAIProvider for "openai"', () => {
    const provider = AIProviderFactory.create('openai', 'key');
    expect(provider.name).toBe('openai');
  });

  it('creates AnthropicProvider for "anthropic"', () => {
    const provider = AIProviderFactory.create('anthropic', 'key');
    expect(provider.name).toBe('anthropic');
  });

  it('creates GeminiProvider for "gemini"', () => {
    const provider = AIProviderFactory.create('gemini', 'key');
    expect(provider.name).toBe('gemini');
  });

  it('is case-insensitive — "OpenAI" resolves to openai', () => {
    const provider = AIProviderFactory.create('OpenAI', 'key');
    expect(provider.name).toBe('openai');
  });

  it('is case-insensitive — "ANTHROPIC" resolves to anthropic', () => {
    const provider = AIProviderFactory.create('ANTHROPIC', 'key');
    expect(provider.name).toBe('anthropic');
  });

  it('is case-insensitive — "Gemini" resolves to gemini', () => {
    const provider = AIProviderFactory.create('Gemini', 'key');
    expect(provider.name).toBe('gemini');
  });

  it('throws AIProviderError for unknown provider', () => {
    expect(() => AIProviderFactory.create('cohere', 'key')).toThrow(AIProviderError);
  });

  it('includes provider name in error message', () => {
    expect(() => AIProviderFactory.create('unknown', 'key')).toThrow("'unknown'");
  });
});
