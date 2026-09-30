/**
 * RetentionEdit — Edge-safe, Universal Cryptographic Session Token Helper.
 * Works in both Next.js Edge Middleware and Node.js API runtimes.
 * Uses Web Crypto API (crypto.subtle).
 */

const DEFAULT_SECRET_FALLBACK = "retentionedit-vault-core-session-secret-salt-2026";

export function getEffectiveSessionSecret(): string {
  if (typeof process !== "undefined" && process.env) {
    const s = (process.env.SESSION_SECRET || process.env.VAULT_MASTER_KEY || "").trim();
    if (s.length >= 16) return s;
  }
  // FAIL-CLOSED in produzione: senza secret reale nessuna sessione firmata.
  // In dev/preview resta il fallback per i test locali (mai in prod).
  if (typeof process !== "undefined" && process.env && process.env.NODE_ENV === "production") {
    throw new Error("[session-token] SESSION_SECRET/VAULT_MASTER_KEY missing in production — refusing to sign sessions.");
  }
  return DEFAULT_SECRET_FALLBACK;
}

function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

export interface SessionTokenPayload {
  u: string; // userId
  e?: string; // email
  exp: number; // expiration timestamp in seconds
  iat: number; // issued at timestamp in seconds
}

/**
 * Creates a signed session token: re_v1.<payload_b64url>.<signature_hex>
 */
export async function createSessionToken(
  userId: string,
  email?: string,
  maxAgeSec: number = 8 * 3600,
  secretOverride?: string
): Promise<string> {
  const secret = secretOverride || getEffectiveSessionSecret();
  const now = Math.floor(Date.now() / 1000);
  const exp = maxAgeSec <= 0 ? now + maxAgeSec : now + maxAgeSec;

  const payload: SessionTokenPayload = {
    u: userId.trim().slice(0, 100),
    e: email ? email.trim().toLowerCase().slice(0, 150) : undefined,
    exp,
    iat: now,
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `re_v1.${payloadB64}`;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sigBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(dataToSign));
  const sigHex = bytesToHex(new Uint8Array(sigBuffer));

  return `${dataToSign}.${sigHex}`;
}

/**
 * Verifies a signed session token. Returns parsed payload if valid and not expired, or null.
 */
export async function verifySessionToken(
  token: string,
  secretOverride?: string
): Promise<{ userId: string; email?: string } | null> {
  if (!token || typeof token !== "string") return null;

  const parts = token.trim().split(".");
  if (parts.length !== 3 || parts[0] !== "re_v1") {
    return null;
  }

  const [prefix, payloadB64, providedSigHex] = parts;
  if (!prefix || !payloadB64 || !providedSigHex || providedSigHex.length !== 64) {
    return null;
  }

  const dataToSign = `${prefix}.${payloadB64}`;
  const secret = secretOverride || getEffectiveSessionSecret();

  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const sigBytes = hexToBytes(providedSigHex);
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes as unknown as BufferSource,
      enc.encode(dataToSign)
    );
    if (!isValid) return null;

    const payload = JSON.parse(base64UrlDecode(payloadB64)) as SessionTokenPayload;
    if (!payload || typeof payload.u !== "string" || !payload.u.trim()) return null;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== "number" || payload.exp < now) {
      return null;
    }

    return {
      userId: payload.u.trim(),
      email: payload.e?.trim() || undefined,
    };
  } catch {
    return null;
  }
}
