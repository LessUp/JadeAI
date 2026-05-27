'use client';

import { createContext, useContext, useEffect } from 'react';
import { useSettingsStore } from '@/stores/settings-store';
import type { AIProvider } from '@/lib/ai/shared';

interface RuntimeConfig {
  authEnabled: boolean;
  githubRepo: string;
  siteUrl: string;
  aiServerConfigured: boolean;
  aiServerProvider: AIProvider;
  aiServerBaseURL: string;
  aiServerModel: string;
}

const DEFAULT_GITHUB_REPO = 'LessUp/JadeAI';
const DEFAULT_SITE_URL = 'https://lessup.github.io/JadeAI';

const RuntimeConfigContext = createContext<RuntimeConfig>({
  authEnabled: false,
  githubRepo: DEFAULT_GITHUB_REPO,
  siteUrl: DEFAULT_SITE_URL,
  aiServerConfigured: false,
  aiServerProvider: 'openai',
  aiServerBaseURL: 'https://api.openai.com/v1',
  aiServerModel: 'gpt-4o',
});

export function RuntimeConfigProvider({
  children,
  authEnabled,
  githubRepo,
  siteUrl,
  aiServerConfigured,
  aiServerProvider,
  aiServerBaseURL,
  aiServerModel,
}: {
  children: React.ReactNode;
  authEnabled: boolean;
  githubRepo: string;
  siteUrl: string;
  aiServerConfigured: boolean;
  aiServerProvider: AIProvider;
  aiServerBaseURL: string;
  aiServerModel: string;
}) {
  const setServerAIConfig = useSettingsStore((s) => s.setServerAIConfig);

  useEffect(() => {
    setServerAIConfig({
      configured: aiServerConfigured,
      provider: aiServerProvider,
      baseURL: aiServerBaseURL,
      model: aiServerModel,
    });
  }, [aiServerConfigured, aiServerProvider, aiServerBaseURL, aiServerModel, setServerAIConfig]);

  return (
    <RuntimeConfigContext.Provider
      value={{
        authEnabled,
        githubRepo,
        siteUrl,
        aiServerConfigured,
        aiServerProvider,
        aiServerBaseURL,
        aiServerModel,
      }}
    >
      {children}
    </RuntimeConfigContext.Provider>
  );
}

export function useRuntimeConfig() {
  return useContext(RuntimeConfigContext);
}
