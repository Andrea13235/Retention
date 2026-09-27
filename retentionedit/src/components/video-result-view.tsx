"use client";
import React, { useState, useRef } from "react";
import {
  Loader2,
  Sparkles,
  Wand2,
} from "lucide-react";
import { PipelineJob } from "@/lib/types";

interface VideoResultViewProps {
  job: PipelineJob;
  onReset: () => void;
  /** Called after a successful Opus revision — parent refetches or patches job. */
  onRevised?: (job: PipelineJob) => void;
}

/**
 * VideoResultView
 *
 * Implements the refined single-screen layout matching the wireframe photo:
 * 1. Raised 16:9 VIDEO player container at the top (no headers, badges or titles above it).
 * 2. Bottom card:
 *    - Prompt input to request AI revisions
 *    - Bottom-left: "OPUS 3.5" terracotta/orange badge (#ea9368)
 *    - Bottom-right: "EDIT" pill button
 * 3. Fits completely into a single screen with no possibility of scrolling.
 */
export function VideoResultView({ job, onRevised }: VideoResultViewProps) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    const p = prompt.trim();
    if (p.length < 2) {
      setErr("Scrivi una richiesta di modifica per l'AI.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/pipeline/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, prompt: p }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Revisione fallita, riprova");
      setPrompt("");
      if (data?.job && onRevised) {
        onRevised(data.job as PipelineJob);
      } else {
        window.location.reload();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Errore imprevisto durante la revisione");
    } finally {
      setBusy(false);
    }
  };

  const [blobUrl, setBlobUrl] = useState<string | null>(() => {
    try {
      // Synchronously check memory cache on mount for instant zero-latency playback
      const { getProjectBlobSync } = require("@/lib/projects-store");
      const b = getProjectBlobSync(job.id);
      if (b) return URL.createObjectURL(b);
    } catch {}
    return null;
  });

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { getProjectBlob } = await import("@/lib/projects-store");
        const blob = await getProjectBlob(job.id);
        if (blob && active) {
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      active = false;
    };
  }, [job.id]);

  const getInitialSrc = () => {
    if (blobUrl) return blobUrl;
    const v = job.renderedVideoUrl;
    if (
      v &&
      !v.includes("r2.retentionedit.com") &&
      !v.includes("cloudflarestorage.com") &&
      !v.includes("your_") &&
      !v.includes("kling") &&
      !v.includes("raw-vlog")
    )
      return v;
    if (
      job.rawVideoUrl &&
      !job.rawVideoUrl.includes("r2.retentionedit.com") &&
      !job.rawVideoUrl.includes("cloudflarestorage.com") &&
      !job.rawVideoUrl.includes("your_") &&
      !job.rawVideoUrl.includes("kling") &&
      !job.rawVideoUrl.includes("raw-vlog")
    )
      return job.rawVideoUrl;
    return "";
  };

  const [currentVideoSrc, setCurrentVideoSrc] = useState(getInitialSrc());
  const [currentTime, setCurrentTime] = useState(0);
  const [effectsEnabled, setEffectsEnabled] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    const src = blobUrl || getInitialSrc();
    if (src) setCurrentVideoSrc(src);
  }, [blobUrl, job.renderedVideoUrl, job.rawVideoUrl]);

  // Handle real-time silence skipping and time tracking
  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    const t = v.currentTime;
    setCurrentTime(t);

    if (effectsEnabled && job.editPlan?.cuts) {
      for (const cut of job.editPlan.cuts) {
        if (!cut.keep && t >= cut.start && t < cut.end) {
          v.currentTime = cut.end;
          break;
        }
      }
    }
  };

  // Dynamic zoom punch from EditPlan
  let currentScale = 1;
  if (effectsEnabled && job.editPlan?.zooms) {
    const activeZoom = job.editPlan.zooms.find(
      (z) => currentTime >= z.time && currentTime < z.time + (z.duration || 0.6)
    );
    if (activeZoom) {
      currentScale = activeZoom.scale || 1.15;
    }
  }

  // Active viral hook graphic banner
  const activeGraphic = effectsEnabled && job.editPlan?.graphics?.find(
    (g) => currentTime >= g.time && currentTime < g.time + (g.duration || 3)
  );

  // Active karaoke subtitle words (Alex Hormozi style)
  const words = job.editPlan?.captions?.words || [];
  const activeWordIdx = words.findIndex(
    (w) => currentTime >= w.start && currentTime <= w.end
  );

  let visibleWords: typeof words = [];
  if (activeWordIdx !== -1) {
    const startIdx = Math.max(0, activeWordIdx - (activeWordIdx % 4));
    visibleWords = words.slice(startIdx, startIdx + 4);
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden select-none py-1">
      {/* Main Layout Container matching the wireframe photo */}
      <div className="w-full max-w-[720px] flex flex-col items-center my-auto">
        {/* 1. TOP VIDEO CONTAINER — Raised, clean, 16:9, fits the viewport perfectly */}
        <div className="relative w-full aspect-[16/9] max-h-[52vh] rounded-2xl sm:rounded-3xl overflow-hidden border border-white/10 bg-black shadow-2xl flex items-center justify-center shrink">
          <video
            ref={videoRef}
            src={currentVideoSrc}
            controls
            autoPlay
            playsInline
            loop
            onTimeUpdate={handleTimeUpdate}
            onError={async () => {
              try {
                const { getProjectBlob } = await import("@/lib/projects-store");
                const b = await getProjectBlob(job.id);
                if (b) {
                  const recoveredUrl = URL.createObjectURL(b);
                  if (recoveredUrl !== currentVideoSrc) {
                    setCurrentVideoSrc(recoveredUrl);
                    return;
                  }
                }
              } catch {}
              console.warn("Video failed to load source:", currentVideoSrc);
            }}
            className="w-full h-full object-contain"
            style={{
              transform: `scale(${currentScale})`,
              transition: "transform 0.22s cubic-bezier(0.2, 0.9, 0.2, 1)",
            }}
          />

          {/* Retention Edit Active Indicator & Toggle */}
          <div className="absolute top-3 right-3 flex items-center gap-2 pointer-events-auto z-20">
            <button
              type="button"
              onClick={() => setEffectsEnabled((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider backdrop-blur-md border transition cursor-pointer ${
                effectsEnabled
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.35)]"
                  : "bg-black/60 border-white/20 text-zinc-400"
              }`}
              title="Attiva/Disattiva effetti di ritenzione (Zoom, Subtitles, Silenzi)"
            >
              <Wand2 size={11} className={effectsEnabled ? "animate-pulse" : ""} />
              <span>{effectsEnabled ? "RETENTION AI ON" : "RAW FOOTAGE"}</span>
            </button>
          </div>

          {/* Dynamic Graphic Banner (Act Title / Hook) */}
          {activeGraphic && (
            <div className="absolute top-3 left-3 sm:left-4 z-20 max-w-[70%] animate-in fade-in slide-in-from-top-2 duration-300 pointer-events-none">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/80 border border-emerald-500/50 shadow-2xl backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-white truncate">
                  {activeGraphic.text}
                </span>
              </div>
            </div>
          )}

          {/* Alex Hormozi Style Karaoke Subtitles */}
          {effectsEnabled && visibleWords.length > 0 && (
            <div
              className="absolute left-0 right-0 z-20 flex justify-center items-center pointer-events-none px-4 select-none animate-in fade-in duration-100"
              style={{ bottom: `${job.editPlan?.captions?.bottom_pct || 18}%` }}
            >
              <div className="inline-flex flex-wrap justify-center items-center gap-1.5 sm:gap-2 px-4 py-1.5 rounded-xl bg-black/60 backdrop-blur-sm shadow-2xl border border-white/10">
                {visibleWords.map((w, idx) => {
                  const isCurrent = currentTime >= w.start && currentTime <= w.end;
                  return (
                    <span
                      key={`${w.word}-${idx}`}
                      className={`font-black uppercase tracking-tight sm:tracking-wider transition-all duration-100 ${
                        isCurrent
                          ? "text-yellow-300 scale-110 drop-shadow-[0_2px_8px_rgba(250,204,21,0.8)] text-sm sm:text-base"
                          : "text-white text-xs sm:text-sm drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]"
                      }`}
                    >
                      {w.word}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 2. BOTTOM CARD CONTAINER — Rounded pill card matching the wireframe */}
        <div className="w-full mt-3 sm:mt-4 rounded-3xl sm:rounded-[32px] border border-white/15 bg-[#141416]/95 backdrop-blur-xl shadow-2xl p-3.5 sm:p-4 flex flex-col justify-between shrink-0">
          {/* Prompt input field */}
          <div className="w-full mb-2.5">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Chiedi all'AI di modificare tagli, zoom, silenzi, testo..."
              className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-2.5 text-xs sm:text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white/30 transition text-center sm:text-left"
              disabled={busy}
            />
            {err && (
              <p className="mt-1 text-center text-xs text-rose-400 font-medium">
                {err}
              </p>
            )}
          </div>

          {/* Bottom row: OPUS 3.5 (left) + EDIT button (right) */}
          <div className="flex items-center justify-between">
            {/* Left: OPUS 3.5 Terracotta/Orange Badge (#ea9368 from photo) */}
            <div
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-extrabold tracking-wider text-white shadow-md select-none"
              style={{ backgroundColor: "#ea9368" }}
              aria-label="Powered by OPUS 3.5"
            >
              <Sparkles size={12} className="text-white fill-white" />
              <span>OPUS 3.5</span>
            </div>

            {/* Right: EDIT outlined pill button matching the photo */}
            <button
              type="button"
              onClick={submit}
              disabled={busy || prompt.trim().length < 2}
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/30 bg-transparent hover:bg-white/10 active:scale-95 px-6 py-1 text-xs font-extrabold uppercase tracking-wider text-white transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : null}
              <span>EDIT</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
