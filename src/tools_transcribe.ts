/**
 * tools_transcribe.ts — Step 2: Whisper transcription.
 * Calls faster-whisper (Python, via child_process) and returns a JSON
 * transcript with per-segment/per-word timecodes.
 *
 * Multilingual: Whisper auto-detects the spoken language (~100 languages:
 * Italian, English, Spanish, French, German, Portuguese, …) and transcribes
 * in that language. The detected code is returned as `Transcript.language`
 * (BCP-47, e.g. "it", "en"). No language option is needed — just speak.
 */
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { secToTimecode, type Timecode, type Transcript } from "./types.js";

const execFileAsync = promisify(execFile);

/**
 * Find a Python interpreter with working faster-whisper.
 * Order: RETENTION_PYTHON → skill venv (~/.retention/.venv)
 * → active/conventional venvs → system pythons.
 * Manual override: RETENTION_PYTHON=/path/to/python.
 */
export async function findWhisperPython(): Promise<string> {
  const home = process.env.HOME ?? "";
  const retentionVenv = home ? `${home}/.retention/.venv/bin/python` : undefined;
  const candidates = [
    process.env.RETENTION_PYTHON,
    retentionVenv,
    // Active or conventional venvs (faster-whisper often lives here)
    process.env.VIRTUAL_ENV ? `${process.env.VIRTUAL_ENV}/bin/python` : undefined,
    home ? `${home}/.venv/bin/python` : undefined,
    `${process.cwd()}/.venv/bin/python`,
    "python3",
    "/opt/homebrew/bin/python3",
    "/usr/local/bin/python3",
    "/usr/bin/python3",
  ].filter((c): c is string => !!c);
  for (const bin of new Set(candidates)) {
    try {
      await execFileAsync(bin, ["-c", "import faster_whisper"], {
        timeout: 60_000,
        env: cleanPythonEnv(),
      });
      return bin;
    } catch {
      /* next candidate */
    }
  }

  // Self-healing fallback: attempt automatic setup unless opt-out requested via RETENTION_NO_AUTO_SETUP
  if (!process.env.RETENTION_NO_AUTO_SETUP) {
    try {
      console.error(
        "transcribe_media: faster-whisper not found in environment; attempting one-time automated setup..."
      );
      const setupScript = fileURLToPath(new URL("../scripts/setup-whisper.js", import.meta.url));
      await execFileAsync(process.execPath, [setupScript], {
        timeout: 3 * 60 * 1000,
        env: cleanPythonEnv(),
      });
      for (const bin of new Set(candidates)) {
        try {
          await execFileAsync(bin, ["-c", "import faster_whisper"], {
            timeout: 60_000,
            env: cleanPythonEnv(),
          });
          return bin;
        } catch {
          /* continue */
        }
      }
    } catch {
      /* fallback to throw below */
    }
  }

  throw new Error(
    "transcribe_media: faster-whisper not found in any Python → " +
      "run: node scripts/setup-whisper.js (see README)"
  );
}

/** Clean env for Python subprocesses (drops inherited PYTHONPATH/PYTHONHOME
 *  that can break imports). */
export function cleanPythonEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.PYTHONPATH;
  delete env.PYTHONHOME;
  return env;
}

/** hardware → model (automatic selection). */
export type HardwareKind = "gpu_nvidia" | "apple_silicon" | "cpu_only";

export async function detectHardware(): Promise<HardwareKind> {
  try {
    await execFileAsync("nvidia-smi", []);
    return "gpu_nvidia";
  } catch {
    /* no NVIDIA GPU */
  }
  if (process.platform === "darwin" && process.arch === "arm64")
    return "apple_silicon";
  return "cpu_only";
}

export function selectModel(hardware: HardwareKind): string {
  // large-v3 on GPU/Apple Silicon, small on CPU (7-8x faster)
  if (hardware === "gpu_nvidia" || hardware === "apple_silicon")
    return "large-v3";
  return "small";
}

interface WhisperWord {
  start: number;
  end: number;
  word: string;
}
interface WhisperSegment {
  start: number;
  end: number;
  text: string;
  words?: WhisperWord[];
}

const BRIDGE_SCRIPT = `
import json, sys
from faster_whisper import WhisperModel

media_path, model_name, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
model = WhisperModel(model_name, device="auto", compute_type="auto")
segments, info = model.transcribe(media_path, word_timestamps=True)
result = {"model": model_name, "language": info.language, "segments": [
    {"start": s.start, "end": s.end, "text": s.text.strip(),
     "words": [{"start": w.start, "end": w.end, "word": w.word} for w in (s.words or [])]}
    for s in segments]}
with open(out_path, "w") as f:
    json.dump(result, f)
`;

export interface TranscribeOptions {
  /** Manual model override (default: automatic selection). */
  model?: string;
  /** Timeout in ms (default 30 min: large-v3 on CPU is slow). */
  timeoutMs?: number;
}

export async function transcribeMedia(
  mediaPath: string,
  mediaId: string,
  opts: TranscribeOptions = {}
): Promise<Transcript> {
  const hardware = await detectHardware();
  const model = opts.model ?? selectModel(hardware);
  // Python with working faster-whisper (clean env, see findWhisperPython).
  const pythonBin = await findWhisperPython();

  const dir = await mkdtemp(join(tmpdir(), "retention-"));
  try {
    const bridge = join(dir, "bridge.py");
    const out = join(dir, "transcript.json");
    await writeFile(bridge, BRIDGE_SCRIPT);

    try {
      await execFileAsync(pythonBin, [bridge, mediaPath, model, out], {
        timeout: opts.timeoutMs ?? 30 * 60 * 1000,
        maxBuffer: 64 * 1024 * 1024,
        env: cleanPythonEnv(),
      });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("faster_whisper") || msg.includes("No module"))
        throw new Error(
          "transcribe_media: faster-whisper not installed → run: node scripts/setup-whisper.js"
        );
      throw new Error(`transcribe_media: Whisper failed — ${msg}`);
    }

    const { readFileSync } = await import("node:fs");
    const raw = JSON.parse(readFileSync(out, "utf8")) as {
      segments: WhisperSegment[];
      language?: string;
    };
    const toTc = (s: number): Timecode => secToTimecode(s);
    return {
      media_id: mediaId,
      model,
      language: raw.language,
      segments: (raw.segments as WhisperSegment[]).map((s) => ({
        start: toTc(s.start),
        end: toTc(s.end),
        text: s.text,
        words: s.words?.map((w) => ({
          start: toTc(w.start),
          end: toTc(w.end),
          word: w.word,
        })),
      })),
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
