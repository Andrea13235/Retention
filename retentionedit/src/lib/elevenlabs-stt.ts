/**
 * RetentionEdit — ElevenLabs Scribe v2 STT client (SERVER ONLY).
 *
 * Real endpoint (verified 2026-09-29 with live key):
 *   POST https://api.elevenlabs.io/v1/speech-to-text
 *   multipart/form-data:
 *     file     = 16kHz mono WAV blob (ffmpeg-extracted, same as Muse path)
 *     model_id = "scribe_v2"
 *   headers: xi-api-key: <ELEVENLABS_API_KEY>
 *   → { text, language_code ("ita"), words[] } — words carry REAL
 *     start/end seconds (no proportional distribution needed).
 *
 * Word payload quirk: start/end arrive as NUMBERS (seconds, 2dp) in
 * flat words[] — no nested timestamp objects. Each item has
 * { text|word, start, end } (keys verified live: text/start/end floats).
 *
 * Rules: ElevenLabs is the PRIMARY STT. On any failure return null
 * (caller falls to Muse → Whisper → silence-only, never invented words).
 * Key: ELEVENLABS_API_KEY (vault `elevenlabs` wins). Never import from
 * client components — key stays server-side.
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

const STT_URL = "https://api.elevenlabs.io/v1/speech-to-text";
const SCRIBE_MODEL = "scribe_v2";
const REQ_TIMEOUT_MS = 180_000;
const LANG_MAP: Record<string, string> = { ita: "it", eng: "en" };

function elevenKey(): string {
  const v = getSecret("elevenlabs") || process.env.ELEVENLABS_API_KEY || "";
  const t = v.trim();
  return t && !t.includes("your_elevenlabs") ? t : "";
}

interface ScribeWord {
  text?: string;
  word?: string;
  start?: number;
  end?: number;
  logprob?: number;
}

interface ScribeResponse {
  text?: string;
  language_code?: string;
  language_probability?: number;
  words?: ScribeWord[];
  error?: unknown;
}

function normLang(code: string | undefined): string {
  if (!code) return "auto";
  const c = code.trim().toLowerCase();
  return LANG_MAP[c] ?? c.slice(0, 2);
}

/**
 * Transcribe a local file via ElevenLabs Scribe v2. Returns null when
 * unconfigured or failed (caller falls back, never invents).
 */
export async function transcribeElevenFile(
  mediaPath: string
): Promise<{ transcript: MetaMMSTranscript; language: string } | null> {
  const key = elevenKey();
  if (!key || !existsSync(mediaPath)) return null;
  const workdir = mkdtempSync(path.join(tmpdir(), "re-eleven-"));
  const wavPath = path.join(workdir, "audio16k.wav");
  try {
    await execFileAsync(ffmpegBin(), [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", mediaPath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wavPath,
    ]);
    const wav = readFileSync(wavPath);
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "audio.wav");
    form.append("model_id", SCRIBE_MODEL);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQ_TIMEOUT_MS);
    let data: ScribeResponse;
    try {
      const res = await fetch(STT_URL, {
        method: "POST",
        headers: { "xi-api-key": key },
        body: form,
        signal: controller.signal,
      });
      data = (await res.json().catch(() => ({}))) as ScribeResponse;
      if (!res.ok) {
        // Never retry auth errors (wrong key → fall back fast).
        if (res.status === 401 || res.status === 403) return null;
        return null;
      }
    } finally {
      clearTimeout(timer);
    }
    const rawWords = Array.isArray(data.words) ? data.words : [];
    const words: WordTimestamp[] = [];
    for (const w of rawWords) {
      const text = String(w.text ?? w.word ?? "").trim();
      const s = Number(w.start);
      const e = Number(w.end);
      if (!text || !Number.isFinite(s) || !Number.isFinite(e) || !(e > s)) continue;
      words.push({
        word: text,
        start: Number(s.toFixed(2)),
        end: Number(e.toFixed(2)),
        confidence: 0.95,
      });
    }
    if (words.length === 0) return null;
    const language = normLang(data.language_code);
    // Single segment over the whole clip (Scribe gives flat words; the
    // pipeline splits into caption chunks downstream from word times).
    const text = words.map((w) => w.word).join(" ").replace(/\s+([.,!?;:])/g, "$1");
    const end = words[words.length - 1].end;
    let durationSec = end + 0.5;
    try {
      const { stdout } = await execFileAsync(ffprobeBin(), [
        "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", mediaPath,
      ]);
      const d = Number(String(stdout).trim());
      if (Number.isFinite(d) && d > 0) durationSec = d;
    } catch {}
    const segment: TranscriptSegment = {
      id: "seg_1",
      text,
      start: words[0].start,
      end,
      speaker: "Speaker 1",
      words,
    };
    return {
      language,
      transcript: {
        provider: "elevenlabs_scribe",
        language,
        duration_sec: Number(durationSec.toFixed(2)),
        speakers: ["Speaker 1"],
        segments: [segment],
      },
    };
  } catch {
    return null;
  } finally {
    try {
      rmSync(workdir, { recursive: true, force: true });
    } catch {}
  }
}

/** Fail-soft availability probe (no generation, no cost). True when a key is configured. */
export function elevenConfigured(): boolean {
  const key = elevenKey();
  return !!key && key.length >= 20 && !key.includes("your_elevenlabs");
}
