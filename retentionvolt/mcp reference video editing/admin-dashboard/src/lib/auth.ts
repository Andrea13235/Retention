/**
 * Shared Admin Authentication & Cryptography Utilities
 * Works across both Edge runtime (middleware) and Node.js runtime (API routes).
 */

const SESSION_SALT = 'rv_admin_session_salt_2026';

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function computeSha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Computes the legacy session token for backwards compatibility. */
export async function computeAdminSessionToken(secret: string): Promise<string> {
  return computeSha256(`${secret}:${SESSION_SALT}`);
}

/** Issues a cryptographically signed, timestamped session token (valid for 8h). */
export async function createAdminSessionToken(secret: string): Promise<string> {
  const timestamp = Date.now().toString();
  const signature = await computeSha256(`${secret}:${SESSION_SALT}:${timestamp}`);
  return `${timestamp}.${signature}`;
}

/** Verifies a session token against the secret and enforces maximum age. */
export async function verifyAdminSessionToken(
  token: string | undefined,
  secret: string,
  maxAgeMs = 8 * 3600 * 1000
): Promise<boolean> {
  if (!token || !secret) return false;

  // New format: timestamp.signature
  const dotIndex = token.indexOf('.');
  if (dotIndex !== -1) {
    const timestampStr = token.slice(0, dotIndex);
    const signature = token.slice(dotIndex + 1);
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp) || timestamp <= 0) return false;

    const now = Date.now();
    // Expiration check: token must be newer than maxAgeMs and not more than 60s into future
    if (now - timestamp > maxAgeMs || timestamp > now + 60_000) {
      return false;
    }

    const expectedSignature = await computeSha256(`${secret}:${SESSION_SALT}:${timestampStr}`);
    return timingSafeEqual(signature, expectedSignature);
  }

  // Fallback to legacy static token
  const legacyExpected = await computeAdminSessionToken(secret);
  return timingSafeEqual(token, legacyExpected);
}

/** Verifies presented password against secret in constant time. */
export async function verifyPasswordConstantTime(provided: string, secret: string): Promise<boolean> {
  if (!provided || !secret) return false;
  const hashProvided = await computeSha256(provided);
  const hashSecret = await computeSha256(secret);
  return timingSafeEqual(hashProvided, hashSecret);
}

/** In-memory rate limiter for admin login (prevents brute force). */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const loginRateMap = new Map<string, RateLimitEntry>();

export function checkLoginRateLimit(ip: string, limit = 5, windowMs = 60_000): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();

  // Prune expired entries to prevent memory leak
  if (loginRateMap.size > 500) {
    for (const [k, v] of loginRateMap.entries()) {
      if (now > v.resetAt) loginRateMap.delete(k);
    }
  }

  const record = loginRateMap.get(ip);

  if (!record || now > record.resetAt) {
    loginRateMap.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (record.count >= limit) {
    const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, retryAfterSec };
  }

  record.count += 1;
  return { allowed: true };
}
