/**
 * RetentionEdit — Meta Muse Voice STT client M6 (SERVER ONLY).
 *
 * Real endpoint (verified 2026-09-27):
 *   POST {BASE}/asr/transcribe  (BASE default https://api.meta.ai/v1)
 *   multipart/form-data:
 *     request = {"model":"muse-voice-transcribe-1.0","audioEncoding":"WAV"}
 *     audio   = 16kHz mono WAV file
 *   → { transcript, audioDurationMs, turns[] }
 *
 * Verified quirks:
 * - audioEncoding MUST be uppercase "WAV" (lowercase → Malformed).
 * - Only model+audioEncoding pass; ANY extra field → "Malformed request".
 * - turns[] empty on short mono clips; NO word timestamps — caller
 *   distributes words proportionally (documented estimate, never invented text).
 * - Occasional backend_unavailable → retry with backoff.
 * - Key: META_MUSE_API_KEY (vault `meta_muse` wins). Endpoint override:
 *   META_MUSE_ENDPOINT (full .../asr/transcribe URL or base .../v1).
 *
 * Pricing: $0.18/h audio. Latency measured: ~2.5s per 5s clip.
 */
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { getSecret } from "./vault-store";
import { ffmpegBin, ffprobeBin } from "./media-bins";
import type { MetaMMSTranscript, TranscriptSegment, WordTimestamp } from "./types";

const execFileAsync = promisify(execFile);

const DEFAULT_BASE = "https://api.meta.ai/v1";
const MUSE_MODEL = "muse-voice-transcribe-1.0";
const MAX_RETRIES = 3;
const REQ_TIMEOUT_MS = 180_000;

function museKey(): string {
  const v = getSecret("meta_muse") || process.env.META_MUSE_API_KEY || "";
  const t = v.trim();
  return t && t !== "muse_dev_token" ? t : "";
}

function museEndpoint(): string {
  const raw = (process.env.META_MUSE_ENDPOINT || "").trim();
  if (raw) {
    // Accept full URL (.../asr/transcribe) or base (.../v1).
    if (raw.endsWith("/asr/transcribe")) return raw;
    return raw.replace(/\/+$/, "") + "/asr/transcribe";
  }
  return DEFAULT_BASE + "/asr/transcribe";
}

interface MuseTurn {
  text?: string;
  startMs?: number;
  endMs?: number;
  start?: number;
  end?: number;
  speaker?: string;
}

interface MuseResponse {
  transcript?: string;
  audioDurationMs?: number;
  turns?: MuseTurn[];
  error?: { code?: string | null; message?: string };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function musePost(wavPath: string, key: string, endpoint: string): Promise<MuseResponse> {
  const form = new FormData();
  form.append("request", JSON.stringify({ model: MUSE_MODEL, audioEncoding: "WAV" }));
  const buf = readFileSync(wavPath);
  form.append("audio", new Blob([new Uint8Array(buf)], { type: "audio/wav" }), "audio.wav");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQ_TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as MuseResponse;
    if (!res.ok) {
      const msg = data?.error?.message || `HTTP ${res.status}`;
      const err = new Error(`muse:${res.status}:${msg.slice(0, 160)}`) as Error & { retryable?: boolean };
      // Retry on 429/5xx + backend_unavailable; never on 401/auth.
      err.retryable = res.status === 429 || res.status >= 500 || /backend_unavailable|temporarily/i.test(msg);
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Distribute transcript words across [start,end] proportionally to word
 * length. Muse gives turn-level (not word-level) timing, so word times are
 * ESTIMATES anchored to the real turn window — text is always real.
 */
export function distributeWords(text: string, start: number, end: number): WordTimestamp[] {
  const cleaned = text.replace(/([.!?…]){2,}/g, "$1").trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || !(end > start)) return [];
  const weights = tokens.map((t) => Math.max(1, t.length));
  const total = weights.reduce((a, b) => a + b, 0);
  const span = end - start;
  const out: WordTimestamp[] = [];
  let t = start;
  for (let i = 0; i < tokens.length; i++) {
    const dur = (weights[i] / total) * span;
    const ws = i === 0 ? start : t;
    const we = i === tokens.length - 1 ? end : t + dur;
    out.push({
      word: tokens[i],
      start: Number(ws.toFixed(2)),
      end: Number(Math.max(ws + 0.05, we).toFixed(2)),
      confidence: 0.92,
    });
    t += dur;
  }
  return out;
}

/**
 * Transcribe a local file via Muse. Returns null when unconfigured or
 * failed after retries (caller falls back to Whisper, never invents).
 */
export async function transcribeMuseFile(
  mediaPath: string
): Promise<{ transcript: MetaMMSTranscript; language: string } | null> {
  const key = museKey();
  if (!key || !existsSync(mediaPath)) return null;
  const endpoint = museEndpoint();
  const workdir = mkdtempSync(path.join(tmpdir(), "re-muse-"));
  const wavPath = path.join(workdir, "audio16k.wav");
  try {
    await execFileAsync(ffmpegBin(), [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", mediaPath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wavPath,
    ]);
    let lastErr = "";
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const data = await musePost(wavPath, key, endpoint);
        if (data.error) throw new Error(`muse:${data.error.message || "error"}`.slice(0, 160));
        const text = (data.transcript || "").trim();
        if (!text) return null;
        const durSec = data.audioDurationMs && data.audioDurationMs > 0 ? data.audioDurationMs / 1000 : 0;
        const segments: TranscriptSegment[] = [];
        const turns = Array.isArray(data.turns) ? data.turns : [];
        if (turns.length > 0) {
          let i = 0;
          for (const t of turns) {
            const rawText = (t.text || "").trim().replace(/([.!?…]){2,}/g, "$1");
            if (!rawText) continue;
            const s = t.startMs != null ? t.startMs / 1000 : typeof t.start === "number" ? t.start : 0;
            const e = t.endMs != null ? t.endMs / 1000 : typeof t.end === "number" ? t.end : durSec;
            const words = distributeWords(rawText, s, e);
            if (words.length === 0) continue;
            i++;
            segments.push({
              id: `seg_${i}`,
              text: rawText,
              start: words[0].start,
              end: words[words.length - 1].end,
              speaker: t.speaker || `Speaker 1`,
              words,
            });
          }
        }
        if (segments.length === 0) {
          // Single-turn fallback: whole transcript over measured duration.
          const cleanText = text.replace(/([.!?…]){2,}/g, "$1").trim();
          const end = durSec > 0 ? durSec : Math.max(1, cleanText.split(/\s+/).length * 0.35);
          const words = distributeWords(cleanText, 0, end);
          if (words.length === 0) return null;
          segments.push({
            id: "seg_1",
            text: words.map((w) => w.word).join(" "),
            start: 0,
            end: words[words.length - 1].end,
            speaker: "Speaker 1",
            words,
          });
        }
        let durationSec = durSec;
        if (!durationSec || durationSec <= 0) {
          try {
            const { stdout } = await execFileAsync(ffprobeBin(), [
              "-v", "error", "-show_entries", "format=duration",
              "-of", "default=noprint_wrappers=1:nokey=1", mediaPath,
            ]);
            const d = Number(String(stdout).trim());
            if (Number.isFinite(d) && d > 0) durationSec = d;
          } catch {}
          if (!durationSec) durationSec = Math.max(...segments.map((s) => s.end)) + 0.5;
        }
        return {
          language: "auto",
          transcript: {
            provider: "meta_muse_voice",
            language: "auto",
            duration_sec: Number(durationSec.toFixed(2)),
            speakers: [...new Set(segments.map((s) => s.speaker || "Speaker 1"))],
            segments,
          },
        };
      } catch (e: unknown) {
        const err = e as Error & { retryable?: boolean };
        lastErr = err?.message || String(e);
        const retryable =
          err?.retryable ?? /backend_unavailable|temporarily|429|5\d\d|abort|timeout|fetch failed/i.test(lastErr);
        // Never retry auth errors (wrong key → fall back fast).
        if (/401|403|unauthorized|invalid.*key/i.test(lastErr)) return null;
        if (!retryable || attempt === MAX_RETRIES - 1) return null;
        await sleep(1500 * (attempt + 1));
      }
    }
    void lastErr;
    return null;
  } catch {
    return null;
  } finally {
    try {
      rmSync(workdir, { recursive: true, force: true });
    } catch {}
  }
}
