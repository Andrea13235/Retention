/**
 * Shared types for the andrea-video-skill MCP tools.
 * Pipeline: ingest → transcribe → analyze → plan → render.
 */

/** "HH:MM:SS.mmm" timecode, e.g. "00:03:10.000" */
export type Timecode = string;

/** Metadata of an imported RAW file (Step 1 — Ingest). */
export interface MediaAsset {
  media_id: string;
  path: string;
  duration_sec: number;
  width: number;
  height: number;
  fps: number;
  audio_streams: number;
}

/** One transcribed segment with timecodes (Step 2 — Whisper). */
export interface TranscriptSegment {
  start: Timecode;
  end: Timecode;
  text: string;
  /** Timestamped words, when word_timestamps=true. */
  words?: Array<{ start: Timecode; end: Timecode; word: string }>;
}

export interface Transcript {
  media_id: string;
  model: string;
  /** BCP-47 language code auto-detected by Whisper (e.g. "it", "en"). */
  language?: string;
  segments: TranscriptSegment[];
}

/** Narrative structure from analysis (Step 3). */
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

/** Machine-actionable Action Plan (Step 4). */
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

/** Convert "HH:MM:SS.mmm" to seconds. */
export function timecodeToSec(tc: Timecode): number {
  const m = tc.match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/);
  if (!m) throw new Error(`Invalid timecode: ${tc} (expected HH:MM:SS.mmm)`);
  const [, h, min, s, ms] = m.map(Number);
  return h * 3600 + min * 60 + s + ms / 1000;
}

/** Convert seconds to "HH:MM:SS.mmm". */
export function secToTimecode(sec: number): Timecode {
  if (!Number.isFinite(sec) || sec < 0)
    throw new Error(`Invalid seconds value: ${sec}`);
  const h = Math.floor(sec / 3600);
  const min = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec - Math.floor(sec)) * 1000);
  const pad = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${pad(h)}:${pad(min)}:${pad(s)}.${pad(ms, 3)}`;
}

/** HyperFrames render quality presets (Step 6). */
export const RENDER_PRESETS = {
  draft: { crf: 28, description: "fast iteration" },
  standard: { crf: 21, description: "default" },
  high: { crf: 15, description: "final delivery (up to 4K/HDR10)" },
} as const;

export type RenderPreset = keyof typeof RENDER_PRESETS;
