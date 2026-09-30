/**
 * Server-side S3 Multipart Upload verso R2 (SigV4 Authorization header).
 * SERVER ONLY — mai importare dal client.
 *
 * Usato dal relay chunked upload: ogni chunk del browser diventa una
 * UploadPart R2; alla fine CompleteMultipartUpload assembla l'oggetto.
 * Server→R2 non è soggetto a CORS: funziona con qualsiasi bucket config.
 */
import { getR2Config } from "./r2";
import { createHash, createHmac } from "node:crypto";

function hmac(key: Buffer | string, data: string | Buffer): Buffer {
  return createHmac("sha256", key).update(data).digest();
}
function hashHex(s: string | Buffer): string {
  return createHash("sha256").update(s).digest("hex");
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

function canonUri(bucket: string, key: string): string {
  if (!key) return `/${bucket}`;
  return `/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

async function signedFetch(opts: {
  method: string;
  key: string;
  subresource: string; // es. "uploads" | "uploadId=…&partNumber=…" | "" — canonical QS ordinata
  body?: Buffer;
  contentType?: string;
}): Promise<Response> {
  const cfg = getR2Config();
  if (!cfg) throw new Error("R2 not configured");
  const { accountId, accessKeyId, secretAccessKey, bucket } = cfg;
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const region = "auto";
  const service = "s3";
  const { amzDate: amzDt, dateStamp } = amzDate();
  const uri = canonUri(bucket, opts.key);
  const qs = opts.subresource;
  const payloadHash = opts.body ? hashHex(opts.body) : hashHex("");
  const headers: Record<string, string> = {
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDt,
  };
  if (opts.contentType) headers["content-type"] = opts.contentType;
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((n) => `${n}:${headers[n]}\n`).join("");
  const signedHeaders = names.join(";");
  const canonicalRequest = [opts.method, uri, qs, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDt, credentialScope, hashHex(canonicalRequest)].join("\n");
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmac(kSigning, stringToSign).toString("hex");
  const url = `https://${host}${uri}${qs ? `?${qs}` : ""}`;
  const res = await fetch(url, {
    method: opts.method,
    headers: {
      ...headers,
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      ...(opts.body ? { "Content-Length": String(opts.body.length) } : {}),
    },
    body: opts.body ? new Uint8Array(opts.body) : undefined,
  });
  return res;
}

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Avvia un MPU. Ritorna l'uploadId. */
export async function mpuCreate(key: string, contentType: string): Promise<string> {
  const res = await signedFetch({
    method: "POST",
    key,
    subresource: "uploads=",
    contentType: contentType || "video/mp4",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`R2 CreateMPU failed (${res.status})`);
  const m = text.match(/<UploadId>([^<]+)<\/UploadId>/);
  if (!m) throw new Error("R2 CreateMPU: UploadId mancante");
  return m[1];
}

/** Carica una parte. Ritorna l'ETag (con virgolette, come serve a Complete). */
export async function mpuUploadPart(
  key: string,
  uploadId: string,
  partNumber: number,
  body: Buffer
): Promise<string> {
  const qs = `partNumber=${partNumber}&uploadId=${encodeURIComponent(uploadId)}`;
  const res = await signedFetch({ method: "PUT", key, subresource: qs, body });
  const errText = res.ok ? "" : await res.text().catch(() => "");
  if (!res.ok) throw new Error(`R2 UploadPart ${partNumber} failed (${res.status}): ${errText.slice(0, 300)}`);
  await res.arrayBuffer().catch(() => null);
  const etag = res.headers.get("etag") || "";
  if (!etag) throw new Error(`R2 UploadPart ${partNumber}: ETag mancante`);
  return etag;
}

/** Completa l'MPU. Ritorna true se R2 conferma l'assemblaggio. */
export async function mpuComplete(
  key: string,
  uploadId: string,
  parts: Array<{ partNumber: number; etag: string }>
): Promise<boolean> {
  const xml =
    `<CompleteMultipartUpload>` +
    parts
      .slice()
      .sort((a, b) => a.partNumber - b.partNumber)
      .map((p) => `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${escXml(p.etag)}</ETag></Part>`)
      .join("") +
    `</CompleteMultipartUpload>`;
  const qs = `uploadId=${encodeURIComponent(uploadId)}`;
  const res = await signedFetch({
    method: "POST",
    key,
    subresource: qs,
    body: Buffer.from(xml, "utf8"),
    contentType: "application/xml",
  });
  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`R2 CompleteMPU failed (${res.status})`);
  return /<CompleteMultipartUploadResult/i.test(text) || res.status === 200;
}

/** HEAD: verifica che l'oggetto esista e ritorna la size. Null se assente. */
export async function mpuHeadSize(key: string): Promise<number | null> {
  try {
    const res = await signedFetch({ method: "HEAD", key, subresource: "" });
    if (!res.ok) return null;
    await res.arrayBuffer().catch(() => null);
    const len = Number(res.headers.get("content-length"));
    return Number.isFinite(len) && len >= 0 ? len : 0;
  } catch {
    return null;
  }
}

/** Chiave staging per un chunk: tmp/mpu/<userId>/<uploadId>/<partNumber padded>. */
export function stagingChunkKey(userId: string, uploadId: string, partNumber: number): string {
  const safeUp = (uploadId || "").trim().replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return `tmp/mpu/${userId}/${safeUp}/${String(partNumber).padStart(5, "0")}`;
}

/** Abort: pulisce un MPU rimasto appeso (best-effort, mai throw). */
export async function mpuAbort(key: string, uploadId: string): Promise<void> {
  try {
    const qs = `uploadId=${encodeURIComponent(uploadId)}`;
    const res = await signedFetch({ method: "DELETE", key, subresource: qs });
    await res.arrayBuffer().catch(() => null);
  } catch {}
}

/** Lista oggetti con prefisso (ListObjectsV2). Ritorna [{key,size}]. */
export async function listR2Prefix(
  prefix: string,
  maxKeys = 1000
): Promise<Array<{ key: string; size: number }>> {
  const qs = `list-type=2&max-keys=${Math.max(1, Math.min(1000, maxKeys))}&prefix=${encodeURIComponent(prefix)}`;
  const res = await signedFetch({ method: "GET", key: "", subresource: qs });
  const text = await res.text();
  if (!res.ok) throw new Error(`R2 List failed (${res.status})`);
  const out: Array<{ key: string; size: number }> = [];
  const re = /<Contents>[\s\S]*?<Key>([^<]+)<\/Key>[\s\S]*?<Size>(\d+)<\/Size>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ key: m[1], size: Number(m[2]) });
  }
  return out;
}

/**
 * GET streaming di un oggetto R2 (per assemblare file grandi senza
 * caricarli interi in RAM). Il chiamante consuma `res.body`.
 */
export async function getR2ObjectResponse(key: string): Promise<Response> {
  const res = await signedFetch({ method: "GET", key, subresource: "" });
  if (!res.ok) throw new Error(`R2 GET ${key} failed (${res.status})`);
  return res;
}

/** DELETE di un oggetto (best-effort: ritorna true se 200/204). */
export async function deleteR2Object(key: string): Promise<boolean> {
  try {
    const res = await signedFetch({ method: "DELETE", key, subresource: "" });
    await res.arrayBuffer().catch(() => null);
    return res.status === 200 || res.status === 204;
  } catch {
    return false;
  }
}
