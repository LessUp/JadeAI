import assert from 'node:assert/strict';
import { setTimeout as wait } from 'node:timers/promises';
import test from 'node:test';
import { AI_PROVIDER_DEFAULTS } from '@/lib/ai/shared';
import { getAIHeaders, useSettingsStore } from './settings-store';

const openaiDefaults = AI_PROVIDER_DEFAULTS.openai;
const anthropicDefaults = AI_PROVIDER_DEFAULTS.anthropic;

function resetSettings(overrides: Partial<ReturnType<typeof useSettingsStore.getState>> = {}) {
  useSettingsStore.setState({
    aiProvider: 'openai',
    aiApiKey: '',
    aiBaseURL: openaiDefaults.baseURL,
    aiModel: openaiDefaults.model,
    serverAIConfigured: false,
    serverAIProvider: 'openai',
    serverAIBaseURL: openaiDefaults.baseURL,
    serverAIModel: openaiDefaults.model,
    autoSave: true,
    autoSaveInterval: 500,
    _hydrated: true,
    _syncing: false,
    settingsSyncError: null,
    ...overrides,
  });
}

test('getAIHeaders uses server provider, base URL, and model when no local key is configured', () => {
  resetSettings({
    aiProvider: 'openai',
    aiApiKey: '',
    aiBaseURL: openaiDefaults.baseURL,
    aiModel: openaiDefaults.model,
    serverAIConfigured: true,
    serverAIProvider: 'openai',
    serverAIBaseURL: 'https://server.example/v1',
    serverAIModel: 'server-model',
  });

  assert.deepEqual(getAIHeaders(), {
    'x-provider': 'openai',
    'x-base-url': 'https://server.example/v1',
    'x-model': 'server-model',
  });
});

test('getAIHeaders switches to the configured server provider when local settings are stale and keyless', () => {
  resetSettings({
    aiProvider: 'openai',
    aiApiKey: '   ',
    aiBaseURL: 'https://local.example/v1',
    aiModel: 'local-model',
    serverAIConfigured: true,
    serverAIProvider: 'anthropic',
    serverAIBaseURL: anthropicDefaults.baseURL,
    serverAIModel: 'claude-server',
  });

  assert.deepEqual(getAIHeaders(), {
    'x-provider': 'anthropic',
    'x-base-url': anthropicDefaults.baseURL,
    'x-model': 'claude-server',
  });
});

test('getAIHeaders preserves local provider settings when a local key exists', () => {
  resetSettings({
    aiProvider: 'openai',
    aiApiKey: ' local-key ',
    aiBaseURL: 'https://local.example/v1',
    aiModel: 'local-model',
    serverAIConfigured: true,
    serverAIProvider: 'anthropic',
    serverAIBaseURL: anthropicDefaults.baseURL,
    serverAIModel: 'claude-server',
  });

  assert.deepEqual(getAIHeaders(), {
    'x-provider': 'openai',
    'x-api-key': 'local-key',
    'x-base-url': 'https://local.example/v1',
    'x-model': 'local-model',
  });
});

test('clearing a local key reconciles visible AI settings back to server defaults', () => {
  resetSettings({
    aiProvider: 'openai',
    aiApiKey: 'local-key',
    aiBaseURL: 'https://local.example/v1',
    aiModel: 'local-model',
    serverAIConfigured: true,
    serverAIProvider: 'anthropic',
    serverAIBaseURL: anthropicDefaults.baseURL,
    serverAIModel: 'claude-server',
  });

  useSettingsStore.getState().setAIApiKey('');

  assert.equal(useSettingsStore.getState().aiProvider, 'anthropic');
  assert.equal(useSettingsStore.getState().aiBaseURL, anthropicDefaults.baseURL);
  assert.equal(useSettingsStore.getState().aiModel, 'claude-server');
});

test('hydrate surfaces settings load failures', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    resetSettings();
  });

  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'settings service unavailable' }), { status: 503 });
  resetSettings({ _hydrated: false });

  await useSettingsStore.getState().hydrate();

  const state = useSettingsStore.getState();
  assert.equal(state._hydrated, true);
  assert.equal(state.settingsSyncError, 'settings service unavailable');
});

test('debounced settings sync surfaces save failures', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
    resetSettings();
  });

  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'settings save failed' }), { status: 500 });
  resetSettings();

  useSettingsStore.getState().setAIModel('new-model');
  await wait(550);

  assert.equal(useSettingsStore.getState().settingsSyncError, 'settings save failed');
});
