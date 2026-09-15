/**
 * Shared types for the cutcraft MCP tools.
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
  /**
   * Rotation (degrees) the player must apply to display the video upright,
   * from container/iPhone display-matrix metadata (0, 90, -90, 180).
   * Phones shooting portrait store a landscape frame + rotation flag.
   */
  rotation: number;
  /**
   * Display dimensions AFTER rotation. Use these (not width/height)
   * to choose the render canvas.
   */
  display_width: number;
  display_height: number;
  /** True when the displayed image is portrait (height > width). */
  is_portrait: boolean;
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

/** One proposed editorial cut (Step 3 output, Step 4 input). */
export interface CutCandidate {
  start: Timecode;
  end: Timecode;
  kind:
    | "dead_air"
    | "stutter"
    | "filler"
    | "false_start"
    | "trim_head"
    | "trim_tail"
    | "manual";
  reason: string;
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
  /**
   * Static blocks at risk of attention drop (no visual/narrative change).
   * Agents mark them during analysis; the planner turns each into a
   * pattern interrupt so every risk point gets coverage.
   */
  attention_risk_points?: Array<{
    start: Timecode;
    end: Timecode;
    reason: string;
  }>;
  /**
   * Editorial signals for the planner (all deterministic):
   * - keywords: content-bearing words with their speech time (nouns,
   *   verbs, numbers, proper names — stopwords excluded), scored by
   *   rarity × emphasis (slower/louder articulation proxy: duration).
   * - hook_moment: the single most quotable sub-segment of the hook
   *   (highest keyword density in ≤5s) — the cold-open candidate.
   * - slow_spots: word runs spoken markedly slower than average
   *   (emphasis or uncertainty — worth a punch-in, not a cut).
   */
  keywords?: Array<{ word: string; start: Timecode; score: number }>;
  hook_moment?: { start: Timecode; end: Timecode; text: string };
  slow_spots?: Array<{ start: Timecode; end: Timecode; reason: string }>;
  /**
   * Total media duration in seconds (when known). Lets the planner use
   * the full [0, mediaEnd] range so tail trims are exact.
   */
  duration_sec?: number;
  /**
   * Proposed editorial cuts — the actual "taglia qui" decisions.
   * The planner turns these into a KEEP splice (complement ranges);
   * the agent may add/remove entries before planning (false starts
   * and rhetoric the heuristics can't judge).
   */
  cut_candidates?: CutCandidate[];
}

/** Animation types supported by the HyperFrames renderer. */
export type AnimationType =
  | "text_overlay"
  | "caption"
  | "karaoke_caption"
  | "lower_third"
  | "zoom_in"
  | "zoom_out"
  | "slow_zoom"
  | "transition";

/** Target canvas presets. short = 9:16 vertical, long = 16:9 landscape. */
export type CanvasFormat = "short" | "long";

export const CANVAS: Record<CanvasFormat, { width: number; height: number }> = {
  short: { width: 1080, height: 1920 },
  long: { width: 1920, height: 1080 },
};

/** Machine-actionable Action Plan (Step 4). */
export interface EditPlan {
  version: "1.2";
  style: string;
  media_id: string;
  /** Target canvas: "short" (9:16) or "long" (16:9). Renderer sizes to it. */
  format: CanvasFormat;
  /**
   * KEEP ranges (source timecodes): the splice that reaches the screen.
   * Entries prefixed `CUT —` are excluded. KEEP ranges are sorted,
   * non-overlapping, and laid edge-to-edge on the output timeline —
   * i.e. this IS the final content, not advisory metadata.
   */
  cuts: Array<{ start: Timecode; end: Timecode; reason: string }>;
  animations: Array<{
    time: Timecode;
    type: AnimationType;
    content?: string;
    position?: "top" | "bottom" | "center";
    target?: string;
    /** Visible duration in seconds (captions/overlays, default 3). */
    duration?: number;
    /**
     * karaoke_caption: per-word timing in SOURCE timecodes (same clock as
     * cuts). The renderer drops words inside CUT ranges and remaps the
     * rest onto the output timeline. Only kept words reach the screen.
     * Words flagged `emphasis: true` render as keyword pops.
     */
    words?: Array<{ start: Timecode; word: string; emphasis?: boolean }>;
    /** slow_zoom direction (default "in"). */
    direction?: "in" | "out";
    /** slow_zoom speed as scale %/s (default 3). */
    intensity?: number;
  }>;
  broll: Array<{
    start: Timecode;
    end: Timecode;
    source: string;
    reason?: string;
  }>;
  pattern_interrupts: Array<{ time: Timecode; kind: string; detail?: string }>;
  /** Free-form agent notes (hook missing, cold-open proposal, …). */
  structure_notes?: Array<{ time: Timecode; note: string }>;
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
