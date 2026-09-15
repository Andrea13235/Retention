/**
 * tools_plan.ts — Step 4: Action Plan generation (v1.2).
 * Turns the NarrativeStructure into a machine-actionable EditPlan:
 * a real KEEP splice (complement of cut_candidates), kept-words-only
 * karaoke captions, act-based motion.
 *
 * Rules:
 * - format "short" (explicit or portrait source): 9:16 canvas, tight,
 *   hook-first, punch every ~4s, captions always on.
 * - format "long": 16:9 canvas, breathing room, punch every ~25s.
 * - cuts = complement of cut_candidates over [0, mediaEnd]: sorted,
 *   non-overlapping, edge-to-edge. CUT entries are ALSO listed
 *   (reason "CUT — …") for the human-readable record.
 * - Karaoke captions contain ONLY kept words; corrected text
 *   (structure.corrections_applied) replaces ASR-mangled words.
 * - Motion follows narrative acts (one slow_zoom per section), not a
 *   metronome; slow_spots get punch-ins.
 */
import {
  secToTimecode,
  timecodeToSec,
  type CanvasFormat,
  type CutCandidate,
  type EditPlan,
  type NarrativeStructure,
} from "./types.js";

export type StylePreset =
  | "youtube_talking_head"
  | "podcast"
  | "short_form";

export interface PlanOptions {
  style?: StylePreset;
  /**
   * Target canvas. Default: "short" for short_form style or portrait
   * sources, "long" otherwise. Pass explicitly to override.
   */
  format?: CanvasFormat;
  /** True when the source footage is portrait (vertical video). */
  sourcePortrait?: boolean;
  /** Pattern-interrupt cadence in seconds (default per style). */
  interruptEverySec?: number;
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
}

const DEFAULT_INTERRUPT: Record<StylePreset, number> = {
  youtube_talking_head: 25,
  podcast: 60,
  short_form: 4,
};

export function generateEditPlan(
  structure: NarrativeStructure,
  opts: PlanOptions = {},
  transcriptWords?: Array<{ start: string; word: string }>
): EditPlan {
  const style = opts.style ?? "youtube_talking_head";
  const format: CanvasFormat =
    opts.format ?? (style === "short_form" || opts.sourcePortrait ? "short" : "long");
  const isShort = format === "short";
  const every = opts.interruptEverySec ?? DEFAULT_INTERRUPT[style];
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
    const GAP = 0.08;
    rawCards.forEach((card, i) => {
      if (card.words.length === 0) return;
      const lastStart = timecodeToSec(card.words[card.words.length - 1].start);
      const natural = lastStart - card.start + 0.8;
      const nextStart = rawCards[i + 1]?.start;
      const capped =
        nextStart !== undefined ? Math.max(0.5, nextStart - card.start - GAP) : natural;
      // Short-form: snappy cards (1–4s). Long-form: room to breathe (1–8s).
      const dur = isShort
        ? Math.min(4, Math.max(1, Math.min(natural, capped)))
        : Math.min(8, Math.max(1, Math.min(natural, capped)));
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
    // Fallback (no word timestamps): captions on highlights as before.
    for (const h of structure.highlights.slice(0, 10)) {
      animations.push({
        time: h.start,
        type: "caption",
        content: "KEY INSIGHT",
        position: "bottom",
      });
    }
  }

  // ——— Motion follows acts, not a metronome ———
  // hook_moment emphasis is rendered by the karaoke cards themselves
  // (no separate top caption: double captions + black boxes are banned —
  // the Apple restraint rule).
  //
  // HARD-CUT rule: cleanup cuts (stutter, dead air, filler, false starts,
  // trims) are NET cuts — the splice alone, no animation on top. A zoom
  // landing on a cleanup resume tells the viewer "something was hidden
  // here", which is exactly what must NOT happen.
  //
  // Zooms live ONLY on genuine scene changes: section boundaries (a new
  // act starts — coherent emphasis, not a cover-up) and explicit agent
  // attentionRiskPoints (the agent judged the moment worthy). The 0.8s
  // pre-cut mask still vetoes everything: a punch on the last pre-cut
  // frame would spotlight the seam.
  const CUT_MASK_S = 0.8;
  const cutStarts = mergedCuts.map((c) => c.s); // cuts start here
  const nearCutStart = (t: number): boolean =>
    cutStarts.some((cs) => t >= cs - CUT_MASK_S && t < cs);
  const isSceneChange = (t: number): boolean =>
    structure.sections.some(
      (sec, i) => i > 0 && Math.abs(timecodeToSec(sec.start) - t) < 0.5
    );
  // Scene-change emphasis ONLY: a slow_zoom opens a new act (section
  // boundary = genuine change of scene/topic, coherent by definition).
  // Mid-act motion is restraint: no drift over continuous speech.
  structure.sections.forEach((s, i) => {
    if (i === 0) return; // first section opens on the hook — no zoom needed
    const sStart = timecodeToSec(s.start);
    const sEnd = timecodeToSec(s.end);
    const dur = Math.min(12, Math.max(3, sEnd - sStart - 1));
    if (dur >= 3 && isKept(sStart + 0.5) && !nearCutStart(sStart + 0.5)) {
      animations.push({
        time: secToTimecode(sStart + 0.5),
        type: "slow_zoom",
        target: "face",
        direction: i % 2 === 0 ? "in" : "out",
        intensity: isShort ? 2 : 3,
        duration: dur,
      });
    }
  });
  for (const spot of structure.slow_spots ?? []) {
    const t = timecodeToSec(spot.start);
    if (isKept(t) && !nearCutStart(t) && isSceneChange(t)) {
      animations.push({
        time: spot.start,
        type: "zoom_in",
        target: "face",
      });
    }
  }
  for (const d of structure.attention_dips.slice(0, 10)) {
    const t = timecodeToSec(d.start);
    if (isKept(t) && !nearCutStart(t) && isSceneChange(t)) {
      animations.push({
        time: d.start,
        type: "zoom_in",
        target: "face",
      });
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

  // Pattern interrupts on cadence (short-form keeps every ~4s)…
  // …skipped inside CUT ranges and inside the pre-cut mask (same rule).
  // Long-form cadence is caption_pop by default; zoom_punch ONLY on
  // genuine scene changes (section boundary) — motion stays coherent.
  const pattern_interrupts: EditPlan["pattern_interrupts"] = [];
  for (let t = every; t < endSec; t += every) {
    if (!isKept(t) || nearCutStart(t)) continue;
    const kind =
      style === "short_form" ? "caption_pop" : isSceneChange(t) ? "zoom_punch" : "caption_pop";
    pattern_interrupts.push({
      time: secToTimecode(t),
      kind,
      detail: `interrupt every ~${every}s`,
    });
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
    const kind =
      style === "short_form"
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

  return {
    version: "1.2",
    style,
    format,
    media_id: structure.media_id,
    cuts,
    animations,
    broll,
    pattern_interrupts,
    review_cuts: reviewCuts.length > 0 ? reviewCuts : undefined,
  };
}
