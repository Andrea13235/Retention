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

/** Italian + English stopwords: never keywords, never emphasized. */
const STOPWORDS = new Set(
  [
    // Italian
    "il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "di", "a",
    "da", "in", "con", "su", "per", "tra", "fra", "e", "ed", "o", "ma",
    "che", "cui", "non", "si", "ci", "ne", "come", "più", "molto",
    "tutto", "tutti", "tutte", "questo", "questa", "questi", "queste",
    "quello", "quella", "essere", "avere", "fare", "dire", "anche",
    "solo", "sempre", "mai", "già", "ancora", "bene", "tanto", "tutti",
    "sia", "può", "una", "mio", "mia", "miei", "tuo", "tua", "tuoi",
    "tue", "suo", "loro", "nostro", "vostro", "del", "della", "dei",
    "delle", "al", "alla", "dal", "nella", "sul", "sui", "hai", "ho",
    "abbiamo", "hanno", "sono", "siamo", "siete", "era", "stato",
    // English
    "the", "a", "an", "of", "to", "and", "or", "but", "in", "on",
    "with", "for", "is", "are", "was", "were", "be", "been", "it",
    "this", "that", "these", "those", "you", "your", "we", "our",
    "they", "their", "he", "she", "his", "her", "have", "has",
    "will", "would", "can", "could", "just", "very", "really",
  ].map((w) => w.toLowerCase())
);

/** Clean a Whisper word token for analysis (strip spaces/punctuation). */
function cleanWord(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^[^a-zà-ÿ0-9']+/i, "")
    .replace(/[^a-zà-ÿ0-9']+$/i, "");
}

/**
 * Flatten all word timestamps of the transcript in time order.
 * Falls back to evenly splitting segment text when words are missing.
 */
function allWords(transcript: Transcript): Array<{
  word: string;
  start: number;
  end: number;
}> {
  const out: Array<{ word: string; start: number; end: number }> = [];
  for (const s of transcript.segments) {
    const sStart = timecodeToSec(s.start);
    const sEnd = timecodeToSec(s.end);
    if (s.words && s.words.length > 0) {
      for (const w of s.words) {
        const clean = cleanWord(w.word);
        if (!clean) continue;
        out.push({
          word: clean,
          start: timecodeToSec(w.start),
          end: timecodeToSec(w.end),
        });
      }
    } else {
      const tokens = s.text.split(/\s+/).filter(Boolean);
      const dur = Math.max(0.01, (sEnd - sStart) / Math.max(1, tokens.length));
      tokens.forEach((tok, i) => {
        const clean = cleanWord(tok);
        if (!clean) return;
        out.push({ word: clean, start: sStart + i * dur, end: sStart + (i + 1) * dur });
      });
    }
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

export interface AnalyzeOptions {
  /** Long-pause threshold → attention dip (sec, default 2.5). */
  longPauseSec?: number;
  /** How many thematic sections to split into (default 3). */
  sectionCount?: number;
  /**
   * Dead-air threshold in seconds (default 0.8): word gaps ≥ this become
   * `cut_candidates` of kind "dead_air". Lower (0.4–0.5) for short-form
   * pace, higher (1.2+) for podcasts. Whisper word timestamps below
   * ~0.3s resolution are unreliable — never go below 0.3.
   */
  deadAirSec?: number;
  /**
   * Whisper-small word timings are jittery: words LONGER than this
   * (default 2.0s) are ASR artifacts, not real hesitations. They are
   * clamped for slow-spot detection and never become cuts.
   */
  maxWordSec?: number;
  /**
   * Transcript corrections applied BEFORE analysis (and forwarded into
   * the plan so captions render corrected): { misheard, correct }.
   * Fixes brand names / proper nouns Whisper-small mangles
   * ("raw cut" → "RetentionVolt", "cloud" → "Claude").
   */
  corrections?: Array<{ misheard: string; correct: string }>;
}

export function analyzeTranscript(
  transcript: Transcript,
  opts: AnalyzeOptions = {}
): NarrativeStructure {
  const {
    longPauseSec = 2.5,
    sectionCount = 3,
    deadAirSec = 0.8,
    maxWordSec = 2.0,
    corrections = [],
  } = opts;

  // Corrections FIRST: fix ASR-mangled words before any analysis so
  // keywords, captions and cuts all see the corrected text.
  let segs = transcript.segments;
  if (corrections.length > 0) {
    const applyFix = (text: string): string => {
      let out = text;
      for (const c of corrections) {
        const esc = c.misheard.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        out = out.replace(
          new RegExp(`(^|\\s)${esc}(?=\\s|$|[.,!?;:])`, "gi"),
          (_, pre) => `${pre}${c.correct}`
        );
      }
      return out;
    };
    segs = segs.map((s) => ({
      ...s,
      text: applyFix(s.text),
      words: s.words?.map((w) => {
        const fixed = applyFix(w.word);
        return fixed === w.word ? w : { ...w, word: fixed };
      }),
    }));
  }
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

  // ——— Editorial signals (deterministic, word-level) ———
  const rawWords = allWords({ ...transcript, segments: segs });
  // Clamp ASR-artifact words (small-model timing jitter): a "word" of
  // 4.48s is not a hesitation, it is a bad timestamp. Clamp so slow-spot
  // detection and gap math stay honest; never cut on these.
  const words = rawWords.map((w) => ({
    ...w,
    end: Math.min(w.end, w.start + maxWordSec),
  }));
  const totalDur =
    words.length > 0
      ? Math.max(0.01, words[words.length - 1].end - words[0].start)
      : 1;
  const avgRate = words.length / totalDur; // words per second

  // Keywords: non-stopword tokens scored by rarity × articulation time.
  // Rare words spoken slowly (emphasis) score highest.
  const freq = new Map<string, number>();
  for (const w of words) {
    if (STOPWORDS.has(w.word) || FILLER_WORDS.has(w.word)) continue;
    freq.set(w.word, (freq.get(w.word) ?? 0) + 1);
  }
  const avgDur =
    words.reduce((a, w) => a + Math.max(0, w.end - w.start), 0) /
    Math.max(1, words.length);
  const seen = new Set<string>();
  const keywords: NonNullable<NarrativeStructure["keywords"]> = [];
  for (const w of words) {
    if (STOPWORDS.has(w.word) || FILLER_WORDS.has(w.word)) continue;
    if (seen.has(w.word)) continue; // first (emphasized) occurrence wins
    seen.add(w.word);
    const rarity = 1 / (freq.get(w.word) ?? 1);
    const emphasis = Math.min(2.5, Math.max(0.5, (w.end - w.start) / Math.max(0.05, avgDur)));
    const longBonus = w.word.length >= 6 ? 1.2 : 1;
    const numBonus = /\d/.test(w.word) ? 1.5 : 1;
    keywords.push({
      word: w.word,
      start: secToTimecode(w.start),
      score: Math.round(rarity * emphasis * longBonus * numBonus * 100) / 100,
    });
  }
  keywords.sort((a, b) => b.score - a.score);

  // Hook moment: densest keyword window (≤5s) inside the hook — the
  // single most quotable beat, i.e. the cold-open candidate.
  let hook_moment: NarrativeStructure["hook_moment"];
  {
    const hookStart = timecodeToSec(startAll);
    const hookWords = words.filter((w) => w.start < hookEndSec);
    let best = { score: -1, s: hookStart, e: hookStart };
    for (const w of hookWords) {
      const winEnd = w.start + 5;
      const inWin = hookWords.filter((x) => x.start >= w.start && x.start < winEnd);
      const kw = inWin.filter(
        (x) => !STOPWORDS.has(x.word) && !FILLER_WORDS.has(x.word)
      ).length;
      const density = kw / Math.max(1, inWin.length);
      const score = kw * 2 + density;
      if (score > best.score)
        best = {
          score,
          s: w.start,
          e: Math.min(winEnd, inWin[inWin.length - 1]?.end ?? winEnd),
        };
    }
    if (best.score > 0) {
      const text = hookWords
        .filter((x) => x.start >= best.s && x.start < best.e)
        .map((x) => x.word)
        .join(" ");
      hook_moment = {
        start: secToTimecode(best.s),
        end: secToTimecode(best.e),
        text,
      };
    }
  }

  // Slow spots: runs of ≥4 words spoken at <60% of the average rate
  // (deliberate emphasis — punch in, don't cut).
  const slow_spots: NonNullable<NarrativeStructure["slow_spots"]> = [];
  {
    let run: typeof words = [];
    const flush = () => {
      if (run.length >= 4) {
        slow_spots.push({
          start: secToTimecode(run[0].start),
          end: secToTimecode(run[run.length - 1].end),
          reason: `slow delivery: ${run.length} words at reduced pace`,
        });
      }
      run = [];
    };
    for (const w of words) {
      const dur = Math.max(0.01, w.end - w.start);
      const slow = 1 / dur < avgRate * 0.6;
      if (slow) run.push(w);
      else flush();
    }
    flush();
  }

  return {
    media_id: transcript.media_id,
    hook: { start: startAll, end: secToTimecode(hookEndSec), summary: hookText },
    sections,
    fillers,
    attention_dips,
    highlights,
    keywords: keywords.slice(0, 40),
    hook_moment,
    slow_spots,
    speech: buildSpeech(words, 0, timecodeToSec(endAll)),
    duration_sec: Math.round(timecodeToSec(endAll) * 1000) / 1000,
    cut_candidates: buildCutCandidates({
      words,
      segs,
      hookEndSec,
      deadAirSec,
      mediaStart: 0,
      mediaEnd: timecodeToSec(endAll),
    }),
    needs_review: buildNeedsReview(words, segs),
  };
}

/**
 * Measured speech pace: words per minute over the full media span.
 * Uses ALL words (pre-cut view): what the speaker delivered, so the
 * agent can compare against the reference registers (show ~182,
 * educational ~174–188, tutorial ~257 wpm) BEFORE the splice hides
 * the ramble. wpm = words / minutes, rounded to 1 decimal.
 */
function buildSpeech(
  words: Array<{ word: string; start: number; end: number }>,
  mediaStart: number,
  mediaEnd: number
): { wpm: number; totalWords: number } {
  const spanMin = Math.max(1 / 60, (mediaEnd - mediaStart) / 60);
  const totalWords = words.length;
  return { wpm: Math.round((totalWords / spanMin) * 10) / 10, totalWords };
}

/**
 * Words Whisper likely mangled — the first-take safety net.
 * A token is suspicious when it is RARE (seen once in the whole
 * transcript) AND (emphasized (spoken slowly) OR long (≥7 chars) OR
 * adjacent to a long pause (uncertain delivery)). Those are exactly
 * the brand names / proper nouns / neologisms small models invent
 * ("rawcat" for RetentionVolt, "cloud" for Claude): frequent words are
 * never flagged (the model gets common speech right), stopwords and
 * fillers are excluded by construction.
 * Each flag carries sentence context so the agent can correct it
 * without re-listening. Cap 10: beyond that the transcript is noise
 * and the agent should re-transcribe with a bigger model.
 */
function buildNeedsReview(
  words: Array<{ word: string; start: number; end: number }>,
  segs: Transcript["segments"]
): NonNullable<NarrativeStructure["needs_review"]> {
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w.word, (freq.get(w.word) ?? 0) + 1);
  const avgDur =
    words.reduce((a, w) => a + Math.max(0, w.end - w.start), 0) /
    Math.max(1, words.length);
  const out: NonNullable<NarrativeStructure["needs_review"]> = [];
  const seen = new Set<string>();
  words.forEach((w, i) => {
    if (seen.has(w.word)) return;
    seen.add(w.word);
    if (STOPWORDS.has(w.word) || FILLER_WORDS.has(w.word)) return;
    if ((freq.get(w.word) ?? 0) > 1) return; // model is consistent → trust it
    const dur = Math.max(0, w.end - w.start);
    const emphasized = dur > avgDur * 1.8;
    const longToken = w.word.length >= 7;
    const prevGap = i > 0 ? w.start - words[i - 1].end : 0;
    const nextGap =
      i + 1 < words.length ? words[i + 1].start - w.end : 0;
    const hesitant = prevGap >= 0.5 || nextGap >= 0.5;
    if (!(emphasized || longToken || hesitant)) return;
    const seg = segs.find(
      (s) => w.start >= timecodeToSec(s.start) && w.start < timecodeToSec(s.end)
    );
    const tokens = (seg?.text ?? w.word).split(/\s+/);
    const idx = tokens.findIndex((t) =>
      cleanWord(t).startsWith(w.word.slice(0, Math.min(4, w.word.length)))
    );
    const context = tokens.slice(Math.max(0, idx - 4), idx + 5).join(" ");
    out.push({ word: w.word, start: secToTimecode(w.start), context });
  });
  return out.slice(0, 10);
}

/**
 * Build the "taglia qui" list — real editorial cut decisions.
 * Kinds (in detection order):
 * - trim_head: silence before the first word (cold mic, framing fumble).
 * - trim_tail: silence after the last word (lingering outro).
 * - dead_air: inter-word gaps ≥ deadAirSec (mind gone blank).
 * - stutter: immediate same-word repetition ("sul sul tuo" → keep last).
 * - filler: runs of ≥2 consecutive filler words ("ehm allora", "cioè ecco").
 * - false_start: short aborted burst (≤3 words) followed by a restart of
 *   the same sentence — keep only the final take.
 *
 * Guardrails: never cut inside the hook's first 3s (cold open is sacred),
 * never emit zero-length candidates, merge overlaps.
 */
function buildCutCandidates(args: {
  words: Array<{ word: string; start: number; end: number }>;
  segs: Transcript["segments"];
  hookEndSec: number;
  deadAirSec: number;
  mediaStart: number;
  mediaEnd: number;
}): NonNullable<NarrativeStructure["cut_candidates"]> {
  const { words, hookEndSec, deadAirSec, mediaStart, mediaEnd } = args;
  const out: NonNullable<NarrativeStructure["cut_candidates"]> = [];
  if (words.length === 0) return out;
  // Cold-open guard: never cut inside the first 3s OF THE MEDIA
  // (the opening seconds are sacred). Anchored to mediaStart, NOT to
  // the first word — otherwise a long leading silence would extend
  // the sacred zone over real content.
  const hookSafeUntil = mediaStart + 3;

  const push = (start: number, end: number, kind: NonNullable<NarrativeStructure["cut_candidates"]>[number]["kind"], reason: string, confidence: number) => {
    if (!(end > start)) return;
    if (start < hookSafeUntil && kind !== "trim_head") return;
    out.push({ start: secToTimecode(start), end: secToTimecode(end), kind, reason, confidence });
  };

  // trim_head / trim_tail (dead air at the edges — always cut, max trust)
  const firstStart = words[0].start;
  const lastEnd = words[words.length - 1].end;
  if (firstStart - mediaStart >= 0.3)
    push(mediaStart, firstStart, "trim_head", `leading silence ${(firstStart - mediaStart).toFixed(1)}s`, 0.99);
  if (mediaEnd - lastEnd >= 0.5)
    push(lastEnd, mediaEnd, "trim_tail", `trailing silence ${(mediaEnd - lastEnd).toFixed(1)}s`, 0.99);

  // dead_air between words. Confidence scales with length: a 4s void is
  // certainly a blank mind (0.95); a 0.8s gap may be a rhetorical pause
  // the speaker wanted (0.6) — the planner applies it but flags review.
  const floor = Math.max(0.3, deadAirSec);
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end;
    if (gap >= floor) {
      const confidence = gap >= 2 ? 0.95 : gap >= 1.2 ? 0.8 : 0.6;
      push(words[i - 1].end, words[i].start, "dead_air", `silence of ${gap.toFixed(1)}s mid-speech`, confidence);
    }
  }

  // stutter: "sul sul", "di di" — cut the FIRST occurrence + its gap.
  // Near-certain (0.9): nobody repeats a word on purpose twice in a row.
  for (let i = 1; i < words.length; i++) {
    if (words[i].word && words[i].word === words[i - 1].word)
      push(words[i - 1].start, words[i].start, "stutter", `repeated word "${words[i].word}" — keep final take`, 0.9);
  }

  // filler runs: ≥2 consecutive filler words ("ehm allora", "cioè ecco").
  // High trust (0.85): consecutive fillers carry no meaning by definition.
  {
    let runStart = -1;
    let runEnd = -1;
    let count = 0;
    const flush = () => {
      if (count >= 2) push(runStart, runEnd, "filler", `filler run: ${count} consecutive filler words`, 0.85);
      runStart = runEnd = -1;
      count = 0;
    };
    for (const w of words) {
      if (FILLER_WORDS.has(w.word)) {
        if (runStart < 0) runStart = w.start;
        runEnd = w.end;
        count++;
      } else flush();
    }
    flush();
  }

  // false starts: burst of ≤3 words starting a sentence, then a pause and
  // a restart — the speaker aborted. Medium trust (0.7): the heuristic
  // can't tell an aborted take from deliberate anaphora ("io… io dico").
  {
    let sentenceStart = 0;
    let wordsSinceGap = 0;
    for (let i = 1; i < words.length; i++) {
      const gap = words[i].start - words[i - 1].end;
      if (gap >= 0.5) {
        if (wordsSinceGap > 0 && wordsSinceGap <= 3) {
          push(
            words[sentenceStart].start,
            words[i].start,
            "false_start",
            `aborted burst of ${wordsSinceGap} words before restart`,
            0.7
          );
        }
        sentenceStart = i;
        wordsSinceGap = 0;
      } else {
        wordsSinceGap++;
      }
    }
    void hookEndSec;
  }

  // Merge overlaps, sort.
  out.sort((a, b) => timecodeToSec(a.start) - timecodeToSec(b.start));
  const merged: typeof out = [];
  for (const c of out) {
    const last = merged[merged.length - 1];
    if (last && timecodeToSec(c.start) < timecodeToSec(last.end)) {
      if (timecodeToSec(c.end) > timecodeToSec(last.end)) last.end = c.end;
      last.reason += ` + ${c.reason}`;
    } else merged.push({ ...c });
  }
  return merged;
}
