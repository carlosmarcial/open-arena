/**
 * OpenRouter LLM Client
 * Unified interface for accessing multiple LLMs through OpenRouter
 */

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenRouterClient {
  private apiKey: string;
  private baseURL = 'https://openrouter.ai/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async chat(
    model: string,
    messages: LLMMessage[],
    options: {
      temperature?: number;
      max_tokens?: number;
      top_p?: number;
    } = {}
  ): Promise<LLMResponse> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://aster-arena.com', // Replace with your domain
        'X-Title': 'Open Arena Trading Bot',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 1000,
        top_p: options.top_p ?? 1,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} ${error}`);
    }

    const data = await response.json();

    return {
      content: data.choices[0].message.content,
      usage: data.usage,
    };
  }

  // Convenience method for simple text completion
  async complete(
    model: string,
    prompt: string,
    options: {
      temperature?: number;
      max_tokens?: number;
      systemPrompt?: string;
    } = {}
  ): Promise<LLMResponse> {
    const messages: LLMMessage[] = [];

    if (options.systemPrompt) {
      messages.push({
        role: 'system',
        content: options.systemPrompt,
      });
    }

    messages.push({
      role: 'user',
      content: prompt,
    });

    return this.chat(model, messages, options);
  }
}

// Model identifiers for OpenRouter
// Updated with valid model IDs as of January 2025
export const OPENROUTER_MODELS = {
  CLAUDE_3_5_SONNET: 'anthropic/claude-3.5-sonnet',
  GPT_4O: 'openai/gpt-4o',
  GPT_4O_MINI: 'openai/gpt-4o-mini',
  MISTRAL_MEDIUM_3_1: 'mistralai/mistral-medium-3.1', // Updated to Mistral Medium 3.1
  DEEPSEEK_CHAT: 'deepseek/deepseek-chat',
  GROK_2: 'x-ai/grok-4', // Updated to Grok 4
  QWEN_72B: 'qwen/qwen-2.5-72b-instruct', // Corrected Qwen ID
} as const;

export type OpenRouterModel = typeof OPENROUTER_MODELS[keyof typeof OPENROUTER_MODELS];
