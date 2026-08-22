import { NextRequest } from 'next/server';

export function generateShareToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function getShareUrl(token: string, request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const origin = host ? `${proto}://${host}` : request.nextUrl.origin;
  return `${origin}/share/${token}`;
}

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_LENGTH = 32;
const PBKDF2_HASH = 'SHA-256';
const PBKDF2_PREFIX = 'pbkdf2';

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function deriveKey(password: string, salt: Uint8Array): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    keyMaterial,
    PBKDF2_KEY_LENGTH * 8
  );
  return toHex(bits);
}

/** Hash format: pbkdf2$<iterations>$<salt-hex>$<hash-hex> */
export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = await deriveKey(password, salt);
  return `${PBKDF2_PREFIX}$${PBKDF2_ITERATIONS}$${toHex(salt.buffer as ArrayBuffer)}$${hash}`;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Legacy unsalted SHA-256 hex digest — kept only to verify pre-existing shares. */
async function legacySha256(password: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  return toHex(digest);
}

/**
 * Verifies a share password against a stored hash. Supports both the current
 * salted PBKDF2 format and legacy plain SHA-256 hashes.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash) return false;

  if (storedHash.startsWith(`${PBKDF2_PREFIX}$`)) {
    const [, iterationsRaw, saltHex, expectedHash] = storedHash.split('$');
    const iterations = Number(iterationsRaw);
    if (!iterations || !saltHex || !expectedHash) return false;

    const salt = new Uint8Array(saltHex.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) ?? []);
    if (salt.length === 0) return false;
    // Recompute with the stored iteration count so future upgrades stay verifiable.
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: PBKDF2_HASH },
      keyMaterial,
      PBKDF2_KEY_LENGTH * 8
    );
    return timingSafeEqualHex(toHex(bits), expectedHash.toLowerCase());
  }

  // Legacy hash (no separator) — verify then let callers re-hash on save.
  return timingSafeEqualHex(await legacySha256(password), storedHash.toLowerCase());
}
