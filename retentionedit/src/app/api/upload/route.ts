import { NextRequest, NextResponse } from "next/server";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { requireAuth } from "@/lib/server-auth";
import { sanitizeR2KeySegment } from "@/lib/r2";

const execFileAsync = promisify(execFile);

const MAX_BYTES = 4 * 1024 * 1024 * 1024; // 4 GB (come da dropzone UI)
const ALLOWED_EXT = new Set([".mp4", ".mov", ".webm", ".mkv", ".m4v"]);

function sanitizeFilename(name: string): string {
  const base = path.basename(name || "upload.mp4");
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "upload.mp4";
}

/** Durata reale via ffprobe (secondi). Null se ffprobe assente/illeggibile. */
async function probeDuration(filePath: string): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    const sec = Number(String(stdout).trim());
    return Number.isFinite(sec) && sec > 0 ? sec : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult && authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const userId = sanitizeR2KeySegment(authResult.user.userId, 50);

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }
      if (file.size <= 0) {
        return NextResponse.json({ error: "Empty file" }, { status: 400 });
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "File too large (max 4 GB)" }, { status: 413 });
      }
      const ext = path.extname(file.name || "").toLowerCase();
      if (ext && !ALLOWED_EXT.has(ext)) {
        return NextResponse.json(
          { error: `Unsupported format ${ext} (MP4, MOV, WebM)` },
          { status: 415 }
        );
      }
      const mimeOk = !file.type || file.type.startsWith("video/") || file.type === "application/octet-stream";
      if (file.type && !mimeOk) {
        return NextResponse.json({ error: "Invalid file type" }, { status: 415 });
      }

      // PRIVACY: NEVER store in public/ directory! Store in user-isolated private storage.
      const isServerless = Boolean(
        process.env.VERCEL ||
        process.env.AWS_LAMBDA_FUNCTION_NAME ||
        process.env.LAMBDA_TASK_ROOT ||
        process.env.NODE_ENV === "production"
      );
      const outDir = isServerless
        ? path.join(process.env.TMPDIR || "/tmp", "uploads", userId)
        : path.join(process.cwd(), ".vault", "uploads", userId);

      try {
        mkdirSync(outDir, { recursive: true });
      } catch {}
      const safe = sanitizeFilename(file.name);
      const stored = `${Date.now()}_${safe}`;
      const dest = path.join(outDir, stored);
      const bytes = Buffer.from(await file.arrayBuffer());
      try {
        writeFileSync(dest, bytes);
      } catch {}

      const probed = await probeDuration(dest);
      const duration = probed ? Math.round(probed) : 45;

      return NextResponse.json({
        success: true,
        title: safe.replace(/\.[^/.]+$/, ""),
        rawVideoUrl: `/api/media/stream?file=${encodeURIComponent(stored)}`,
        size: bytes.length,
        duration,
        durationProbed: probed !== null,
        private: true,
      });
    }

    // JSON payload: validate + sanitize
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const title = typeof body.title === "string" ? body.title.replace(/[\x00-\x1F\x7F]/g, "").slice(0, 160) : "Raw Creator Video";
    const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
    let rawVideoUrl = "";
    if (rawUrl) {
      const lower = rawUrl.toLowerCase();
      if (!lower.startsWith("javascript:") && !lower.startsWith("data:") && !lower.startsWith("file:")) {
        if (rawUrl.startsWith("/") || rawUrl.startsWith("blob:") || rawUrl.startsWith("r2://")) {
          rawVideoUrl = rawUrl.slice(0, 400);
        } else {
          try {
            const u = new URL(rawUrl);
            if (u.protocol === "https:" || u.protocol === "http:") rawVideoUrl = rawUrl.slice(0, 600);
          } catch {
            // keep default
          }
        }
      }
    }
    const duration = Number.isFinite(body.duration as number)
      ? Math.max(1, Math.min(4 * 3600, Math.round(Number(body.duration))))
      : 52;
    return NextResponse.json({
      success: true,
      title,
      rawVideoUrl,
      duration,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload failed";
    console.error("[upload] error:", message);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
