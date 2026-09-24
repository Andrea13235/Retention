/**
 * Shared types for the retention MCP tools.
 * Pipeline: ingest → transcribe → analyze → plan → render.
 * Supports RetentionVolt (retentionvolt.com) blueprints for high-retention editing.
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
  /**
   * Planner trust 0..1. ≥0.85 auto-applied; 0.5–0.85 applied but listed
   * in the plan's `review_cuts` so the agent double-checks rhetorical
   * moments; <0.5 NOT applied (stays a proposal for the agent).
   */
  confidence: number;
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
   * Measured speech pace over KEPT words (CUT words excluded — the pace
   * that reaches the screen, not the RAW ramble). The agent compares
   * this against the measured registers (show ~182, educational ~174–188,
   * tutorial ~257 wpm) to pick the rhythm honestly instead of guessing.
   */
  speech?: { wpm: number; totalWords: number };
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
  /**
   * Words Whisper likely mangled — rare tokens the agent MUST confirm
   * before rendering (brand names, proper nouns, neologisms like
   * "rawcat" for Retention). Each entry carries the sentence context so
   * the agent can fix it without re-listening to the audio. If ignored,
   * the raw ASR text reaches the captions verbatim.
   */
  needs_review?: Array<{ word: string; start: Timecode; context: string }>;
  /**
   * Cut proposals below the auto-apply threshold that the planner
   * SKIPPED (kept in the video). The agent reviews these: promote to
   * extraCuts or leave kept. Never silent — every skipped cut is listed.
   */
  review_cuts?: Array<{
    start: Timecode;
    end: Timecode;
    reason: string;
  }>;
}

/** Animation types supported by the HyperFrames renderer.
 * RENDERED today: text_overlay | caption | karaoke_caption | lower_third
 * (caption family) and zoom_in | zoom_out | slow_zoom (motion family).
 * LEGACY (parse, do not author): "transition" (a cut-level concern —
 * already expressed by the cuts list, the renderer skips it) and
 * "graphic_card" (v1.0 idea, superseded by the v1.3 `graphics[]`
 * GraphicBeat banners — never hand-write this type).
 */
export type AnimationType =
  | "text_overlay"
  | "caption"
  | "karaoke_caption"
  | "lower_third"
  | "zoom_in"
  | "zoom_out"
  | "slow_zoom"
  | "transition"
  | "graphic_card";

/**
 * Editing style requested by the agent (Step 0 + Step 4).
 * - show / educational / tutorial / podcast: LONG-form rhythm registers,
 *   measured on real reference videos (see REGISTER below). Pick by
 *   content energy, not by gut feeling — check analyze's speech.wpm.
 * - short_form: VERTICAL short (format "short"), its own cadence.
 * - youtube_talking_head: LEGACY alias of educational (kept so old plans
 *   still parse; new work should say educational).
 */
export type StylePreset =
  | "show"
  | "educational"
  | "tutorial"
  | "podcast"
  | "short_form"
  | "youtube_talking_head";

/** Rhythm register after alias resolution (never contains the legacy alias). */
export type RegisterName = "show" | "educational" | "tutorial" | "podcast" | "short_form";

/**
 * Measured interruption cadence per register (seconds between beats).
 * Source: 6 reference videos analyzed frame-by-frame 2026-09-15 —
 * MrBeast "100 Days" (28 cuts/min → ~2s), Higgsfield edu (13/min → ~5s),
 * Higgsfield graphics (9/min → ~7s, rounded into educational),
 * Nate Herk tutorial (locked-off 30min, screen carries it → ~20s),
 * beingmayy Apple-style motion 0:50 (11 cuts, ~13/min, median ~2.4s,
 * 206 wpm, fully synthetic).
 * Lesson from #5: cadence is not energy — clean/restrained restraint
 * (one accent/scene, one idea/frame) holds at show-grade speed.
 * podcast (60s) and short_form (4s) are carried over: conversations
 * breathe, verticals snap. Footage-less kinetic promos (VID-06, 0:33.6,
 * 13 phrases → 13 cards, LIGHT↔DARK heartbeat) bypass cadence: one
 * card per spoken phrase — see docs/analysis-guide.md §6c.
 * ONE table — planner, guide and SKILL.md
 * all read these numbers, never a second copy.
 */
export const REGISTER_CADENCE: Record<RegisterName, number> = {
  show: 2,
  educational: 5,
  tutorial: 20,
  podcast: 60,
  short_form: 4,
};

/**
 * What the editor physically has in hand. Decided by takesCount:
 * - single_take (1 take): ONE continuous recording. There is no second
 *   angle, no B-roll, no coverage — so the plan MUST NOT fake any:
 *   no shot-change transitions, no multi-cam rhythm. Caption pops,
 *   graphic banners and slow push-ins are legal (they add, not fake).
 * - multi_take (≥2 takes): real coverage exists — the agent can cut
 *   between takes, so show-rhythm and punch zooms are legal.
 */
export type FootageMode = "single_take" | "multi_take";

/**
 * CUT-adjacency exclusion for MOTION (cuts-first strategy).
 *
 * A cut on a zoomed frame is a visible scale jump: the two sides of a
 * splice meet at different magnifications. So every zoom's FULL span —
 * start to start+duration — must keep clear of every CUT edge:
 * - ZOOM_PRE_CUT_MASK_S (0.8s): nothing may start in the window before
 *   a CUT starts (a punch on the last pre-cut frame spotlights the seam).
 * - ZOOM_POST_CUT_SETTLE_S (2.0s): nothing may start in the window after
 *   a CUT ends (the resume must play clean before any scale change).
 * - Crossing: a span may never contain a CUT inside it (a slow_zoom
 *   running across a splice lands on the next clip at the wrong scale).
 *
 * ONE definition — the planner (`motionSpanAllowed` in tools_plan.ts)
 * and the renderer (last-gate validation in tools_render.ts) both read
 * these numbers, never a second copy.
 */
export const ZOOM_PRE_CUT_MASK_S = 0.8;
export const ZOOM_POST_CUT_SETTLE_S = 2.0;

/** Zoom span kinds the exclusion rule applies to. */
export type MotionKind = "zoom_in" | "zoom_out" | "slow_zoom";

/**
 * Effective visible duration of a motion span (seconds).
 * zoom_in/zoom_out punches render as a 0.18s push + 0.5s settle
 * (≈0.7s total); slow_zoom renders for `duration` (default 8s).
 */
export function motionSpanDuration(
  kind: MotionKind,
  duration?: number
): number {
  if (kind === "slow_zoom")
    return Math.max(1, Math.min(duration ?? 8, 30));
  return 0.7;
}

/**
 * motionSpanAllowed(start, kind, duration, cutRanges) → { ok, reason? }.
 * Returns ok=false when the span [start, start+spanDur] would:
 * - start inside the pre-cut mask of any CUT, OR
 * - start inside the post-cut settle of any CUT, OR
 * - contain a CUT edge inside it (crossing), OR
 * - start inside a CUT range itself.
 * Cut ranges are { s, e } in seconds (SOURCE clock).
 */
export function motionSpanAllowed(
  start: number,
  kind: MotionKind,
  duration: number | undefined,
  cutRanges: Array<{ s: number; e: number }>
): { ok: boolean; reason?: string } {
  const spanDur = motionSpanDuration(kind, duration);
  const end = start + spanDur;
  for (const c of cutRanges) {
    if (start >= c.s && start < c.e)
      return {
        ok: false,
        reason: `starts inside CUT [${secToTimecode(c.s)}–${secToTimecode(c.e)}]`,
      };
    if (start >= c.s - ZOOM_PRE_CUT_MASK_S && start < c.s)
      return {
        ok: false,
        reason: `starts inside the ${ZOOM_PRE_CUT_MASK_S}s pre-cut mask of CUT ${secToTimecode(c.s)}`,
      };
    if (start >= c.e && start < c.e + ZOOM_POST_CUT_SETTLE_S)
      return {
        ok: false,
        reason: `starts inside the ${ZOOM_POST_CUT_SETTLE_S}s post-cut settle of CUT ending ${secToTimecode(c.e)}`,
      };
    if (start < c.s && end > c.s)
      return {
        ok: false,
        reason: `span ${spanDur.toFixed(2)}s crosses CUT ${secToTimecode(c.s)} (would land zoomed on the next clip)`,
      };
  }
  return { ok: true };
}

/** Resolve takesCount → mode. 1 (or unknown) is single_take: prudence by default. */
export function footageMode(takesCount?: number): FootageMode {
  return (takesCount ?? 1) >= 2 ? "multi_take" : "single_take";
}

/**
 * Resolve (style, takes) → effective register.
 * - youtube_talking_head → educational (legacy alias, same cadence).
 * - show + single_take → educational + note: MrBeast rhythm needs real
 *   coverage (10 takes, B-roll, crew). Faking it on one take reads as
 *   cheap, not energetic. The downgrade is recorded in structure_notes
 *   so the agent sees it — never silent.
 */
export function resolveRegister(
  style: StylePreset | undefined,
  takesCount?: number
): { register: RegisterName; downgraded: boolean } {
  const s = style ?? "educational";
  const base: RegisterName = s === "youtube_talking_head" ? "educational" : s;
  if (base === "show" && footageMode(takesCount) === "single_take")
    return { register: "educational", downgraded: true };
  return { register: base, downgraded: false };
}

/**
 * Graphic kinds the planner may emit — all CONTENT-AWARE (text comes
 * from the real transcript/analysis, never invented):
 * - act_title: new act opens (section boundary) — title from the
 *   section's own words (video-4 "3 STEPS" hook banner).
 * - number_stat: a spoken number/stat worth reading (video-3
 *   "$3,000/MONTH" full-screen formula) — from keywords with digits.
 * - highlight: a top keyword as a context label (MrBeast "MIDDLE OF
 *   NOWHERE") — from top-scoring non-numeric keywords.
 * - quote: the hook's most quotable line replayed mid-video as a recap
 *   (guide §5.4 visual recap) — from hook_moment.text.
 */
export type GraphicKind = "act_title" | "number_stat" | "highlight" | "quote";

/**
 * One content-aware graphic banner or motion design card (planner output, renderer input).
 * Times are SOURCE timecodes (same clock as cuts/animations); the
 * renderer remaps them and drops beats inside CUT ranges.
 */
export interface GraphicBeat {
  time: Timecode;
  kind: GraphicKind;
  /** Main line: section words / number / keyword / quote / tool name. */
  title: string;
  /** Optional second line (act_title, tool_badge, concept_card). */
  subtitle?: string;
  /** Category badge or tag (e.g. "AI TOOL", "SKILL", "AUTOMATION") */
  tag?: string;
  /** Optional icon/emoji (e.g. "⚡", "🤖", "📱", "✂️") */
  icon?: string;
  /** Visible seconds (act 2.5, number 3.5, highlight 3, quote 4). */
  duration: number;
  /** Position on screen: "top" | "center" | "bottom" (default: "top") */
  position?: "top" | "center" | "bottom";
}

/** Target canvas presets. short = 9:16 vertical, long = 16:9 landscape. */
export type CanvasFormat = "short" | "long";

export const CANVAS: Record<CanvasFormat, { width: number; height: number }> = {
  short: { width: 1080, height: 1920 },
  long: { width: 1920, height: 1080 },
};

/** Machine-actionable Action Plan (Steps 4–6). Version history:
 * - 1.2: KEEP splice + kept-words karaoke + act-based motion.
 * - 1.3: ADDS speech (wpm from analyze), takesCount→footage gate,
 *   resolvedRegister (legacy alias folded, show+single_take downgraded
 *   with a structure_notes entry — never silent), graphics[]
 *   (content-aware banners: act_title / number_stat / highlight / quote,
 *   transcript-verbatim). Old 1.2 plans still parse (new fields optional).
 */
export interface EditPlan {
  version: "1.2" | "1.3";
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
  /**
   * Measured speech pace from analyze (words/min over kept words).
   * The agent reads this to pick the register honestly: ≥220 sustained =
   * tutorial-grade density (the screen must change, not the face);
   * ~170–190 = educational/show-grade (cut on ideas).
   */
  speech?: { wpm: number; totalWords: number };
  /**
   * Takes the editor has in hand (default 1 = single_take = prudent).
   * Decides FootageMode: 1 → no faked coverage; ≥2 → real cutting.
   */
  takesCount?: number;
  /**
   * Effective rhythm register AFTER resolveRegister ran (alias folded,
   * downgrade applied). The planner always writes it — what you read
   * here is what the cadence obeyed, no guessing.
   */
  resolvedRegister?: RegisterName;
  /**
   * Content-aware graphic banners (all transcript-verbatim, TOP position
   * so captions stay clear). The renderer drops beats in CUT ranges and
   * enforces max-1-at-a-time (fail-loud on overlap, like karaoke).
   */
  graphics?: GraphicBeat[];
  /** Free-form agent notes (hook missing, cold-open proposal, …). */
  structure_notes?: Array<{ time: Timecode; note: string }>;
  /**
   * Cuts the planner did NOT silently apply: skipped low-confidence
   * proposals + applied-but-verify medium ones. The agent MUST review
   * these before rendering — rhetoric the heuristics can't judge.
   */
  review_cuts?: Array<{
    start: Timecode;
    end: Timecode;
    reason: string;
  }>;
  /** Flag set when animations and motion graphics originate from RetentionVolt */
  retentionvolt_applied?: boolean;
  /** Thumbnail configuration (generated or suggested by RetentionVolt) */
  thumbnail?: ThumbnailConfig;
  /** Directorial shot setups (fullscreen, screen share, PiP, split screen) adapted from RetentionVolt */
  shots?: Array<{
    start: Timecode;
    end: Timecode;
    shot_type: BlueprintShotType;
    pip_position?: "bottom_right" | "bottom_left" | "top_right" | "top_left";
    pip_size_pct?: number;
    split_ratio?: string;
    /** Image or video media path for full screen background / b-roll / screen share */
    media_url?: string;
    /** Title / header for demonstrative screen */
    title?: string;
    /** Subtitle / description for demonstrative screen */
    subtitle?: string;
  }>;
}

/**
 * RetentionVolt Blueprint (from retentionvolt.com MCP server).
 * Contains the full per-second visual event timeline of a top-performing reference video.
 *
 * IMPORTANT: This blueprint contains NO cuts. Cuts are determined exclusively
 * by analyze_transcript on the user's own content. The blueprint only defines
 * what to ADD visually (shots, zooms, motion graphics, captions).
 *
 * The agent adapts `at_sec` timecodes using semantic triggers:
 * - `section_index` → maps to equivalent section in the user's video
 * - `text_source` → text pulled from the USER's transcript (never copied from reference)
 */
export interface RetentionVoltBlueprint {
  /** Video reference pattern ID from RetentionVolt database */
  pattern_id?: string;
  /** Provenance: cloud database query or local fallback heuristics */
  source?: "retentionvolt_cloud" | "local_fallback";
  /**
   * Full per-second visual event timeline of the reference video.
   * Events are ordered by at_sec ascending.
   * Types: shot | zoom | graphic | caption | animation | section_start
   * NEVER includes 'cut' events.
   */
  events?: BlueprintEvent[];
  /** Summary of shot types used (for quick agent reference) */
  shot_types_summary?: BlueprintShotType[];
  /** Summary of graphic types used (for quick agent reference) */
  graphic_types_summary?: BlueprintGraphicKind[];
  /** High-CTR thumbnail configuration */
  thumbnail?: ThumbnailConfig;
  /** Free-form retention notes from reference video analysis */
  retention_notes?: string[];

  // ── Legacy fields (kept for backward compatibility with v1 blueprints) ──
  /** @deprecated Use events[] instead */
  animations?: Array<{
    time: Timecode;
    type: AnimationType;
    content?: string;
    position?: "top" | "bottom" | "center";
    target?: string;
    duration?: number;
    direction?: "in" | "out";
    intensity?: number;
  }>;
  /** @deprecated Use events[] instead */
  pattern_interrupts?: Array<{
    time: Timecode;
    kind: "caption_pop" | "zoom_punch" | "visual_glitch" | string;
    detail?: string;
  }>;
  /** @deprecated Use events[] instead */
  graphics?: GraphicBeat[];
}

/**
 * Profile della struttura narrativa di un video utente, usato per il similarity matching.
 * Derivato dall'output di analyze_transcript.
 */
export interface VideoStructureProfile {
  /** Durata del hook in secondi */
  hook_duration_sec: number;
  /** Numero di sezioni narrative */
  sections_count: number;
  /** Durata media di ogni sezione (secondi) */
  avg_section_length_sec: number;
  /** Rapporto parole filler su totale (0-1) */
  filler_ratio: number;
  /** Numero di zone di calo attenzione */
  attention_dips_count: number;
  /** Densità dei momenti highlight (highlights/min) */
  highlight_density: number;
  /** Presenza di una call-to-action finale */
  cta_present: boolean;
  /** Parole al minuto (over kept words) */
  speech_wpm?: number;
  /** Tipo di video inferito automaticamente da inferVideoType() */
  inferred_video_type?: VideoType;
}

/** Un singolo video simile trovato nel database RetentionVolt */
export interface SimilarVideoMatch {
  /** UUID del video nel database RetentionVolt */
  video_id: string;
  /** Nome del creator (es: 'Ali Abdaal', 'MrBeast') */
  creator: string;
  /** Titolo del video di riferimento */
  title: string;
  /** Niche del video */
  niche: string;
  /** Tipologia di video (talking_head, vlog, tutorial_screencast, ecc.) */
  video_type: VideoType;
  /** Format: short o long */
  format: "short" | "long";
  /** Lingua del video */
  language: string;
  /** Durata in secondi */
  duration_sec: number;
  /** % media di retention del pubblico */
  avg_retention_pct?: number;
  /** Click-Through Rate % */
  ctr_pct?: number;
  /** Numero di views */
  views_count?: number;
  /** Score virale normalizzato 0-1 */
  viral_score?: number;
  /** Score di similarità composito 0-1 */
  similarity_score: number;
  /** Posizione nel ranking (1 = migliore match) */
  rank: number;
  /** Blueprint da iniettare in generate_edit_plan */
  blueprint: RetentionVoltBlueprint;
  /** Ricetta thumbnail high-CTR */
  thumbnail_recipe?: ThumbnailConfig;
  /** Pattern interrupts con timestamp */
  pattern_interrupts?: Array<{ time: Timecode; kind: string; detail?: string }>;
}

/** Risultato completo di find_similar_video */
export interface SimilarVideoResult {
  /** Lista ordinata dei video più simili (rank 1 = migliore match) */
  matches: SimilarVideoMatch[];
  /** Blueprint del rank-1 già pronto per generate_edit_plan */
  best_blueprint: RetentionVoltBlueprint;
  /** Confidence del match migliore (0-1) */
  confidence: number;
  /** Se true, il match supera la soglia consigliata (0.70) */
  high_confidence: boolean;
  /** Provenance: cloud o fallback */
  source: "retentionvolt_cloud" | "local_fallback";
  /** Messaggio human-readable per l'agente da mostrare all'utente */
  agent_message: string;
}

/** Configuration for high-CTR video thumbnail / cover generation. */
export interface ThumbnailConfig {
  /** Main hook headline on cover (large, high-contrast) */
  title: string;
  /** Optional subtitle or badge (e.g. "DEFINITIVE GUIDE", "$10K") */
  badge?: string;
  /** Source timestamp to capture base frame from (defaults to hook_moment or 00:00:02.000) */
  frame_time?: Timecode;
  /** Style preset for thumbnail: "minimal" | "bold" | "youtube_clean" */
  style?: "minimal" | "bold" | "youtube_clean";
  /** Target filename when output path is a directory (default: "thumbnail.png") */
  output_filename?: string;
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

/**
 * Tipologia di video — usata come dimensione di matching nel Video Similarity Engine.
 * Rilevata automaticamente dal transcript e dai metadata del video.
 */
export type VideoType =
  | "talking_head"                    // Singola persona in camera, sfondo fisso
  | "talking_head_with_screen_share"  // Viso + schermo computer
  | "vlog"                            // On the go, location varie, molto B-roll
  | "tutorial_screencast"             // Schermo prevalente, voce over
  | "podcast"                         // 2+ persone, ambiente fisso
  | "cinematic_branded";              // Camera professionale, footage curato

/**
 * Tipo di un singolo evento visivo nel blueprint RetentionVolt.
 * I CUT non sono inclusi: i cut dipendono dal contenuto dell'utente
 * e vengono decisi da analyze_transcript, non dal blueprint.
 */
export type BlueprintEventType =
  | "shot"          // Cambio di inquadratura (talking_head → screen_share → split_screen)
  | "zoom"          // Qualsiasi zoom (slow_zoom, zoom_punch, zoom_in, zoom_out)
  | "graphic"       // Motion graphics (banner, caption_pop, stat, callout, highlight_box)
  | "caption"       // Configurazione stile sottotitoli
  | "animation"     // Animazioni UI / overlay effects
  | "section_start"; // Marcatore inizio sezione (per semantic mapping)

/**
 * Shot types supported in blueprints.
 */
export type BlueprintShotType =
  | "talking_head_fullscreen"
  | "screen_share_fullscreen"
  | "pip_talking_head_on_screen"   // Picture-in-picture: creator su schermo
  | "split_screen"                 // Creator a sinistra, schermo a destra
  | "talking_head_pip"             // Talking head piccolo su sfondo
  | "b_roll_fullscreen";           // B-roll clip a schermo intero

/**
 * Graphic kinds in the blueprint.
 */
export type BlueprintGraphicKind =
  | "act_title_banner"      // Banner sezione in alto
  | "caption_pop"           // Keyword pop a schermo
  | "number_stat"           // Numero/stat grande a schermo
  | "screen_callout_arrow"  // Freccia + label su elemento schermo
  | "screen_highlight_box"  // Box evidenziatore su area schermo
  | "lower_third"           // Lower third con nome/info
  | "end_screen_cta";       // CTA end screen

/**
 * Un singolo evento visivo nel blueprint di un video top-performer.
 * Il campo `at_sec` è relativo al video di riferimento analizzato.
 * L'agente NON copia `at_sec` direttamente — usa `section_index` e
 * `text_source` come trigger semantici da mappare sul video dell'utente.
 */
export interface BlueprintEvent {
  /** Timecode (secondi) nel video di riferimento. Solo per ispirazione — non copiare direttamente. */
  at_sec: number;
  /** Tipo di evento visivo. Mai 'cut' — i cut non fanno parte del blueprint. */
  type: BlueprintEventType;

  // ── SHOT fields (type === 'shot') ────────────────────────────────────────
  shot_type?: BlueprintShotType;
  framing?: "wide" | "medium" | "medium_close_up" | "close_up" | "extreme_close_up";
  transition?: "instant_cut" | "fade" | "slide";
  /** Split screen ratio (e.g. '40/60') */
  split_ratio?: string;
  left?: string;
  right?: string;
  pip_position?: "bottom_right" | "bottom_left" | "top_right" | "top_left";
  pip_size_pct?: number;

  // ── ZOOM fields (type === 'zoom') ────────────────────────────────────────
  kind?: "slow_zoom" | "zoom_punch" | "zoom_in" | "zoom_out";
  direction?: "in" | "out";
  target?: "face" | "screen_region" | "full_frame";
  scale?: number;              // Scale multiplier (e.g. 1.12)
  intensity_pct_per_sec?: number; // For slow_zoom
  duration_sec?: number;

  // ── GRAPHIC fields (type === 'graphic') ──────────────────────────────────
  graphic_kind?: BlueprintGraphicKind;
  /**
   * Source of text content. Never hardcoded — always references the user's transcript.
   * Values: 'keyword_from_transcript' | 'section_title_from_transcript' |
   *         'spoken_number_from_transcript' | 'creator_name' | 'hook_strongest_phrase'
   */
  text_source?: string;
  position?: "top" | "bottom" | "center" | "bottom_left" | "bottom_right" | "top_left";
  style?: string;
  color?: string;
  region?: string;             // For screen_callout_arrow / screen_highlight_box
  points_to?: string;          // For callout arrows

  // ── CAPTION fields (type === 'caption') ──────────────────────────────────
  caption_style?: "karaoke" | "karaoke_bold" | "static" | "word_by_word";
  accent_color?: string;
  active?: boolean;

  // ── SECTION_START fields (type === 'section_start') ──────────────────────
  /** 1-based section index — used for semantic mapping onto user's video */
  section_index?: number;

  // ── Common optional ──────────────────────────────────────────────────────
  note?: string;
}

/** A single screenshot extracted during the Step 6 verification quality gate. */
export interface VerificationFrame {
  timestamp: string;
  seconds: number;
  label: string;
  beat_description: string;
  image_path: string;
}

/** Result of the Step 6 frame-by-frame verification inspection. */
export interface VerificationResult {
  video_path: string;
  output_dir: string;
  total_frames: number;
  frames: VerificationFrame[];
  verification_checklist: {
    audio_visual_sync: string;
    in_bounds_safe_area: string;
    aesthetic_quality: string;
    face_unobstructed: string;
    finished_product_ready: string;
  };
}
