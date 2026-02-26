import type { AIProvider, GenerateOptions } from './ai-provider.interface.js';

export class MockAIProvider implements AIProvider {
  readonly name = 'mock';

  constructor(private readonly _generateFn?: (prompt: string) => string) {}

  async testConnection(): Promise<boolean> {
    return true;
  }

  async generateText(prompt: string, _options?: GenerateOptions): Promise<string> {
    return this._generateFn ? this._generateFn(prompt) : `Mock response for: ${prompt}`;
  }

  async *streamText(prompt: string, _options?: GenerateOptions): AsyncGenerator<string> {
    yield this._generateFn ? this._generateFn(prompt) : `Mock stream for: ${prompt}`;
  }
}
