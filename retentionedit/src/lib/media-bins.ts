/**
 * RetentionEdit — media binary resolver (SERVER ONLY).
 *
 * Local dev: system ffmpeg/ffprobe from PATH (brew).
 * Vercel serverless: no system binaries → bundled ffmpeg-static /
 * ffprobe-static (linux x64), pinned via outputFileTracingIncludes in
 * next.config.ts (file-tracing does not follow their dynamic paths).
 * The traced files land at the function root (/var/task/...) preserving
 * their node_modules relative paths — probed explicitly below.
 *
 * Never import from client components.
 */
import { existsSync } from "node:fs";
import path from "node:path";

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

/** Candidate locations for the traced static binaries (first hit wins). */
function tracedCandidates(): string[] {
  const rel = [
    "node_modules/ffmpeg-static/ffmpeg",
    "node_modules/ffprobe-static/bin/linux/x64/ffprobe",
  ];
  const roots = new Set<string>();
  try {
    roots.add(process.cwd());
  } catch {}
  // Vercel function root + Next standalone layouts.
  for (const r of ["/var/task", "/var/runtime", "/tmp"]) roots.add(r);
  try {
    // Directory of this bundled module (covers .next/server/* layouts).
    roots.add(path.join(__dirname, "..", "..", ".."));
    roots.add(path.join(__dirname, "..", ".."));
  } catch {}
  const out: string[] = [];
  for (const root of roots) for (const r of rel) out.push(path.join(root, r));
  return out;
}

function tracedBin(name: "ffmpeg" | "ffprobe"): string | null {
  const needle = name === "ffmpeg" ? "ffmpeg-static/ffmpeg" : "ffprobe-static/bin/linux/x64/ffprobe";
  for (const p of tracedCandidates()) {
    if (!p.endsWith(needle)) continue;
    try {
      if (existsSync(p)) return p;
    } catch {}
  }
  return null;
}

function isExecutable(p: string): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { execFileSync } = require("node:child_process") as typeof import("node:child_process");
    execFileSync(p, ["-version"], { timeout: 15000, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
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
  // 2. Traced statics (Vercel serverless — linux x64). Must EXECUTE, not just exist.
  const tFfmpeg = tracedBin("ffmpeg");
  const tFfprobe = tracedBin("ffprobe");
  if (tFfmpeg && tFfprobe && isExecutable(tFfmpeg) && isExecutable(tFfprobe)) {
    cached = { ffmpeg: tFfmpeg, ffprobe: tFfprobe };
    return cached;
  }
  // 3. Module-reported paths (may not exist under file-tracing — validated).
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegStatic = require("ffmpeg-static") as string | null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffprobeStatic = require("ffprobe-static") as { path?: string } | null;
    if (
      ffmpegStatic &&
      ffprobeStatic?.path &&
      existsSync(ffmpegStatic) &&
      existsSync(ffprobeStatic.path) &&
      isExecutable(ffmpegStatic) &&
      isExecutable(ffprobeStatic.path)
    ) {
      cached = { ffmpeg: ffmpegStatic, ffprobe: ffprobeStatic.path };
      return cached;
    }
  } catch {}
  // 4. Last resort: bare names (exec will throw a clear error).
  cached = { ffmpeg: sysFfmpeg || tFfmpeg || "ffmpeg", ffprobe: sysFfprobe || tFfprobe || "ffprobe" };
  return cached;
}

export function ffmpegBin(): string {
  return mediaBinaries().ffmpeg;
}

export function ffprobeBin(): string {
  return mediaBinaries().ffprobe;
}
