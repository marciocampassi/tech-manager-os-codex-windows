export interface GenerateOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface AIProvider {
  readonly name: string;
  testConnection(): Promise<boolean>;
  generateText(prompt: string, options?: GenerateOptions): Promise<string>;
  streamText(prompt: string, options?: GenerateOptions): AsyncGenerator<string>;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AIProviderError';
    Object.setPrototypeOf(this, AIProviderError.prototype);
  }
}
