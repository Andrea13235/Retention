/**
 * tools_plan.ts — Step 4: Action Plan generation (v1.3).
 * Turns the NarrativeStructure into a machine-actionable EditPlan:
 * a real KEEP splice (complement of cut_candidates), kept-words-only
 * karaoke captions, act-based motion, content-aware graphics.
 *
 * Rules (ONE decision chain, in this order):
 * 1. format: "short" (explicit or portrait source) → 9:16 canvas,
 *    hook-first, punch every ~4s, captions always on. "long" → 16:9,
 *    breathing room, register cadence below.
 * 2. register: style → resolveRegister (types.ts): legacy
 *    youtube_talking_head folds to educational; show + single_take
 *    downgrades to educational WITH a structure_notes entry (never
 *    silent — MrBeast rhythm needs real coverage, faking it reads cheap).
 *    Cadence comes from REGISTER_CADENCE — the measured table, no copies.
 * 3. footage gate: takesCount 1 (default) = single_take → NO faked
 *    coverage: no shot-change transitions, show-rhythm only with ≥2
 *    takes. Caption pops, graphic banners, push-ins stay legal.
 * 4. cuts = complement of cut_candidates over [0, mediaEnd]: sorted,
 *    non-overlapping, edge-to-edge. CUT entries are ALSO listed
 *    (reason "CUT — …") for the human-readable record.
 * - Karaoke captions contain ONLY kept words; corrected text
 *   (structure.corrections_applied) replaces ASR-mangled words.
 * - Motion follows narrative acts (one slow_zoom per section), not a
 *   metronome; slow_spots get punch-ins.
 * - Graphics (NEW v1.3): max 1 banner at a time, TOP position (captions
 *   live at the bottom — no overlap possible), text ALWAYS
 *   transcript-verbatim (section words, spoken numbers, top keywords,
 *   hook quote). Dropped inside CUTs, validated by the renderer.
 */
import {
  footageMode,
  motionSpanAllowed,
   motionSpanDuration,
  REGISTER_CADENCE,
  resolveRegister,
  secToTimecode,
  timecodeToSec,
  type CanvasFormat,
  type CutCandidate,
  type EditPlan,
  type GraphicBeat,
  type MotionKind,
  type NarrativeStructure,
  type RegisterName,
  type RetentionVoltBlueprint,
  type BlueprintEvent,
  type BlueprintShotType,
  type StylePreset,
  type ThumbnailConfig,
  type Timecode,
  type Transcript,
} from "./types.js";
import { findSimilarVideoSync } from "./retentionvolt_client.js";

export type { StylePreset };

export interface PlanOptions {
  style?: StylePreset;
  /**
   * Target canvas. Default: "short" for short_form style or portrait
   * sources, "long" otherwise. Pass explicitly to override.
   */
  format?: CanvasFormat;
  /** True when the source footage is portrait (vertical video). */
  sourcePortrait?: boolean;
  /**
   * Takes the editor has in hand (default 1 = single_take = prudent).
   * 1 → no faked coverage (no shot-change transitions, no multi-cam
   * rhythm); ≥2 → real cutting between takes is legal.
   */
  takesCount?: number;
  /** Available b-roll sources (paths). */
  brollSources?: string[];
  /**
   * Custom / AI-generated cutaways (Higgsfield-style).
   * Exact start/end timecodes and image/video paths.
   */
  customBroll?: Array<{
    start: Timecode;
    end: Timecode;
    source: string;
    reason?: string;
    prompt?: string;
    camera_motion?: "zoom_in_drift_right" | "zoom_in_drift_left" | "slow_pull_back" | "subtle_drift_up" | "cinematic_pan";
    motion_vector?: {
      scale_start?: number;
      scale_end?: number;
      drift_x?: number;
      drift_y?: number;
      ease?: string;
    };
  }>;
  /**
   * Static blocks at risk of attention drop. Every risk point gets a
   * dedicated pattern interrupt at its midpoint (in addition to cadence).
   * Agents mark them during transcript analysis (see docs/analysis-guide.md).
   */
  attentionRiskPoints?: Array<{
    start: string;
    end: string;
    reason: string;
  }>;
  /**
   * Extra CUT ranges from the agent (false starts / rhetoric the
   * heuristics can't judge). Merged with structure.cut_candidates.
   */
  extraCuts?: Array<{ start: string; end: string; reason: string }>;
  /**
   * Transcript corrections { misheard, correct }. Applied by analyze
   * already, but accepted here too so a plan can be built from a
   * hand-written structure: corrected words reach captions.
   */
  corrections?: Array<{ misheard: string; correct: string }>;
  /**
   * Max words per karaoke caption card (default 5 short / 8 long).
   * Short-form keeps cards tiny for pace; long-form allows full phrases.
   */
  maxWordsPerCard?: number;
  /**
   * Optional RetentionVolt blueprint (from retentionvolt.com MCP server).
   * When provided:
   * 1. Bypasses heuristic animation & motion-graphics guesswork (uses proven
   *    animations and pattern interrupts from RetentionVolt).
   * 2. Sets retentionvolt_applied = true in the plan.
   * 3. Configures high-CTR thumbnail generation from the blueprint.
   */
  retentionvoltBlueprint?: RetentionVoltBlueprint;
  /** Thumbnail configuration or override */
  thumbnail?: ThumbnailConfig;
  /**
   * Disable TOP graphic banners (act_title / highlight / number_stat).
   * Default: true for single_take/short (restraint), false when blueprint
   * provides graphics or caller explicitly enables them.
   * When true, graphics[] is empty — no banner sopra in alto.
   */
  disableGraphics?: boolean;
  /** Raw transcript object or JSON string from transcribeMedia */
  transcript?: Transcript | string;
  /** Explicit or manual shot directorial setups (screen share, PiP, demonstrative visual slides) */
  shots?: EditPlan["shots"];
}

export function generateEditPlan(
  structure: NarrativeStructure,
  opts: PlanOptions = {},
  transcriptWords?: Array<{ start: string; word: string }>
): EditPlan {
  const style = opts.style ?? "educational";
  const format: CanvasFormat =
    opts.format ?? (style === "short_form" || opts.sourcePortrait ? "short" : "long");
  const isShort = format === "short";
  // Register + cadence: ONE measured table (types.ts). short_form keeps
  // its own cadence; long-form reads the resolved register.
  const { register, downgraded } = isShort
    ? { register: "short_form" as RegisterName, downgraded: false }
    : resolveRegister(style, opts.takesCount);
  const every = REGISTER_CADENCE[register];
  const maxWords = opts.maxWordsPerCard ?? (isShort ? 5 : 8);

  const endSec = timecodeToSec(
    structure.sections[structure.sections.length - 1]?.end ??
      structure.hook.end
  );
  const mediaEnd = structure.duration_sec ?? endSec;

  // ——— Cuts: complement of cut_candidates over [0, mediaEnd] ———
  // Confidence gate (first-take safety):
  // - confidence ≥ 0.85 → auto-applied, no questions.
  // - 0.5 ≤ confidence < 0.85 → applied BUT listed in review_cuts:
  //   the agent double-checks rhetorical moments (a 0.8s pause may be
  //   deliberate drama, not a blank mind).
  // - confidence < 0.5 → NOT applied: stays a proposal, agent decides.
  // - manual extraCuts always apply (the agent already judged them).
  const reviewCuts: NonNullable<EditPlan["review_cuts"]> = [];
  const rawCuts: CutCandidate[] = [
    ...(structure.cut_candidates ?? []).flatMap((c) => {
      const conf = c.confidence ?? 0.7;
      if (conf < 0.5) {
        reviewCuts.push({
          start: c.start,
          end: c.end,
          reason: `SKIPPED (confidence ${conf}): ${c.kind}: ${c.reason} — promote via extraCuts or leave kept`,
        });
        return [];
      }
      if (conf < 0.85) {
        reviewCuts.push({
          start: c.start,
          end: c.end,
          reason: `APPLIED, verify rhetoric (${conf}): ${c.kind}: ${c.reason}`,
        });
      }
      return [c];
    }),
    ...(opts.extraCuts ?? []).map((c) => ({ ...c, kind: "manual" as const, confidence: 1 })),
  ];
  const cutRanges = rawCuts
    .map((c) => ({
      s: Math.max(0, timecodeToSec(c.start)),
      e: Math.min(mediaEnd, timecodeToSec(c.end)),
      kind: c.kind,
      reason: c.reason,
    }))
    .filter((c) => c.e > c.s)
    .sort((a, b) => a.s - b.s);
  // merge overlaps
  const mergedCuts: typeof cutRanges = [];
  for (const c of cutRanges) {
    const last = mergedCuts[mergedCuts.length - 1];
    if (last && c.s < last.e) {
      last.e = Math.max(last.e, c.e);
      last.reason += ` + ${c.reason}`;
    } else mergedCuts.push({ ...c });
  }
  // complement → KEEP ranges
  const cuts: EditPlan["cuts"] = [];
  let cursor = 0;
  const keepLabel = (s: number, e: number): string => {
    if (cursor === 0 && mergedCuts.length > 0 && s === 0) return "opening hook (trimmed)";
    for (const sec of structure.sections) {
      if (s >= timecodeToSec(sec.start) - 0.01 && e <= timecodeToSec(sec.end) + 0.01)
        return sec.title;
    }
    return "keep";
  };
  for (const c of mergedCuts) {
    if (c.s > cursor) cuts.push({ start: secToTimecode(cursor), end: secToTimecode(c.s), reason: keepLabel(cursor, c.s) });
    cursor = c.e;
  }
  if (cursor < mediaEnd) cuts.push({ start: secToTimecode(cursor), end: secToTimecode(mediaEnd), reason: keepLabel(cursor, mediaEnd) });
  // CUT entries appended for the human-readable record (renderer skips them)
  for (const c of mergedCuts) {
    cuts.push({ start: secToTimecode(c.s), end: secToTimecode(c.e), reason: `CUT — ${c.kind}: ${c.reason}` });
  }
  const isKept = (t: number): boolean =>
    mergedCuts.every((c) => t < c.s || t >= c.e);

  const fixWord = (w?: string): string => {
    if (!w) return "";
    let out = w;
    for (const c of opts.corrections ?? []) {
      const esc = c.misheard.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`(^|\\s)${esc}(?=\\s|$|[.,!?;:])`, "gi"), (_, pre) => `${pre}${c.correct}`);
    }
    return out;
  };

  // Helper to extract seconds from any time representation (number, "00:00:01.000", "1.5")
  const getWordSec = (start: any): number => {
    if (typeof start === "number") return start;
    if (typeof start === "string") {
      if (start.includes(":")) {
        try {
          return timecodeToSec(start);
        } catch {
          return 0;
        }
      }
      const n = parseFloat(start);
      if (!isNaN(n)) return n;
    }
    return 0;
  };

  let rawWords = transcriptWords;
  if ((!rawWords || rawWords.length === 0) && opts.transcript) {
    try {
      const t = typeof opts.transcript === "string" ? JSON.parse(opts.transcript) : opts.transcript;
      rawWords = (t.segments ?? []).flatMap((s: any) =>
        (s.words ?? []).map((w: any) => ({
          start: typeof w.start === "number" ? secToTimecode(w.start) : String(w.start),
          word: w.word,
        }))
      );
    } catch {
      // ignore
    }
  }

  // ——— Karaoke captions with keyword emphasis ———
  const kwSet = new Set(
    (structure.keywords ?? []).slice(0, 15).map((k) => k.word)
  );
  const animations: EditPlan["animations"] = [];
  const structure_notes: EditPlan["structure_notes"] = [];
  if (rawWords && rawWords.length > 0) {
    // Drop CUT words first: only kept words reach captions.
    const kept = rawWords
      .map((w) => ({
        ...w,
        sec: getWordSec(w.start),
        word: fixWord(w.word),
      }))
      .filter((w) => isKept(w.sec));
    // Build raw cards first (maxWords each), then assign durations so
    // cards NEVER overlap: each card ends when the next begins (minus a
    // breath gap). One caption alive at a time — guaranteed by
    // construction, whatever the splice did to the clock.
    const rawCards: Array<{ start: number; words: typeof kept }> = [];
    let cur: (typeof rawCards)[number] | null = null;
    for (const w of kept) {
      if (!cur || cur.words.length >= maxWords) {
        cur = { start: w.sec, words: [] };
        rawCards.push(cur);
      }
      cur.words.push(w);
    }
    const keepRanges = cuts.filter((c) => !c.reason.startsWith("CUT")).map((c) => ({
      s: timecodeToSec(c.start),
      e: timecodeToSec(c.end),
    }));
    const srcToTlSec = (src: number): number => {
      let tl = 0;
      for (const k of keepRanges) {
        if (src >= k.s && src <= k.e) {
          return tl + (src - k.s);
        }
        tl += k.e - k.s;
      }
      return tl;
    };
    const GAP = 0.08;
    rawCards.forEach((card, i) => {
      if (card.words.length === 0) return;
      const cardTl = srcToTlSec(card.start);
      const lastStart = card.words[card.words.length - 1].sec;
      const natural = lastStart - card.start + 0.8;

      const currentKeep = keepRanges.find((k) => card.start >= k.s && card.start <= k.e);
      const keepLimit = currentKeep ? srcToTlSec(currentKeep.e) - cardTl - GAP : (isShort ? 4 : 8);

      const nextStart = rawCards[i + 1]?.start;
      const nextLimit = nextStart !== undefined ? srcToTlSec(nextStart) - cardTl - GAP : (isShort ? 4 : 8);

      const maxAllowed = Math.max(0.3, Math.min(keepLimit, nextLimit));
      // Short-form: snappy cards (0.3–4s). Long-form: room to breathe (0.3–8s).
      const dur = Math.min(maxAllowed, Math.max(0.3, Math.min(isShort ? 4 : 8, natural)));
      animations.push({
        time: secToTimecode(card.start),
        type: "karaoke_caption",
        position: "bottom",
        duration: dur,
        words: card.words.map((w) => ({
          start: secToTimecode(w.sec),
          word: w.word.trim(),
          emphasis: kwSet.has(w.word.trim().toLowerCase().replace(/[.,!?;:]+$/, "")),
        })),
      });
    });
  } else {
    // No word timestamps: do NOT invent captions. Produce a caption-free
    // plan and tell the agent the exact fix (pass transcript with words).
    structure_notes.push({
      time: secToTimecode(0),
      note: "captions disabled: transcript has no word timestamps — re-run transcribe_media with word_timestamps=true and pass transcript to generate_edit_plan",
    });
  }

  // ——— Motion follows acts, not a metronome ———
  // hook_moment emphasis is rendered by the karaoke cards themselves
  // (no separate top caption: double captions + black boxes are banned —
  // the Apple restraint rule).
  //
  // CUTS-FIRST strategy: the KEEP splice above is FINAL before any motion
  // is placed. A cut on a zoomed frame is a visible scale jump — the two
  // sides of a splice meeting at different magnifications — so every zoom
  // span keeps clear of every CUT edge on BOTH sides (types.ts
  // ZOOM_PRE_CUT_MASK_S / ZOOM_POST_CUT_SETTLE_S + no crossing). Motion
  // that cannot fit is relocated when possible, clamped when a slow_zoom
  // overruns the next CUT, skipped with a structure_notes entry when
  // neither works — never silent, never overlapping a cut.
  //
  // HARD-CUT rule: cleanup cuts (stutter, dead air, filler, false starts,
  // trims) are NET cuts — the splice alone, no animation on top. A zoom
  // landing on a cleanup resume tells the viewer "something was hidden
  // here", which is exactly what must NOT happen.
  //
  // Zooms live ONLY on genuine scene changes: section boundaries (a new
  // act starts — coherent emphasis, not a cover-up) and explicit agent
  // attentionRiskPoints (the agent judged the moment worthy).
  const CUT_MASK_S = 0.8;
  const cutStarts = mergedCuts.map((c) => c.s); // cuts start here
  const nearCutStart = (t: number): boolean =>
    cutStarts.some((cs) => t >= cs - CUT_MASK_S && t < cs);

  // All candidate cuts (including low-confidence ones) for strict graphic/interrupt mask checks
  const allCandidateCuts = [
    ...mergedCuts,
    ...(structure.cut_candidates ?? []).map((c) => ({
      s: Math.max(0, timecodeToSec(c.start)),
      e: Math.min(mediaEnd, timecodeToSec(c.end)),
    })),
  ];
  const isClearOfAllCuts = (t: number): boolean =>
    allCandidateCuts.every((c) => t < c.s - CUT_MASK_S || t >= c.e);

  // Helper to clamp a [start, end] span inside a single KEEP range so it never
  // starts or ends inside a CUT or crosses a splice boundary.
  const keepIntervals = cuts
    .filter((c) => !c.reason.startsWith("CUT"))
    .map((c) => ({ s: timecodeToSec(c.start), e: timecodeToSec(c.end) }))
    .filter((k) => k.e - k.s >= 1.2);

  const clampSpanToKeep = (
    wantedStart: number,
    wantedEnd: number
  ): { s: number; e: number } | null => {
    const wantedDur = Math.max(1.5, wantedEnd - wantedStart);
    if (keepIntervals.length === 0) {
      const s = Math.max(0, Math.min(wantedStart, mediaEnd - 1.5));
      const e = Math.min(mediaEnd, s + wantedDur);
      return e > s ? { s, e } : null;
    }
    // Prefer the keep interval containing wantedStart (if enough room), else nearest keep interval
    let win = keepIntervals.find(
      (k) => wantedStart >= k.s - 0.1 && wantedStart < k.e - 1.2 && k.e - k.s >= 1.6
    );
    if (!win) {
      win = [...keepIntervals]
        .filter((k) => k.e - k.s >= 1.6)
        .sort(
          (a, b) =>
            Math.min(Math.abs(a.s - wantedStart), Math.abs(a.e - wantedStart)) -
            Math.min(Math.abs(b.s - wantedStart), Math.abs(b.e - wantedStart))
        )[0];
    }
    if (!win) win = keepIntervals[0];
    const pad = 0.08;
    const avail = win.e - win.s - pad * 2;
    if (avail < 1.0) return null;
    const dur = Math.min(wantedDur, avail);
    const s = Math.max(win.s + pad, Math.min(wantedStart, win.e - pad - dur));
    const e = Math.min(win.e - pad, s + dur);
    return e - s >= 1.0 ? { s: Math.round(s * 100) / 100, e: Math.round(e * 100) / 100 } : null;
  };

  // Track placed zoom spans so two zoom tweens never collide on the same clip
  const placedZoomSpans: Array<{ s: number; e: number }> = [];
  const zoomOverlaps = (s: number, dur: number): boolean =>
    placedZoomSpans.some((z) => s < z.e + 0.3 && s + dur > z.s - 0.3);

  // Cuts-first placement helper. Tries, in order:
  // 1. place at `wanted` when the full span is CUT-clear;
  // 2. relocate the start within ±6s (prefer the nearest CUT-clear second,
  //    earlier slots first — the act opening stays near its boundary);
  // 3. clamp a slow_zoom's duration so it ends at the next CUT edge;
  // 4. skip with a structure_notes entry (never silent).
  // Returns the placed start (sec) or null when skipped.
  const pushMotion = (
    wanted: number,
    kind: MotionKind,
    duration: number | undefined,
    label: string
  ): number | null => {
    const spanDur = motionSpanDuration(kind, duration);
    const ok = motionSpanAllowed(wanted, kind, duration, mergedCuts);
    if (ok.ok && isKept(wanted) && !zoomOverlaps(wanted, spanDur)) {
      placedZoomSpans.push({ s: wanted, e: wanted + spanDur });
      animations.push({
        time: secToTimecode(wanted),
        type: kind,
        target: "face",
        ...(kind === "slow_zoom"
          ? {
              direction: "in" as const,
              intensity: isShort ? 2 : 3,
              duration: Math.max(1, Math.min(duration ?? 8, 30)),
            }
          : {}),
      });
      return wanted;
    }
    const skipReason = !isKept(wanted) ? "inside a CUT range" : (ok.reason ?? "cut-adjacent");
    for (let d = 1; d <= 6; d++) {
      for (const t of [Math.floor(wanted) - d, Math.ceil(wanted) + d]) {
        if (t < 0 || t > mediaEnd) continue;
        if (!isKept(t)) continue;
        if (
          motionSpanAllowed(t, kind, duration, mergedCuts).ok &&
          !zoomOverlaps(t, spanDur)
        ) {
          placedZoomSpans.push({ s: t, e: t + spanDur });
          animations.push({
            time: secToTimecode(t),
            type: kind,
            target: "face",
            ...(kind === "slow_zoom"
              ? {
                  direction: "in" as const,
                  intensity: isShort ? 2 : 3,
                  duration: Math.max(1, Math.min(duration ?? 8, 30)),
                }
              : {}),
          });
          structure_notes.push({
            time: secToTimecode(t),
            note: `${label}: moved ${secToTimecode(wanted)} → ${secToTimecode(t)} (${skipReason})`,
          });
          return t;
        }
      }
    }
    if (kind === "slow_zoom") {
      const nextEdge = mergedCuts
        .map((c) => c.s)
        .filter((e) => e > wanted + 1)
        .sort((a, b) => a - b)[0];
      const clamped = nextEdge !== undefined ? nextEdge - 0.2 - wanted : 0;
      if (
        clamped >= 3 &&
        motionSpanAllowed(wanted, kind, clamped, mergedCuts).ok &&
        isKept(wanted) &&
        !zoomOverlaps(wanted, clamped)
      ) {
        const finalDur = Math.round(clamped * 10) / 10;
        placedZoomSpans.push({ s: wanted, e: wanted + finalDur });
        animations.push({
          time: secToTimecode(wanted),
          type: kind,
          target: "face",
          direction: "in" as const,
          intensity: isShort ? 2 : 3,
          duration: finalDur,
        });
        structure_notes.push({
          time: secToTimecode(wanted),
          note: `${label}: duration clamped to ${clamped.toFixed(1)}s (next CUT at ${secToTimecode(nextEdge!)})`,
        });
        return wanted;
      }
    }
    structure_notes.push({
      time: secToTimecode(wanted),
      note: `${label} at ${secToTimecode(wanted)} skipped (${skipReason}; no CUT-clear slot ≤6s ahead)`,
    });
    return null;
  };
  const isSceneChange = (t: number): boolean =>
    structure.sections.some(
      (sec, i) => i > 0 && Math.abs(timecodeToSec(sec.start) - t) < 0.5
    );

  // Patterns for detecting tools, software, skills, and tech/business concepts spoken in speech (IT + EN)
  const CONTEXT_VISUAL_PATTERNS = [
    { match: /\b(codex)\b/i, title: "CODEX AI", tag: "AI AGENT", icon: "⚡", subtitle: "Autonomous Coding", isScreen: true },
    { match: /\b(claude)\b/i, title: "CLAUDE", tag: "ANTHROPIC LLM", icon: "🤖", subtitle: "Context & Reasoning", isScreen: true },
    { match: /\b(hermes)\b/i, title: "HERMES", tag: "AI SYSTEM", icon: "🏛️", subtitle: "Autonomous Execution", isScreen: true },
    { match: /\b(rawcut|retention|retentionvolt)\b/i, title: "RETENTION AI", tag: "VIDEO AI", icon: "✂️", subtitle: "High-Retention Editor", isScreen: true },
    { match: /\b(short|shorts|reel|reels|tiktok)\b/i, title: "VIRAL SHORTS", tag: "FORMAT", icon: "📱", subtitle: "9:16 High Retention", isScreen: true },
    { match: /\b(social|socials|youtube|instagram)\b/i, title: "SOCIAL MEDIA", tag: "DISTRIBUTION", icon: "🚀", subtitle: "Multi-Platform Reach" },
    { match: /\b(video|editare|editing|montaggio)\b/i, title: "VIDEO EDITING", tag: "TIMELINE", icon: "🎬", subtitle: "Smart Cut & Motion" },
    { match: /\b(skill|skills|agente|agent)\b/i, title: "AI SKILL", tag: "CAPABILITY", icon: "🧩", subtitle: "Workflow Automation", isScreen: true },
    { match: /\b(python|typescript|javascript|codice|code)\b/i, title: "CODE ENGINE", tag: "DEV STACK", icon: "🐍", subtitle: "Automated Pipeline", isScreen: true },
    { match: /\b(whisper)\b/i, title: "WHISPER AI", tag: "ASR", icon: "🎙️", subtitle: "Millisecond Timings" },
    { match: /\b(terminal|terminale|command|cli)\b/i, title: "CLI / TERMINAL", tag: "TERMINAL", icon: "💻", subtitle: "Developer Environment", isScreen: true },
    { match: /\b(b-roll|broll|cutaway|animazion[ei]|motion)\b/i, title: "MOTION & B-ROLL", tag: "VISUAL PACING", icon: "✨", subtitle: "2.5D Ken Burns & Graphics" },
    { match: /\b(gratis|gratuit[ao]|free|open\s*source|github)\b/i, title: "100% OPEN SOURCE", tag: "FREE ACCESS", icon: "🔓", subtitle: "Zero Lock-In • Native DB" },
  ];

  // Unwrap SimilarVideoResult if passed directly, or automatically query the 100% native
  // RetentionVolt database so every edited video always benefits from RetentionVolt!
  const rawExplicitRv = opts.retentionvoltBlueprint as any;
  const explicitRv: RetentionVoltBlueprint | undefined =
    rawExplicitRv?.best_blueprint ?? rawExplicitRv;
  const hasExplicitRv = Boolean(explicitRv);

  const searchCorpus = [
    rawWords?.map((w) => fixWord(w.word)).join(" ") ?? "",
    structure.hook?.summary ?? "",
    ...structure.sections.map((s) => `${s.title ?? ""} ${s.summary ?? ""}`),
    ...(structure.keywords ?? []).slice(0, 15).map((k) => k.word),
  ]
    .join(" ")
    .trim();

  const rv: RetentionVoltBlueprint =
    explicitRv ??
    findSimilarVideoSync(searchCorpus || "high retention editing", {
      format,
      topK: 1,
    }).best_blueprint!;

  const shots: NonNullable<EditPlan["shots"]> = [];
  if (rv) {
    structure_notes.push({
      time: secToTimecode(0),
      note: `RetentionVolt blueprint applied (${rv.pattern_id ?? "curated pattern"}): heuristic guesswork bypassed. Proven animations and visual cues injected.`,
    });
    for (const note of rv.retention_notes ?? []) {
      structure_notes.push({ time: secToTimecode(0), note: `[RetentionVolt]: ${note}` });
    }
  }

  // Build default B-roll items FIRST so shots and B-roll overlays can share or coordinate assets
  const broll: EditPlan["broll"] = [];
  const defaultMotionVector = (
    motion: string
  ): NonNullable<EditPlan["broll"][number]["motion_vector"]> => {
    if (motion === "zoom_in_drift_right") {
      return { scale_start: 1.0, scale_end: 1.14, drift_x: 24, drift_y: -14, ease: "sine.inOut" };
    }
    if (motion === "zoom_in_drift_left") {
      return { scale_start: 1.0, scale_end: 1.14, drift_x: -24, drift_y: 14, ease: "sine.inOut" };
    }
    if (motion === "slow_pull_back") {
      return { scale_start: 1.14, scale_end: 1.02, drift_x: 18, drift_y: -10, ease: "sine.inOut" };
    }
    return { scale_start: 1.04, scale_end: 1.12, drift_x: 0, drift_y: -18, ease: "sine.inOut" };
  };

  if (opts.customBroll && opts.customBroll.length > 0) {
    for (let i = 0; i < opts.customBroll.length; i++) {
      const cb = opts.customBroll[i];
      const sSec = timecodeToSec(cb.start);
      const eSec = timecodeToSec(cb.end);
      if (eSec <= sSec) continue;
      const fitted = clampSpanToKeep(sSec, eSec);
      if (!fitted) continue;
      const camMotion =
        cb.camera_motion ?? (i % 2 === 0 ? "zoom_in_drift_right" : "zoom_in_drift_left");
      broll.push({
        start: secToTimecode(fitted.s),
        end: secToTimecode(fitted.e),
        source: cb.source,
        reason: cb.reason ?? "custom cutaway b-roll",
        prompt: cb.prompt,
        camera_motion: camMotion,
        motion_vector: cb.motion_vector ?? defaultMotionVector(camMotion),
      });
    }
  } else if (opts.brollSources && opts.brollSources.length > 0) {
    const sources = opts.brollSources;
    if (structure.cutaway_proposals && structure.cutaway_proposals.length > 0) {
      structure.cutaway_proposals.forEach((prop, i) => {
        if (i < sources.length) {
          const fitted = clampSpanToKeep(
            timecodeToSec(prop.start),
            timecodeToSec(prop.end)
          );
          if (!fitted) return;
          const camMotion =
            prop.camera_motion ?? (i % 2 === 0 ? "zoom_in_drift_right" : "zoom_in_drift_left");
          broll.push({
            start: secToTimecode(fitted.s),
            end: secToTimecode(fitted.e),
            source: sources[i % sources.length],
            reason: prop.reason || `b-roll cutaway: ${prop.topic}`,
            prompt: prop.suggested_prompt,
            camera_motion: camMotion,
            motion_vector: defaultMotionVector(camMotion),
          });
        }
      });
    } else if (structure.sections.length > 1) {
      structure.sections.slice(1).forEach((s, i) => {
        const sStart = timecodeToSec(s.start);
        const sEnd = timecodeToSec(s.end);
        if (sEnd - sStart >= 4) {
          const fitted = clampSpanToKeep(
            sStart + 1.2,
            Math.min(sStart + 5.0, sEnd - 0.3)
          );
          if (fitted) {
            const camMotion = i % 2 === 0 ? "zoom_in_drift_right" : "zoom_in_drift_left";
            broll.push({
              start: secToTimecode(fitted.s),
              end: secToTimecode(fitted.e),
              source: sources[i % sources.length],
              reason: `b-roll over section: ${s.title}`,
              camera_motion: camMotion,
              motion_vector: defaultMotionVector(camMotion),
            });
          }
        }
      });
    }
  } else if (structure.cutaway_proposals && structure.cutaway_proposals.length > 0) {
    // Auto-populate B-roll cutaways from analyzeTranscript's cutaway_proposals
    // so every video edit automatically includes 2.5D Ken Burns B-roll cutaways!
    structure.cutaway_proposals.forEach((prop, i) => {
      const fitted = clampSpanToKeep(
        timecodeToSec(prop.start),
        timecodeToSec(prop.end)
      );
      if (!fitted) return;
      const camMotion =
        prop.camera_motion ?? (i % 2 === 0 ? "zoom_in_drift_right" : "zoom_in_drift_left");
      broll.push({
        start: secToTimecode(fitted.s),
        end: secToTimecode(fitted.e),
        source: `./assets/cutaway_${i + 1}.svg`,
        reason: prop.reason || `2.5D B-roll cutaway: ${prop.topic}`,
        prompt:
          prop.suggested_prompt ||
          `Cinematic photorealistic 85mm photograph illustrating "${prop.topic}"`,
        camera_motion: camMotion,
        motion_vector: defaultMotionVector(camMotion),
      });
    });
  }

  // ——— Shots & Motion Animations ———
  const placedShotSpans: Array<{ s: number; e: number }> = [];
  const shotOverlaps = (s: number, e: number): boolean =>
    placedShotSpans.some((sh) => s < sh.e + 0.5 && e > sh.s - 0.5);

  if (rv?.events && rv.events.length > 0) {
    const refDuration = Math.max(...rv.events.map((e) => e.at_sec || 0), 30);
    for (const ev of rv.events) {
      try {
        let targetSec = (ev.at_sec / refDuration) * mediaEnd;
        if (ev.section_index && structure.sections[ev.section_index - 1]) {
          targetSec = timecodeToSec(structure.sections[ev.section_index - 1].start) + 0.3;
        }
        targetSec = Math.max(0, Math.min(mediaEnd - 1, targetSec));

        if (ev.type === "shot" && ev.shot_type) {
          // Only create max 4 shots for short videos, max 8 for long videos
          const maxShots = isShort ? 4 : 8;
          if (shots.length >= maxShots) continue;

          const wantedDur = Math.max(
            2.0,
            Math.min(ev.duration_sec ?? (isShort ? 3.2 : 5.0), mediaEnd - targetSec)
          );
          const fitted = clampSpanToKeep(targetSec, targetSec + wantedDur);
          if (!fitted || shotOverlaps(fitted.s, fitted.e)) continue;

          // If a B-roll overlay is already active at [fitted.s, fitted.e] and this shot is
          // b_roll_fullscreen, avoid duplicating the B-roll window
          const overlapsBroll = broll.some((b) => {
            const bs = timecodeToSec(b.start);
            const be = timecodeToSec(b.end);
            return fitted.s < be + 0.5 && fitted.e > bs - 0.5;
          });
          if (overlapsBroll && ev.shot_type === "b_roll_fullscreen") {
            continue;
          }

          const secObj = ev.section_index
            ? structure.sections[ev.section_index - 1]
            : structure.sections.find(
                (s) => timecodeToSec(s.start) <= fitted.s && fitted.s <= timecodeToSec(s.end)
              );
          let shotTitle = ev.text_source ?? secObj?.title ?? "Demonstration";
          let shotSub = ev.note ?? secObj?.summary?.slice(0, 60);

          // Semantic anchoring: if user spoke of a specific concept/tool around fitted.s
          const matchedPat = CONTEXT_VISUAL_PATTERNS.find((pat) =>
            rawWords?.some((w) => {
              const wt = getWordSec(w.start);
              return wt >= fitted.s - 1.5 && wt <= fitted.e + 1.5 && pat.match.test(w.word);
            })
          );
          if (matchedPat) {
            shotTitle = matchedPat.title;
            shotSub = matchedPat.subtitle ?? shotSub;
          }

          const matchedBroll = broll.find((cb) => {
            const cbStart = timecodeToSec(cb.start);
            return Math.abs(cbStart - fitted.s) < 4.0;
          });
          const shotIndex = shots.length;
          const assignedImage =
            ev.shot_type === "b_roll_fullscreen"
              ? matchedBroll?.source ??
                opts.customBroll?.[shotIndex]?.source ??
                opts.brollSources?.[shotIndex % (opts.brollSources?.length || 1)] ??
                `./assets/cutaway_${(shotIndex % Math.max(1, broll.length)) + 1}.svg`
              : opts.customBroll?.find(
                  (cb) => Math.abs(timecodeToSec(cb.start) - fitted.s) < 4.0
                )?.source ??
                opts.brollSources?.[shotIndex % (opts.brollSources?.length || 1)];

          placedShotSpans.push({ s: fitted.s, e: fitted.e });
          shots.push({
            start: secToTimecode(fitted.s),
            end: secToTimecode(fitted.e),
            shot_type: ev.shot_type,
            pip_position: ev.pip_position,
            pip_size_pct: ev.pip_size_pct,
            split_ratio: ev.split_ratio,
            title: shotTitle,
            subtitle: shotSub,
            media_url: assignedImage,
          });
        } else if (ev.type === "zoom" && hasExplicitRv) {
          const kind: MotionKind =
            ev.kind === "slow_zoom"
              ? "slow_zoom"
              : ev.kind === "zoom_out"
                ? "zoom_out"
                : "zoom_in";
          const dur = ev.kind === "slow_zoom" ? (ev.duration_sec ?? 4) : undefined;
          const placed = pushMotion(targetSec, kind, dur, `RetentionVolt ${kind}`);
          if (placed !== null && kind === "slow_zoom" && ev.direction) {
            const last = animations[animations.length - 1];
            if (last && last.type === "slow_zoom") last.direction = ev.direction;
          }
        } else if (ev.type === "animation") {
          if (isKept(targetSec) && !nearCutStart(targetSec)) {
            animations.push({
              time: secToTimecode(targetSec),
              type: "lower_third",
              duration: ev.duration_sec ?? 3,
              content: ev.text_source ?? structure.hook?.summary,
              position: ev.position === "top" ? "top" : "bottom",
            });
          }
        }
      } catch {
        /* skip invalid event */
      }
    }
  }

  if (hasExplicitRv && rv?.animations && rv.animations.length > 0 && !(rv.events && rv.events.some((e) => e.type === "zoom"))) {
    // Explicit v1 Legacy blueprint animations
    for (const anim of rv.animations) {
      try {
        const t = timecodeToSec(anim.time);
        if (anim.type === "slow_zoom" || anim.type === "zoom_in" || anim.type === "zoom_out") {
          const placed = pushMotion(t, anim.type, anim.duration, `RetentionVolt ${anim.type}`);
          if (placed !== null && anim.type === "slow_zoom" && anim.direction) {
            const last = animations[animations.length - 1];
            if (last && last.type === "slow_zoom") last.direction = anim.direction;
          }
        } else {
          if (isKept(t) && !nearCutStart(t)) {
            animations.push({ ...anim });
          }
        }
      } catch {
        /* skip invalid timecode */
      }
    }
  }

  // Always ensure section-boundary slow_zooms (opens each new act, i > 0)
  // AND dynamic zoom_in / zoom_out punches so NO video ever has 0 zoom animations!
  structure.sections.forEach((s, i) => {
    if (i === 0) return; // first section opens on the hook
    const sStart = timecodeToSec(s.start);
    const sEnd = timecodeToSec(s.end);
    const dur = Math.min(12, Math.max(3, sEnd - sStart - 1));
    if (dur >= 3 && !hasExplicitRv) {
      const want = sStart + 0.5;
      const placed = pushMotion(want, "slow_zoom", dur, `slow_zoom (act "${s.title}")`);
      if (placed !== null) {
        const last = animations[animations.length - 1];
        if (last && last.type === "slow_zoom")
          last.direction = i % 2 === 0 ? "in" : "out";
      }
    }
  });

  // If explicit blueprint had events with NO zooms (like uJdjKOBikTE in IMG_0790 3),
  // or if no zoom animations exist yet, inject section-boundary slow_zooms + punch zooms!
  const hasAnyZoom = animations.some(
    (a) => a.type === "slow_zoom" || a.type === "zoom_in" || a.type === "zoom_out"
  );
  if (!hasAnyZoom) {
    structure.sections.forEach((s, i) => {
      if (i === 0 && structure.sections.length > 1) return;
      const sStart = timecodeToSec(s.start);
      const sEnd = timecodeToSec(s.end);
      const dur = Math.min(8, Math.max(3, sEnd - sStart - 1));
      if (dur >= 3) {
        const want = i === 0 ? Math.min(3.5, mediaEnd * 0.2) : sStart + 0.5;
        const placed = pushMotion(want, "slow_zoom", dur, `RetentionVolt slow_zoom (act "${s.title}")`);
        if (placed !== null) {
          const last = animations[animations.length - 1];
          if (last && last.type === "slow_zoom")
            last.direction = i % 2 === 0 ? "in" : "out";
        }
      }
    });
  }

  for (const spot of structure.slow_spots ?? []) {
    const t = timecodeToSec(spot.start);
    if (isSceneChange(t) || isShort) {
      pushMotion(t, "zoom_in", undefined, `zoom_in (slow spot: ${spot.reason})`);
    }
  }
  for (const d of (structure.attention_dips ?? []).slice(0, 10)) {
    const t = timecodeToSec(d.start);
    if (isSceneChange(t)) {
      pushMotion(t, "zoom_in", undefined, `zoom_in (attention dip: ${d.reason})`);
    }
  }

  // Ensure punch-in / punch-out dynamic zoom accents on key moments across every video
  if (!(hasExplicitRv && explicitRv?.animations && explicitRv.animations.length > 0 && !explicitRv?.events)) {
    const zoomTargets = [0.15, 0.42, 0.72].map((f) => Math.round(mediaEnd * f * 10) / 10);
    zoomTargets.forEach((zt, idx) => {
      pushMotion(
        zt,
        idx % 2 === 0 ? "zoom_in" : "zoom_out",
        undefined,
        `RetentionVolt dynamic ${idx % 2 === 0 ? "zoom_in" : "zoom_out"}`
      );
    });
  }

  animations.sort((a, b) => timecodeToSec(a.time) - timecodeToSec(b.time));

  // Pattern interrupts on cadence (register-measured: show ~2s,
  // educational ~5s, tutorial ~20s, podcast ~60s, short ~4s)…
  // …skipped inside CUT ranges and inside the pre-cut mask (same rule).
  // FOOTAGE GATE: single_take (default) gets caption_pop ONLY — no
  // zoom_punch, no fake shot-change energy.
  const mode = footageMode(opts.takesCount);
  const pattern_interrupts: EditPlan["pattern_interrupts"] = [];

  if (
    hasExplicitRv &&
    rv?.pattern_interrupts &&
    rv.pattern_interrupts.length > 0 &&
    !(rv.events && rv.events.some((e) => e.type === "graphic" && e.graphic_kind === "caption_pop"))
  ) {
    for (const pi of rv.pattern_interrupts) {
      try {
        const t = timecodeToSec(pi.time);
        if (t >= 0 && t < mediaEnd - 0.5 && isKept(t) && !nearCutStart(t) && isClearOfAllCuts(t)) {
          const kind =
            mode === "single_take" && pi.kind === "zoom_punch"
              ? "caption_pop"
              : pi.kind;
          pattern_interrupts.push({ ...pi, kind });
        }
      } catch {
        /* skip invalid timecode */
      }
    }
  }

  // Always run the register cadence loop so pattern_interrupts is NEVER empty
  // (even when a blueprint event falls inside a CUT range) and always honors
  // the selected style register cadence.
  for (let t = every; t < endSec; t += every) {
    if (!isKept(t) || nearCutStart(t) || !isClearOfAllCuts(t)) continue;
    const alreadyNear = pattern_interrupts.some(
      (p) => Math.abs(timecodeToSec(p.time) - t) < Math.min(1.5, every * 0.4)
    );
    if (alreadyNear) continue;
    const kind =
      isShort || mode === "single_take"
        ? "caption_pop"
        : isSceneChange(t)
          ? "zoom_punch"
          : "caption_pop";
    pattern_interrupts.push({
      time: secToTimecode(t),
      kind,
      detail: `interrupt every ~${every}s`,
    });
  }

  // Also inject explicit blueprint caption_pop events if any slot is uncovered
  if (hasExplicitRv) {
    const rvPopEvents =
      rv?.events?.filter((e) => e.type === "graphic" && e.graphic_kind === "caption_pop") ?? [];
    if (rvPopEvents.length > 0) {
      const refDuration = Math.max(...(rv?.events?.map((e) => e.at_sec || 0) ?? [60]), 30);
      for (const pop of rvPopEvents) {
        try {
          let t = (pop.at_sec / refDuration) * mediaEnd;
          if (pop.section_index && structure.sections[pop.section_index - 1]) {
            t = timecodeToSec(structure.sections[pop.section_index - 1].start) + 0.3;
          }
          t = Math.max(0.5, Math.min(mediaEnd - 1, t));
          if (
            isKept(t) &&
            !nearCutStart(t) &&
            isClearOfAllCuts(t) &&
            !pattern_interrupts.some((p) => Math.abs(timecodeToSec(p.time) - t) < 1.5)
          ) {
            pattern_interrupts.push({
              time: secToTimecode(t),
              kind: "caption_pop",
              detail: "RetentionVolt caption pop",
            });
          }
        } catch {
          /* skip invalid pop event */
        }
      }
    }
  }

  // …plus one dedicated interrupt per risk point (midpoint), so every
  // attention_risk_point from analysis gets coverage (see checklist).
  const agentRisk = new Set(
    (opts.attentionRiskPoints ?? []).map((r) => `${r.start}|${r.end}`)
  );
  const riskPoints = [
    ...(structure.attention_risk_points ?? []),
    ...(opts.attentionRiskPoints ?? []),
  ];
  for (const r of riskPoints) {
    const s = timecodeToSec(r.start);
    const e = timecodeToSec(r.end);
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) continue;
    const mid = (s + e) / 2;
    if (!isKept(mid) || nearCutStart(mid) || !isClearOfAllCuts(mid)) continue;
    const covered = pattern_interrupts.some(
      (p) => Math.abs(timecodeToSec(p.time) - mid) < every / 2
    );
    if (covered) continue;
    const fromAgent = agentRisk.has(`${r.start}|${r.end}`);
    const kind =
      isShort || mode === "single_take"
        ? "caption_pop"
        : fromAgent || isSceneChange(mid)
          ? "zoom_punch"
          : "caption_pop";
    pattern_interrupts.push({
      time: secToTimecode(mid),
      kind,
      detail: `risk-point coverage: ${r.reason}`,
    });
  }
  pattern_interrupts.sort(
    (a, b) => timecodeToSec(a.time) - timecodeToSec(b.time)
  );

  // ——— Content-aware graphics (v1.3): ALWAYS enabled by default ———
  // Combines RetentionVolt blueprint graphics with semantic transcript triggers
  // (tools/concepts spoken in speech, spoken numbers, section act titles, top keywords)
  // while strictly enforcing max 1 banner at a time on both source and spliced timelines.
  const disableGraphics = opts.disableGraphics ?? false;
  const graphics: GraphicBeat[] = [];
  const graphicSpans: Array<{ s: number; e: number; tlS: number; tlE: number }> = [];

  const srcToTlForGfx = (src: number): number | null => {
    let tlAcc = 0;
    for (const k of keepIntervals) {
      if (src >= k.s && src < k.e) return tlAcc + (src - k.s);
      tlAcc += k.e - k.s;
    }
    return keepIntervals.length === 0 ? src : null;
  };

  const claimGraphic = (t: number, dur: number): boolean => {
    if (disableGraphics) return false;
    if (t < 0 || t + 1 > mediaEnd) return false;
    if (!isKept(t) || nearCutStart(t) || !isClearOfAllCuts(t)) return false;
    const tl = srcToTlForGfx(t);
    if (tl === null) return false;
    if (
      graphicSpans.some(
        (g) =>
          (t < g.e + 0.12 && t + dur > g.s - 0.12) ||
          (tl < g.tlE + 0.12 && tl + dur > g.tlS - 0.12)
      )
    ) {
      return false;
    }
    graphicSpans.push({ s: t, e: t + dur, tlS: tl, tlE: tl + dur });
    return true;
  };

  const placeGraphic = (wantedT: number, dur: number): number | null => {
    if (disableGraphics) return null;
    const offsets = [0, 0.4, -0.4, 0.8, -0.8, 1.4, -1.4, 2.0, -2.0, 2.8, -2.8, 3.6, -3.6];
    for (const off of offsets) {
      const cand = Math.round((wantedT + off) * 100) / 100;
      if (cand >= 0.2 && cand + 1 <= mediaEnd && claimGraphic(cand, dur)) {
        return cand;
      }
    }
    return null;
  };

  const contentWords = (text?: string): string[] =>
    (text ?? "").split(/\s+/).filter((w) => {
      const c = w.toLowerCase().replace(/[.,!?;:]+$/, "");
      return c.length > 0 && !CONTENT_STOP.has(c);
    });

  // 1. Explicit legacy v1 blueprint graphics (if passed directly in opts.retentionvoltBlueprint.graphics)
  if (hasExplicitRv && rv?.graphics && rv.graphics.length > 0 && !(rv.events && rv.events.length > 0)) {
    for (const g of rv.graphics) {
      try {
        const t = timecodeToSec(g.time);
        const dur = Math.max(1, Math.min(8, Number(g.duration) || 2.6));
        const placedT = placeGraphic(t, dur);
        if (placedT !== null) {
          graphics.push({ ...g, time: secToTimecode(placedT), duration: dur });
        }
      } catch {
        /* skip invalid timecode */
      }
    }
  }

  // 2. Contextual Screen Overlays & Tool Badges based on transcript words (Priority semantic triggers)
  for (const pat of CONTEXT_VISUAL_PATTERNS) {
    if (graphics.length >= (isShort ? 5 : 8)) break;
    const matchWord = rawWords?.find((w) => pat.match.test(fixWord(w.word)));
    if (matchWord) {
      const wantedT = getWordSec(matchWord.start);
      const dur = pat.isScreen ? 2.6 : 2.2;
      const placedT = placeGraphic(wantedT, dur);
      if (placedT !== null) {
        graphics.push({
          time: secToTimecode(placedT),
          kind: pat.isScreen ? "quote" : "highlight",
          title: pat.title,
          subtitle: pat.subtitle,
          tag: pat.tag,
          icon: pat.icon,
          duration: dur,
          position: isShort ? "center" : "top",
        });
      }
    }
  }

  // 3. RetentionVolt Blueprint Graphic Events (act_title_banner, number_stat, lower_third, screen_highlight_box)
  const rvGraphicEvents =
    rv?.events?.filter((e) => e.type === "graphic" && e.graphic_kind !== "caption_pop") ?? [];
  if (rvGraphicEvents.length > 0) {
    const refDuration = Math.max(...(rv?.events?.map((e) => e.at_sec || 0) ?? [60]), 30);
    for (const ge of rvGraphicEvents) {
      if (graphics.length >= (isShort ? 5 : 8)) break;
      try {
        let wantedT = (ge.at_sec / refDuration) * mediaEnd;
        if (ge.section_index && structure.sections[ge.section_index - 1]) {
          wantedT = timecodeToSec(structure.sections[ge.section_index - 1].start) + 0.3;
        }
        wantedT = Math.max(0.2, Math.min(mediaEnd - 1.2, wantedT));
        const dur = Math.max(1.5, Math.min(4.0, ge.duration_sec ?? 2.4));

        let title = "";
        let kind: GraphicBeat["kind"] = "act_title";

        if (ge.graphic_kind === "act_title_banner") {
          kind = "act_title";
          if (ge.section_index && structure.sections[ge.section_index - 1]) {
            const sec = structure.sections[ge.section_index - 1];
            const sumText = sec.summary || sec.title || "";
            const words = contentWords(fixWord(sumText)).slice(0, 6);
            title = words.join(" ").toUpperCase().slice(0, 48) || sec.title;
          } else {
            const sec = structure.sections.find(
              (s) => timecodeToSec(s.start) <= wantedT && wantedT <= timecodeToSec(s.end)
            );
            const sumText = sec ? (sec.summary || sec.title || "") : "";
            title = sumText
              ? contentWords(fixWord(sumText)).slice(0, 6).join(" ").toUpperCase()
              : "HIGHLIGHT";
          }
        } else if (ge.graphic_kind === "number_stat") {
          const numKw = (structure.keywords ?? [])
            .filter((k) => /\d/.test(k.word))
            .sort(
              (a, b) =>
                Math.abs(timecodeToSec(a.start) - wantedT) -
                Math.abs(timecodeToSec(b.start) - wantedT)
            )[0];
          if (numKw) {
            kind = "number_stat";
            title = fixWord(numKw.word).toUpperCase().slice(0, 48);
          } else {
            kind = "highlight";
            const topKw = (structure.keywords ?? [])[0];
            title = topKw ? fixWord(topKw.word).toUpperCase().slice(0, 40) : "100% RETENTION";
          }
        } else if (ge.graphic_kind === "lower_third") {
          kind = "quote";
          const rawTitle = fixWord(
            ge.text_source ?? structure.hook_moment?.text ?? structure.sections[0]?.summary ?? ""
          );
          title = contentWords(rawTitle).slice(0, 6).join(" ").toUpperCase().slice(0, 48) || rawTitle.slice(0, 48);
        } else {
          kind = "highlight";
          const nearestKw = (structure.keywords ?? []).sort(
            (a, b) =>
              Math.abs(timecodeToSec(a.start) - wantedT) -
              Math.abs(timecodeToSec(b.start) - wantedT)
          )[0];
          title = nearestKw ? fixWord(nearestKw.word).toUpperCase().slice(0, 40) : "KEY INSIGHT";
        }

        let tag =
          ge.graphic_kind === "act_title_banner"
            ? ge.section_index
              ? `PARTE ${ge.section_index}`
              : "CAPITOLO"
            : ge.graphic_kind === "number_stat"
              ? "METRIC"
              : "RETENTIONVOLT";
        let icon: string | undefined =
          ge.graphic_kind === "number_stat"
            ? "📊"
            : ge.graphic_kind === "act_title_banner"
              ? "🎯"
              : "⚡";
        let subtitle: string | undefined = undefined;

        const matchedPat = CONTEXT_VISUAL_PATTERNS.find((pat) =>
          rawWords?.some((w) => {
            const wt = getWordSec(w.start);
            return wt >= wantedT - 1.5 && wt <= wantedT + dur + 1.5 && pat.match.test(fixWord(w.word));
          })
        );
        if (matchedPat && ge.graphic_kind !== "act_title_banner" && ge.graphic_kind !== "number_stat") {
          title = matchedPat.title;
          subtitle = matchedPat.subtitle;
          tag = matchedPat.tag;
          icon = matchedPat.icon;
          kind = matchedPat.isScreen ? "quote" : "highlight";
        }

        if (title) {
          const placedT = placeGraphic(wantedT, dur);
          if (placedT !== null) {
            graphics.push({
              time: secToTimecode(placedT),
              kind,
              title,
              subtitle,
              tag,
              icon,
              duration: dur,
            });
          }
        }
      } catch {
        /* skip invalid graphic event */
      }
    }
  }

  // 4. Spoken numbers & statistics (high-retention hooks)
  const numKws = (structure.keywords ?? [])
    .filter((k) => /\d/.test(k.word))
    .slice(0, 2);
  for (const k of numKws) {
    if (graphics.length >= (isShort ? 5 : 8)) break;
    const wantedT = timecodeToSec(k.start);
    const dur = 2.4;
    const placedT = placeGraphic(wantedT, dur);
    if (placedT !== null) {
      graphics.push({
        time: secToTimecode(placedT),
        kind: "number_stat",
        title: fixWord(k.word).toUpperCase().slice(0, 48),
        duration: dur,
        tag: "STAT",
        icon: "📊",
      });
    }
  }

  // 5. Section openings (act titles) — ensure sections have act banners when room exists
  let actCount = graphics.filter((g) => g.kind === "act_title").length;
  for (let i = 0; i < structure.sections.length && actCount < 3; i++) {
    if (graphics.length >= (isShort ? 5 : 8)) break;
    const sec = structure.sections[i];
    const sStart = timecodeToSec(sec.start);
    const sumText = sec.summary || sec.title || "";
    const words = contentWords(fixWord(sumText)).slice(0, 6);
    if (words.length === 0) continue;
    const wantedT = sStart + 0.3;
    const dur = 2.4;
    const placedT = placeGraphic(wantedT, dur);
    if (placedT !== null) {
      graphics.push({
        time: secToTimecode(placedT),
        kind: "act_title",
        title: words.join(" ").toUpperCase().slice(0, 48) || sec.title,
        subtitle: sec.title !== sec.summary ? sec.title : undefined,
        duration: dur,
        tag: `PARTE ${i + 1}`,
      });
      actCount++;
    }
  }

  // 6. Top keyword highlights if we still have fewer than 3 graphics
  if (graphics.length < 3) {
    for (const kw of (structure.keywords ?? []).slice(0, 6)) {
      if (graphics.length >= 4) break;
      const wantedT = timecodeToSec(kw.start);
      const dur = 2.2;
      const placedT = placeGraphic(wantedT, dur);
      if (placedT !== null) {
        graphics.push({
          time: secToTimecode(placedT),
          kind: "highlight",
          title: fixWord(kw.word).toUpperCase().slice(0, 40),
          tag: "KEY POINT",
          icon: "✨",
          duration: dur,
        });
      }
    }
  }

  graphics.sort((a, b) => timecodeToSec(a.time) - timecodeToSec(b.time));
  if (disableGraphics && graphics.length === 0) {
    structure_notes.push({
      time: secToTimecode(0),
      note: "graphics disabled: pass disableGraphics:false to enable motion graphic banners",
    });
  }

  if (downgraded) {
    structure_notes.push({
      time: secToTimecode(0),
      note:
        `style "show" requested but takesCount=${opts.takesCount ?? 1} ` +
        `(single_take): downgraded to "educational" cadence (~5s). ` +
        `MrBeast rhythm needs real coverage (≥2 takes / B-roll). ` +
        `Pass takesCount: N to unlock show rhythm.`,
    });
  }

  const keptWords = rawWords
    ? rawWords.filter((w) => isKept(getWordSec(w.start))).length
    : undefined;

  const thumbnail = opts.thumbnail
    ? { ...opts.thumbnail }
    : hasExplicitRv && !explicitRv?.thumbnail
      ? {
          title: fixWord(structure.hook?.summary ?? "").slice(0, 40) || "Highlights",
          badge: "HIGH RETENTION",
          frame_time:
            structure.hook_moment?.start ?? structure.hook?.start ?? "00:00:02.000",
          style: "bold" as const,
        }
      : rv?.thumbnail
        ? { ...rv.thumbnail }
        : {
            title: fixWord(structure.hook?.summary ?? "").slice(0, 40) || "Highlights",
            badge: "HIGH RETENTION",
            frame_time:
              structure.hook_moment?.start ?? structure.hook?.start ?? "00:00:02.000",
            style: "bold" as const,
          };

  if (opts.shots && opts.shots.length > 0) {
    shots.push(...opts.shots);
  }
  shots.sort((a, b) => timecodeToSec(a.start) - timecodeToSec(b.start));

  return {
    version: "1.3",
    style,
    format,
    media_id: structure.media_id,
    cuts,
    animations,
    broll,
    pattern_interrupts,
    speech:
      keptWords !== undefined && mediaEnd > 0
        ? {
            wpm: Math.round((keptWords / (mediaEnd / 60)) * 10) / 10,
            totalWords: keptWords,
          }
        : structure.speech,
    takesCount: opts.takesCount ?? 1,
    resolvedRegister: register,
    graphics: graphics.length > 0 ? graphics : undefined,
    structure_notes: structure_notes.length > 0 ? structure_notes : undefined,
    review_cuts: reviewCuts.length > 0 ? reviewCuts : undefined,
    shots: shots.length > 0 ? shots : undefined,
    retentionvolt_applied: true,
    thumbnail,
  };
}

/** Stopwords for banner titles (banner = content words only). */
const CONTENT_STOP = new Set([
  "il", "lo", "la", "i", "gli", "le", "di", "a", "da", "in", "con", "su",
  "per", "tra", "fra", "e", "ed", "o", "ma", "che", "cui", "non", "si",
  "ci", "ne", "come", "questo", "questa", "questi", "queste", "quello",
  "quella", "anche", "solo", "molto", "tutto", "tutti", "del", "della",
  "dei", "delle", "al", "alla", "dal", "nella", "sul", "hai", "ho",
  "sono", "era", "the", "a", "an", "of", "to", "and", "or", "but",
  "in", "on", "with", "for", "is", "are", "was", "were", "be", "it",
  "this", "that", "these", "those", "you", "your", "we", "our", "they",
  "their", "have", "has", "will", "would", "can", "could", "just",
]);
