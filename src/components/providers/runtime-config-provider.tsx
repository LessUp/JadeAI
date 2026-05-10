'use client';

import { createContext, useContext } from 'react';

interface RuntimeConfig {
  authEnabled: boolean;
  githubRepo: string;
  siteUrl: string;
}

const DEFAULT_GITHUB_REPO = 'LessUp/JadeAI';
const DEFAULT_SITE_URL = 'https://lessup.github.io/JadeAI';

const RuntimeConfigContext = createContext<RuntimeConfig>({
  authEnabled: false,
  githubRepo: DEFAULT_GITHUB_REPO,
  siteUrl: DEFAULT_SITE_URL,
});

export function RuntimeConfigProvider({
  children,
  authEnabled,
  githubRepo,
  siteUrl,
}: {
  children: React.ReactNode;
  authEnabled: boolean;
  githubRepo: string;
  siteUrl: string;
}) {
  return (
    <RuntimeConfigContext.Provider value={{ authEnabled, githubRepo, siteUrl }}>
      {children}
    </RuntimeConfigContext.Provider>
  );
}

export function useRuntimeConfig() {
  return useContext(RuntimeConfigContext);
}
