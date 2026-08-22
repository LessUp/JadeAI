import { AI_ALLOW_PRIVATE_HOSTS_ENV } from '@/lib/constants';

/**
 * Base-URL validation for client-supplied AI provider endpoints.
 *
 * The server forwards requests to `x-base-url`, so without validation a caller
 * could pivot the server into internal networks (SSRF), e.g. cloud metadata
 * services. Local loopback stays allowed so self-hosted local LLM runtimes
 * (Ollama, LM Studio, vLLM) keep working; private ranges can be re-enabled
 * explicitly with AI_ALLOW_PRIVATE_BASE_URL=true.
 */

const BLOCKED_HOSTNAMES = new Set([
  'metadata.google.internal',
  'metadata.goog',
]);

function isPrivateIPv4(hostname: string): boolean {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10 || a === 127) return true; // private, loopback handled separately
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isPrivateIPv6(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === '::1' || host === '::') return true;
  if (host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) return true;
  if (host.startsWith('::ffff:')) return isPrivateIPv4(host.slice(7).split('%')[0]);
  return false;
}

export function isPrivateNetworkHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.+$/, '');
  if (!host) return false;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return isPrivateIPv4(host);
  if (host.includes(':')) return isPrivateIPv6(host);
  // .local mDNS and bare single-label hosts resolve inside the LAN.
  if (host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (!host.includes('.')) return true;
  return false;
}

export type BaseUrlValidation =
  | { ok: true }
  | { ok: false; reason: string };

export function validateAIBaseUrl(rawBaseUrl: string): BaseUrlValidation {
  let url: URL;
  try {
    url = new URL(rawBaseUrl);
  } catch {
    return { ok: false, reason: 'Invalid base URL format.' };
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'Base URL must use http or https.' };
  }

  const allowPrivate = process.env[AI_ALLOW_PRIVATE_HOSTS_ENV] === 'true';
  const hostname = url.hostname.toLowerCase();
  const isLoopback =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1';

  if (!allowPrivate && !isLoopback && isPrivateNetworkHost(hostname)) {
    return {
      ok: false,
      reason:
        'Base URL points to a private/internal network address and was blocked. Set AI_ALLOW_PRIVATE_BASE_URL=true to allow it.',
    };
  }

  return { ok: true };
}
