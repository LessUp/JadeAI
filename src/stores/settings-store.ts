import { create } from 'zustand';
import { AI_PROVIDER_DEFAULTS, DEFAULT_AI_PROVIDER, normalizeAIProvider, type AIProvider } from '@/lib/ai/shared';
import {
  reconcileLocalAISettingsWithServerDefaults,
  resolveEffectiveAISettings,
  type AISettingsReconciliationInput,
} from '@/lib/ai/settings-reconciliation';

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
  settingsSyncError: string | null;

  // Actions
  setAIProvider: (provider: AIProvider) => void;
  setAIApiKey: (key: string) => void;
  setAIBaseURL: (url: string) => void;
  setAIModel: (model: string) => void;
  setServerAIConfig: (config: ServerAIState) => void;
  setAutoSave: (enabled: boolean) => void;
  setAutoSaveInterval: (interval: number) => void;
  clearSettingsSyncError: () => void;
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

function getSettingsSyncError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

async function readSettingsSyncError(response: Response, fallback: string) {
  try {
    const data = await response.json();
    if (typeof data?.error === 'string' && data.error) return data.error;
  } catch {
    // Fall through to status-based error.
  }
  return `${fallback} (${response.status})`;
}

function getAIReconciliationInput(state: SettingsStore): AISettingsReconciliationInput {
  return {
    aiProvider: state.aiProvider,
    aiApiKey: state.aiApiKey,
    aiBaseURL: state.aiBaseURL,
    aiModel: state.aiModel,
    serverAIConfigured: state.serverAIConfigured,
    serverAIProvider: state.serverAIProvider,
    serverAIBaseURL: state.serverAIBaseURL,
    serverAIModel: state.serverAIModel,
  };
}

// Sync settings to server (debounced)
let syncTimeout: ReturnType<typeof setTimeout> | null = null;

function syncToServer(state: SettingsStore) {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    try {
      const res = await fetch('/api/user/settings', {
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
      if (!res.ok) {
        throw new Error(await readSettingsSyncError(res, 'Unable to sync settings'));
      }
      useSettingsStore.setState({ settingsSyncError: null });
    } catch (error) {
      useSettingsStore.setState({
        settingsSyncError: getSettingsSyncError(error, 'Unable to sync settings. Local changes are still saved in this browser.'),
      });
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
  const state = useSettingsStore.getState();
  const { provider, baseURL, model } = resolveEffectiveAISettings(getAIReconciliationInput(state));
  const localApiKey = state.aiApiKey.trim();
  const headers: Record<string, string> = {};
  if (provider) headers['x-provider'] = provider;
  if (localApiKey) headers['x-api-key'] = localApiKey;
  if (baseURL) headers['x-base-url'] = baseURL;
  if (model) headers['x-model'] = model;
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
  settingsSyncError: null,

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

      if (!state.aiApiKey.trim() && configured) {
        nextState.aiProvider = normalizedProvider;
        nextState.aiBaseURL = baseURL;
        nextState.aiModel = model;
      }

      return nextState;
    });
  },

  setAIApiKey: (key) => {
    const apiKey = key.trim();
    set((state) => {
      const nextState = { ...state, aiApiKey: apiKey };
      return {
        aiApiKey: apiKey,
        ...reconcileLocalAISettingsWithServerDefaults(getAIReconciliationInput(nextState)),
      };
    });
    saveApiKeyLocally(apiKey);
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

  clearSettingsSyncError: () => set({ settingsSyncError: null }),

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
        set((state) => {
          const nextState = {
            ...state,
            ...(provider && { aiProvider: provider }),
            ...(data.aiBaseURL && { aiBaseURL: data.aiBaseURL }),
            ...(data.aiModel && { aiModel: data.aiModel }),
            ...(typeof data.autoSave === 'boolean' && { autoSave: data.autoSave }),
            ...(typeof data.autoSaveInterval === 'number' && { autoSaveInterval: data.autoSaveInterval }),
            _hydrated: true,
            settingsSyncError: null,
          };
          return {
            ...nextState,
            ...reconcileLocalAISettingsWithServerDefaults(getAIReconciliationInput(nextState)),
          };
        });
        // Seed provider config cache with hydrated values
        syncProviderConfig(get());
        return;
      }
      throw new Error(await readSettingsSyncError(res, 'Unable to load settings'));
    } catch (error) {
      set({
        settingsSyncError: getSettingsSyncError(error, 'Unable to load synced settings. Local settings are still available.'),
      });
    }

    set({ _hydrated: true });
  },
}));

// Auto-hydrate on client side so settings are ready before any component uses them
if (typeof window !== 'undefined') {
  useSettingsStore.getState().hydrate();
}
