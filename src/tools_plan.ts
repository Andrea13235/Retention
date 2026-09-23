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
} from "./types.js";

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

  // ——— Karaoke captions: ONLY kept words, corrected text ———
  const fixWord = (w: string): string => {
    let out = w;
    for (const c of opts.corrections ?? []) {
      const esc = c.misheard.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`(^|\\s)${esc}(?=\\s|$|[.,!?;:])`, "gi"), (_, pre) => `${pre}${c.correct}`);
    }
    return out;
  };

  // ——— Karaoke captions with keyword emphasis ———
  const kwSet = new Set(
    (structure.keywords ?? []).slice(0, 15).map((k) => k.word)
  );
  const animations: EditPlan["animations"] = [];
  const structure_notes: EditPlan["structure_notes"] = [];
  if (transcriptWords && transcriptWords.length > 0) {
    // Drop CUT words first: only kept words reach captions.
    const kept = transcriptWords
      .map((w) => ({ ...w, word: fixWord(w.word) }))
      .filter((w) => isKept(timecodeToSec(w.start)));
    // Build raw cards first (maxWords each), then assign durations so
    // cards NEVER overlap: each card ends when the next begins (minus a
    // breath gap). One caption alive at a time — guaranteed by
    // construction, whatever the splice did to the clock.
    const rawCards: Array<{ start: number; words: typeof kept }> = [];
    let cur: (typeof rawCards)[number] | null = null;
    for (const w of kept) {
      if (!cur || cur.words.length >= maxWords) {
        cur = { start: timecodeToSec(w.start), words: [] };
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
      const lastStart = timecodeToSec(card.words[card.words.length - 1].start);
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
          start: w.start,
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
    const ok = motionSpanAllowed(wanted, kind, duration, mergedCuts);
    if (ok.ok && isKept(wanted)) {
      animations.push({ time: secToTimecode(wanted), type: kind, target: "face", ...(kind === "slow_zoom" ? { direction: "in" as const, intensity: isShort ? 2 : 3, duration: Math.max(1, Math.min(duration ?? 8, 30)) } : {}) });
      return wanted;
    }
    const skipReason = !isKept(wanted) ? "inside a CUT range" : (ok.reason ?? "cut-adjacent");
    for (let d = 1; d <= 6; d++) {
      for (const t of [Math.floor(wanted) - d, Math.ceil(wanted) + d]) {
        if (t < 0 || t > mediaEnd) continue;
        if (!isKept(t)) continue;
        if (motionSpanAllowed(t, kind, duration, mergedCuts).ok) {
          animations.push({ time: secToTimecode(t), type: kind, target: "face", ...(kind === "slow_zoom" ? { direction: "in" as const, intensity: isShort ? 2 : 3, duration: Math.max(1, Math.min(duration ?? 8, 30)) } : {}) });
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
      if (clamped >= 3 && motionSpanAllowed(wanted, kind, clamped, mergedCuts).ok && isKept(wanted)) {
        animations.push({ time: secToTimecode(wanted), type: kind, target: "face", direction: "in" as const, intensity: isShort ? 2 : 3, duration: Math.round(clamped * 10) / 10 });
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

  const rv = opts.retentionvoltBlueprint;
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

  // Motion & visual animations:
  // Priority 1: v2 Blueprint events (timeline-level events with semantic anchors)
  if (rv?.events && rv.events.length > 0) {
    const refDuration = Math.max(...rv.events.map((e) => e.at_sec || 0), 60);
    for (const ev of rv.events) {
      try {
        let targetSec = (ev.at_sec / refDuration) * mediaEnd;
        if (ev.section_index && structure.sections[ev.section_index - 1]) {
          targetSec = timecodeToSec(structure.sections[ev.section_index - 1].start) + 0.3;
        }
        targetSec = Math.max(0, Math.min(mediaEnd - 1, targetSec));

        if (ev.type === "shot" && ev.shot_type) {
          const shotDur = Math.max(2, Math.min(ev.duration_sec ?? 8, mediaEnd - targetSec));
          shots.push({
            start: secToTimecode(targetSec),
            end: secToTimecode(targetSec + shotDur),
            shot_type: ev.shot_type,
            pip_position: ev.pip_position,
            pip_size_pct: ev.pip_size_pct,
            split_ratio: ev.split_ratio,
          });
        } else if (ev.type === "zoom") {
          const kind: MotionKind = ev.kind === "slow_zoom" ? "slow_zoom" : ev.kind === "zoom_out" ? "zoom_out" : "zoom_in";
          const dur = ev.kind === "slow_zoom" ? (ev.duration_sec ?? 8) : undefined;
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
  } else if (rv?.animations && rv.animations.length > 0) {
    // Priority 2: v1 Legacy blueprint animations
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
  } else {
    // Standard local heuristics:
    // Scene-change emphasis ONLY: a slow_zoom opens a new act (section
    // boundary = genuine change of scene/topic, coherent by definition).
    // Mid-act motion is restraint: no drift over continuous speech.
    // Placed cuts-first via pushMotion: the full span must clear every CUT
    // edge (pre-mask + post-settle + no crossing) or it relocates/clamps.
    structure.sections.forEach((s, i) => {
      if (i === 0) return; // first section opens on the hook — no zoom needed
      const sStart = timecodeToSec(s.start);
      const sEnd = timecodeToSec(s.end);
      const dur = Math.min(12, Math.max(3, sEnd - sStart - 1));
      if (dur >= 3) {
        const want = sStart + 0.5;
        const placed = pushMotion(want, "slow_zoom", dur, `slow_zoom (act "${s.title}")`);
        if (placed !== null) {
          const last = animations[animations.length - 1];
          if (last && last.type === "slow_zoom")
            last.direction = i % 2 === 0 ? "in" : "out";
        }
      }
    });
    for (const spot of structure.slow_spots ?? []) {
      const t = timecodeToSec(spot.start);
      if (isSceneChange(t)) {
        pushMotion(t, "zoom_in", undefined, `zoom_in (slow spot: ${spot.reason})`);
      }
    }
    for (const d of structure.attention_dips.slice(0, 10)) {
      const t = timecodeToSec(d.start);
      if (isSceneChange(t)) {
        pushMotion(t, "zoom_in", undefined, `zoom_in (attention dip: ${d.reason})`);
      }
    }
  }
  animations.sort((a, b) => timecodeToSec(a.time) - timecodeToSec(b.time));

  // B-roll: spread sources across middle sections.
  const broll: EditPlan["broll"] = [];
  const sources = opts.brollSources ?? [];
  if (sources.length > 0 && structure.sections.length > 1) {
    structure.sections.slice(1, -1).forEach((s, i) => {
      const sStart = timecodeToSec(s.start);
      const sEnd = timecodeToSec(s.end);
      if (sEnd - sStart >= 8) {
        broll.push({
          start: secToTimecode(sStart + 2),
          end: secToTimecode(Math.min(sStart + 12, sEnd)),
          source: sources[i % sources.length],
          reason: `b-roll over section: ${s.title}`,
        });
      }
    });
  }

  // Pattern interrupts on cadence (register-measured: show ~2s,
  // educational ~5s, tutorial ~20s, podcast ~60s, short ~4s)…
  // …skipped inside CUT ranges and inside the pre-cut mask (same rule).
  // FOOTAGE GATE: single_take (default) gets caption_pop ONLY — no
  // zoom_punch, no fake shot-change energy. There is one camera and one
  // take: punching every 2s on the same frame reads as a glitch, not
  // energy. multi_take unlocks zoom_punch on scene changes / agent risk.
  const mode = footageMode(opts.takesCount);
  const pattern_interrupts: EditPlan["pattern_interrupts"] = [];

  const rvPopEvents = rv?.events?.filter((e) => e.type === "graphic" && e.graphic_kind === "caption_pop") ?? [];
  if (rvPopEvents.length > 0) {
    const refDuration = Math.max(...(rv?.events?.map((e) => e.at_sec || 0) ?? [60]), 60);
    for (const pop of rvPopEvents) {
      try {
        let t = (pop.at_sec / refDuration) * mediaEnd;
        if (pop.section_index && structure.sections[pop.section_index - 1]) {
          t = timecodeToSec(structure.sections[pop.section_index - 1].start) + 0.3;
        }
        t = Math.max(0, Math.min(mediaEnd - 1, t));
        if (isKept(t) && !nearCutStart(t)) {
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
  } else if (rv?.pattern_interrupts && rv.pattern_interrupts.length > 0) {
    for (const pi of rv.pattern_interrupts) {
      try {
        const t = timecodeToSec(pi.time);
        if (isKept(t) && !nearCutStart(t)) {
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
  } else {
    for (let t = every; t < endSec; t += every) {
      if (!isKept(t) || nearCutStart(t)) continue;
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
  }

  // …plus one dedicated interrupt per risk point (midpoint), so every
  // attention_risk_point from analysis gets coverage (see checklist).
  // Explicit agent attentionRiskPoints are genuine scene-change judgments:
  // they may carry a zoom_punch even mid-act. Heuristic risk points from
  // analysis only get a caption_pop (never motion) unless they coincide
  // with a section boundary — motion must stay coherent, never a cover-up.
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
    if (!isKept(mid) || nearCutStart(mid)) continue;
    const covered = pattern_interrupts.some(
      (p) => Math.abs(timecodeToSec(p.time) - mid) < every / 2
    );
    if (covered) continue;
    const fromAgent = agentRisk.has(`${r.start}|${r.end}`);
    // Agent risk points may carry zoom_punch ONLY with real coverage
    // (multi_take): on a single take even an agent-flagged moment gets
    // caption_pop — the punch would land on the same frame as everything.
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

  // ——— Content-aware graphics (v1.3): WHAT is said decides the banner ———
  // Max 1 banner alive at a time (checked below), TOP position (renderer),
  // text ALWAYS transcript-verbatim. Four kinds, each with its trigger:
  // 1. act_title — each new act opens with its own words (video-4 "3 STEPS"
  //    banner). Title = section's first ≤6 content words (stopwords cut,
  //    UPPERCASED for the banner look). Max 3 banners per video: titles
  //    are emphasis — the 4th act doesn't need a hat.
  // 2. number_stat — a spoken number/stat worth READING, not just hearing
  //    (video-3 "$3,000/MONTH"). Trigger: keyword containing a digit with
  //    score in the top 10. Title = the number + its ≤3-word context
  //    ("$3,000 / MONTH"). Max 2: numbers are rare by nature.
  // 3. highlight — a top keyword as a context label (MrBeast "MIDDLE OF
  //    NOWHERE"). Trigger: top-5 non-numeric keyword, only when no
  //    number_stat fired within ±20s (labels and numbers don't stack).
  // 4. quote — the hook's most quotable line replayed ONCE past midpoint
  //    (guide §5.4 visual recap for >8min). Trigger: hook_moment exists
  //    AND media >8min. Title = hook_moment.text (≤90 chars).
  // ALL beats are dropped when: inside a CUT range, inside the 0.8s
  // pre-cut mask, overlapping another banner, or shorter than 1s of KEEP.
  const hasRvGraphics =
    (rv?.graphics && rv.graphics.length > 0) ||
    (rv?.events && rv.events.some((e) => e.type === "graphic" && e.graphic_kind !== "caption_pop"));

  const disableGraphics =
    opts.disableGraphics ??
    (!hasRvGraphics ? footageMode(opts.takesCount) === "single_take" : false);
  const graphics: GraphicBeat[] = [];
  const graphicSpans: Array<{ s: number; e: number }> = [];
  const claimGraphic = (t: number, dur: number): boolean => {
    if (disableGraphics) return false;
    if (!isKept(t) || nearCutStart(t)) return false;
    if (t + 1 > mediaEnd) return false;
    if (graphicSpans.some((g) => t < g.e && t + dur > g.s)) return false;
    graphicSpans.push({ s: t, e: t + dur });
    return true;
  };
  const contentWords = (text: string): string[] =>
    text.split(/\s+/).filter((w) => {
      const c = w.toLowerCase().replace(/[.,!?;:]+$/, "");
      return c.length > 0 && !CONTENT_STOP.has(c);
    });
  // 1. act titles / RetentionVolt graphics (v2 events or legacy v1)
  const rvGraphicEvents = rv?.events?.filter((e) => e.type === "graphic" && e.graphic_kind !== "caption_pop") ?? [];
  if (rvGraphicEvents.length > 0) {
    const refDuration = Math.max(...(rv?.events?.map((e) => e.at_sec || 0) ?? [60]), 60);
    for (const ge of rvGraphicEvents) {
      try {
        let t = (ge.at_sec / refDuration) * mediaEnd;
        if (ge.section_index && structure.sections[ge.section_index - 1]) {
          t = timecodeToSec(structure.sections[ge.section_index - 1].start) + 0.3;
        }
        t = Math.max(0, Math.min(mediaEnd - 1, t));
        const dur = Math.max(1, Math.min(8, ge.duration_sec ?? 2.5));

        let title = "";
        let kind: GraphicBeat["kind"] = "act_title";

        if (ge.graphic_kind === "act_title_banner") {
          kind = "act_title";
          if (ge.section_index && structure.sections[ge.section_index - 1]) {
            const sec = structure.sections[ge.section_index - 1];
            const words = contentWords(fixWord(sec.summary)).slice(0, 6);
            title = words.join(" ").toUpperCase().slice(0, 48) || sec.title;
          } else {
            const sec = structure.sections.find((s) => timecodeToSec(s.start) <= t && t <= timecodeToSec(s.end));
            title = sec ? contentWords(fixWord(sec.summary)).slice(0, 6).join(" ").toUpperCase() : "CHAPTER";
          }
        } else if (ge.graphic_kind === "number_stat") {
          kind = "number_stat";
          const numKw = (structure.keywords ?? [])
            .filter((k) => /\d/.test(k.word))
            .sort((a, b) => Math.abs(timecodeToSec(a.start) - t) - Math.abs(timecodeToSec(b.start) - t))[0];
          title = numKw ? fixWord(numKw.word).slice(0, 48) : "1";
        } else if (ge.graphic_kind === "lower_third") {
          kind = "quote";
          title = fixWord(ge.text_source ?? structure.sections[0]?.summary ?? "").slice(0, 48);
        } else {
          kind = "highlight";
          const nearestKw = (structure.keywords ?? [])
            .sort((a, b) => Math.abs(timecodeToSec(a.start) - t) - Math.abs(timecodeToSec(b.start) - t))[0];
          title = nearestKw ? fixWord(nearestKw.word).toUpperCase().slice(0, 40) : "HIGHLIGHT";
        }

        if (title && claimGraphic(t, dur)) {
          graphics.push({
            time: secToTimecode(t),
            kind,
            title,
            duration: dur,
          });
        }
      } catch {
        /* skip invalid graphic event */
      }
    }
  } else if (rv?.graphics && rv.graphics.length > 0) {
    for (const g of rv.graphics) {
      try {
        const t = timecodeToSec(g.time);
        const dur = Math.max(1, Math.min(8, Number(g.duration) || 3));
        if (claimGraphic(t, dur)) {
          graphics.push({ ...g, duration: dur });
        }
      } catch {
        /* skip invalid timecode */
      }
    }
  } else {
    let actCount = 0;
    for (let i = 1; i < structure.sections.length && actCount < 3; i++) {
      const sec = structure.sections[i];
      const sStart = timecodeToSec(sec.start);
      const words = contentWords(fixWord(sec.summary)).slice(0, 6);
      if (words.length === 0) continue;
      const t = sStart + 0.5;
      const dur = 2.5;
      if (!claimGraphic(t, dur)) continue;
      graphics.push({
        time: secToTimecode(t),
        kind: "act_title",
        title: words.join(" ").toUpperCase().slice(0, 48),
        subtitle: sec.title,
        duration: dur,
      });
      actCount++;
    }
    // 2. number stats (top-10 digit keywords, max 2)
    const numKws = (structure.keywords ?? [])
      .filter((k, i) => i < 10 && /\d/.test(k.word))
      .slice(0, 2);
    for (const k of numKws) {
      const t = timecodeToSec(k.start);
      const dur = 3.5;
      if (!claimGraphic(t, dur)) continue;
      graphics.push({
        time: secToTimecode(t),
        kind: "number_stat",
        title: fixWord(k.word).slice(0, 48),
        duration: dur,
      });
    }
    // 3. highlights (top-5 non-numeric, clear of numbers ±20s, max 2)
    const numTimes = numKws.map((k) => timecodeToSec(k.start));
    let hlCount = 0;
    for (const k of (structure.keywords ?? []).slice(0, 5)) {
      if (hlCount >= 2) break;
      if (/\d/.test(k.word)) continue;
      const t = timecodeToSec(k.start);
      if (numTimes.some((n) => Math.abs(n - t) < 20)) continue;
      const dur = 3;
      if (!claimGraphic(t, dur)) continue;
      graphics.push({
        time: secToTimecode(t),
        kind: "highlight",
        title: fixWord(k.word).toUpperCase().slice(0, 40),
        duration: dur,
      });
      hlCount++;
    }
    // 4. quote recap (hook replay past midpoint, >8min media only)
    if (structure.hook_moment && mediaEnd > 8 * 60) {
      const t = mediaEnd / 2;
      const dur = 4;
      if (claimGraphic(t, dur)) {
        graphics.push({
          time: secToTimecode(t),
          kind: "quote",
          title: fixWord(structure.hook_moment.text).slice(0, 90),
          duration: dur,
        });
      }
    }
  }
  graphics.sort((a, b) => timecodeToSec(a.time) - timecodeToSec(b.time));
  if (disableGraphics && graphics.length === 0) {
    structure_notes.push({
      time: secToTimecode(0),
      note: "graphics disabled (single_take restraint): no TOP banner — pass disableGraphics:false or takesCount ≥2 to enable",
    });
  }

  // (structure_notes was declared up in the motion block: downgrade +
  // relocation + skip notes all land there.)
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

  const keptWords = transcriptWords
    ? transcriptWords.filter((w) => isKept(timecodeToSec(w.start))).length
    : undefined;

  const thumbnail = opts.thumbnail
    ? { ...opts.thumbnail }
    : rv?.thumbnail
      ? { ...rv.thumbnail }
      : rv
        ? {
            title: fixWord(structure.hook?.summary ?? "").slice(0, 40) || "Highlights",
            badge: "HIGH RETENTION",
            frame_time:
              structure.hook_moment?.start ?? structure.hook?.start ?? "00:00:02.000",
            style: "bold" as const,
          }
        : undefined;

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
    retentionvolt_applied: Boolean(
      rv &&
        ((rv.events?.length ?? 0) +
          (rv.animations?.length ?? 0) +
          (rv.pattern_interrupts?.length ?? 0) >
          0)
    ),
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
