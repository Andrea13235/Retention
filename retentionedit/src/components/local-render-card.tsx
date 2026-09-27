"use client";
import React, { useEffect, useRef, useState } from "react";
import { Download, Loader2, CheckCircle2, AlertTriangle, Folder } from "lucide-react";
import { useAuth } from "@/context/auth-context";

type Stage = "idle" | "uploading" | "transcribe" | "cuts" | "render" | "done" | "error";

interface StatusResp {
  jobId: string;
  title: string;
  format: string;
  stage: Stage;
  progress: number;
  log: string[];
  language?: string;
  transcriptWords?: number;
  transcriptPreview?: string;
  cutsCount?: number;
  captions?: Array<{ start: number; end: number; text: string }>;
  captionsCount?: number;
  captionsBurned?: number;
  scenesCount?: number;
  zoomsCount?: number;
  zoomsApplied?: number;
  volt?: {
    title: string;
    creator: string;
    youtubeUrl: string | null;
    thumbnailUrl: string | null;
    niche: string;
    retentionScore: number;
    views: number | string | null;
    hookTactic: string | null;
    bodyPacing: string | null;
    voltZooms: number;
  } | null;
  broll?: {
    finalStart: number;
    finalEnd: number;
    prompt: string;
    bytes: number;
  } | null;
  brollsApplied?: number;
  sourceDuration?: number;
  finalDuration?: number;
  timeSavedSec?: number;
  bytes?: number;
  error?: string;
  downloadUrl?: string | null;
  coverUrl?: string | null;
}

function stageLabel(s: Stage): string {
  switch (s) {
    case "uploading":
      return "Caricamento video…";
    case "transcribe":
      return "Trascrizione reale (Muse Voice)…";
    case "cuts":
      return "Taglio silenzi reali…";
    case "render":
      return "Render MP4 (H.264 + AAC)…";
    case "done":
      return "Pronto";
    case "error":
      return "Errore";
    default:
      return "In attesa";
  }
}

/** "39595K" / 39595000 / "39.5M" → display "39.6M". */
function formatViews(v: number | string): string {
  if (typeof v === "number" && Number.isFinite(v)) {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return String(v);
  }
  const s = String(v).trim();
  const m = s.match(/^([\d.,]+)\s*([KMB])?$/i);
  if (!m) return s.slice(0, 12);
  const num = Number(m[1].replace(",", "."));
  if (!Number.isFinite(num)) return s.slice(0, 12);
  const unit = (m[2] || "").toUpperCase();
  if (unit === "M") return `${num}M`;
  if (unit === "B") return `${num}B`;
  if (unit === "K") return num >= 1000 ? `${(num / 1000).toFixed(1)}M` : `${num}K`;
  return formatViews(num);
}

/**
 * LocalRenderCard — "Edit with one click" reale (M1).
 * Upload → Muse Voice STT → silencedetect cuts → ffmpeg MP4 → download.
 * Mostra progresso reale via /api/local-render/status e player + DOWNLOAD MP4 a fine job.
 */
export function LocalRenderCard() {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const stopPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPoll = (jobId: string) => {
    stopPoll();
    const tick = async () => {
      try {
        const res = await fetch(`/api/local-render/status?jobId=${encodeURIComponent(jobId)}`, {
          headers: { ...(user?.id ? { "x-retentionedit-session": user.id } : {}) },
        });
        if (!res.ok) return;
        const data = (await res.json()) as StatusResp;
        setStatus(data);
        setStage(data.stage);
        setProgress(data.progress);
        if (data.stage === "done" || data.stage === "error") {
          stopPoll();
          if (data.stage === "error") setError(data.error || "Render fallito");
        }
      } catch {}
    };
    tick();
    pollRef.current = setInterval(tick, 1500);
  };

  const handleFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setFileName(file.name);
    setError(null);
    setStatus(null);
    setStage("uploading");
    setProgress(3);
    try {
      if (typeof document !== "undefined" && user?.id) {
        document.cookie = `retentionedit_session=${encodeURIComponent(user.id)}; path=/; max-age=28800; SameSite=Lax`;
      }
      const form = new FormData();
      form.append("file", file);
      form.append("format", "short");
      form.append("title", file.name.replace(/\.[^/.]+$/, ""));
      const res = await fetch("/api/local-render/start", {
        method: "POST",
        headers: { ...(user?.id ? { "x-retentionedit-session": user.id } : {}) },
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
  };

  const downloadMp4 = () => {
    if (!status?.downloadUrl) return;
    const a = document.createElement("a");
    a.href = status.downloadUrl;
    a.download = `${(status.title || "video").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40)}_retention_edit.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="w-full max-w-[720px] mx-auto flex flex-col items-center mt-6 rounded-3xl border border-emerald-500/25 bg-emerald-500/[0.04] p-5 sm:p-6">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-emerald-400">
        <CheckCircle2 size={13} />
        <span>Real edit engine — tagli veri + MP4 scaricabile</span>
      </div>

      {stage === "idle" || stage === "error" ? (
        <div className="w-full mt-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full h-[56px] pl-5 pr-1.5 rounded-full bg-[#2B2B2E] flex items-center justify-between gap-3 border border-white/10 hover:border-emerald-500/40 transition cursor-pointer"
          >
            <span className="flex items-center gap-2 text-[14px] text-white min-w-0">
              <Folder size={18} className="text-emerald-400 shrink-0" />
              <span className="font-medium truncate">{fileName || "Upload video → edit reale in un click"}</span>
            </span>
            <span className="h-[44px] px-7 rounded-full bg-emerald-400 hover:bg-emerald-300 text-black font-semibold text-[13px] flex items-center shrink-0">
              Edit with one click
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
            className="hidden"
            onChange={(e) => handleFile(e.target.files)}
          />
          {error && (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-rose-400 font-medium">
              <AlertTriangle size={13} /> {error}
            </p>
          )}
          <p className="mt-2 text-center text-[11px] text-[#8c8c90]">
            Trascrizione reale + taglio silenzi + MP4 H.264. Niente demo, niente video finto.
          </p>
        </div>
      ) : (
        <div className="w-full mt-4">
          <div className="flex items-center justify-between text-xs text-[#e2e3e7]">
            <span className="font-semibold flex items-center gap-2">
              {stage !== "done" && <Loader2 size={14} className="animate-spin text-emerald-400" />}
              {stageLabel(stage)}
            </span>
            <span className="font-mono text-emerald-300">{progress}%</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(2, progress))}%` }}
            />
          </div>
          {status?.transcriptPreview && (
            <p className="mt-3 text-[11px] leading-relaxed text-[#b9bac2] border-l-2 border-emerald-500/50 pl-2.5">
              “{status.transcriptPreview}”
              {typeof status.transcriptWords === "number" && (
                <span className="text-emerald-300 font-semibold"> · {status.transcriptWords} parole reali</span>
              )}
            </p>
          )}
          {typeof status?.cutsCount === "number" && stage !== "done" && (
            <p className="mt-1.5 text-[11px] text-[#8c8c90]">
              Silenzi da rimuovere: <span className="text-white font-semibold">{status.cutsCount}</span>
              {typeof status.timeSavedSec === "number" && status.timeSavedSec > 0 && (
                <> · −{status.timeSavedSec.toFixed(1)}s</>
              )}
            </p>
          )}
          {stage === "done" && status && (
            <div className="mt-4 rounded-2xl overflow-hidden border border-white/10 bg-black">
              {status.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={status.coverUrl} alt={status.title} className="w-full aspect-video object-cover" />
              )}
              <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{status.title}</p>
                  <p className="text-[11px] text-[#8c8c90] mt-0.5">
                    {status.sourceDuration?.toFixed(1)}s → {status.finalDuration?.toFixed(1)}s
                    {typeof status.timeSavedSec === "number" && status.timeSavedSec > 0 && (
                      <> · −{status.timeSavedSec.toFixed(1)}s di silenzi</>
                    )}
                    {typeof status.captionsBurned === "number" && status.captionsBurned > 0 && (
                      <> · {status.captionsBurned} caption bruciate</>
                    )}
                    {typeof status.zoomsApplied === "number" && status.zoomsApplied > 0 && (
                      <> · {status.zoomsApplied} zoom dinamici</>
                    )}
                    {typeof status.brollsApplied === "number" && status.brollsApplied > 0 && (
                      <> · {status.brollsApplied} B-roll Higgsfield</>
                    )}
                    {typeof status.bytes === "number" && <> · {(status.bytes / 1048576).toFixed(1)} MB</>}
                  </p>
                  {status.captions && status.captions.length > 0 && (
                    <p className="mt-1.5 text-[11px] leading-relaxed text-[#b9bac2] border-l-2 border-white/20 pl-2.5">
                      “{status.captions.slice(0, 3).map((c) => c.text).join(" │ ")}”
                    </p>
                  )}
                  {status.broll && (
                    <p className="mt-1.5 text-[11px] leading-relaxed text-[#b9bac2] border-l-2 border-violet-400/40 pl-2.5">
                      B-roll Higgsfield {status.broll.finalStart.toFixed(1)}s→{status.broll.finalEnd.toFixed(1)}s: “{status.broll.prompt.slice(0, 90)}”
                    </p>
                  )}
                  {/* RetentionVolt reference card: WHICH viral video drove the pacing */}
                  {status.volt && (
                    <div className="mt-2.5 flex items-center gap-2.5 rounded-xl border border-amber-400/25 bg-amber-400/[0.05] px-2.5 py-2">
                      {status.volt.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={status.volt.thumbnailUrl}
                          alt={status.volt.title}
                          className="w-16 aspect-video rounded-lg object-cover shrink-0 border border-white/10"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-16 aspect-video rounded-lg bg-white/10 shrink-0 flex items-center justify-center text-amber-300 text-xs font-bold">
                          ★{status.volt.retentionScore}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300/90">
                          Montato come · ★{status.volt.retentionScore}
                        </p>
                        <p className="text-[11px] font-semibold text-white truncate">
                          {status.volt.title}
                          <span className="font-normal text-[#8c8c90]"> — {status.volt.creator}</span>
                        </p>
                        <p className="text-[10px] text-[#8c8c90] truncate">
                          {status.volt.niche}
                          {status.volt.views != null && String(status.volt.views).length > 0 && (
                            <> · {formatViews(status.volt.views)} views</>
                          )}
                          {status.volt.voltZooms > 0 && <> · +{status.volt.voltZooms} zoom pacing</>}
                        </p>
                      </div>
                      {status.volt.youtubeUrl && (
                        <a
                          href={status.volt.youtubeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-[10px] font-bold text-amber-300 hover:text-amber-200 border border-amber-400/30 rounded-full px-2.5 py-1 transition"
                        >
                          Vedi
                        </a>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {status.downloadUrl && (
                    <a
                      href={status.downloadUrl}
                      download
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-emerald-400 hover:bg-emerald-300 text-black text-xs font-bold transition"
                    >
                      <Download size={14} /> DOWNLOAD MP4
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setStage("idle");
                      setStatus(null);
                      setProgress(0);
                      setFileName("");
                    }}
                    className="px-4 py-2.5 rounded-full border border-white/20 text-white text-xs font-semibold hover:bg-white/10 transition cursor-pointer"
                  >
                    Nuovo
                  </button>
                </div>
              </div>
              {status.downloadUrl && (
                <video src={status.downloadUrl} controls playsInline preload="metadata" className="w-full aspect-video bg-black" />
              )}
              <button type="button" onClick={downloadMp4} className="hidden" aria-hidden="true" tabIndex={-1} />
            </div>
          )}
          {status && status.log.length > 0 && stage !== "done" && (
            <div className="mt-3 max-h-24 overflow-y-auto rounded-xl bg-black/40 border border-white/5 px-3 py-2 space-y-1">
              {status.log.slice(-6).map((l, i) => (
                <p key={i} className="text-[10px] font-mono text-[#8c8c90]">
                  {l}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
