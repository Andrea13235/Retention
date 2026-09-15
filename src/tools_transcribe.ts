/**
 * tools_transcribe.ts — Step 2: trascrizione con Whisper (spec §4, §9).
 * Chiama faster-whisper (Python, via child_process) e ritorna transcript
 * JSON con timecode per segmento/parola.
 */
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { secToTimecode, type Timecode, type Transcript } from "./types.js";

const execFileAsync = promisify(execFile);

/**
 * Trova un interprete Python con faster-whisper funzionante.
 * Ordine: AVSKILL_PYTHON → venv dedicato della skill (~/.andrea-video-skill/.venv)
 * → venv attivo/convenzionali → python di sistema.
 * Override manuale: AVSKILL_PYTHON=/path/to/python.
 */
export async function findWhisperPython(): Promise<string> {
  const home = process.env.HOME ?? "";
  const skillVenv = home
    ? `${home}/.andrea-video-skill/.venv/bin/python`
    : undefined;
  const candidates = [
    process.env.AVSKILL_PYTHON,
    skillVenv,
    // venv attivo o convenzionali (faster-whisper vive spesso qui)
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
      /* prossimo candidato */
    }
  }
  throw new Error(
    "transcribe_media: faster-whisper non trovato in nessun Python → " +
      "pip install -r requirements.txt (vedi README)"
  );
}

/** Env pulito per i subprocess Python (toglie PYTHONPATH/PYTHONHOME
 *  ereditati che possono rompere gli import). */
export function cleanPythonEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.PYTHONPATH;
  delete env.PYTHONHOME;
  return env;
}

/** hardware → modello (§9: selezione automatica). */
export type HardwareKind = "gpu_nvidia" | "apple_silicon" | "cpu_only";

export async function detectHardware(): Promise<HardwareKind> {
  try {
    await execFileAsync("nvidia-smi", []);
    return "gpu_nvidia";
  } catch {
    /* nessuna GPU NVIDIA */
  }
  if (process.platform === "darwin" && process.arch === "arm64")
    return "apple_silicon";
  return "cpu_only";
}

export function selectModel(hardware: HardwareKind): string {
  // §9: large-v3 su GPU/Apple Silicon, small su CPU (7-8x più rapido)
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
  /** Override manuale del modello (default: selezione automatica §9). */
  model?: string;
  /** Timeout ms (default 30 min: large-v3 su CPU è lento). */
  timeoutMs?: number;
}

export async function transcribeMedia(
  mediaPath: string,
  mediaId: string,
  opts: TranscribeOptions = {}
): Promise<Transcript> {
  const hardware = await detectHardware();
  const model = opts.model ?? selectModel(hardware);
  // Python con faster-whisper funzionante (env pulito, vedi findWhisperPython).
  const pythonBin = await findWhisperPython();

  const dir = await mkdtemp(join(tmpdir(), "avskill-"));
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
          "transcribe_media: faster-whisper non installato → pip install -r requirements.txt"
        );
      throw new Error(`transcribe_media: Whisper fallito — ${msg}`);
    }

    const { readFileSync } = await import("node:fs");
    const raw = JSON.parse(readFileSync(out, "utf8")) as {
      segments: WhisperSegment[];
    };
    const toTc = (s: number): Timecode => secToTimecode(s);
    return {
      media_id: mediaId,
      model,
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
