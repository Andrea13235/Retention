/**
 * RetentionEdit — Local silence detector (ffmpeg silencedetect).
 *
 * SERVER ONLY. Returns real silence spans [start,end] in seconds for a local
 * media file. Never invents spans: empty array when undetectable (e.g. no
 * audio track).
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { ffmpegBin, ffprobeBin } from "./media-bins";

const execFileAsync = promisify(execFile);

export interface SilenceSpan {
  start: number;
  end: number;
}

/** True when the file has at least one audio stream. */
export async function hasAudioTrack(mediaPath: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(ffprobeBin(), [
      "-v",
      "error",
      "-select_streams",
      "a",
      "-show_entries",
      "stream=index",
      "-of",
      "csv=p=0",
      mediaPath,
    ]);
    return String(stdout).trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Detect silences: noise floor -32dB, min duration 0.45s.
 * Returns spans sorted by start. Caps span count to avoid pathological outputs.
 */
export async function detectSilences(
  mediaPath: string,
  opts?: { noiseDb?: number; minDurSec?: number; timeoutMs?: number; maxSpans?: number }
): Promise<SilenceSpan[]> {
  if (!existsSync(mediaPath)) return [];
  if (!(await hasAudioTrack(mediaPath))) return [];

  const noiseDb = opts?.noiseDb ?? -32;
  const minDur = opts?.minDurSec ?? 0.45;
  const timeoutMs = opts?.timeoutMs ?? 120_000;
  const maxSpans = opts?.maxSpans ?? 200;

  const parseLog = (log: string): SilenceSpan[] => {
    const spans: SilenceSpan[] = [];
    let pendingStart: number | null = null;
    for (const line of log.split("\n")) {
      const mStart = line.match(/silence_start:\s*([\d.]+)/);
      if (mStart) {
        pendingStart = Number(mStart[1]);
        continue;
      }
      const mEnd = line.match(/silence_end:\s*([\d.]+)/);
      if (mEnd && pendingStart !== null) {
        const end = Number(mEnd[1]);
        if (Number.isFinite(pendingStart) && Number.isFinite(end) && end > pendingStart) {
          spans.push({ start: Number(pendingStart.toFixed(2)), end: Number(end.toFixed(2)) });
          if (spans.length >= maxSpans) break;
        }
        pendingStart = null;
      }
    }
    return spans;
  };

  try {
    const { stderr } = await execFileAsync(
      ffmpegBin(),
      [
        "-hide_banner",
        "-i",
        mediaPath,
        "-af",
        `silencedetect=noise=${noiseDb}dB:d=${minDur}`,
        "-vn",
        "-sn",
        "-dn",
        "-f",
        "null",
        "/dev/null",
      ],
      { timeout: timeoutMs }
    );
    // silencedetect logs to stderr; ffmpeg exits 0 on success.
    return parseLog(String(stderr || ""));
  } catch (e: unknown) {
    // Non-zero exit (timeout etc.) — still try to salvage partial log.
    const err = e as { stderr?: string };
    const log = String(err?.stderr || "");
    if (!log) return [];
    return parseLog(log);
  }
}

/**
 * Merge overlapping/adjacent spans and keep a breath buffer (default 0.12s
 * on each side) so cuts never clip word edges. Drops spans shorter than
 * minKeepSec after buffering.
 */
export function spansToCuts(
  spans: SilenceSpan[],
  opts?: { breathSec?: number; minKeepSec?: number; mediaDuration?: number }
): Array<{ start: number; end: number }> {
  const breath = opts?.breathSec ?? 0.12;
  const minKeep = opts?.minKeepSec ?? 0.3;
  const dur = opts?.mediaDuration;

  const sorted = [...spans]
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start)
    .sort((a, b) => a.start - b.start);

  // Merge overlaps.
  const merged: SilenceSpan[] = [];
  for (const s of sorted) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end + 0.05) {
      last.end = Math.max(last.end, s.end);
    } else {
      merged.push({ ...s });
    }
  }

  const cuts: Array<{ start: number; end: number }> = [];
  for (const s of merged) {
    const cs = Math.max(0, s.start + breath);
    let ce = s.end - breath;
    if (typeof dur === "number" && Number.isFinite(dur) && dur > 0) {
      ce = Math.min(ce, dur);
    }
    if (ce - cs >= minKeep) {
      cuts.push({ start: Number(cs.toFixed(2)), end: Number(ce.toFixed(2)) });
    }
  }
  return cuts;
}
