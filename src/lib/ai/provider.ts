import { NextRequest } from 'next/server';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { AI_PROVIDER_DEFAULTS, DEFAULT_AI_PROVIDER, normalizeAIProvider, type AIProvider } from '@/lib/ai/shared';
import { getServerAIConfig } from '@/lib/ai/server-config';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  baseURL: string;
  model: string;
}

export function extractAIConfig(request: NextRequest): AIConfig {
  const requestedProvider = normalizeAIProvider(request.headers.get('x-provider'));
  const serverConfig = getServerAIConfig(requestedProvider);
  const suppliedApiKey = request.headers.get('x-api-key')?.trim() || '';

  if (!suppliedApiKey && serverConfig) {
    return serverConfig;
  }

  const provider = requestedProvider || serverConfig?.provider || DEFAULT_AI_PROVIDER;
  const defaults = AI_PROVIDER_DEFAULTS[provider];
  const apiKey = suppliedApiKey || serverConfig?.apiKey || '';
  const baseURL = request.headers.get('x-base-url') || serverConfig?.baseURL || defaults.baseURL;
  const model = request.headers.get('x-model') || serverConfig?.model || defaults.model;
  return { provider, apiKey, baseURL, model };
}

export function getModel(config: AIConfig, modelOverride?: string) {
  if (!config.apiKey) {
    throw new AIConfigError('API key is required. Please configure it in Settings or set server-side AI environment variables.');
  }
  const modelId = modelOverride || config.model;

  switch (config.provider) {
    case 'anthropic': {
      const p = createAnthropic({ apiKey: config.apiKey, baseURL: config.baseURL || undefined });
      return p(modelId);
    }
    case 'gemini': {
      const p = createGoogleGenerativeAI({ apiKey: config.apiKey, baseURL: config.baseURL || undefined });
      return p(modelId);
    }
    default: {
      const p = createOpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
      return p.chat(modelId);
    }
  }
}

/**
 * Returns providerOptions for JSON mode — only applicable to OpenAI-compatible providers.
 */
export function getJsonProviderOptions(config: AIConfig) {
  if (config.provider === 'openai') {
    return { openai: { response_format: { type: 'json_object' as const } } };
  }
  return {} as Record<string, never>;
}

export class AIConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIConfigError';
  }
}
