/**
 * RetentionEdit — Local scene detection M3 (SERVER ONLY).
 *
 * Real scene cuts via ffmpeg `select='gt(scene,T)'` + showinfo.
 * NEVER invents scenes: empty array when single-take. The zoom engine
 * only fires on these real boundaries (rule: motion on true scene changes,
 * never 0.8s before / 2s after a cut we made ourselves).
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ffmpegBin } from "./media-bins";

const execFileAsync = promisify(execFile);

export interface SceneCut {
  /** Time (seconds) of the first frame of the new scene. */
  at: number;
}

const SCENE_THRESHOLD = 0.35;

/** Detect real scene boundaries in a local media file. */
export async function detectScenes(
  mediaPath: string,
  timeoutMs = 120_000
): Promise<SceneCut[]> {
  try {
    const { stderr } = await execFileAsync(
      ffmpegBin(),
      [
        "-hide_banner",
        "-loglevel",
        "info",
        "-i",
        mediaPath,
        "-vf",
        `select='gt(scene,${SCENE_THRESHOLD})',showinfo`,
        "-f",
        "null",
        "-",
      ],
      { timeout: timeoutMs }
    );
    return parseSceneLog(String(stderr));
  } catch (err: unknown) {
    // ffmpeg exits 0 here; on real failure (unreadable file) return [].
    const stderr = (err as { stderr?: unknown })?.stderr;
    if (typeof stderr === "string") return parseSceneLog(stderr);
    return [];
  }
}

/** Parse showinfo `pts_time:X` lines → scene cuts. Exported for tests. */
export function parseSceneLog(log: string): SceneCut[] {
  const cuts: SceneCut[] = [];
  const re = /pts_time:(\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  let first = true;
  while ((m = re.exec(log)) !== null) {
    const at = Number(m[1]);
    if (!Number.isFinite(at)) continue;
    // The very first selected frame is t=0 (stream start), not a cut.
    if (first && at < 0.05) {
      first = false;
      continue;
    }
    first = false;
    if (at < 0.2) continue;
    const prev = cuts[cuts.length - 1];
    if (prev && Math.abs(prev.at - at) < 0.5) continue; // dedupe
    cuts.push({ at: Number(at.toFixed(2)) });
  }
  return cuts;
}

export interface ZoomPlan {
  /** Scene time the zoom anchors to (source timeline). */
  at: number;
  /** Zoom window start/end on FINAL timeline (computed post-cut by caller). */
  finalStart: number;
  finalEnd: number;
  /** Peak zoom factor (1.0 = no zoom). */
  peak: number;
}

export interface ZoomWindow {
  finalStart: number;
  finalEnd: number;
  peak: number;
}

/**
 * Build zoom windows from FINAL-timeline scene times.
 * Rule: 0.9s ease-in push AFTER the cut (never before), peak 1.12,
 * hold, release by +2.5s. Min 3s gap between zooms (skip crowded cuts).
 */
export function planZooms(
  finalSceneTimes: number[],
  finalDuration: number,
  opts?: { peak?: number; leadIn?: number; release?: number; minGap?: number }
): ZoomWindow[] {
  const peak = opts?.peak ?? 1.12;
  const leadIn = opts?.leadIn ?? 0.9;
  const release = opts?.release ?? 2.5;
  const minGap = opts?.minGap ?? 3.0;
  const wins: ZoomWindow[] = [];
  let lastEnd = -Infinity;
  for (const at of [...finalSceneTimes].sort((a, b) => a - b)) {
    if (at < 0.4 || at > finalDuration - 0.6) continue;
    const s = at;
    const e = Math.min(finalDuration, at + release);
    if (e - s < leadIn + 0.3) continue;
    if (s - lastEnd < minGap) continue;
    wins.push({ finalStart: Number(s.toFixed(2)), finalEnd: Number(e.toFixed(2)), peak });
    lastEnd = e;
  }
  return wins;
}

/**
 * Remap source-timeline scene times → final timeline through keep segments.
 * Drops scenes inside removed spans (no zoom on a cut we made).
 */
export function remapScenesToFinal(
  scenes: SceneCut[],
  keep: Array<{ start: number; end: number }>
): number[] {
  const sorted = [...keep].filter((k) => k.end > k.start).sort((a, b) => a.start - b.start);
  const out: number[] = [];
  let offset = 0;
  for (const k of sorted) {
    for (const s of scenes) {
      if (s.at >= k.start + 0.1 && s.at <= k.end - 0.1) {
        out.push(Number((offset + (s.at - k.start)).toFixed(2)));
      }
    }
    offset += k.end - k.start;
  }
  return out.sort((a, b) => a - b);
}

/**
 * Build the zoompan `z` expression for the whole timeline (frame-based).
 * zoompan exposes `in` (input frame count); timeline is CFR 30fps from
 * pass 1, so time→frame = t*FPS. Per window: linear ramp 0.9s up to peak,
 * hold, linear release over last 0.8s. Non-overlapping by construction.
 * No windows → "1" (passthrough, zero visual change).
 */
export function zoomExpression(wins: ZoomWindow[], fps = 30): string {
  if (wins.length === 0) return "1";
  const terms = wins.map((w) => {
    const amp = (w.peak - 1).toFixed(4);
    const s = Math.round(w.finalStart * fps);
    const e = Math.round(w.finalEnd * fps);
    const up = Math.round(0.9 * fps);
    const dn = Math.round(0.8 * fps);
    // up: clamp((in-s)/up,0,1); down: clamp((e-in)/dn,0,1); gate between(s,e)
    return `(${amp}*min(max((in-${s})/${up},0),1)*min(max((${e}-in)/${dn},0),1)*gte(in,${s})*lte(in,${e}))`;
  });
  return `1+${terms.join("+")}`;
}

/** Full zoompan filter string for final W×H (applied after vf scale/crop). */
export function zoompanFilter(wins: ZoomWindow[], outW: number, outH: number, fps = 30): string {
  if (wins.length === 0) return "";
  const z = zoomExpression(wins, fps);
  // 2x upscale first so zoom never samples beyond frame edges.
  return `scale=${outW * 2}:${outH * 2},zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${outW}x${outH}:fps=${fps}`;
}
