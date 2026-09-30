/**
 * Chunked browser→R2 upload relay — 100% CORS-immune.
 *
 * Perché esiste: il PUT diretto browser→R2 via presigned URL richiede che il
 * bucket abbia CORS configurato (AccessDenied sul token senza permessi
 * bucket-config). Questo relay aggira il problema alla radice:
 *  - client → Next.js (stessa origin: ZERO CORS, ZERO preflight)
 *  - server → R2 con S3 Multipart Upload firmato SigV4 (server-to-server: niente CORS)
 * Ogni chunk resta sotto il body-cap serverless (~4.5MB su Vercel).
 *
 * Flusso:
 *  1. POST /api/r2/mpu/initiate { filename, bytes, contentType, plan }
 *     → { uploadId, key, partSize, totalParts }
 *  2. N × POST /api/r2/mpu/chunk (multipart: uploadId, key, partNumber, chunk: Blob)
 *     → { partNumber, etag }  (parallelo controllato, max 3)
 *  3. POST /api/r2/mpu/complete { uploadId, key, parts: [{partNumber, etag}] }
 *     → { key, bytes, verified } (HEAD server-side: l'oggetto esiste davvero)
 * Poi il client chiama /api/local-render/start { r2Key } come prima.
 *
 * Sicurezza: key sempre raw/<userId>/…; partNumber 1..10000; ogni chunk ≤ 8MB;
 * complete verifica ownership + quota + HEAD su R2 prima di registrare.
 */
"use client";

export interface ChunkedUploadResult {
  key: string;
  bytes: number;
  verified: boolean;
}

interface InitiateResponse {
  uploadId: string;
  key: string;
  partSize: number;
  totalParts: number;
}

function authHeaders(userId?: string | null): Record<string, string> {
  return userId ? { "x-retentionedit-session": userId } : {};
}

/**
 * Upload di un File su R2 a chunk, con progress callback.
 * Fallisce LOUD con messaggi azionabili (mai fallback silenti).
 */
export async function uploadFileChunked(
  file: File,
  opts: { userId?: string | null; plan?: string; onProgress?: (pct: number) => void }
): Promise<ChunkedUploadResult> {
  const { userId, plan, onProgress } = opts;
  const report = (done: number, total: number) => {
    try {
      onProgress?.(total > 0 ? Math.min(99, Math.round((done / total) * 100)) : 0);
    } catch {}
  };

  // 1. initiate
  let initRes: Response;
  try {
    initRes = await fetch("/api/r2/mpu/initiate", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(userId) },
      body: JSON.stringify({
        filename: file.name,
        bytes: file.size,
        contentType: file.type || "video/mp4",
        plan: plan || "free",
      }),
    });
  } catch (e) {
    throw new Error(
      e instanceof Error && e.message
        ? `Upload non avviabile (rete): ${e.message}`
        : "Upload non avviabile — controlla la connessione e riprova."
    );
  }
  if (!initRes.ok) {
    const errBody = (await initRes.json().catch(() => ({}))) as { error?: string };
    if (initRes.status === 401) throw new Error("Sessione scaduta — effettua di nuovo il login e riprova.");
    if (initRes.status === 503) throw new Error("Storage R2 non configurato sul server — contatta il supporto.");
    throw new Error(
      (typeof errBody?.error === "string" && errBody.error) || `Avvio upload fallito (${initRes.status})`
    );
  }
  const init = (await initRes.json()) as InitiateResponse;
  if (!init.uploadId || !init.key || !init.partSize) throw new Error("Risposta initiate non valida dal server.");

  // 2. chunks in parallelo controllato (max 3) → staging tmp su R2
  const totalParts = init.totalParts;
  const partSize = init.partSize;
  let completed = 0;
  let failed: unknown = null;

  const uploadChunk = async (partNumber: number): Promise<void> => {
    const start = (partNumber - 1) * partSize;
    const blob = file.slice(start, Math.min(start + partSize, file.size));
    const form = new FormData();
    form.append("uploadId", init.uploadId);
    form.append("key", init.key);
    form.append("partNumber", String(partNumber));
    form.append("chunk", blob, `chunk-${partNumber}`);
    let res: Response;
    try {
      res = await fetch("/api/r2/mpu/chunk", {
        method: "POST",
        headers: { ...authHeaders(userId) },
        body: form,
      });
    } catch {
      throw new Error(`Parte ${partNumber}/${totalParts} non inviata (rete) — riprova.`);
    }
    if (!res.ok) {
      const eb = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 401) throw new Error("Sessione scaduta durante l'upload — login e riprova.");
      throw new Error(
        (typeof eb?.error === "string" && eb.error) || `Parte ${partNumber}/${totalParts} rifiutata (${res.status})`
      );
    }
    completed += 1;
    report(completed, totalParts);
  };

  const CONCURRENCY = 3;
  let next = 1;
  const workers = Array.from({ length: Math.min(CONCURRENCY, totalParts) }, async () => {
    while (next <= totalParts && !failed) {
      const pn = next++;
      try {
        await uploadChunk(pn);
      } catch (e) {
        failed = e;
        return;
      }
    }
  });
  await Promise.all(workers);
  if (failed) throw failed instanceof Error ? failed : new Error("Upload interrotto.");

  // 3. complete (assemble server-side + verify HEAD)
  let compRes: Response;
  try {
    compRes = await fetch("/api/r2/mpu/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(userId) },
      body: JSON.stringify({
        uploadId: init.uploadId,
        key: init.key,
        totalParts,
        bytes: file.size,
      }),
    });
  } catch {
    throw new Error("Finalizzazione upload non raggiungibile — il file potrebbe essere su R2, riprova tra poco.");
  }
  if (!compRes.ok) {
    const eb = (await compRes.json().catch(() => ({}))) as { error?: string };
    throw new Error((typeof eb?.error === "string" && eb.error) || `Finalizzazione fallita (${compRes.status})`);
  }
  const done = (await compRes.json()) as { key: string; bytes: number; verified: boolean };
  onProgress?.(100);
  return { key: done.key, bytes: done.bytes, verified: done.verified };
}
