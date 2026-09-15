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
}

interface FfprobeOutput {
  streams: FfprobeStream[];
  format: { duration?: string };
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

    assets.push({
      media_id: randomUUID(),
      path,
      duration_sec: Number(probe.format.duration ?? 0),
      width: video?.width ?? 0,
      height: video?.height ?? 0,
      fps: parseFps(video?.avg_frame_rate),
      audio_streams: audioCount,
    });
  }
  return assets;
}
