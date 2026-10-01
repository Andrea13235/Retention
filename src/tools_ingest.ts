/**
 * tools_ingest.ts — Step 1: RAW import.
 * Registers files, extracts metadata with ffprobe, assigns a media_id.
 */
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import { promisify } from "node:util";
import type { MediaAsset } from "./types.js";

const execFileAsync = promisify(execFile);

interface FfprobeStream {
  codec_type: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  /** Rotation tag (some containers), degrees. */
  rotation?: number | string;
  /** iPhone display-matrix side data (preferred source). */
  side_data_list?: Array<{
    side_data_type?: string;
    rotation?: number;
  }>;
}

interface FfprobeOutput {
  streams: FfprobeStream[];
  format: { duration?: string };
}

/** Normalize any reported rotation to one of 0 | 90 | -90 | 180. */
function normalizeRotation(raw: unknown): number {
  const deg = Number(raw);
  if (!Number.isFinite(deg)) return 0;
  const norm = ((deg % 360) + 360) % 360; // 0..359
  if (norm === 90) return 90;
  if (norm === 270) return -90;
  if (norm === 180) return 180;
  return 0;
}

/** Extract rotation: display-matrix side data first, then rotation tag. */
function detectRotation(video: FfprobeStream | undefined): number {
  if (!video) return 0;
  const matrix = (video.side_data_list ?? []).find((s) => {
    const t = (s.side_data_type ?? "").toLowerCase().replace(/[\s_-]/g, "");
    return t.includes("displaymatrix");
  });
  if (matrix?.rotation !== undefined)
    return normalizeRotation(matrix.rotation);
  if (video.rotation !== undefined) return normalizeRotation(video.rotation);
  return 0;
}

function parseFps(avg: string | undefined): number {
  if (!avg) return 0;
  const [n, d] = avg.split("/").map(Number);
  if (!n || !d) return 0;
  return n / d;
}

export async function importRawMedia(paths: string[]): Promise<MediaAsset[]> {
  if (!Array.isArray(paths) || paths.length === 0)
    throw new Error("import_raw_media: `paths` must be a non-empty array");

  const assets: MediaAsset[] = [];
  for (const path of paths) {
    const st = await stat(path).catch(() => null);
    if (!st || !st.isFile())
      throw new Error(`import_raw_media: file not found: ${path}`);

    let probe: FfprobeOutput;
    try {
      const { stdout } = await execFileAsync("ffprobe", [
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_streams",
        "-show_format",
        path,
      ]);
      probe = JSON.parse(stdout) as FfprobeOutput;
    } catch (err) {
      throw new Error(
        `import_raw_media: ffprobe failed on ${path} — ${(err as Error).message}`
      );
    }

    const video = probe.streams.find((s) => s.codec_type === "video");
    const audioCount = probe.streams.filter(
      (s) => s.codec_type === "audio"
    ).length;

    // Display dimensions: a ±90° rotation swaps width/height (portrait
    // phones store a landscape frame + rotation flag).
    const rotation = detectRotation(video);
    const rawW = video?.width ?? 0;
    const rawH = video?.height ?? 0;
    const swapped = Math.abs(rotation) === 90;
    const displayW = swapped ? rawH : rawW;
    const displayH = swapped ? rawW : rawH;

    assets.push({
      media_id: randomUUID(),
      path,
      duration_sec: Number(probe.format.duration ?? 0),
      width: rawW,
      height: rawH,
      fps: parseFps(video?.avg_frame_rate),
      audio_streams: audioCount,
      rotation,
      display_width: displayW,
      display_height: displayH,
      is_portrait: displayH > displayW,
    });
  }
  return assets;
}
