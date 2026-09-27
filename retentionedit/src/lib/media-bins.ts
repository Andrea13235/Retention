/**
 * RetentionEdit — media binary resolver (SERVER ONLY).
 *
 * Local dev: system ffmpeg/ffprobe from PATH (brew).
 * Vercel serverless: no system binaries → bundled ffmpeg-static /
 * ffprobe-static (linux x64) resolved from node_modules.
 *
 * Never import from client components.
 */
let cached: { ffmpeg: string; ffprobe: string } | null = null;

function fromPath(name: string): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    const out = execSync(`command -v ${name} || which ${name}`, { timeout: 5000 }).toString().trim().split("\n")[0]?.trim();
    if (out && out.startsWith("/")) return out;
  } catch {}
  return null;
}

export function mediaBinaries(): { ffmpeg: string; ffprobe: string } {
  if (cached) return cached;
  // 1. System binaries (local dev, Modal, Docker with ffmpeg).
  const sysFfmpeg = fromPath("ffmpeg");
  const sysFfprobe = fromPath("ffprobe");
  if (sysFfmpeg && sysFfprobe) {
    cached = { ffmpeg: sysFfmpeg, ffprobe: sysFfprobe };
    return cached;
  }
  // 2. Bundled statics (Vercel serverless — linux x64).
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegStatic = require("ffmpeg-static") as string | null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffprobeStatic = require("ffprobe-static") as { path?: string } | null;
    if (ffmpegStatic && ffprobeStatic?.path) {
      cached = { ffmpeg: ffmpegStatic, ffprobe: ffprobeStatic.path };
      return cached;
    }
  } catch {}
  // 3. Last resort: bare names (exec will throw a clear error).
  cached = { ffmpeg: sysFfmpeg || "ffmpeg", ffprobe: sysFfprobe || "ffprobe" };
  return cached;
}

export function ffmpegBin(): string {
  return mediaBinaries().ffmpeg;
}

export function ffprobeBin(): string {
  return mediaBinaries().ffprobe;
}
