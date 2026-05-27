import 'server-only';

import { AI_PROVIDER_DEFAULTS, AI_PROVIDERS, DEFAULT_AI_PROVIDER, normalizeAIProvider, type AIProvider } from '@/lib/ai/shared';

interface ProviderEnvConfig {
  apiKey: string[];
  baseURL: string[];
  model: string[];
}

const PROVIDER_ENV_CONFIGS: Record<AIProvider, ProviderEnvConfig> = {
  openai: {
    apiKey: ['OPENAI_API_KEY'],
    baseURL: ['OPENAI_BASE_URL', 'AI_BASE_URL'],
    model: ['OPENAI_MODEL', 'AI_MODEL'],
  },
  anthropic: {
    apiKey: ['ANTHROPIC_API_KEY'],
    baseURL: ['ANTHROPIC_BASE_URL', 'AI_BASE_URL'],
    model: ['ANTHROPIC_MODEL', 'AI_MODEL'],
  },
  gemini: {
    apiKey: ['GOOGLE_GENERATIVE_AI_API_KEY', 'GEMINI_API_KEY'],
    baseURL: ['GOOGLE_GENERATIVE_AI_BASE_URL', 'GEMINI_BASE_URL', 'AI_BASE_URL'],
    model: ['GOOGLE_GENERATIVE_AI_MODEL', 'GEMINI_MODEL', 'AI_MODEL'],
  },
};

export interface ServerAIConfig {
  provider: AIProvider;
  apiKey: string;
  baseURL: string;
  model: string;
}

export interface PublicServerAIConfig {
  configured: boolean;
  provider: AIProvider;
  baseURL: string;
  model: string;
}

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function readFirstEnv(names: string[]) {
  for (const name of names) {
    const value = readEnv(name);
    if (value) return value;
  }
  return undefined;
}

function getExplicitProvider() {
  return normalizeAIProvider(process.env.AI_PROVIDER);
}

function getProviderApiKey(provider: AIProvider) {
  return readFirstEnv(PROVIDER_ENV_CONFIGS[provider].apiKey);
}

function resolveConfiguredProvider(preferredProvider?: string | null) {
  const requestedProvider = normalizeAIProvider(preferredProvider);
  if (requestedProvider && getProviderApiKey(requestedProvider)) {
    return requestedProvider;
  }

  const explicitProvider = getExplicitProvider();
  if (explicitProvider) {
    return getProviderApiKey(explicitProvider) ? explicitProvider : undefined;
  }

  return AI_PROVIDERS.find((provider) => Boolean(getProviderApiKey(provider)));
}

export function getServerAIConfig(preferredProvider?: string | null): ServerAIConfig | null {
  const provider = resolveConfiguredProvider(preferredProvider);
  if (!provider) return null;

  const apiKey = getProviderApiKey(provider);
  if (!apiKey) return null;

  const defaults = AI_PROVIDER_DEFAULTS[provider];
  return {
    provider,
    apiKey,
    baseURL: readFirstEnv(PROVIDER_ENV_CONFIGS[provider].baseURL) || defaults.baseURL,
    model: readFirstEnv(PROVIDER_ENV_CONFIGS[provider].model) || defaults.model,
  };
}

export function getPublicServerAIConfig(): PublicServerAIConfig {
  const config = getServerAIConfig();
  if (!config) {
    const defaults = AI_PROVIDER_DEFAULTS[DEFAULT_AI_PROVIDER];
    return {
      configured: false,
      provider: DEFAULT_AI_PROVIDER,
      baseURL: defaults.baseURL,
      model: defaults.model,
    };
  }

  return {
    configured: true,
    provider: config.provider,
    baseURL: config.baseURL,
    model: config.model,
  };
}
