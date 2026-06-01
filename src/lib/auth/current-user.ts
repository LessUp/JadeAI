import { createHmac, timingSafeEqual } from 'node:crypto';

export const FINGERPRINT_HEADER = 'x-fingerprint';
export const ANONYMOUS_SESSION_COOKIE = 'jade_anon_session';

const MIN_FINGERPRINT_LENGTH = 8;
const MAX_FINGERPRINT_LENGTH = 128;
const FINGERPRINT_PATTERN = /^[A-Za-z0-9._:-]+$/;
const COOKIE_VERSION = 'v1';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

export type CurrentUserIdentity =
  | {
      type: 'oauth';
      source: 'nextauth';
      userId: string;
      email?: string | null;
    }
  | {
      type: 'fingerprint';
      source: 'cookie' | 'header';
      fingerprint: string;
    };

export type RequestWithReadableCookies = Pick<Request, 'headers'> & {
  cookies?: CookieReader;
};

export type AnonymousSessionCookie = {
  name: typeof ANONYMOUS_SESSION_COOKIE;
  value: string;
  options: {
    httpOnly: true;
    sameSite: 'lax';
    secure: boolean;
    path: '/';
    maxAge: number;
  };
};

type AnonymousCookiePayload = {
  fingerprint: string;
  issuedAt: number;
};

function getAnonymousSessionSecret(secret?: string): string | null {
  return secret || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || null;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string | null {
  try {
    return Buffer.from(value, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function signaturesMatch(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function readCookieValue(request: RequestWithReadableCookies, name: string): string | null {
  const requestCookie = request.cookies?.get(name)?.value;
  if (requestCookie) return requestCookie;

  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  for (const cookie of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = cookie.trim().split('=');
    if (rawName === name) return rawValue.join('=') || null;
  }

  return null;
}

export function normalizeFingerprint(value?: string | null): string | null {
  if (typeof value !== 'string') return null;

  const fingerprint = value.trim();
  if (fingerprint.length < MIN_FINGERPRINT_LENGTH) return null;
  if (fingerprint.length > MAX_FINGERPRINT_LENGTH) return null;
  if (!FINGERPRINT_PATTERN.test(fingerprint)) return null;

  return fingerprint;
}

export function createAnonymousSessionCookieValue(
  fingerprint: string,
  options: { secret?: string; issuedAt?: number } = {}
): string | null {
  const normalizedFingerprint = normalizeFingerprint(fingerprint);
  const secret = getAnonymousSessionSecret(options.secret);
  if (!normalizedFingerprint || !secret) return null;

  const payload: AnonymousCookiePayload = {
    fingerprint: normalizedFingerprint,
    issuedAt: options.issuedAt ?? Date.now(),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(`${COOKIE_VERSION}.${encodedPayload}`, secret);

  return `${COOKIE_VERSION}.${encodedPayload}.${signature}`;
}

export function verifyAnonymousSessionCookieValue(value?: string | null, secret?: string): string | null {
  const resolvedSecret = getAnonymousSessionSecret(secret);
  if (!value || !resolvedSecret) return null;

  const [version, encodedPayload, signature, ...extra] = value.split('.');
  if (extra.length > 0 || version !== COOKIE_VERSION || !encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(`${version}.${encodedPayload}`, resolvedSecret);
  if (!signaturesMatch(signature, expectedSignature)) return null;

  const decodedPayload = base64UrlDecode(encodedPayload);
  if (!decodedPayload) return null;

  try {
    const payload = JSON.parse(decodedPayload) as Partial<AnonymousCookiePayload>;
    return normalizeFingerprint(payload.fingerprint);
  } catch {
    return null;
  }
}

export function getFingerprintIdentityFromRequest(
  request: RequestWithReadableCookies,
  options: { secret?: string } = {}
): Extract<CurrentUserIdentity, { type: 'fingerprint' }> | null {
  const cookieFingerprint = verifyAnonymousSessionCookieValue(
    readCookieValue(request, ANONYMOUS_SESSION_COOKIE),
    options.secret
  );
  const headerFingerprint = normalizeFingerprint(request.headers.get(FINGERPRINT_HEADER));
  if (cookieFingerprint) {
    if (headerFingerprint && headerFingerprint !== cookieFingerprint) {
      return null;
    }
    return { type: 'fingerprint', source: 'cookie', fingerprint: cookieFingerprint };
  }

  if (!headerFingerprint) return null;

  return { type: 'fingerprint', source: 'header', fingerprint: headerFingerprint };
}

export function createAnonymousSessionCookie(
  fingerprint: string,
  options: { secret?: string; secure?: boolean; issuedAt?: number } = {}
): AnonymousSessionCookie | null {
  const value = createAnonymousSessionCookieValue(fingerprint, options);
  if (!value) return null;

  return {
    name: ANONYMOUS_SESSION_COOKIE,
    value,
    options: {
      httpOnly: true,
      sameSite: 'lax',
      secure: options.secure ?? process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: COOKIE_MAX_AGE_SECONDS,
    },
  };
}
