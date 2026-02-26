import { describe, it, expect } from '@jest/globals';
import { MockAIProvider } from '../../src/providers/mock-provider.js';

describe('MockAIProvider', () => {
  it('name is "mock"', () => {
    expect(new MockAIProvider().name).toBe('mock');
  });

  it('testConnection always returns true', async () => {
    expect(await new MockAIProvider().testConnection()).toBe(true);
  });

  it('generateText returns default mock response', async () => {
    const provider = new MockAIProvider();
    expect(await provider.generateText('hello')).toBe('Mock response for: hello');
  });

  it('generateText uses custom _generateFn when provided', async () => {
    const provider = new MockAIProvider(p => `custom: ${p}`);
    expect(await provider.generateText('test')).toBe('custom: test');
  });

  it('streamText yields single chunk with default mock string', async () => {
    const provider = new MockAIProvider();
    const chunks: string[] = [];
    for await (const chunk of provider.streamText('hello')) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['Mock stream for: hello']);
  });

  it('streamText uses custom _generateFn when provided', async () => {
    const provider = new MockAIProvider(p => `streamed: ${p}`);
    const chunks: string[] = [];
    for await (const chunk of provider.streamText('world')) {
      chunks.push(chunk);
    }
    expect(chunks).toEqual(['streamed: world']);
  });
});
