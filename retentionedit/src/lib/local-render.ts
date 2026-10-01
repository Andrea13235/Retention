/**
 * RetentionEdit — Local real render engine (ffmpeg, H.264 + AAC MP4).
 *
 * SERVER ONLY (node:child_process + node:fs). Never import from client.
 *
 * renderLocalCut():
 *  - input: local source file + keep segments (complement of cuts)
 *  - output: real edited MP4 (libx264 + aac), same container as requested
 *    format dimensions (short 1080x1920 crop-center, long 1920x1080 fit),
 *    loudnorm + aac audio, faststart for streaming/download.
 *  - cover: center-frame JPG thumbnail.
 *
 * Never invents content: with zero/degenerate keep segments it re-encodes
 * (normalize) instead of failing, so My Projects always gets a playable MP4.
 */
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { VideoFormat } from "./types";
import type { CaptionCue } from "./local-captions";
import type { ZoomWindow } from "./local-scenes";
import { ffmpegBin, ffprobeBin } from "./media-bins";
import { storageRoot } from "./storage-root";

const execFileAsync = promisify(execFile);

export interface KeepSegment {
  start: number;
  end: number;
}

export interface BrollOverlay {
  /** Absolute server path of the generated PNG. */
  imagePath: string;
  /** Window on the FINAL timeline (seconds). */
  finalStart: number;
  finalEnd: number;
}

export interface LocalRenderResult {
  /** Absolute path of the rendered MP4. */
  mp4Path: string;
  /** Absolute path of the cover JPG. */
  coverPath: string;
  bytes: number;
  durationSec: number;
  /** Original source duration (pre-cut). */
  sourceDuration: number;
  /** Number of silence cuts removed (keep segments - 1, min 0). */
  cutsApplied: number;
  timeSavedSec: number;
  /** Number of caption cues actually burned into the MP4 (0 = STT absent). */
  captionsBurned: number;
  /** Number of real scene cuts the zoom engine fired on (0 = single-take). */
  zoomsApplied: number;
  /** Number of Higgsfield B-rolls composited with Ken Burns (0 = none). */
  brollsApplied: number;
}

export function cutsToKeep(
  cuts: Array<{ start: number; end: number }>,
  duration: number
): { keep: KeepSegment[]; saved: number } {
  const sorted = [...cuts]
    .filter((c) => Number.isFinite(c.start) && Number.isFinite(c.end) && c.end > c.start)
    .sort((a, b) => a.start - b.start);
  const keep: KeepSegment[] = [];
  let cursor = 0;
  let saved = 0;
  for (const c of sorted) {
    const cs = Math.max(0, Math.min(c.start, duration));
    const ce = Math.max(0, Math.min(c.end, duration));
    if (cs > cursor) keep.push({ start: Number(cursor.toFixed(2)), end: Number(cs.toFixed(2)) });
    if (ce > cursor) {
      saved += ce - Math.max(cursor, cs);
      cursor = ce;
    }
  }
  if (cursor < duration - 0.05) {
    keep.push({ start: Number(cursor.toFixed(2)), end: Number(duration.toFixed(2)) });
  }
  const valid = keep.filter((k) => k.end - k.start >= 0.25);
  return { keep: valid.length > 0 ? valid : [{ start: 0, end: Number(duration.toFixed(2)) }], saved: Number(saved.toFixed(2)) };
}

export async function probeMedia(filePath: string): Promise<{
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
} | null> {
  try {
    const { stdout } = await execFileAsync(ffprobeBin(), [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=codec_type,width,height",
      "-of",
      "json",
      filePath,
    ]);
    const j = JSON.parse(String(stdout)) as {
      format?: { duration?: string };
      streams?: Array<{ codec_type?: string; width?: number; height?: number }>;
    };
    const duration = Number(j.format?.duration || 0);
    if (!Number.isFinite(duration) || duration <= 0) return null;
    const v = (j.streams || []).find((s) => s.codec_type === "video");
    const hasAudio = (j.streams || []).some((s) => s.codec_type === "audio");
    return {
      duration,
      width: Number(v?.width || 0),
      height: Number(v?.height || 0),
      hasAudio,
    };
  } catch {
    return null;
  }
}

function vfFor(format: VideoFormat): string {
  // Short 9:16: center-crop to 1080x1920. Long 16:9: fit to 1920x1080.
  if (format === "short") {
    return "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30";
  }
  return "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30";
}

/**
 * Render the edited MP4 from keep segments.
 * Two-pass approach for sample-accurate audio cuts:
 *  pass 1 — per-segment intermediates (video re-encode + audio copy-safe aac)
 *  pass 2 — concat demuxer (c copy) + loudnorm single-pass + faststart.
 */
export async function renderLocalCut(params: {
  sourcePath: string;
  keep: KeepSegment[];
  format: VideoFormat;
  outDir: string;
  basename: string;
  timeoutMs?: number;
  /**
   * Real caption cues on the FINAL (post-cut) timeline, with per-word
   * timings. Burned as karaoke PNG overlays in pass 2 (spoken full-white,
   * upcoming 40%, keyword pop yellow). Empty/undefined = no captions.
   * Cues WITHOUT words[] still render (all-words-spoken fallback PNG).
   */
  captions?: CaptionCue[];
  /**
   * Real zoom windows on the FINAL timeline (from true scene cuts only).
   * Empty/undefined = no zoom (single-take). Applied after captions.
   */
  zooms?: ZoomWindow[];
  /**
   * Higgsfield B-roll overlays (server PNGs, Ken Burns animated).
   * Empty/undefined = none. Applied AFTER zoom so the B-roll fills frame.
   */
  brolls?: BrollOverlay[];
}): Promise<LocalRenderResult> {
  const { sourcePath, format, outDir } = params;
  const timeoutMs = params.timeoutMs ?? 600_000;
  if (!existsSync(sourcePath)) throw new Error("source not found");

  const probed = await probeMedia(sourcePath);
  if (!probed) throw new Error("unreadable source");

  const keep = params.keep.filter((k) => k.end > k.start);
  const effectiveKeep = keep.length > 0 ? keep : [{ start: 0, end: probed.duration }];

  mkdirSync(outDir, { recursive: true });
  const workdir = path.join(outDir, `${params.basename}_parts`);
  mkdirSync(workdir, { recursive: true });

  const vf = vfFor(format);
  const segFiles: string[] = [];

  // Pass 1: cut each keep segment (re-encode video for frame accuracy).
  for (let i = 0; i < effectiveKeep.length; i++) {
    const seg = effectiveKeep[i];
    const segPath = path.join(workdir, `seg_${String(i).padStart(3, "0")}.mp4`);
    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-ss",
      String(seg.start),
      "-to",
      String(seg.end),
      "-i",
      sourcePath,
      "-vf",
      vf,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
    ];
    if (probed.hasAudio) {
      args.push("-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2");
    } else {
      args.push("-an");
    }
    args.push(segPath);
    await execFileAsync(ffmpegBin(), args, { timeout: timeoutMs });
    segFiles.push(segPath);
  }

  // Pass 2: concat (+ optional burned captions).
  const listPath = path.join(workdir, "concat.txt");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(listPath, segFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));

  // Render caption PNGs at FINAL frame size (long 1920x1080, short 1080x1920).
  // Karaoke: one PNG per word-boundary window (spoken vs upcoming sweep).
  const captions = (params.captions || []).filter(
    (c) => Number.isFinite(c.start) && Number.isFinite(c.end) && c.end > c.start && c.text.trim().length > 0
  );
  const capDir = path.join(workdir, "captions");
  const capPngPaths: string[] = [];
  const capSpokenThrough: number[] = [];
  if (captions.length > 0) {
    const { mkdirSync: mkCap } = await import("node:fs");
    mkCap(capDir, { recursive: true });
    const { renderCaptionPng, buildCaptionChain: previewChain } = await import("./local-captions");
    const fw = format === "short" ? 1080 : 1920;
    const fh = format === "short" ? 1920 : 1080;
    // Word-boundary windows per cue (same tiling buildCaptionChain uses).
    const preview = previewChain(1, captions);
    const MAX_FRAMES = 1200; // guard: pathological STT can't explode ffmpeg args
    const frames = preview.windows.slice(0, MAX_FRAMES);
    for (let i = 0; i < frames.length; i++) {
      // Owning cue = last cue whose span contains this window start.
      let cue = captions[0];
      for (const c of captions) {
        if (c.start <= frames[i].start + 0.001) cue = c;
        else break;
      }
      const p = path.join(capDir, `cap_${String(i).padStart(4, "0")}.png`);
      await renderCaptionPng(cue, p, fw, fh, frames[i].end);
      capPngPaths.push(p);
      capSpokenThrough.push(frames[i].end);
    }
  }
  const burnedCues = captions.slice(0, capPngPaths.length);

  const mp4Path = path.join(outDir, `${params.basename}_final.mp4`);
  const concatArgs = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
  ];
  for (const p of capPngPaths) {
    concatArgs.push("-i", p);
  }
  // Filter graph: [0:v]vf → [v0], then caption overlays → [vout], then zoom.
  let vfChain = `[0:v]${vf}[v0]`;
  let vOut = "[v0]";
  if (capPngPaths.length > 0) {
    const { buildCaptionChain } = await import("./local-captions");
    const chain = buildCaptionChain(1, captions.slice(0, burnedCues.length));
    vfChain += `;${chain.filter}`;
    vOut = chain.outLabel;
  }
  const zooms = (params.zooms || []).filter(
    (z) => Number.isFinite(z.finalStart) && Number.isFinite(z.finalEnd) && z.finalEnd > z.finalStart && z.peak > 1.0 && z.peak <= 1.5
  );
  if (zooms.length > 0) {
    const { zoomExpression } = await import("./local-scenes");
    const fw = format === "short" ? 1080 : 1920;
    const fh = format === "short" ? 1920 : 1080;
    const z = zoomExpression(zooms, 30);
    vfChain += `;${vOut}scale=${fw * 2}:${fh * 2},zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${fw}x${fh}:fps=30[vzoom]`;
    vOut = "[vzoom]";
  }
  // M7 B-roll: Higgsfield PNG → Ken Burns (scale 1.0→1.12 + slow drift) →
  // fullscreen overlay on its FINAL-timeline window. zoompan on a looped
  // still: d = frames (dur*30), s = frame size, fps=30 for CFR sync.
  const { existsSync: exSync } = await import("node:fs");
  const KB_FPS = 30;
  const brolls = (params.brolls || []).filter(
    (b) =>
      b &&
      typeof b.imagePath === "string" &&
      exSync(b.imagePath) &&
      Number.isFinite(b.finalStart) &&
      Number.isFinite(b.finalEnd) &&
      b.finalEnd - b.finalStart >= 1.0
  );
  let brollIdx = 0;
  if (brolls.length > 0) {
    const fw = format === "short" ? 1080 : 1920;
    const fh = format === "short" ? 1920 : 1080;
    for (const b of brolls.slice(0, 2)) {
      // Cap the looped still to its window duration: without -t, `-loop 1`
      // feeds infinite frames and zoompan(d=N) never terminates the stream.
      const dur = Math.min(b.finalEnd - b.finalStart, 8); // guard: ≤8s per broll
      const endT = b.finalStart + dur;
      concatArgs.push("-loop", "1", "-t", String(Number(dur.toFixed(2))), "-i", b.imagePath);
      const inIdx = 1 + capPngPaths.length + brollIdx;
      const frames = Math.max(30, Math.round(dur * KB_FPS));
      // Ken Burns: linear 1.0→1.12 over the window + gentle rightward drift.
      const kbZ = `1+0.12*min(max((in)/${frames},0),1)`;
      const kbX = `(iw-iw/zoom)*min(max((in)/${frames},0),1)`;
      const kbY = `(ih-ih/zoom)*0.5`;
      const kbLabel = `[kb${brollIdx}]`;
      const ovLabel = `[ov${brollIdx}]`;
      vfChain +=
        `;[${inIdx}:v]scale=${fw * 2}:${fh * 2},` +
        `zoompan=z='${kbZ}':x='${kbX}':y='${kbY}':d=${frames}:s=${fw}x${fh}:fps=${KB_FPS},` +
        `setsar=1,format=yuv420p${kbLabel}` +
        `;${vOut}${kbLabel}overlay=0:0:enable='between(t,${b.finalStart.toFixed(2)},${endT.toFixed(2)})'${ovLabel}`;
      vOut = ovLabel;
      brollIdx++;
    }
  }
  concatArgs.push("-filter_complex", vfChain, "-map", vOut);
  if (probed.hasAudio) {
    concatArgs.push("-map", "0:a", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11");
  }
  // Cap output to the concat (main timeline) duration: looped broll inputs
  // would otherwise extend the MP4 beyond the real edited length.
  const mainDur = effectiveKeep.reduce((a, k) => a + Math.max(0, k.end - k.start), 0);
  concatArgs.push("-t", String(Number(mainDur.toFixed(2))));
  concatArgs.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p");
  if (probed.hasAudio) {
    concatArgs.push("-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2");
  } else {
    concatArgs.push("-an");
  }
  concatArgs.push("-movflags", "+faststart", mp4Path);
  await execFileAsync(ffmpegBin(), concatArgs, { timeout: timeoutMs });

  // Cover: center frame of the final MP4.
  const finalProbe = (await probeMedia(mp4Path)) ?? { duration: 1, width: 0, height: 0, hasAudio: false };
  const coverAt = Math.max(0.5, Math.min(finalProbe.duration - 0.5, finalProbe.duration * 0.35));
  const coverPath = path.join(outDir, `${params.basename}_cover.jpg`);
  await execFileAsync(
    ffmpegBin(),
    ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(Number(coverAt.toFixed(2))), "-i", mp4Path, "-frames:v", "1", "-q:v", "3", coverPath],
    { timeout: 60_000 }
  );

  const bytes = statSync(mp4Path).size;
  const timeSaved = Math.max(0, probed.duration - finalProbe.duration);
  const sourceDuration = probed.duration;
  const cutsApplied = Math.max(0, effectiveKeep.length - 1);

  return {
    mp4Path,
    coverPath,
    bytes,
    durationSec: Number(finalProbe.duration.toFixed(2)),
    sourceDuration: Number(sourceDuration.toFixed(2)),
    cutsApplied,
    timeSavedSec: Number(timeSaved.toFixed(2)),
    captionsBurned: burnedCues.length,
    zoomsApplied: zooms.length,
    brollsApplied: brollIdx,
  };
}

/** Resolve a job rawVideoUrl to a local file path when possible. */
export function resolveLocalSource(rawVideoUrl: string, userId: string): string | null {
  if (!rawVideoUrl) return null;
  // /api/media/stream?file=<stored> → .vault/uploads/<userId>/<stored>
  const m = rawVideoUrl.match(/\/api\/media\/stream\?file=([^&]+)/);
  if (m) {
    const stored = path.basename(decodeURIComponent(m[1]));
    const cand = path.join(storageRoot(), "uploads", userId, stored);
    if (existsSync(cand)) return cand;
    const tmpCand = path.join(tmpdir(), "uploads", userId, stored);
    if (existsSync(tmpCand)) return tmpCand;
    return null;
  }
  // Absolute local path (dev only).
  if (rawVideoUrl.startsWith("/") && !rawVideoUrl.startsWith("/api/") && existsSync(rawVideoUrl)) {
    return rawVideoUrl;
  }
  // public/ asset path.
  if (rawVideoUrl.startsWith("/videos/") || rawVideoUrl.startsWith("/public/")) {
    const rel = rawVideoUrl.replace(/^\/public\//, "").replace(/^\//, "");
    const cand = path.join(process.cwd(), "public", rel.replace(/^videos\//, "videos/"));
    void cand;
    const cand2 = path.join(process.cwd(), rel);
    if (existsSync(cand2)) return cand2;
  }
  return null;
}

export function rendersDir(userId: string): string {
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50) || "default";
  return path.join(tmpdir(), "retentionedit-renders", safe);
}
