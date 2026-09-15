/**
 * Shared types for the andrea-video-skill MCP tools.
 * Pipeline: ingest → transcribe → analyze → plan → render (§4 dello spec).
 */

/** "HH:MM:SS.mmm" timecode, es. "00:03:10.000" */
export type Timecode = string;

/** Metadati di un file RAW importato (Step 1 — Ingest). */
export interface MediaAsset {
  media_id: string;
  path: string;
  duration_sec: number;
  width: number;
  height: number;
  fps: number;
  audio_streams: number;
}

/** Un segmento trascritto con timecode (Step 2 — Whisper). */
export interface TranscriptSegment {
  start: Timecode;
  end: Timecode;
  text: string;
  /** Parole con timestamp, quando word_timestamps=true (§9). */
  words?: Array<{ start: Timecode; end: Timecode; word: string }>;
}

export interface Transcript {
  media_id: string;
  model: string;
  segments: TranscriptSegment[];
}

/** Struttura narrativa emersa dall'analisi (Step 3). */
export interface NarrativeStructure {
  media_id: string;
  hook: { start: Timecode; end: Timecode; summary: string };
  sections: Array<{
    title: string;
    start: Timecode;
    end: Timecode;
    summary: string;
  }>;
  fillers: Array<{ start: Timecode; end: Timecode; reason: string }>;
  attention_dips: Array<{ start: Timecode; end: Timecode; reason: string }>;
  highlights: Array<{ start: Timecode; end: Timecode; reason: string }>;
}

/** Action Plan machine-actionable (Step 4, §4 dello spec). */
export interface EditPlan {
  version: "1.0";
  style: string;
  media_id: string;
  cuts: Array<{ start: Timecode; end: Timecode; reason: string }>;
  animations: Array<{
    time: Timecode;
    type: "text_overlay" | "zoom_in" | "zoom_out" | "transition" | "caption";
    content?: string;
    position?: "top" | "bottom" | "center";
    target?: string;
  }>;
  broll: Array<{ start: Timecode; end: Timecode; source: string }>;
  pattern_interrupts: Array<{ time: Timecode; kind: string; detail?: string }>;
}

/** Converte "HH:MM:SS.mmm" in secondi. */
export function timecodeToSec(tc: Timecode): number {
  const m = tc.match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/);
  if (!m) throw new Error(`Timecode non valido: ${tc} (atteso HH:MM:SS.mmm)`);
  const [, h, min, s, ms] = m.map(Number);
  return h * 3600 + min * 60 + s + ms / 1000;
}

/** Converte secondi in "HH:MM:SS.mmm". */
export function secToTimecode(sec: number): Timecode {
  if (!Number.isFinite(sec) || sec < 0)
    throw new Error(`Secondi non validi: ${sec}`);
  const h = Math.floor(sec / 3600);
  const min = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec - Math.floor(sec)) * 1000);
  const pad = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${pad(h)}:${pad(min)}:${pad(s)}.${pad(ms, 3)}`;
}

/** Qualità di render HyperFrames (§2, §4 Step 6). */
export const RENDER_PRESETS = {
  draft: { crf: 28, description: "iterazione veloce" },
  standard: { crf: 21, description: "default" },
  high: { crf: 15, description: "consegna finale (fino a 4K/HDR10)" },
} as const;

export type RenderPreset = keyof typeof RENDER_PRESETS;
