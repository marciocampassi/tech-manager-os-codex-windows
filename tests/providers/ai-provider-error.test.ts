import { describe, it, expect } from '@jest/globals';

const { AIProviderError } = await import('../../src/providers/ai-provider.interface.js');

describe('AIProviderError', () => {
  it('is an instance of AIProviderError', () => {
    const err = new AIProviderError('msg', 'openai');
    expect(err).toBeInstanceOf(AIProviderError);
  });

  it('has name === AIProviderError', () => {
    const err = new AIProviderError('msg', 'openai');
    expect(err.name).toBe('AIProviderError');
  });

  it('has correct message', () => {
    const err = new AIProviderError('something went wrong', 'anthropic');
    expect(err.message).toBe('something went wrong');
  });

  it('has correct provider field', () => {
    const err = new AIProviderError('msg', 'gemini');
    expect(err.provider).toBe('gemini');
  });

  it('has cause === undefined when not provided', () => {
    const err = new AIProviderError('msg', 'openai');
    expect(err.cause).toBeUndefined();
  });

  it('has cause equal to the original error when provided', () => {
    const root = new Error('root cause');
    const err = new AIProviderError('wrapper', 'openai', root);
    expect(err.cause).toBe(root);
  });
});
