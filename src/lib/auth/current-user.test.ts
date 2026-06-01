import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ANONYMOUS_SESSION_COOKIE,
  createAnonymousSessionCookie,
  createAnonymousSessionCookieValue,
  getFingerprintIdentityFromRequest,
  normalizeFingerprint,
  verifyAnonymousSessionCookieValue,
} from './current-user';

const SECRET = 'test-secret-for-anonymous-session-binding';

function requestWith(headers: Record<string, string>) {
  return new Request('https://jadeai.test/api/resume', { headers });
}

test('fingerprint normalization preserves existing safe identifiers', () => {
  assert.equal(normalizeFingerprint(' demo-fingerprint '), 'demo-fingerprint');
  assert.equal(normalizeFingerprint('7f7f9f8a9b8c7d6e5f4a'), '7f7f9f8a9b8c7d6e5f4a');
  assert.equal(normalizeFingerprint('550e8400-e29b-41d4-a716-446655440000'), '550e8400-e29b-41d4-a716-446655440000');
});

test('fingerprint normalization rejects missing blank and garbage boundaries', () => {
  assert.equal(normalizeFingerprint(undefined), null);
  assert.equal(normalizeFingerprint(null), null);
  assert.equal(normalizeFingerprint(''), null);
  assert.equal(normalizeFingerprint('   '), null);
  assert.equal(normalizeFingerprint('short'), null);
  assert.equal(normalizeFingerprint('visitor id with spaces'), null);
  assert.equal(normalizeFingerprint('{"visitorId":"client-garbage"}'), null);
  assert.equal(normalizeFingerprint('a'.repeat(129)), null);
});

test('signed anonymous session cookie round-trips normalized fingerprint', () => {
  const cookieValue = createAnonymousSessionCookieValue(' demo-fingerprint ', {
    secret: SECRET,
    issuedAt: 1,
  });

  assert.ok(cookieValue);
  assert.equal(verifyAnonymousSessionCookieValue(cookieValue, SECRET), 'demo-fingerprint');
});

test('signed anonymous session cookie rejects tampering and wrong secrets', () => {
  const cookieValue = createAnonymousSessionCookieValue('demo-fingerprint', {
    secret: SECRET,
    issuedAt: 1,
  });

  assert.ok(cookieValue);
  assert.equal(verifyAnonymousSessionCookieValue(`${cookieValue}tampered`, SECRET), null);
  assert.equal(verifyAnonymousSessionCookieValue(cookieValue, 'different-secret'), null);
});

test('current user seam resolves identity from signed cookie when present', () => {
  const cookieValue = createAnonymousSessionCookieValue('trusted-fingerprint', {
    secret: SECRET,
    issuedAt: 1,
  });
  assert.ok(cookieValue);

  const identity = getFingerprintIdentityFromRequest(
    requestWith({
      cookie: `${ANONYMOUS_SESSION_COOKIE}=${cookieValue}`,
    }),
    { secret: SECRET }
  );

  assert.deepEqual(identity, {
    type: 'fingerprint',
    source: 'cookie',
    fingerprint: 'trusted-fingerprint',
  });
});

test('current user seam rejects mismatched header when a signed session cookie exists', () => {
  const cookieValue = createAnonymousSessionCookieValue('trusted-fingerprint', {
    secret: SECRET,
    issuedAt: 1,
  });
  assert.ok(cookieValue);

  const identity = getFingerprintIdentityFromRequest(
    requestWith({
      cookie: `${ANONYMOUS_SESSION_COOKIE}=${cookieValue}`,
      'x-fingerprint': 'different-fingerprint',
    }),
    { secret: SECRET }
  );

  assert.equal(identity, null);
});

test('current user seam keeps x-fingerprint fallback when cookie is missing or invalid', () => {
  const identity = getFingerprintIdentityFromRequest(
    requestWith({
      cookie: `${ANONYMOUS_SESSION_COOKIE}=not-a-valid-cookie`,
      'x-fingerprint': 'fallback-fingerprint',
    }),
    { secret: SECRET }
  );

  assert.deepEqual(identity, {
    type: 'fingerprint',
    source: 'header',
    fingerprint: 'fallback-fingerprint',
  });
});

test('anonymous cookie binding is only created when a signing secret is available', () => {
  const originalAuthSecret = process.env.AUTH_SECRET;
  const originalNextAuthSecret = process.env.NEXTAUTH_SECRET;

  try {
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    assert.equal(createAnonymousSessionCookie('demo-fingerprint'), null);
  } finally {
    if (originalAuthSecret === undefined) {
      delete process.env.AUTH_SECRET;
    } else {
      process.env.AUTH_SECRET = originalAuthSecret;
    }
    if (originalNextAuthSecret === undefined) {
      delete process.env.NEXTAUTH_SECRET;
    } else {
      process.env.NEXTAUTH_SECRET = originalNextAuthSecret;
    }
  }

  const cookie = createAnonymousSessionCookie('demo-fingerprint', {
    secret: SECRET,
    secure: true,
  });

  assert.ok(cookie);
  assert.equal(cookie.name, ANONYMOUS_SESSION_COOKIE);
  assert.equal(cookie.options.httpOnly, true);
  assert.equal(cookie.options.sameSite, 'lax');
  assert.equal(cookie.options.secure, true);
});
