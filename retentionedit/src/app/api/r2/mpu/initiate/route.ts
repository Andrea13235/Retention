import { NextRequest, NextResponse } from "next/server";
import { isR2Configured, sanitizeR2KeySegment } from "@/lib/r2";
import { canFitUpload } from "@/lib/r2-quota";
import { requireAuth } from "@/lib/server-auth";
import { mpuCreate } from "@/lib/s3-mpu";

export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024 * 1024; // 4 GB
// Chunk browser→server 4MB (sotto il cap serverless ~4.5MB); parti R2
// assemblate server-side al complete (S3 richiede ≥5MB per parte non-finale:
// R2 risponde EntityTooSmall altrimenti — verificato con test reale).
const ALLOWED_EXT = new Set([".mp4", ".mov", ".webm", ".mkv", ".m4v"]);

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

/**
 * POST /api/r2/mpu/initiate { filename, bytes, contentType?, plan? }
 * Avvia un S3 Multipart Upload su R2 e ritorna uploadId + key + partSize.
 * Il browser caricherà poi ogni chunk su /api/r2/mpu/chunk (stessa origin:
 * zero CORS). Chunk size 4MB < cap serverless ~4.5MB; R2 accetta parti ≥5MB
 * TRANNE l'ultima — quindi partSize 4MB va bene solo se totalParts gestisce
 * l'ultima parte piccola. S3 richiede ≥5MB per tutte le parti tranne l'ultima.
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult && authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const { user } = authResult;
    const userId = sanitizeR2KeySegment(user.userId, 50);

    if (!isR2Configured()) {
      return NextResponse.json(
        { error: "R2 not configured — set R2_* in .env.local or vault, then restart." },
        { status: 503 }
      );
    }
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    const filename = String(body.filename ?? "").trim().slice(0, 160) || "upload.mp4";
    const bytes = Math.floor(Number(body.bytes));
    const contentType = typeof body.contentType === "string" ? body.contentType.trim().slice(0, 80) : "";
    const plan = typeof body.plan === "string" ? body.plan : "free";

    if (!Number.isFinite(bytes) || bytes <= 0) {
      return NextResponse.json({ error: "bytes must be a positive number" }, { status: 400 });
    }
    if (bytes > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File too large (max 4 GB)" }, { status: 413 });
    }
    const ext = extOf(filename);
    if (ext && !ALLOWED_EXT.has(ext)) {
      return NextResponse.json({ error: `Unsupported format ${ext}` }, { status: 415 });
    }
    if (contentType && !contentType.startsWith("video/") && contentType !== "application/octet-stream") {
      return NextResponse.json({ error: "Invalid content type" }, { status: 415 });
    }

    const quota = canFitUpload({ userId, plan, fileBytes: bytes });
    if (!quota.ok) {
      return NextResponse.json(
        {
          error: "Storage quota exceeded for your plan",
          quotaBytes: quota.quotaBytes,
          usedBytes: quota.usedBytes,
          remainingBytes: quota.remainingBytes,
        },
        { status: 413 }
      );
    }

    const safeName = sanitizeR2KeySegment(filename, 100) || "upload.mp4";
    const key = `raw/${userId}/${Date.now()}_${safeName}`;
    // Chunk 4MB browser→server (sotto il cap Vercel ~4.5MB). Al complete il
    // server assembla parti R2 ≥5MB leggendo i chunk in staging (stateless:
    // serverless = istanze diverse, niente buffer in RAM tra request).
    const partSize = 4 * 1024 * 1024;
    const totalParts = Math.max(1, Math.ceil(bytes / partSize));

    let uploadId: string;
    try {
      uploadId = await mpuCreate(key, contentType || "video/mp4");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "mpu create failed";
      console.error("[r2/mpu/initiate] mpuCreate error:", msg);
      return NextResponse.json({ error: "Avvio upload fallito — riprova." }, { status: 502 });
    }

    return NextResponse.json({
      uploadId,
      key,
      partSize,
      totalParts,
      quota: { quotaBytes: quota.quotaBytes, usedBytes: quota.usedBytes, remainingBytes: quota.remainingBytes },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "initiate failed";
    console.error("[r2/mpu/initiate] error:", msg);
    return NextResponse.json({ error: "Failed to initiate upload" }, { status: 500 });
  }
}
