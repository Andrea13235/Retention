import { NextRequest, NextResponse } from "next/server";
import { isR2Configured, sanitizeR2KeySegment } from "@/lib/r2";
import { requireAuth } from "@/lib/server-auth";
import { uploadR2Object } from "@/lib/r2";
import { stagingChunkKey } from "@/lib/s3-mpu";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_CHUNK_BYTES = 4_500_000; // request browser→server: sotto il cap Vercel ~4.5MB

/**
 * POST /api/r2/mpu/chunk (multipart: uploadId, key, partNumber, chunk: Blob)
 * Salva il chunk in staging su R2 (tmp/mpu/…). Stessa origin → zero CORS.
 * Stateless: ogni request è indipendente (serverless-safe).
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult && authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const userId = sanitizeR2KeySegment(authResult.user.userId, 50);

    if (!isR2Configured()) {
      return NextResponse.json({ error: "R2 not configured" }, { status: 503 });
    }

    const formData = await req.formData().catch(() => null);
    if (!formData) return NextResponse.json({ error: "Invalid multipart" }, { status: 400 });

    const uploadId = String(formData.get("uploadId") || "").trim().slice(0, 500);
    const key = String(formData.get("key") || "").trim().slice(0, 400);
    const partNumber = Math.floor(Number(formData.get("partNumber")));
    const chunk = formData.get("chunk") as File | null;

    if (!uploadId || !key || !Number.isFinite(partNumber) || partNumber < 1 || partNumber > 10000) {
      return NextResponse.json({ error: "uploadId/key/partNumber invalid" }, { status: 400 });
    }
    // Ownership: solo raw/<userId>/…
    if (!key.startsWith(`raw/${userId}/`) || key.includes("..")) {
      return NextResponse.json({ error: "Forbidden — key fuori dal tuo spazio" }, { status: 403 });
    }
    if (!chunk || chunk.size <= 0) {
      return NextResponse.json({ error: "chunk mancante o vuoto" }, { status: 400 });
    }
    if (chunk.size > MAX_CHUNK_BYTES) {
      return NextResponse.json({ error: "chunk troppo grande (max ~4.5MB)" }, { status: 413 });
    }

    const bytes = Buffer.from(await chunk.arrayBuffer());
    const stagingKey = stagingChunkKey(userId, uploadId, partNumber);
    const saved = await uploadR2Object(stagingKey, bytes, "application/octet-stream");
    if (!saved) {
      return NextResponse.json({ error: "Staging chunk fallito — riprova." }, { status: 502 });
    }
    return NextResponse.json({ partNumber, bytes: bytes.length, staged: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "chunk failed";
    console.error("[r2/mpu/chunk] error:", msg);
    return NextResponse.json({ error: "Chunk upload failed" }, { status: 500 });
  }
}
