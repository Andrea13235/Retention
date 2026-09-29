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
 * upload → Muse STT → silence cuts → PNG captions → zoom scene →
 * RetentionVolt → B-roll Higgsfield → MP4 H.264 download.
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
    (id: string) => {
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
    async (file: File, title: string) => {
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
        // 1. R2 presigned PUT diretto browser→R2 (mai body grandi nella function).
        //    FAIL-LOUD: se il presign fallisce e il file supera il body-cap
        //    serverless (~4.5MB su Vercel), NON ripiegare sul multipart: la
        //    platform risponderebbe 413 e l'errore reale (sessione/R2/CORS)
        //    resterebbe nascosto. Riporta la causa vera.
        //    Soglia multipart: 4_000_000 byte (sotto il cap Vercel di ~4.5MB).
        const MULTIPART_SAFE_BYTES = 4_000_000;
        let presigned: { url: string; key: string } | null = null;
        let presignError: string | null = null;
        try {
          const presignRes = await fetch("/api/r2/presign", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({
              filename: file.name,
              bytes: file.size,
              contentType: file.type || "video/mp4",
            }),
          });
          if (presignRes.ok) {
            presigned = (await presignRes.json()) as { url: string; key: string };
          } else {
            const errBody = (await presignRes.json().catch(() => ({}))) as { error?: string };
            presignError =
              presignRes.status === 401
                ? "Sessione scaduta — effettua di nuovo il login e riprova."
                : presignRes.status === 503
                  ? "Storage R2 non configurato sul server — contatta il supporto."
                  : (typeof errBody?.error === "string" && errBody.error) ||
                    `Presign upload fallito (${presignRes.status})`;
          }
        } catch (e) {
          presignError =
            e instanceof Error && e.message
              ? e.message
              : "Presign non raggiungibile — controlla la connessione e riprova.";
        }
        if (presignError && file.size > MULTIPART_SAFE_BYTES) {
          throw new Error(presignError);
        }
        if (presigned) {
          setProgress(5);
          let putRes: Response;
          try {
            putRes = await fetch(presigned.url, {
              method: "PUT",
              headers: { "Content-Type": file.type || "video/mp4" },
              body: file,
            });
          } catch {
            throw new Error(
              "Upload verso R2 bloccato dal browser (CORS del bucket o rete) — ricarica la pagina e riprova."
            );
          }
          if (!putRes.ok) throw new Error(`R2 upload fallito (${putRes.status})`);
          setProgress(8);
          const startRes = await fetch("/api/local-render/start", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: JSON.stringify({ r2Key: presigned.key, format: "short", title: cleanTitle }),
          });
          const startData = await startRes.json().catch(() => ({}));
          if (!startRes.ok) throw new Error(startData?.error || `Avvio fallito (${startRes.status})`);
          startPoll(startData.jobId as string);
          return;
        }
        // 2. Fallback multipart diretto (SOLO file piccoli / dev locale).
        const form = new FormData();
        form.append("file", file);
        form.append("format", "short");
        form.append("title", cleanTitle);
        const res = await fetch("/api/local-render/start", {
          method: "POST",
          headers: { ...authHeaders },
          body: form,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `Upload fallito (${res.status})`);
        setProgress(8);
        startPoll(data.jobId as string);
      } catch (e) {
        setStage("error");
        setError(e instanceof Error ? e.message : "Errore imprevisto");
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
