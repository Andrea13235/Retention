import { NextRequest, NextResponse } from "next/server";
import { isR2Configured, presignR2Url, sanitizeR2KeySegment } from "@/lib/r2";
import { canFitUpload } from "@/lib/r2-quota";
import { requireAuth } from "@/lib/server-auth";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024 * 1024; // 4 GB
const ALLOWED_EXT = new Set([".mp4", ".mov", ".webm", ".mkv", ".m4v"]);
const ALLOWED_MIME_PREFIX = "video/";

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

/**
 * POST /api/r2/presign { filename, bytes, contentType?, plan? }
 * Returns a presigned PUT URL for direct browser→R2 upload.
 * Security: Strictly requires valid authentication. The R2 storage key
 * is ALWAYS bound to the authenticated user's ID: raw/<userId>/<timestamp>_<file>.
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
    if (contentType && !contentType.startsWith(ALLOWED_MIME_PREFIX) && contentType !== "application/octet-stream") {
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

    const url = presignR2Url({
      method: "PUT",
      key,
      expiresSec: 600,
      contentType: contentType || undefined,
      contentLength: bytes,
    });
    if (!url) return NextResponse.json({ error: "Failed to presign URL" }, { status: 500 });

    return NextResponse.json({
      url,
      key,
      bucket: (process.env.R2_BUCKET || "").trim() || "retentionedit",
      expiresInSec: 600,
      quota: { quotaBytes: quota.quotaBytes, usedBytes: quota.usedBytes, remainingBytes: quota.remainingBytes },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "presign failed";
    console.error("[r2/presign] error:", msg);
    return NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 });
  }
}
