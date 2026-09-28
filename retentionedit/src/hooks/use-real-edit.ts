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
        if (typeof document !== "undefined" && user?.id) {
          document.cookie = `retentionedit_session=${encodeURIComponent(user.id)}; path=/; max-age=28800; SameSite=Lax`;
        }
        const cleanTitle = title || file.name.replace(/\.[^/.]+$/, "");
        // 1. R2 presigned PUT diretto browser→R2 (mai body grandi nella function).
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
            const presigned = (await presignRes.json()) as { url: string; key: string };
            setProgress(5);
            const putRes = await fetch(presigned.url, {
              method: "PUT",
              headers: { "Content-Type": file.type || "video/mp4" },
              body: file,
            });
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
        } catch (e) {
          if (e instanceof Error && /R2 upload fallito|Avvio fallito/.test(e.message)) throw e;
        }
        // 2. Fallback multipart diretto (file piccoli / dev locale).
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
