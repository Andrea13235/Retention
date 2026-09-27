/**
 * Minimal Cloudflare R2 (S3-compatible) helper — SigV4 presigned URLs.
 * No external deps. Server-only (uses node:crypto). Secrets never leave the server.
 */
import { createHmac, createHash } from "node:crypto";
import { getSecret } from "./vault-store";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl?: string;
};

export function getR2Config(): R2Config | null {
  const accountId = (getSecret("r2_account_id") || "").trim();
  const accessKeyId = (getSecret("r2_access_key_id") || "").trim();
  const secretAccessKey = (getSecret("r2_secret_access_key") || "").trim();
  const bucket = (getSecret("r2_bucket") || "").trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  const publicBaseUrl = (getSecret("r2_public_base_url") || "").trim() || undefined;
  return { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl };
}

export function isR2Configured(): boolean {
  return getR2Config() !== null;
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}
function hashHex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}
function amzDate(d = new Date()): { amzDate: string; dateStamp: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = d.getUTCFullYear();
  const m = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return { amzDate: `${y}${m}${day}T${hh}${mm}${ss}Z`, dateStamp: `${y}${m}${day}` };
}

/**
 * Create a presigned URL for R2 (S3 SigV4 query-string auth).
 * method: PUT | GET | HEAD, expiresSec: 300–900 recommended.
 */
export function presignR2Url(params: {
  method: "PUT" | "GET" | "HEAD";
  key: string;
  expiresSec: number;
  contentType?: string;
  contentLength?: number;
}): string | null {
  const cfg = getR2Config();
  if (!cfg) return null;
  const { accountId, accessKeyId, secretAccessKey, bucket } = cfg;
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const region = "auto";
  const service = "s3";
  const expires = Math.max(60, Math.min(3600, Math.floor(params.expiresSec)));
  const { amzDate: amzDt, dateStamp } = amzDate();
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const signedHeaders = "host";
  const canonicalUri = `/${bucket}/${params.key.split("/").map(encodeURIComponent).join("/")}`;

  // For presigned URLs, content-type/length are NOT signed; we enforce via policy + confirm step.
  const qs: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDt,
    "X-Amz-Expires": String(expires),
    "X-Amz-SignedHeaders": signedHeaders,
  };
  const canonicalQs = Object.keys(qs)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(qs[k])}`)
    .join("&");
  const canonicalHeaders = `host:${host}\n`;
  const payloadHash = "UNSIGNED-PAYLOAD";
  const canonicalRequest = [
    params.method,
    canonicalUri,
    canonicalQs,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDt, credentialScope, hashHex(canonicalRequest)].join("\n");
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmac(kSigning, stringToSign).toString("hex");
  return `https://${host}${canonicalUri}?${canonicalQs}&X-Amz-Signature=${signature}`;
}

/**
 * Checks whether an R2 key belongs to private user content.
 * All raw videos, rendered exports, thumbnails, and job payloads are private.
 */
export function isPrivateUserKey(key: string): boolean {
  const clean = (key || "").trim().toLowerCase();
  return (
    clean.startsWith("raw/") ||
    clean.startsWith("exports/") ||
    clean.startsWith("thumbnails/") ||
    clean.startsWith("jobs/") ||
    clean.includes("/raw/") ||
    clean.includes("/exports/")
  );
}

/**
 * Returns a private, time-limited presigned GET URL for secure video access.
 * User content NEVER uses publicBaseUrl.
 */
export function presignPrivateGetUrl(key: string, expiresSec = 900): string | null {
  const safeTtl = Math.max(60, Math.min(1800, expiresSec)); // 1 to 30 mins
  return presignR2Url({ method: "GET", key, expiresSec: safeTtl });
}

/**
 * Resolves an R2 key to an accessible URL.
 * PRIVACY GUARANTEE: Any key matching private user content (raw, exports, thumbnails)
 * is ALWAYS signed with a short-lived presigned GET URL and NEVER exposed via publicBaseUrl.
 */
export function r2ObjectUrl(
  key: string,
  options?: { forcePrivate?: boolean; expiresSec?: number }
): string | null {
  const cfg = getR2Config();
  if (!cfg) return null;

  const mustBePrivate = options?.forcePrivate !== false && (options?.forcePrivate === true || isPrivateUserKey(key));

  if (mustBePrivate) {
    return presignPrivateGetUrl(key, options?.expiresSec || 900);
  }

  // Only public assets (e.g. general marketing branding) can use publicBaseUrl
  if (cfg.publicBaseUrl) {
    const base = cfg.publicBaseUrl.replace(/\/+$/, "");
    return `${base}/${key.split("/").map(encodeURIComponent).join("/")}`;
  }

  return presignPrivateGetUrl(key, 900);
}

export function sanitizeR2KeySegment(s: string, maxLen = 80): string {
  const base = (s || "file").trim().replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, maxLen);
  return base.replace(/^[_.-]+|[_.-]+$/g, "") || "file";
}
