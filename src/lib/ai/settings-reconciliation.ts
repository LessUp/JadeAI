import { type AIProvider } from '@/lib/ai/shared';

export interface AISettingsReconciliationInput {
  aiProvider: AIProvider;
  aiApiKey: string;
  aiBaseURL: string;
  aiModel: string;
  serverAIConfigured: boolean;
  serverAIProvider: AIProvider;
  serverAIBaseURL: string;
  serverAIModel: string;
}

export interface EffectiveAISettings {
  provider: AIProvider;
  baseURL: string;
  model: string;
  usesServerDefaults: boolean;
}

export function resolveEffectiveAISettings(settings: AISettingsReconciliationInput): EffectiveAISettings {
  const usesServerDefaults = !settings.aiApiKey.trim() && settings.serverAIConfigured;

  if (usesServerDefaults) {
    return {
      provider: settings.serverAIProvider,
      baseURL: settings.serverAIBaseURL,
      model: settings.serverAIModel,
      usesServerDefaults: true,
    };
  }

  return {
    provider: settings.aiProvider,
    baseURL: settings.aiBaseURL,
    model: settings.aiModel,
    usesServerDefaults: false,
  };
}

export function reconcileLocalAISettingsWithServerDefaults(
  settings: AISettingsReconciliationInput
): Partial<Pick<AISettingsReconciliationInput, 'aiProvider' | 'aiBaseURL' | 'aiModel'>> {
  const effective = resolveEffectiveAISettings(settings);
  if (!effective.usesServerDefaults) return {};

  return {
    aiProvider: effective.provider,
    aiBaseURL: effective.baseURL,
    aiModel: effective.model,
  };
}
