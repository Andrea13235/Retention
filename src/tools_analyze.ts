/**
 * tools_analyze.ts — Step 3: narrative & attention analysis.
 * Deterministic heuristics over the transcript: hook, sections, fillers,
 * attention dips, highlights. The LLM agent may refine wording afterwards,
 * but the temporal structure stays this one (verifiable, no hallucinations).
 *
 * Language note: filler detection covers Italian + English out of the box.
 * Timing-based signals (pauses, density, hook position) are language-agnostic
 * and work with any of Whisper's ~100 languages.
 */
import {
  secToTimecode,
  timecodeToSec,
  type NarrativeStructure,
  type Transcript,
} from "./types.js";

/** Italian + English fillers (case-insensitive, per-word match). */
const FILLER_WORDS = new Set(
  [
    "ehm",
    "uhm",
    "eh",
    "cioè",
    "ecco",
    "allora",
    "diciamo",
    "praticamente",
    "sostanzialmente",
    "comunque",
    "quindi",
    "niente",
    "vabbè",
    "um",
    "uh",
    "er",
    "hmm",
    "like",
    "you know",
    "basically",
    "actually",
    "literally",
    "so",
    "well",
    "anyway",
    "right",
    "I mean",
  ].map((w) => w.toLowerCase())
);

export interface AnalyzeOptions {
  /** Long-pause threshold → attention dip (sec, default 2.5). */
  longPauseSec?: number;
  /** How many thematic sections to split into (default 3). */
  sectionCount?: number;
}

export function analyzeTranscript(
  transcript: Transcript,
  opts: AnalyzeOptions = {}
): NarrativeStructure {
  const { longPauseSec = 2.5, sectionCount = 3 } = opts;
  const segs = transcript.segments;
  if (segs.length === 0)
    throw new Error("analyze_transcript: transcript has no segments");

  const startAll = segs[0].start;
  const endAll = segs[segs.length - 1].end;

  // Hook: first 30s (or first segment if shorter).
  const hookEndSec = Math.min(timecodeToSec(segs[0].start) + 30, timecodeToSec(endAll));
  const hookText = segs
    .filter((s) => timecodeToSec(s.start) < hookEndSec)
    .map((s) => s.text)
    .join(" ")
    .slice(0, 200);

  // Sections: uniform split with summary = leading words.
  const total = timecodeToSec(endAll) - timecodeToSec(startAll);
  const n = Math.max(1, Math.min(sectionCount, segs.length));
  const sections = Array.from({ length: n }, (_, i) => {
    const sStart = timecodeToSec(startAll) + (total * i) / n;
    const sEnd = timecodeToSec(startAll) + (total * (i + 1)) / n;
    const inSection = segs.filter(
      (s) => timecodeToSec(s.start) >= sStart && timecodeToSec(s.start) < sEnd
    );
    return {
      title: `Section ${i + 1}`,
      start: secToTimecode(sStart),
      end: secToTimecode(sEnd),
      summary: (inSection.map((s) => s.text).join(" ") || "").slice(0, 160),
    };
  });

  // Fillers: filler words + near-empty segments.
  const fillers: NarrativeStructure["fillers"] = [];
  for (const s of segs) {
    const words = s.text.toLowerCase().split(/\s+/).filter(Boolean);
    const fillerCount = words.filter((w) =>
      FILLER_WORDS.has(w.replace(/[.,!?;:]+$/, ""))
    ).length;
    if (words.length > 0 && fillerCount / words.length >= 0.4) {
      fillers.push({
        start: s.start,
        end: s.end,
        reason: `filler: ${fillerCount}/${words.length} filler words`,
      });
    }
  }

  // Attention dips: long pauses between segments.
  const attention_dips: NarrativeStructure["attention_dips"] = [];
  for (let i = 1; i < segs.length; i++) {
    const gap = timecodeToSec(segs[i].start) - timecodeToSec(segs[i - 1].end);
    if (gap >= longPauseSec) {
      attention_dips.push({
        start: segs[i - 1].end,
        end: segs[i].start,
        reason: `pause of ${gap.toFixed(1)}s`,
      });
    }
  }

  // Highlights: longest/densest segments (top 20% by characters).
  const byLen = [...segs].sort((a, b) => b.text.length - a.text.length);
  const highlights = byLen.slice(0, Math.max(1, Math.ceil(segs.length * 0.2))).map((s) => ({
    start: s.start,
    end: s.end,
    reason: "content-dense segment",
  }));

  return {
    media_id: transcript.media_id,
    hook: { start: startAll, end: secToTimecode(hookEndSec), summary: hookText },
    sections,
    fillers,
    attention_dips,
    highlights,
  };
}
