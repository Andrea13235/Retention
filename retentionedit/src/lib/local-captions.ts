/**
 * RetentionEdit — Local captions M2 (SERVER ONLY).
 *
 * Real cues from real STT words (never invented): groups words into cues,
 * renders Apple-minimal PNG overlays (clean white type, subtle shadow,
 * NO boxes/pills), burns them via ffmpeg overlay filter with
 * enable=between(t,start,end).
 *
 * Karaoke (skill parity): each cue carries per-word timings + emphasis
 * flags. The renderer draws spoken words full-white and upcoming words at
 * 40% opacity; emphasis (keyword) words pop in accent yellow.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { WordTimestamp } from "./types";

export interface CaptionCue {
  start: number;
  end: number;
  text: string;
  /** Per-word timings (skill karaoke parity): spoken vs upcoming rendering. */
  words?: Array<{ word: string; start: number; end: number; emphasis?: boolean }>;
}

/** Group words into cues of ≤ maxWords, splitting on end punctuation. */
export function wordsToCues(
  words: WordTimestamp[],
  maxWords = 6,
  emphasis?: Set<string>
): CaptionCue[] {
  // Merge standalone punctuation tokens (".", ",", "!", …) into the previous
  // word — Muse distributes them as separate tokens ("I know .").
  const merged: WordTimestamp[] = [];
  for (const w of words) {
    if (/^[.,!?;:…'’"]+$/.test(w.word) && merged.length > 0) {
      const prev = merged[merged.length - 1];
      merged[merged.length - 1] = { ...prev, word: prev.word + w.word, end: w.end };
    } else {
      merged.push(w);
    }
  }
  const cues: CaptionCue[] = [];
  let cur: WordTimestamp[] = [];
  const flush = () => {
    if (cur.length === 0) return;
    cues.push({
      start: cur[0].start,
      end: cur[cur.length - 1].end,
      text: cur.map((w) => w.word).join(" "),
      words: cur.map((w) => ({
        word: w.word,
        start: w.start,
        end: w.end,
        // Emphasis = keyword pop: Opus/keyword set wins; else long content words.
        emphasis: emphasis
          ? emphasis.has(w.word.toLowerCase().replace(/[^a-zà-ÿ0-9']/g, ""))
          : w.word.replace(/[^a-zà-ÿA-ZÀ-Þ0-9]/g, "").length >= 7,
      })),
    });
    cur = [];
  };
  for (const w of merged) {
    cur.push(w);
    if (cur.length >= maxWords || /[.!?…]$/.test(w.word)) flush();
  }
  flush();
  return cues;
}

/** Two-line wrap: split cue text near the middle word boundary. */
export function wrapCue(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 4) return [text];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function strokeStyle(sw: number): string {
  return `paint-order: stroke; stroke: rgba(0,0,0,0.55); stroke-width: ${sw}px; stroke-linejoin: round;`;
}

let cachedFontFace: string | null = null;
/** Diagnostic: "embedded" when the bundled font was found, else "fallback". */
export function captionFontStatus(): string {
  captionFontFace();
  return cachedFontFace ? "embedded" : "fallback";
}

/**
 * @font-face with the bundled Inter Bold (TTF) as data URI.
 * Searches upward/outward from CWD and the bundled module dir (Vercel
 * materializes traced files at varying roots) for assets/fonts/Inter-Bold.ttf.
 * TTF (not WOFF): librsvg decodes TTF data URIs more reliably.
 * Returns "" when missing (falls back to system stack — local dev only).
 */
function captionFontFace(): string {
  if (cachedFontFace !== null) return cachedFontFace;
  try {
    const { existsSync, readFileSync, readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
    const p = require("node:path") as typeof import("node:path");
    const found = new Set<string>();
    try {
      found.add(process.cwd());
    } catch {}
    try {
      found.add(p.dirname(require.main?.filename || ""));
    } catch {}
    try {
      let d: string = __dirname;
      for (let i = 0; i < 6; i++) {
        found.add(d);
        d = p.dirname(d);
      }
    } catch {}
    for (const r of ["/var/task", "/tmp"]) found.add(r);
    const roots = [...found].filter(Boolean);
    const hit = (dir: string, depth: number): string | null => {
      if (depth < 0) return null;
      try {
        const direct = p.join(dir, "assets", "fonts", "Inter-Bold.ttf");
        if (existsSync(direct) && statSync(direct).isFile()) return direct;
        if (depth === 0) return null;
        for (const e of readdirSync(dir)) {
          if (e === "node_modules" || e.startsWith(".")) continue;
          try {
            const sub = p.join(dir, e);
            if (statSync(sub).isDirectory()) {
              const r = hit(sub, depth - 1);
              if (r) return r;
            }
          } catch {}
        }
      } catch {}
      return null;
    };
    for (const root of roots) {
      const f = hit(root, 3);
      if (f) {
        const b64 = readFileSync(f).toString("base64");
        cachedFontFace = `@font-face { font-family: 'CapFont'; src: url(data:font/ttf;base64,${b64}) format('truetype'); font-weight: 700; }`;
        return cachedFontFace;
      }
    }
  } catch {}
  cachedFontFace = "";
  return cachedFontFace;
}

/**
 * Render one caption PNG: transparent full-frame canvas (so ffmpeg overlay
 * needs no x/y math), white 700-weight text centered, anchored bottom.
 * Up to 2 stacked lines. NO background boxes.
 *
 * Karaoke (skill parity): words at/before `spokenThrough` render full-white;
 * upcoming words render at 40% opacity; emphasis (keyword) words that have
 * been spoken pop in accent yellow.
 *
 * Font: Inter Bold embedded via @font-face data URI — serverless Linux has
 * NO system fonts (Apple-only stacks render as tofu boxes there).
 */
export async function renderCaptionPng(
  cue: CaptionCue,
  outPath: string,
  frameW: number,
  frameH: number,
  /** Seconds (absolute, same clock as cue timings): words ≤ this are "spoken". */
  spokenThrough?: number
): Promise<void> {
  const lines = wrapCue(cue.text);
  const fontSize = Math.round(Math.min(frameW, frameH) * (frameW <= frameH ? 0.052 : 0.042));
  const lh = Math.round(fontSize * 1.25);
  // Skill safe area: captions at bottom 18% (TikTok/Reels/Shorts draw
  // progress bar + rails over the bottom ~12-15%). Never center-face.
  const bottomMargin = Math.round(frameH * 0.18);
  const y2 = frameH - bottomMargin;
  const y1 = lines.length > 1 ? y2 - lh : y2;
  const sw = Math.max(2, Math.round(fontSize / 10));
  // Karaoke word spans: spoken → full white; upcoming → 40% opacity;
  // spoken emphasis (keyword) → accent yellow pop (#ffd60a, skill parity).
  const st = spokenThrough ?? Number.POSITIVE_INFINITY;
  const wordList = (cue.words && cue.words.length > 0
    ? cue.words
    : cue.text.split(/\s+/).filter(Boolean).map((word) => ({ word, start: cue.start, end: cue.end, emphasis: false }))
  ).map((w) => {
    const spoken = w.end <= st + 0.001;
    // librsvg (sharp) ignora opacity sui tspan: upcoming = fill grigio
    // esplicito + fill-opacity, non opacity ereditata.
    const fill = spoken ? (w.emphasis ? "#ffd60a" : "#ffffff") : "#9a9a9a";
    const fillOp = spoken ? "1" : "0.45";
    const weight = w.emphasis && spoken ? 800 : 700;
    return `<tspan fill="${fill}" fill-opacity="${fillOp}" font-weight="${weight}">${escXml(w.word)}</tspan>`;
  });
  // Re-split tspans across the same 2 visual lines as wrapCue.
  const flat = cue.text.split(/\s+/).filter(Boolean);
  const mid = lines.length > 1 ? lines[0].split(/\s+/).filter(Boolean).length : flat.length;
  const line1 = wordList.slice(0, mid).map((s, k, arr) => s + (k < arr.length - 1 ? " " : "")).join("");
  const line2 = wordList.slice(mid).map((s, k, arr) => s + (k < arr.length - 1 ? " " : "")).join("");
  const tspans =
    lines.length > 1
      ? `<text x="${frameW / 2}" y="${y1}" class="cap" style="${strokeStyle(sw)}">${line1}</text>\n  <text x="${frameW / 2}" y="${y2}" class="cap" style="${strokeStyle(sw)}">${line2}</text>`
      : `<text x="${frameW / 2}" y="${y2}" class="cap" style="${strokeStyle(sw)}">${line1}</text>`;
  const fontFace = captionFontFace();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${frameW}" height="${frameH}">
  <style>
    ${fontFace}
    .cap { font-family: 'CapFont', 'Helvetica Neue', Helvetica, Arial, sans-serif;
           font-size: ${fontSize}px; font-weight: 700; fill: #ffffff;
           text-anchor: middle; }
  </style>
  ${tspans}
</svg>`;
  mkdirSync(path.dirname(outPath), { recursive: true });
  // NOTE: no density scaling — SVG width/height already equal the frame size,
  // so the PNG matches the video frame pixel-for-pixel (overlay=0:0).
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  writeFileSync(outPath, buf);
}

/**
 * Full overlay chain: base video label [v0] + N png inputs → out label.
 * Karaoke frames: each cue renders K frames (one per word boundary):
 * frame k shows words ≤ wordEnds[k] as spoken. Windows tile the cue span.
 * Each frame: [prev][idx:v]overlay=0:0:enable='between(t,a,b)'[vcap{i}].
 */
export function buildCaptionChain(
  pngStartIndex: number,
  cues: CaptionCue[]
): { filter: string; outLabel: string; windows: Array<{ start: number; end: number }> } {
  let prev = "[v0]";
  const parts: string[] = [];
  const windows: Array<{ start: number; end: number }> = [];
  cues.forEach((cue, i) => {
    // Word-boundary frames inside this cue (karaoke sweep, skill parity).
    const ends = (cue.words && cue.words.length > 0
      ? cue.words.map((w) => w.end)
      : [cue.end]
    ).filter((e, k, arr) => e > cue.start && (k === arr.length - 1 || e < arr[k + 1]));
    const bounds = [cue.start, ...ends.filter((e) => e < cue.end), cue.end];
    for (let k = 0; k < bounds.length - 1; k++) {
      const idx = pngStartIndex + windows.length;
      const out = `[vcap${windows.length}]`;
      const a = bounds[k];
      const b = bounds[k + 1];
      parts.push(`${prev}[${idx}:v]overlay=0:0:enable='between(t,${a.toFixed(2)},${b.toFixed(2)})'${out}`);
      prev = out;
      windows.push({ start: a, end: b });
    }
    void i;
  });
  return { filter: parts.join(";"), outLabel: prev, windows };
}

export interface KeepSegmentLike {
  start: number;
  end: number;
}

/**
 * Remap caption cues from SOURCE timeline to FINAL (post-cut) timeline.
 * Drops cues fully inside removed spans; clamps partial overlaps.
 * Word timings remap with the same shift (karaoke sweep stays in sync).
 * Pure function — no invented content, only time-shifted real words.
 */
export function remapCuesToFinal(cues: CaptionCue[], keep: KeepSegmentLike[]): CaptionCue[] {
  const sorted = [...keep]
    .filter((k) => k.end > k.start)
    .sort((a, b) => a.start - b.start);
  const out: CaptionCue[] = [];
  let offset = 0; // final-time cursor = sum of kept durations so far
  for (const k of sorted) {
    for (const cue of cues) {
      const s = Math.max(cue.start, k.start);
      const e = Math.min(cue.end, k.end);
      if (e - s < 0.15) continue; // sliver — skip
      const shift = offset - k.start;
      out.push({
        start: Number((offset + (s - k.start)).toFixed(2)),
        end: Number((offset + (e - k.start)).toFixed(2)),
        text: cue.text,
        words: (cue.words || [])
          .filter((w) => w.end > k.start && w.start < k.end)
          .map((w) => ({
            word: w.word,
            start: Number((w.start + shift).toFixed(2)),
            end: Number((w.end + shift).toFixed(2)),
            emphasis: w.emphasis,
          })),
      });
    }
    offset += k.end - k.start;
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}
