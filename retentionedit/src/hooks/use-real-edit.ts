"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/auth-context";

export type RealStage = "idle" | "uploading" | "transcribe" | "cuts" | "render" | "done" | "error";

export interface RealStatus {
  jobId: string;
  title: string;
  format: string;
  stage: RealStage;
  progress: number;
  log: string[];
  transcriptWords?: number;
  transcriptPreview?: string;
  cutsCount?: number;
  timeSavedSec?: number;
  sourceDuration?: number;
  finalDuration?: number;
  captionsBurned?: number;
  zoomsApplied?: number;
  brollsApplied?: number;
  bytes?: number;
  error?: string;
  downloadUrl?: string | null;
  coverUrl?: string | null;
}

/**
 * useRealEdit — motore reale "Edit with one click".
 * Stessa logica E2E verificata (R2 presigned PUT → /start → poll /status):
 * upload → ElevenLabs STT → Muse STT → silence cuts → PNG captions →
 * zoom scene → RetentionVolt → B-roll Higgsfield → MP4 H.264 download.
 *
 * startEdit risolve con lo status FINALE (stage done/error) così il
 * chiamante può riconciliare card + download MP4 reale.
 */
export function useRealEdit() {
  const { user } = useAuth();
  const [stage, setStage] = useState<RealStage>("idle");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<RealStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPoll, [stopPoll]);

  const startPoll = useCallback(
    (id: string, onTerminal?: (final: RealStatus) => void) => {
      stopPoll();
      setJobId(id);
      const tick = async () => {
        try {
          const res = await fetch(`/api/local-render/status?jobId=${encodeURIComponent(id)}`, {
            headers: { ...(user?.id ? { "x-retentionedit-session": user.id } : {}) },
          });
          if (!res.ok) return;
          const data = (await res.json()) as RealStatus;
          setStatus(data);
          setStage(data.stage);
          setProgress(data.progress);
          if (data.stage === "done" || data.stage === "error") {
            stopPoll();
            if (data.stage === "error") setError(data.error || "Render fallito");
            onTerminal?.(data);
          }
        } catch {
          // il poll continua: errori di rete temporanei non uccidono il job
        }
      };
      tick();
      pollRef.current = setInterval(tick, 3000);
    },
    [stopPoll, user?.id]
  );

  const startEdit = useCallback(
    async (file: File, title: string): Promise<RealStatus> => {
      setError(null);
      setStatus(null);
      setStage("uploading");
      setProgress(3);
      const authHeaders: Record<string, string> = {
        ...(user?.id ? { "x-retentionedit-session": user.id } : {}),
      };
      try {
        // Session: server-minted signed HttpOnly cookie is sent automatically.
        // Never overwrite it with the raw id (destroys auth → 401 → 413).
        const cleanTitle = title || file.name.replace(/\.[^/.]+$/, "");
        // Upload CORS-immune: chunk 4MB stessa-origin → relay server → R2
        // (S3 MPU assemblato server-side). Niente presigned PUT browser→R2:
        // richiede CORS sul bucket e falliva con token senza bucket-config.
        const { uploadFileChunked } = await import("@/lib/chunked-upload");
        setProgress(5);
        const uploaded = await uploadFileChunked(file, {
          userId: user?.id,
          onProgress: (pct) => setProgress(5 + Math.round(pct * 0.15)),
        });
        if (!uploaded.verified) throw new Error("Upload non verificato su R2 — riprova.");
        await fetch("/api/r2/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ r2Key: uploaded.key, bytes: uploaded.bytes, kind: "raw" }),
        }).catch(() => {});
        setProgress(20);
        const startRes = await fetch("/api/local-render/start", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ r2Key: uploaded.key, format: "short", title: cleanTitle }),
        });
        const startData = await startRes.json().catch(() => ({}));
        if (!startRes.ok) throw new Error(startData?.error || `Avvio fallito (${startRes.status})`);
        // startEdit risolve con lo status TERMINALE così il chiamante può
        // riconciliare card + download MP4 reale. Il poll interno aggiorna
        // comunque stage/progress per la UI live.
        return await new Promise<RealStatus>((resolve, reject) => {
          try {
            startPoll(startData.jobId as string, (final) => {
              if (final.stage === "error") reject(new Error(final.error || "Render fallito"));
              else resolve(final);
            });
          } catch (e) {
            reject(e instanceof Error ? e : new Error("Poll non avviato"));
          }
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Errore imprevisto";
        setStage("error");
        setError(msg);
        throw e instanceof Error ? e : new Error(msg);
      }
    },
    [startPoll, user?.id]
  );

  const reset = useCallback(() => {
    stopPoll();
    setStage("idle");
    setProgress(0);
    setStatus(null);
    setError(null);
    setJobId(null);
  }, [stopPoll]);

  return { stage, progress, status, error, jobId, startEdit, reset };
}
