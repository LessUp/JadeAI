export const AI_PROVIDERS = ['openai', 'anthropic', 'gemini'] as const;

export type AIProvider = (typeof AI_PROVIDERS)[number];

export const DEFAULT_AI_PROVIDER: AIProvider = 'openai';

export const AI_PROVIDER_DEFAULTS = {
  openai: {
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o',
  },
  anthropic: {
    baseURL: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-20250514',
  },
  gemini: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.0-flash',
  },
} satisfies Record<AIProvider, { baseURL: string; model: string }>;

export function normalizeAIProvider(value: string | null | undefined): AIProvider | undefined {
  if (!value) return undefined;

  if (value === 'custom' || value === 'azure') {
    return 'openai';
  }

  return AI_PROVIDERS.find((provider) => provider === value);
}
