import { AIProviderError } from './ai-provider.interface.js';
import type { AIProvider } from './ai-provider.interface.js';
import { OpenAIProvider } from './openai-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { GeminiProvider } from './gemini-provider.js';

export class AIProviderFactory {
  static create(provider: string, apiKey: string): AIProvider {
    // Architecture (components.md) defines canonical names: 'openai' | 'claude' | 'gemini'.
    // 'anthropic' is accepted as a legacy alias for backward compatibility.
    switch (provider.toLowerCase()) {
      case 'openai':
        return new OpenAIProvider(apiKey);
      case 'claude':
      case 'anthropic':
        return new AnthropicProvider(apiKey);
      case 'gemini':
        return new GeminiProvider(apiKey);
      default:
        throw new AIProviderError(
          `Unknown provider: '${provider}'. Supported providers: openai, claude, gemini.`,
          provider,
        );
    }
  }
}
