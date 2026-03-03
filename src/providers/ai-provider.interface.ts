export interface GenerateOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface AIProvider {
  readonly name: 'openai' | 'claude' | 'gemini' | 'mock';
  testConnection(): Promise<boolean>;
  generateText(prompt: string, options?: GenerateOptions): Promise<string>;
  streamText(prompt: string, options?: GenerateOptions): AsyncGenerator<string>;
}

export { AIProviderError } from '../errors/tmr-error.js';
