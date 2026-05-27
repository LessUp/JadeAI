import { NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { SessionProvider } from 'next-auth/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { RuntimeConfigProvider } from '@/components/providers/runtime-config-provider';
import { BrandProvider } from '@/components/layout/brand-provider';
import { getPublicServerAIConfig } from '@/lib/ai/server-config';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const authEnabled = process.env.AUTH_ENABLED === 'true';
  const githubRepo = process.env.PUBLIC_GITHUB_REPO || 'LessUp/JadeAI';
  const siteUrl = (process.env.PUBLIC_SITE_URL || 'https://lessup.github.io/JadeAI').replace(/\/$/, '');
  const serverAIConfig = getPublicServerAIConfig();

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  const messages = (await import(`../../../messages/${locale}.json`)).default;

  return (
    <SessionProvider>
      <RuntimeConfigProvider
        authEnabled={authEnabled}
        githubRepo={githubRepo}
        siteUrl={siteUrl}
        aiServerConfigured={serverAIConfig.configured}
        aiServerProvider={serverAIConfig.provider}
        aiServerBaseURL={serverAIConfig.baseURL}
        aiServerModel={serverAIConfig.model}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <BrandProvider>
              <TooltipProvider>
                {children}
                <Toaster />
              </TooltipProvider>
            </BrandProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </RuntimeConfigProvider>
    </SessionProvider>
  );
}
