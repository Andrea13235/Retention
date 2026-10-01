import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { requireAuth } from "@/lib/server-auth";
import { sanitizeR2KeySegment } from "@/lib/r2";

export const dynamic = "force-dynamic";
// Creation is cheap (persist source) — the status polls drive the pipeline.
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024 * 1024; // 4 GB
const ALLOWED_EXT = new Set([".mp4", ".mov", ".webm", ".mkv", ".m4v"]);

function sanitizeFilename(name: string): string {
  const base = path.basename(name || "upload.mp4");
  return base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "upload.mp4";
}

/**
 * POST /api/local-render/start
 * Two input modes (both return jobId immediately; STATUS POLLS drive progress):
 *  1. JSON { r2Key, format?, title? } — browser uploaded direct to R2 via
 *     presigned PUT (no 4.5MB serverless body cap). Server fetches from R2.
 *  2. multipart file + format — direct small-file upload (local dev).
 * Persists source + job.json to R2 (serverless source of truth).
 * Real engine: Muse STT → silencedetect cuts → ffmpeg H.264 MP4 (+ SOUL broll).
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult && authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const userId = sanitizeR2KeySegment(authResult.user.userId, 50);

    let format: "short" | "long" = "short";
    let title = "";
    let sourceBytes: Buffer | null = null;
    let sourceName = "upload.mp4";

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      // ---- Mode 1: R2 key (413-proof) ----
      const body = (await req.json().catch(() => null)) as {
        r2Key?: unknown;
        format?: unknown;
        title?: unknown;
      } | null;
      const r2Key = String(body?.r2Key || "").trim().slice(0, 600);
      if (!r2Key) return NextResponse.json({ error: "r2Key required" }, { status: 400 });
      // Ownership: only this user's own raw/ prefix (no traversal).
      if (!r2Key.startsWith(`raw/${userId}/`) || r2Key.includes("..")) {
        return NextResponse.json({ error: "Forbidden — key fuori dal tuo spazio" }, { status: 403 });
      }
      if (String(body?.format) === "long") format = "long";
      title = String(body?.title || "").replace(/[^\x20-\x7E]/g, "").slice(0, 160);
      const { downloadR2Object } = await import("@/lib/r2");
      sourceBytes = await downloadR2Object(r2Key);
      if (!sourceBytes || sourceBytes.length === 0) {
        return NextResponse.json({ error: "Sorgente R2 non leggibile — ricarica il video" }, { status: 422 });
      }
      sourceName = r2Key.split("/").pop() || "upload.mp4";
    } else {
      // ---- Mode 2: direct multipart ----
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const formatRaw = String(formData.get("format") || "short");
      format = formatRaw === "long" ? "long" : "short";
      title = String(formData.get("title") || "").replace(/[^\x20-\x7E]/g, "").slice(0, 160);

      if (!file || file.size <= 0) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "File too large (max 4 GB)" }, { status: 413 });
      }
      sourceName = file.name || "upload.mp4";
      sourceBytes = Buffer.from(await file.arrayBuffer());
    }
    const ext = path.extname(sourceName || "").toLowerCase();
    if (ext && !ALLOWED_EXT.has(ext)) {
      return NextResponse.json({ error: `Unsupported format ${ext} (MP4, MOV, WebM)` }, { status: 415 });
    }

    const safe = sanitizeFilename(sourceName);
    const finalTitle = title || safe.replace(/\.[^/.]+$/, "");
    const jobId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Persist source + job.json (R2 on serverless, .vault locally).
    // No background work here: the browser's status polls advance the job.
    const { createR2Job } = await import("@/lib/local-jobs-r2");
    const created = await createR2Job({ jobId, userId, title: finalTitle, format, sourceBytes, sourceName: safe });

    // Auto-format: se il sorgente è verticale (9:16) ma il formato chiesto è
    // long (default UI), correggi in short — altrimenti il video esce
    // pillarboxed (bande nere laterali). Mai il contrario senza richiesta.
    try {
      const { probeMedia } = await import("@/lib/local-render");
      const probed = created.sourcePath ? await probeMedia(created.sourcePath).catch(() => null) : null;
      if (probed && probed.width > 0 && probed.height > probed.width && format === "long") {
        const { saveR2Job } = await import("@/lib/local-jobs-r2");
        created.format = "short";
        await saveR2Job(created);
        format = "short";
      }
    } catch {
      // mai bloccare la creazione job per il probe
    }

    return NextResponse.json({ success: true, jobId, title: finalTitle, format });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Upload failed";
    console.error("[local-render/start] error:", message);
    const detail = process.env.NODE_ENV === "production" ? undefined : String(message).slice(0, 200);
    return NextResponse.json({ error: "Upload failed", ...(detail ? { detail } : {}) }, { status: 500 });
  }
}
