/**
 * RetentionEdit — Higgsfield SOUL v2 image client (SERVER ONLY).
 *
 * Verified live 2026-09-27 against https://api.higgsfield.ai:
 *  - Auth:  Authorization: Key <KEY_ID:KEY_SECRET>  (NOT Bearer, NOT hf-api-key)
 *  - POST  {BASE}/higgsfield-ai/soul/v2/standard
 *    flat JSON body: { prompt, batch_size, resolution, aspect_ratio, enhance_prompt }
 *    → 200 { status:"queued", request_id, ... }  (422 if body wrapped in "input")
 *  - GET   https://platform.higgsfield.ai/requests/<id>/status  (same auth)
 *    → queued → in_progress → completed + images[{url}]
 *  - Old path /higgsfield/soul/text-to-image/v1.0 → model_not_found (dead).
 *
 * Rules: Higgsfield is the ONLY image generator. On any failure return null
 * (never a stock photo, never an invented path). Callers skip B-roll when null.
 * Never import from client components — key stays server-side.
 *
 * Serverless note: submitSoulImage + pollSoulImage are split so multi-poll
 * jobs can resume polling across invocations (each poll = one cheap GET).
 */
const SOUL_SUBMIT = "https://api.higgsfield.ai/higgsfield-ai/soul/v2/standard";
const STATUS_HOST = "https://platform.higgsfield.ai";

const SUBMIT_TIMEOUT_MS = 60_000;
const POLL_TIMEOUT_MS = 8 * 60_000; // SOUL 720p ≈ 40s; headroom for queue
const POLL_STEP_MS = 10_000;

function credentials(): string {
  const v = (process.env.HIGGSFIELD_API_KEY || "").trim();
  return v;
}

function authHeader(key: string): string {
  return "Key " + key;
}

export interface SoulImage {
  /** Absolute local path of the downloaded PNG. */
  localPath: string;
  /** Remote URL (cloudfront) — kept for debugging only. */
  remoteUrl: string;
  bytes: number;
}

export interface SoulPending {
  requestId: string;
  prompt: string;
  aspectRatio: "9:16" | "16:9" | "4:3" | "3:4" | "1:1" | "2:3" | "3:2";
}

async function pollTerminal(requestId: string, key: string): Promise<{
  status: string;
  images?: Array<{ url?: string }>;
} | null> {
  const started = Date.now();
  const url = STATUS_HOST + "/requests/" + encodeURIComponent(requestId) + "/status";
  while (Date.now() - started < POLL_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_STEP_MS));
    const res = await fetch(url, {
      headers: { Authorization: authHeader(key) },
      signal: AbortSignal.timeout(30_000),
    }).catch(() => null);
    if (!res || !res.ok) continue;
    const data = (await res.json().catch(() => null)) as {
      status?: string;
      images?: Array<{ url?: string }>;
    } | null;
    if (!data) continue;
    const st = String(data.status || "").toLowerCase();
    if (st === "completed" || st === "failed" || st === "cancelled" || st === "error") return { status: st, images: data.images };
  }
  return null;
}

/**
 * Submit ONLY (no polling). Returns a pending handle to persist in the job —
 * later polls resume via pollSoulImage instead of submitting again.
 */
export async function submitSoulImage(params: {
  prompt: string;
  aspectRatio?: SoulPending["aspectRatio"];
  seed?: number | null;
}): Promise<SoulPending | null> {
  const key = credentials();
  if (!key || key.length < 20 || key.includes("your_higgsfield")) return null;
  const prompt = (params.prompt || "").trim().slice(0, 1500);
  if (!prompt) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);
    let submit: Response;
    try {
      submit = await fetch(SOUL_SUBMIT, {
        method: "POST",
        headers: {
          Authorization: authHeader(key),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          ...(params.seed != null ? { seed: params.seed } : {}),
          batch_size: 1,
          resolution: "720p",
          aspect_ratio: params.aspectRatio ?? "16:9",
          enhance_prompt: true,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!submit.ok) return null;
    const sub = (await submit.json().catch(() => null)) as {
      request_id?: string;
    } | null;
    const requestId = sub?.request_id;
    if (!requestId) return null;
    return { requestId, prompt, aspectRatio: params.aspectRatio ?? "16:9" };
  } catch {
    return null;
  }
}

/**
 * Poll ONE status check (single GET, ~instant). Returns:
 *  - { done: false } → still queued/running, poll again later.
 *  - { done: true, image } → completed AND downloaded to outPath.
 *  - { done: true } (no image) → failed/cancelled/unreachable → caller skips B-roll.
 */
export async function pollSoulImage(
  pending: SoulPending,
  outPath: string,
  timeoutMs = 30_000
): Promise<{ done: boolean; image?: SoulImage }> {
  const key = credentials();
  if (!key) return { done: true };
  try {
    const url = STATUS_HOST + "/requests/" + encodeURIComponent(pending.requestId) + "/status";
    const res = await fetch(url, {
      headers: { Authorization: authHeader(key) },
      signal: AbortSignal.timeout(timeoutMs),
    }).catch(() => null);
    if (!res || !res.ok) return { done: false };
    const data = (await res.json().catch(() => null)) as {
      status?: string;
      images?: Array<{ url?: string }>;
    } | null;
    if (!data) return { done: false };
    const st = String(data.status || "").toLowerCase();
    if (st !== "completed" && st !== "failed" && st !== "cancelled" && st !== "error") {
      return { done: false };
    }
    const imgUrl = data.images?.[0]?.url;
    if (st !== "completed" || !imgUrl || !imgUrl.startsWith("http")) return { done: true };
    const imgRes = await fetch(imgUrl, { signal: AbortSignal.timeout(90_000) }).catch(() => null);
    if (!imgRes || !imgRes.ok) return { done: true };
    const bytes = Buffer.from(await imgRes.arrayBuffer());
    if (bytes.length < 2048) return { done: true };
    const { mkdirSync, writeFileSync, statSync } = await import("node:fs");
    const path = (await import("node:path")).default;
    mkdirSync(path.dirname(outPath), { recursive: true });
    writeFileSync(outPath, bytes);
    return { done: true, image: { localPath: outPath, remoteUrl: imgUrl, bytes: statSync(outPath).size } };
  } catch {
    return { done: false };
  }
}

/**
 * Generate ONE image via SOUL v2 and download it to outPath (PNG).
 * Legacy blocking wrapper (local dev / single-invocation flows).
 * Returns null on ANY failure (no key, 4xx/5xx, timeout, empty images).
 */
export async function generateSoulImage(params: {
  prompt: string;
  outPath: string;
  aspectRatio?: SoulPending["aspectRatio"];
  seed?: number | null;
}): Promise<SoulImage | null> {
  const pending = await submitSoulImage(params);
  if (!pending) return null;
  const done = await pollTerminal(pending.requestId, credentials());
  const imgUrl = done?.images?.[0]?.url;
  if (!imgUrl || !imgUrl.startsWith("http")) return null;
  const got = await pollSoulImage(pending, params.outPath, 90_000);
  return got.image ?? null;
}

/** Fail-soft availability probe (no generation, no cost). True when a key is configured. */
export function higgsfieldConfigured(): boolean {
  const key = credentials();
  return !!key && key.length >= 20 && !key.includes("your_higgsfield");
}
