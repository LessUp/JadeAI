import { create } from 'zustand';
import { AI_PROVIDER_DEFAULTS, DEFAULT_AI_PROVIDER, normalizeAIProvider, type AIProvider } from '@/lib/ai/shared';

export type { AIProvider } from '@/lib/ai/shared';

interface ServerAIState {
  configured: boolean;
  provider: AIProvider;
  baseURL: string;
  model: string;
}

interface SettingsStore {
  // AI settings
  aiProvider: AIProvider;
  aiApiKey: string; // stored locally only, never sent to server
  aiBaseURL: string;
  aiModel: string;
  serverAIConfigured: boolean;
  serverAIProvider: AIProvider;
  serverAIBaseURL: string;
  serverAIModel: string;
  // Editor settings
  autoSave: boolean;
  autoSaveInterval: number; // in milliseconds

  // Hydration state
  _hydrated: boolean;
  _syncing: boolean;

  // Actions
  setAIProvider: (provider: AIProvider) => void;
  setAIApiKey: (key: string) => void;
  setAIBaseURL: (url: string) => void;
  setAIModel: (model: string) => void;
  setServerAIConfig: (config: ServerAIState) => void;
  setAutoSave: (enabled: boolean) => void;
  setAutoSaveInterval: (interval: number) => void;
  hydrate: () => void;
}

const API_KEY_STORAGE_KEY = 'jade_api_key';
const PROVIDER_CONFIGS_KEY = 'jade_provider_configs';

interface ProviderConfig {
  baseURL: string;
  model: string;
  apiKey: string;
}

const PROVIDER_DEFAULTS: Record<AIProvider, ProviderConfig> = Object.fromEntries(
  Object.entries(AI_PROVIDER_DEFAULTS).map(([provider, defaults]) => [
    provider,
    { ...defaults, apiKey: '' },
  ])
) as Record<AIProvider, ProviderConfig>;

function loadProviderConfigs(): Partial<Record<AIProvider, ProviderConfig>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(PROVIDER_CONFIGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveProviderConfigs(configs: Partial<Record<AIProvider, ProviderConfig>>) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(PROVIDER_CONFIGS_KEY, JSON.stringify(configs)); } catch { /* ignore */ }
}

function getFingerprint(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('jade_fingerprint');
}

function getHeaders(): Record<string, string> {
  const fp = getFingerprint();
  return {
    'Content-Type': 'application/json',
    ...(fp ? { 'x-fingerprint': fp } : {}),
  };
}

// Sync settings to server (debounced)
let syncTimeout: ReturnType<typeof setTimeout> | null = null;

function syncToServer(state: SettingsStore) {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    try {
      await fetch('/api/user/settings', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({
          aiProvider: state.aiProvider,
          aiBaseURL: state.aiBaseURL,
          aiModel: state.aiModel,
          autoSave: state.autoSave,
          autoSaveInterval: state.autoSaveInterval,
        }),
      });
    } catch {
      // silently fail, local state is still correct
    }
  }, 500);
}

function syncProviderConfig(state: SettingsStore) {
  const configs = loadProviderConfigs();
  configs[state.aiProvider] = {
    baseURL: state.aiBaseURL,
    model: state.aiModel,
    apiKey: state.aiApiKey,
  };
  saveProviderConfigs(configs);
}

function saveApiKeyLocally(key: string) {
  if (typeof window === 'undefined') return;
  try {
    if (key) {
      localStorage.setItem(API_KEY_STORAGE_KEY, key);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  } catch { /* ignore */ }
}

function loadApiKeyLocally(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function getAIHeaders(): Record<string, string> {
  const {
    aiProvider,
    aiApiKey,
    aiBaseURL,
    aiModel,
    serverAIConfigured,
    serverAIProvider,
    serverAIBaseURL,
    serverAIModel,
  } = useSettingsStore.getState();

  const useServerDefaults = !aiApiKey && serverAIConfigured && aiProvider !== serverAIProvider;
  const effectiveProvider = useServerDefaults ? serverAIProvider : aiProvider;
  const effectiveBaseURL = useServerDefaults ? serverAIBaseURL : aiBaseURL;
  const effectiveModel = useServerDefaults ? serverAIModel : aiModel;
  const headers: Record<string, string> = {};
  if (effectiveProvider) headers['x-provider'] = effectiveProvider;
  if (aiApiKey) headers['x-api-key'] = aiApiKey;
  if (effectiveBaseURL) headers['x-base-url'] = effectiveBaseURL;
  if (effectiveModel) headers['x-model'] = effectiveModel;
  return headers;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  aiProvider: DEFAULT_AI_PROVIDER,
  aiApiKey: '',
  aiBaseURL: PROVIDER_DEFAULTS[DEFAULT_AI_PROVIDER].baseURL,
  aiModel: PROVIDER_DEFAULTS[DEFAULT_AI_PROVIDER].model,
  serverAIConfigured: false,
  serverAIProvider: DEFAULT_AI_PROVIDER,
  serverAIBaseURL: PROVIDER_DEFAULTS[DEFAULT_AI_PROVIDER].baseURL,
  serverAIModel: PROVIDER_DEFAULTS[DEFAULT_AI_PROVIDER].model,
  autoSave: true,
  autoSaveInterval: 500,
  _hydrated: false,
  _syncing: false,

  setAIProvider: (provider) => {
    const { aiProvider: prev, aiBaseURL, aiModel, aiApiKey } = get();

    // Save current provider's config before switching
    const configs = loadProviderConfigs();
    configs[prev] = { baseURL: aiBaseURL, model: aiModel, apiKey: aiApiKey };
    saveProviderConfigs(configs);

    // Restore target provider's cached config, or use defaults
    const cached = configs[provider];
    const defaults = PROVIDER_DEFAULTS[provider];
    const restored = cached || defaults;

    set({
      aiProvider: provider,
      aiBaseURL: restored.baseURL,
      aiModel: restored.model,
      aiApiKey: restored.apiKey,
    });
    saveApiKeyLocally(restored.apiKey);
    syncToServer(get());
  },

  setServerAIConfig: ({ configured, provider, baseURL, model }) => {
    const normalizedProvider = normalizeAIProvider(provider) || DEFAULT_AI_PROVIDER;
    set((state) => {
      const nextState: Partial<SettingsStore> = {
        serverAIConfigured: configured,
        serverAIProvider: normalizedProvider,
        serverAIBaseURL: baseURL,
        serverAIModel: model,
      };

      if (!state.aiApiKey) {
        if (state.aiProvider !== normalizedProvider) {
          nextState.aiProvider = normalizedProvider;
          nextState.aiBaseURL = baseURL;
          nextState.aiModel = model;
        } else {
          if (!state.aiBaseURL || state.aiBaseURL === PROVIDER_DEFAULTS[normalizedProvider].baseURL) {
            nextState.aiBaseURL = baseURL;
          }
          if (!state.aiModel || state.aiModel === PROVIDER_DEFAULTS[normalizedProvider].model) {
            nextState.aiModel = model;
          }
        }
      }

      return nextState;
    });
  },

  setAIApiKey: (key) => {
    set({ aiApiKey: key });
    saveApiKeyLocally(key);
    syncProviderConfig(get());
  },

  setAIBaseURL: (url) => {
    set({ aiBaseURL: url });
    syncToServer(get());
    syncProviderConfig(get());
  },

  setAIModel: (model) => {
    set({ aiModel: model });
    syncToServer(get());
    syncProviderConfig(get());
  },

  setAutoSave: (enabled) => {
    set({ autoSave: enabled });
    syncToServer(get());
  },

  setAutoSaveInterval: (interval) => {
    set({ autoSaveInterval: interval });
    syncToServer(get());
  },

  hydrate: async () => {
    if (get()._hydrated) return;

    // Load API key from localStorage immediately
    const apiKey = loadApiKeyLocally();
    set({ aiApiKey: apiKey });

    // Load other settings from server
    try {
      const res = await fetch('/api/user/settings', { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        // Backward compat: map legacy 'custom' provider to 'openai'
        const provider = normalizeAIProvider(data.aiProvider);
        set({
          ...(provider && { aiProvider: provider }),
          ...(data.aiBaseURL && { aiBaseURL: data.aiBaseURL }),
          ...(data.aiModel && { aiModel: data.aiModel }),
          ...(typeof data.autoSave === 'boolean' && { autoSave: data.autoSave }),
          ...(typeof data.autoSaveInterval === 'number' && { autoSaveInterval: data.autoSaveInterval }),
          _hydrated: true,
        });
        // Seed provider config cache with hydrated values
        syncProviderConfig(get());
        return;
      }
    } catch { /* fall through */ }

    set({ _hydrated: true });
  },
}));

// Auto-hydrate on client side so settings are ready before any component uses them
if (typeof window !== 'undefined') {
  useSettingsStore.getState().hydrate();
}
