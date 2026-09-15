/**
 * tools_analyze.ts — Step 3: analisi narrativa e attenzione (spec §4).
 * Euristiche deterministiche sul transcript: hook, sezioni, filler,
 * cali di attenzione, highlight. L'agente LLM può poi raffinare il testo,
 * ma la struttura temporale resta questa (verificabile, no allucinazioni).
 */
import {
  secToTimecode,
  timecodeToSec,
  type NarrativeStructure,
  type Transcript,
} from "./types.js";

/** Filler italiani + inglesi (case-insensitive, match per parola). */
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
    "like",
    "you know",
    "basically",
    "actually",
    "literally",
    "so",
    "well",
    "anyway",
  ].map((w) => w.toLowerCase())
);

export interface AnalyzeOptions {
  /** Soglia pausa lunga → attention dip (sec, default 2.5). */
  longPauseSec?: number;
  /** Quante sezioni tematiche dividere (default 3). */
  sectionCount?: number;
}

export function analyzeTranscript(
  transcript: Transcript,
  opts: AnalyzeOptions = {}
): NarrativeStructure {
  const { longPauseSec = 2.5, sectionCount = 3 } = opts;
  const segs = transcript.segments;
  if (segs.length === 0)
    throw new Error("analyze_transcript: transcript senza segmenti");

  const startAll = segs[0].start;
  const endAll = segs[segs.length - 1].end;

  // Hook: primi 30s (o primo segmento se più corto).
  const hookEndSec = Math.min(timecodeToSec(segs[0].start) + 30, timecodeToSec(endAll));
  const hookText = segs
    .filter((s) => timecodeToSec(s.start) < hookEndSec)
    .map((s) => s.text)
    .join(" ")
    .slice(0, 200);

  // Sezioni: divisione uniforme con sommario = prime parole.
  const total = timecodeToSec(endAll) - timecodeToSec(startAll);
  const n = Math.max(1, Math.min(sectionCount, segs.length));
  const sections = Array.from({ length: n }, (_, i) => {
    const sStart = timecodeToSec(startAll) + (total * i) / n;
    const sEnd = timecodeToSec(startAll) + (total * (i + 1)) / n;
    const inSection = segs.filter(
      (s) => timecodeToSec(s.start) >= sStart && timecodeToSec(s.start) < sEnd
    );
    return {
      title: `Sezione ${i + 1}`,
      start: secToTimecode(sStart),
      end: secToTimecode(sEnd),
      summary: (inSection.map((s) => s.text).join(" ") || "").slice(0, 160),
    };
  });

  // Filler: parole filler + segmenti quasi vuoti.
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
        reason: `filler: ${fillerCount}/${words.length} parole riempitive`,
      });
    }
  }

  // Attention dips: pause lunghe tra segmenti.
  const attention_dips: NarrativeStructure["attention_dips"] = [];
  for (let i = 1; i < segs.length; i++) {
    const gap = timecodeToSec(segs[i].start) - timecodeToSec(segs[i - 1].end);
    if (gap >= longPauseSec) {
      attention_dips.push({
        start: segs[i - 1].end,
        end: segs[i].start,
        reason: `pausa di ${gap.toFixed(1)}s`,
      });
    }
  }

  // Highlights: segmenti più lunghi/densi (top 20% per caratteri).
  const byLen = [...segs].sort((a, b) => b.text.length - a.text.length);
  const highlights = byLen.slice(0, Math.max(1, Math.ceil(segs.length * 0.2))).map((s) => ({
    start: s.start,
    end: s.end,
    reason: "segmento denso di contenuto",
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
