import { cookies } from 'next/headers';
import { auth } from './config';
import { config } from '@/lib/config';
import { dbReady } from '@/lib/db';
import { userRepository } from '@/lib/db/repositories/user.repository';
import {
  ANONYMOUS_SESSION_COOKIE,
  createAnonymousSessionCookie,
  getFingerprintIdentityFromRequest,
  normalizeFingerprint,
  verifyAnonymousSessionCookieValue,
  type CurrentUserIdentity,
  type RequestWithReadableCookies,
} from './current-user';

type CurrentUser = NonNullable<Awaited<ReturnType<typeof userRepository.findById>>>;

export type CurrentUserContext = {
  user: CurrentUser;
  identity: CurrentUserIdentity;
};

export async function getCurrentUserId(): Promise<string | null> {
  if (config.auth.enabled) {
    const session = await auth();
    return session?.user?.id || null;
  }
  // In fingerprint mode, userId is resolved from the request header
  return null;
}

async function resolveAuthenticatedUser(): Promise<CurrentUserContext | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  // User was created during sign-in (jwt callback), just look up
  let user = await userRepository.findById(session.user.id);

  // Fallback: ID may differ if token was issued before DB creation
  if (!user && session.user.email) {
    user = await userRepository.findByEmail(session.user.email);
  }

  if (!user) return null;

  return {
    user,
    identity: {
      type: 'oauth',
      source: 'nextauth',
      userId: user.id,
      email: session.user.email,
    },
  };
}

async function bindAnonymousSessionCookie(fingerprint: string): Promise<void> {
  const cookie = createAnonymousSessionCookie(fingerprint);
  if (!cookie) return;

  try {
    const cookieStore = await cookies();
    cookieStore.set(cookie.name, cookie.value, cookie.options);
  } catch {
    // Some tests and non-HTTP callers can resolve users outside a route handler.
  }
}

export async function resolveCurrentUser(options: {
  request?: RequestWithReadableCookies;
  fingerprint?: string | null;
} = {}): Promise<CurrentUserContext | null> {
  // Ensure DB tables exist before any query
  await dbReady;

  if (config.auth.enabled) {
    return resolveAuthenticatedUser();
  }

  const fingerprintIdentity = options.request
    ? getFingerprintIdentityFromRequest(options.request)
    : (() => {
        const fingerprint = normalizeFingerprint(options.fingerprint);
        return fingerprint ? ({ type: 'fingerprint', source: 'header', fingerprint } as const) : null;
      })();

  if (!fingerprintIdentity) return null;

  const user = await userRepository.upsertByFingerprint(fingerprintIdentity.fingerprint);
  if (user && fingerprintIdentity.source === 'header') {
    await bindAnonymousSessionCookie(fingerprintIdentity.fingerprint);
  }

  return user ? { user, identity: fingerprintIdentity } : null;
}

export async function resolveUser(fingerprint?: string | null) {
  // Cookie fallback: when no header fingerprint is supplied (fingerprint mode),
  // the signed anonymous session cookie still identifies the user.
  if (!fingerprint && !config.auth.enabled) {
    try {
      const cookieStore = await cookies();
      const cookieValue = cookieStore.get(ANONYMOUS_SESSION_COOKIE)?.value;
      const cookieFingerprint = verifyAnonymousSessionCookieValue(cookieValue);
      if (cookieFingerprint) fingerprint = cookieFingerprint;
    } catch {
      // Not in a route handler context — header-only resolution applies.
    }
  }
  const currentUser = await resolveCurrentUser({ fingerprint });
  return currentUser?.user ?? null;
}

export function getUserIdFromRequest(request: RequestWithReadableCookies): string | null {
  return getFingerprintIdentityFromRequest(request)?.fingerprint ?? null;
}
