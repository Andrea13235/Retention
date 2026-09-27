import { NextRequest, NextResponse } from "next/server";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { requireAuth } from "@/lib/server-auth";
import { sanitizeR2KeySegment } from "@/lib/r2";
import { storageRoot } from "@/lib/storage-root";

export const dynamic = "force-dynamic";
// Vercel free timeout is 10s/60s — local render runs on the user's machine;
// generous maxDuration for Pro/local runtimes, harmless elsewhere.
export const maxDuration = 300;

const MAX_BYTES = 4 * 1024 * 1024 * 1024; // 4 GB
const ALLOWED_EXT = new Set([".mp4", ".mov", ".webm", ".mkv", ".m4v"]);

function sanitizeFilename(name: string): string {
  const base = path.basename(name || "upload.mp4");
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "upload.mp4";
}

/**
 * POST /api/local-render/start (multipart file + format)
 * Real M1 engine, fully local:
 *  whisper.cpp STT (word timestamps) → silencedetect cuts → ffmpeg H.264 MP4.
 * Returns jobId immediately; poll /api/local-render/status?jobId=.
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult && authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const userId = sanitizeR2KeySegment(authResult.user.userId, 50);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const formatRaw = String(formData.get("format") || "short");
    const format = formatRaw === "long" ? "long" : "short";
    const titleRaw = String(formData.get("title") || "").replace(/[\x00-\x1F\x7F]/g, "").slice(0, 160);

    if (!file || file.size <= 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 4 GB)" }, { status: 413 });
    }
    const ext = path.extname(file.name || "").toLowerCase();
    if (ext && !ALLOWED_EXT.has(ext)) {
      return NextResponse.json({ error: `Unsupported format ${ext} (MP4, MOV, WebM)` }, { status: 415 });
    }

    const safe = sanitizeFilename(file.name);
    const title = titleRaw || safe.replace(/\.[^/.]+$/, "");
    const jobId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const jobDir = path.join(storageRoot(), "local-renders", userId, jobId);
    mkdirSync(jobDir, { recursive: true });
    const srcPath = path.join(jobDir, `source_${safe}`);
    writeFileSync(srcPath, Buffer.from(await file.arrayBuffer()));

    const { createLocalJob } = await import("@/lib/local-jobs");
    createLocalJob({ jobId, userId, title, format, sourcePath: srcPath });

    // Fire-and-forget: status polling drives progress.
    // NOTE: userId is required — runLocalJob is a no-op without it.
    const { runLocalJob } = await import("@/lib/local-pipeline");
    runLocalJob(jobId, userId).catch((err: unknown) => {
      console.error(`[local-render:${jobId}] failed:`, err instanceof Error ? err.message : err);
    });

    return NextResponse.json({ success: true, jobId, title, format });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload failed";
    console.error("[local-render/start] error:", message);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
