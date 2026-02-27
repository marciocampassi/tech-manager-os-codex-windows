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

const { AIProviderFactory } = await import('../../src/providers/ai-provider-factory.js');
const { AIProviderError } = await import('../../src/providers/ai-provider.interface.js');

describe('AIProviderFactory.create()', () => {
  it('creates OpenAIProvider for "openai"', () => {
    const provider = AIProviderFactory.create('openai', 'key');
    expect(provider.name).toBe('openai');
  });

  it('creates AnthropicProvider for "claude" (canonical key per architecture)', () => {
    const provider = AIProviderFactory.create('claude', 'key');
    expect(provider.name).toBe('claude');
  });

  it('creates AnthropicProvider for "anthropic" (legacy alias — backward compat)', () => {
    const provider = AIProviderFactory.create('anthropic', 'key');
    expect(provider.name).toBe('claude');
  });

  it('creates GeminiProvider for "gemini"', () => {
    const provider = AIProviderFactory.create('gemini', 'key');
    expect(provider.name).toBe('gemini');
  });

  it('is case-insensitive — "OpenAI" resolves to openai', () => {
    const provider = AIProviderFactory.create('OpenAI', 'key');
    expect(provider.name).toBe('openai');
  });

  it('is case-insensitive — "CLAUDE" resolves to claude', () => {
    const provider = AIProviderFactory.create('CLAUDE', 'key');
    expect(provider.name).toBe('claude');
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
