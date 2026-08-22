import { NextRequest } from 'next/server';
import { extractAIConfig, AIConfigError } from '@/lib/ai/provider';
import { type ModelListItem } from '@/lib/ai/model-list';
import { resolveCurrentUser } from '@/lib/auth/helpers';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const RATE_LIMIT = { limit: 30, windowMs: 60_000 };

function modelListError(message: string, status = 502) {
  return Response.json({ models: [], error: message }, { status });
}

async function readProviderError(res: Response) {
  try {
    const data = await res.json();
    const message = data?.error?.message || data?.error || data?.message;
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  } catch {
    // Fall through to status text.
  }
  return res.statusText || `HTTP ${res.status}`;
}

async function providerFetchError(res: Response, provider: string) {
  const detail = await readProviderError(res);
  return modelListError(`Unable to fetch ${provider} models: ${detail}`, res.status >= 400 && res.status < 500 ? 400 : 502);
}

export async function GET(request: NextRequest) {
  const currentUser = await resolveCurrentUser({ request });
  if (!currentUser) return new Response('Unauthorized', { status: 401 });

  const rate = checkRateLimit(`models:${currentUser.user.id}`, RATE_LIMIT);
  if (!rate.allowed) return rateLimitResponse(rate.retryAfterSeconds);

  let config;
  try {
    config = extractAIConfig(request);
  } catch (error) {
    if (error instanceof AIConfigError) {
      return modelListError(error.message, 400);
    }
    throw error;
  }
  const { provider, apiKey, baseURL } = config;

  if (!apiKey) {
    return modelListError('API key is required to load models. Configure a local key or server-side AI defaults.', 400);
  }

  try {
    let models: ModelListItem[] = [];

    switch (provider) {
      case 'anthropic': {
        const url = baseURL
          ? `${baseURL.replace(/\/$/, '')}/v1/models`
          : 'https://api.anthropic.com/v1/models';
        const res = await fetch(url, {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
        });
        if (!res.ok) return providerFetchError(res, provider);
        const data = await res.json();
        models = (data.data ?? []).map((m: { id: string }) => ({ id: m.id }));
        break;
      }

      case 'gemini': {
        const url = baseURL
          ? `${baseURL.replace(/\/$/, '')}/models?key=${apiKey}`
          : `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) return providerFetchError(res, provider);
        const data = await res.json();
        models = (data.models ?? []).map((m: { name: string }) => ({
          id: m.name.replace(/^models\//, ''),
        }));
        break;
      }

      default: {
        // openai
        const effectiveBaseURL = baseURL.replace(/\/$/, '');
        const res = await fetch(`${effectiveBaseURL}/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!res.ok) return providerFetchError(res, provider);
        const data = await res.json();
        models = (data.data ?? data).map((m: { id: string }) => ({ id: m.id }));
        break;
      }
    }

    return Response.json({ models });
  } catch {
    return modelListError('Unable to fetch models. Check the provider, base URL, and API key settings.');
  }
}
