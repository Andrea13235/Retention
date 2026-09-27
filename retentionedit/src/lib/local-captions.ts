/**
 * RetentionEdit — Local captions M2 (SERVER ONLY).
 *
 * Real cues from real STT words (never invented): groups words into cues,
 * renders Apple-minimal PNG overlays (clean white type, subtle shadow,
 * NO boxes/pills/karaoke), burns them via ffmpeg overlay filter with
 * enable=between(t,start,end).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { WordTimestamp } from "./types";

export interface CaptionCue {
  start: number;
  end: number;
  text: string;
}

/** Group words into cues of ≤ maxWords, splitting on end punctuation. */
export function wordsToCues(words: WordTimestamp[], maxWords = 6): CaptionCue[] {
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

/**
 * Render one caption PNG: transparent full-frame canvas (so ffmpeg overlay
 * needs no x/y math), white 600-weight text centered, anchored bottom.
 * Up to 2 stacked lines. NO background boxes.
 */
export async function renderCaptionPng(
  text: string,
  outPath: string,
  frameW: number,
  frameH: number
): Promise<void> {
  const lines = wrapCue(text);
  const fontSize = Math.round(Math.min(frameW, frameH) * (frameW <= frameH ? 0.052 : 0.042));
  const lh = Math.round(fontSize * 1.25);
  // 9% bottom margin: clears player progress bars (YouTube/IG overlay zone).
  const bottomMargin = Math.round(frameH * 0.09);
  const y2 = frameH - bottomMargin;
  const y1 = lines.length > 1 ? y2 - lh : y2;
  const sw = Math.max(2, Math.round(fontSize / 10));
  const tspans =
    lines.length > 1
      ? `<text x="${frameW / 2}" y="${y1}" class="cap" style="${strokeStyle(sw)}">${escXml(lines[0])}</text>\n  <text x="${frameW / 2}" y="${y2}" class="cap" style="${strokeStyle(sw)}">${escXml(lines[1])}</text>`
      : `<text x="${frameW / 2}" y="${y2}" class="cap" style="${strokeStyle(sw)}">${escXml(lines[0])}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${frameW}" height="${frameH}">
  <style>
    .cap { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
           font-size: ${fontSize}px; font-weight: 600; fill: #ffffff;
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
 * Each cue: [prev][idx:v]overlay=0:0:enable='between(t,a,b)'[vcap{i}].
 */
export function buildCaptionChain(
  pngStartIndex: number,
  cues: CaptionCue[]
): { filter: string; outLabel: string } {
  let prev = "[v0]";
  const parts: string[] = [];
  cues.forEach((cue, i) => {
    const idx = pngStartIndex + i;
    const out = `[vcap${i}]`;
    parts.push(`${prev}[${idx}:v]overlay=0:0:enable='between(t,${cue.start.toFixed(2)},${cue.end.toFixed(2)})'${out}`);
    prev = out;
  });
  return { filter: parts.join(";"), outLabel: prev };
}

export interface KeepSegmentLike {
  start: number;
  end: number;
}

/**
 * Remap caption cues from SOURCE timeline to FINAL (post-cut) timeline.
 * Drops cues fully inside removed spans; clamps partial overlaps.
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
      out.push({
        start: Number((offset + (s - k.start)).toFixed(2)),
        end: Number((offset + (e - k.start)).toFixed(2)),
        text: cue.text,
      });
    }
    offset += k.end - k.start;
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}
