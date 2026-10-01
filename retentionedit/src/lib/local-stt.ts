/**
 * RetentionEdit — Transcription engine (Meta Muse Voice API primary).
 *
 * SERVER ONLY (node:child_process + node:fs). Never import from client components.
 *
 * Chain (M6+):
 *  1. Extract 16kHz mono WAV via ffmpeg.
 *  2. POST Meta Muse muse-voice-transcribe-1.0 (fast, $0.18/h) — primary.
 *  3. Whisper.cpp fallback (bundled ggml-base.bin) when Muse unavailable.
 *  4. Normalize to MetaMMSTranscript shape (provider "meta_muse_voice", word timestamps).
 *
 * Falls back to null when both engines unavailable — the caller
 * decides the degraded path (silence-only cuts), never invented words.
 */
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { MetaMMSTranscript, TranscriptSegment, WordTimestamp } from "./types";
import { ffmpegBin, ffprobeBin } from "./media-bins";

const execFileAsync = promisify(execFile);

function bundledModelPath(): string | null {
  const p = path.join(process.cwd(), "models", "ggml-base.bin");
  return existsSync(p) ? p : null;
}

function whisperBin(): string | null {
  // Homebrew whisper.cpp ships whisper-cli on PATH (local dev only).
  // Vercel has no whisper binary → null → caller uses Muse STT.
  if (process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME) return null;
  return "whisper-cli";
}

function parseSrtTime(s: string): number {
  // "00:00:02,800" or "00:00:02.800"
  const m = s.trim().match(/(\d+):(\d+):([\d.,]+)/);
  if (!m) return 0;
  const sec = Number(m[3].replace(",", "."));
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + (Number.isFinite(sec) ? sec : 0);
}

function cleanToken(t: string): string | null {
  if (!t) return null;
  if (/^\[.*\]$/.test(t.trim())) return null; // [_BEG_], [_TT_], etc.
  const w = t.trim();
  return w.length > 0 ? w : null;
}

export interface LocalTranscribeResult {
  transcript: MetaMMSTranscript;
  /** Detected ISO language code (e.g. "it", "en"). "auto" when unknown. */
  language: string;
}

/**
 * Transcribe a local video/audio file with real word-level timestamps.
 *
 * M6 order: ElevenLabs Scribe v2 first (real word timestamps, primary),
 * Meta Muse Voice API second (fast, $0.18/h), Whisper.cpp local
 * fallback (slow but free/offline). Returns null when none can run —
 * the caller decides the degraded path (silence-only cuts), never invents.
 */
export async function transcribeLocalFile(
  mediaPath: string,
  opts?: { language?: string; timeoutMs?: number }
): Promise<LocalTranscribeResult | null> {
  // ElevenLabs Scribe v2 (primary: real word timestamps, no estimation).
  try {
    const { transcribeElevenFile } = await import("./elevenlabs-stt");
    const eleven = await transcribeElevenFile(mediaPath);
    if (eleven) return eleven;
  } catch {}
  // Meta Muse Voice API second (fast, $0.18/h).
  try {
    const { transcribeMuseFile } = await import("./muse-stt");
    const muse = await transcribeMuseFile(mediaPath);
    if (muse) return muse;
  } catch {}
  const model = bundledModelPath();
  if (!model) return null;
  if (!existsSync(mediaPath)) return null;

  const timeoutMs = opts?.timeoutMs ?? 240_000;
  const workdir = mkdtempSync(path.join(tmpdir(), "re-stt-"));
  const wavPath = path.join(workdir, "audio16k.wav");
  const outPrefix = path.join(workdir, "w");

  try {
    // 1. Extract 16kHz mono WAV.
    await execFileAsync(ffmpegBin(), [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      mediaPath,
      "-ar",
      "16000",
      "-ac",
      "1",
      "-c:a",
      "pcm_s16le",
      wavPath,
    ]);

    // 2. whisper-cli with full JSON + word split.
    const args = [
      "-m",
      model,
      "-f",
      wavPath,
      "--output-json-full",
      "--split-on-word",
      "--output-file",
      outPrefix,
    ];
    const lang = (opts?.language || "auto").trim();
    if (lang && lang !== "auto") {
      args.push("-l", lang);
    } else {
      args.push("-l", "auto");
    }
    try {
      await execFileAsync(whisperBin()!, args, { timeout: timeoutMs });
    } catch (e: unknown) {
      // whisper-cli exits non-zero on some warnings; JSON may still exist.
      const msg = e instanceof Error ? e.message : String(e);
      if (!existsSync(`${outPrefix}.json`)) {
        throw new Error(`whisper-cli failed: ${msg.slice(0, 200)}`);
      }
    }

    const raw = JSON.parse(readFileSync(`${outPrefix}.json`, "utf8")) as {
      result?: { language?: string };
      transcription?: Array<{
        timestamps?: { from?: string; to?: string };
        offsets?: { from?: number; to?: number };
        text?: string;
        tokens?: Array<{
          text?: string;
          timestamps?: { from?: string; to?: string };
          offsets?: { from?: number; to?: number };
          p?: number;
        }>;
      }>;
    };

    const language = String(raw?.result?.language || "auto").toLowerCase();
    const segments: TranscriptSegment[] = [];
    const segs = raw?.transcription || [];

    // Probe real duration for duration_sec.
    let durationSec = 0;
    try {
      const { stdout } = await execFileAsync(ffprobeBin(), [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        mediaPath,
      ]);
      const d = Number(String(stdout).trim());
      if (Number.isFinite(d) && d > 0) durationSec = d;
    } catch {}

    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const segStart = s.timestamps?.from ? parseSrtTime(s.timestamps.from) : (s.offsets?.from ?? 0) / 1000;
      const segEnd = s.timestamps?.to ? parseSrtTime(s.timestamps.to) : (s.offsets?.to ?? 0) / 1000;
      const words: WordTimestamp[] = [];
      for (const tok of s.tokens || []) {
        const w = cleanToken(tok.text || "");
        if (!w) continue;
        const ws = tok.timestamps?.from ? parseSrtTime(tok.timestamps.from) : (tok.offsets?.from ?? 0) / 1000;
        const we = tok.timestamps?.to ? parseSrtTime(tok.timestamps.to) : (tok.offsets?.to ?? 0) / 1000;
        if (!(we > ws)) continue;
        words.push({
          word: w,
          start: Number(ws.toFixed(2)),
          end: Number(we.toFixed(2)),
          confidence: typeof tok.p === "number" ? Number(tok.p.toFixed(3)) : 0.9,
        });
      }
      if (words.length === 0) continue;
      const text = words.map((w) => w.word).join(" ").replace(/\s+([.,!?;:])/g, "$1");
      segments.push({
        id: `seg_${segments.length + 1}`,
        text,
        start: Number(words[0].start.toFixed(2)),
        end: Number(words[words.length - 1].end.toFixed(2)),
        speaker: "Speaker 1",
        words,
      });
      void segStart;
      void segEnd;
    }

    if (segments.length === 0) return null;
    if (!durationSec) {
      durationSec = Math.max(...segments.map((s) => s.end)) + 0.5;
    }

    return {
      language,
      transcript: {
        provider: "meta_mms",
        language,
        duration_sec: Number(durationSec.toFixed(2)),
        speakers: ["Speaker 1"],
        segments,
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

/** Dev smoke helper: transcribe + write normalized JSON next to the file. */
export async function smokeTranscribe(mediaPath: string, outJson?: string): Promise<boolean> {
  const r = await transcribeLocalFile(mediaPath);
  if (!r) return false;
  if (outJson) {
    writeFileSync(outJson, JSON.stringify(r, null, 2));
  }
  return true;
}
