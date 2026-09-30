import { NextRequest, NextResponse } from "next/server";
import { isR2Configured, sanitizeR2KeySegment } from "@/lib/r2";
import { addStorageRecord, canFitUpload } from "@/lib/r2-quota";
import { requireAuth } from "@/lib/server-auth";
import {
  deleteR2Object,
  getR2ObjectResponse,
  listR2Prefix,
  mpuAbort,
  mpuUploadPart,
  mpuHeadSize,
} from "@/lib/s3-mpu";
import { downloadR2Object } from "@/lib/r2";
import { mpuComplete } from "@/lib/s3-mpu";
import { stagingChunkKey } from "@/lib/s3-mpu";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // assemble + verify di file grandi

const MIN_PART_BYTES = 5 * 1024 * 1024; // S3: parti non-finali ≥5MB

/**
 * POST /api/r2/mpu/complete { uploadId, key, totalParts, bytes }
 * 1. Verifica staging completo (tutti i chunk presenti su R2).
 * 2. File piccolo (staging totale <5MB o 1 parte): PUT singolo diretto.
 * 3. File grande: MPU con parti ≥5MB assemblate leggendo i chunk in
 *    streaming (RAM ≤ ~6MB), poi Complete.
 * 4. HEAD verify: l'oggetto finale esiste con size attesa.
 * 5. Cleanup staging tmp (best-effort) + ledger quota.
 */
export async function POST(req: NextRequest) {
  let key = "";
  let uploadId = "";
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult && authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const userId = sanitizeR2KeySegment(authResult.user.userId, 50);

    if (!isR2Configured()) {
      return NextResponse.json({ error: "R2 not configured" }, { status: 503 });
    }
    const body = (await req.json().catch(() => null)) as {
      uploadId?: unknown;
      key?: unknown;
      totalParts?: unknown;
      bytes?: unknown;
    } | null;
    if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

    uploadId = String(body.uploadId || "").trim().slice(0, 500);
    key = String(body.key || "").trim().slice(0, 400);
    const totalParts = Math.floor(Number(body.totalParts));
    const expectedBytes = Math.floor(Number(body.bytes));

    if (!uploadId || !key) return NextResponse.json({ error: "uploadId/key required" }, { status: 400 });
    if (!key.startsWith(`raw/${userId}/`) || key.includes("..")) {
      return NextResponse.json({ error: "Forbidden — key fuori dal tuo spazio" }, { status: 403 });
    }
    if (!Number.isFinite(totalParts) || totalParts < 1 || totalParts > 10000) {
      return NextResponse.json({ error: "totalParts invalid" }, { status: 400 });
    }
    if (!Number.isFinite(expectedBytes) || expectedBytes <= 0) {
      return NextResponse.json({ error: "bytes invalid" }, { status: 400 });
    }

    // Quota check prima di assemblare
    const quota = canFitUpload({ userId, plan: "free", fileBytes: expectedBytes });
    if (!quota.ok) {
      await mpuAbort(key, uploadId).catch(() => {});
      return NextResponse.json({ error: "Storage quota exceeded for your plan" }, { status: 413 });
    }

    // 1. Verifica staging: lista chunk tmp
    const prefix = `tmp/mpu/${userId}/${sanitizeR2KeySegment(uploadId, 120)}/`;
    const staged = await listR2Prefix(prefix, 10000).catch(() => null);
    if (!staged || staged.length < totalParts) {
      return NextResponse.json(
        { error: `Upload incompleto — mancano parti (${staged?.length ?? 0}/${totalParts}), ricarica e riprova.` },
        { status: 422 }
      );
    }
    // Ordina per partNumber dal nome file (zero-padded)
    staged.sort((a, b) => a.key.localeCompare(b.key));
    const stagedTotal = staged.slice(0, totalParts).reduce((s, o) => s + o.size, 0);
    if (stagedTotal !== expectedBytes) {
      return NextResponse.json(
        { error: `Size mismatch staging (${stagedTotal} vs ${expectedBytes}) — ricarica e riprova.` },
        { status: 422 }
      );
    }

    // 2. File piccolo: assembla in RAM (≤5MB) e PUT singolo
    const { uploadR2Object } = await import("@/lib/r2");
    if (stagedTotal < MIN_PART_BYTES) {
      const bufs: Buffer[] = [];
      for (let i = 0; i < totalParts; i++) {
        const b = await downloadR2Object(staged[i].key);
        if (!b) throw new Error(`staging illeggibile (parte ${i + 1})`);
        bufs.push(b);
      }
      const assembled = Buffer.concat(bufs);
      if (assembled.length !== expectedBytes) throw new Error("assemble size mismatch");
      const ok = await uploadR2Object(key, assembled, "video/mp4");
      await mpuAbort(key, uploadId).catch(() => {});
      if (!ok) throw new Error("PUT finale fallito");
      const head = await mpuHeadSize(key);
      if (head === null || head !== expectedBytes) throw new Error("verify HEAD fallita");
      await cleanupStaging(staged.slice(0, totalParts).map((o) => o.key));
      addStorageRecord({ r2Key: key, userId, bytes: expectedBytes, createdAt: Date.now(), kind: "raw" });
      return NextResponse.json({ key, bytes: expectedBytes, verified: true });
    }

    // 3. File grande: MPU, parti ≥5MB via streaming accodato
    const PART_TARGET = 8 * 1024 * 1024; // 8MB per parte (≥5MB S3, RAM ok)
    const parts: Array<{ partNumber: number; etag: string }> = [];
    let partNo = 1;
    let buf: Buffer[] = [];
    let bufLen = 0;
    let streamed = 0;

    const flushPart = async (isLast: boolean) => {
      if (bufLen === 0) return;
      if (!isLast && bufLen < MIN_PART_BYTES) return; // accumula ancora
      const payload = Buffer.concat(buf);
      const etag = await mpuUploadPart(key, uploadId, partNo, payload);
      parts.push({ partNumber: partNo, etag });
      partNo += 1;
      buf = [];
      bufLen = 0;
    };

    for (let i = 0; i < totalParts; i++) {
      const sKey = staged[i].key;
      const res = await getR2ObjectResponse(sKey);
      if (!res.body) throw new Error(`staging illeggibile (parte ${i + 1})`);
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const b = Buffer.from(value);
        streamed += b.length;
        buf.push(b);
        bufLen += b.length;
        if (bufLen >= PART_TARGET) await flushPart(false);
      }
    }
    await flushPart(true);
    if (streamed !== expectedBytes) throw new Error("stream size mismatch");
    if (parts.length === 0) throw new Error("nessuna parte caricata");

    const completed = await mpuComplete(key, uploadId, parts);
    if (!completed) throw new Error("CompleteMPU rifiutato da R2");

    // 4. HEAD verify
    const head = await mpuHeadSize(key);
    if (head === null || head !== expectedBytes) {
      throw new Error("verify HEAD fallita — oggetto finale non verificabile");
    }

    // 5. cleanup + ledger
    await cleanupStaging(staged.slice(0, totalParts).map((o) => o.key));
    addStorageRecord({ r2Key: key, userId, bytes: expectedBytes, createdAt: Date.now(), kind: "raw" });
    return NextResponse.json({ key, bytes: expectedBytes, verified: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "complete failed";
    console.error("[r2/mpu/complete] error:", msg);
    try {
      if (key && uploadId) await mpuAbort(key, uploadId);
    } catch {}
    // Best-effort: rimuovi lo staging orfano (estrai userId dalla key).
    try {
      const m = key.match(/^raw\/([^/]+)\//);
      if (m) {
        const prefix = `tmp/mpu/${m[1]}/${sanitizeR2KeySegment(uploadId, 120)}/`;
        const orphans = await listR2Prefix(prefix, 10000).catch(() => []);
        await cleanupStaging(orphans.map((o) => o.key));
      }
    } catch {}
    return NextResponse.json(
      { error: msg.startsWith("staging") || msg.includes("mancano") || msg.includes("mismatch") || msg.includes("HEAD") || msg.includes("quota") || msg.includes("Quota") ? msg : "Finalizzazione upload fallita — riprova." },
      { status: 500 }
    );
  }
}

async function cleanupStaging(keys: string[]): Promise<void> {
  await Promise.all(keys.map((k) => deleteR2Object(k).catch(() => false)));
  void stagingChunkKey;
}
