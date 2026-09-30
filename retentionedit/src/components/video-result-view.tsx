"use client";
import React, { useState, useRef } from "react";
import {
  Download,
  Check,
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

  const [isRenderedBaked, setIsRenderedBaked] = useState<boolean>(false);
  const [bakingPct, setBakingPct] = useState<number | null>(null);

  // Piano REALE dal server — niente zoom ritmici inventati ogni 3.2s:
  // senza piano reale il player mostra il video così com'è (zoom vuoti).
  const resolvedPlan = React.useMemo(() => {
    if (
      job.editPlan &&
      job.editPlan.zooms &&
      job.editPlan.zooms.length > 2 &&
      job.editPlan.captions?.words &&
      job.editPlan.captions.words.length > 10
    ) {
      return job.editPlan;
    }
    const dur = job.rawDuration || 35;

    const effectiveGraphics: NonNullable<PipelineJob["editPlan"]>["graphics"] = [];

    const effectiveShots: NonNullable<PipelineJob["editPlan"]>["shots"] = [
      { start: 0, end: dur, type: "talking_head_fullscreen" },
    ];

    return {
      version: "1.3" as const,
      format: job.format || "short",
      genai_tier: job.genaiTier || "balanced",
      source_duration: dur,
      target_duration: dur,
      // SOLO piano reale dal server — niente tagli finti 6.5s: senza piano
      // reale non si inventa nessun taglio (player mostra il video così com'è).
      cuts: job.editPlan?.cuts && job.editPlan.cuts.length > 0 ? job.editPlan.cuts : [],
      shots: effectiveShots,
      zooms: job.editPlan?.zooms && job.editPlan.zooms.length > 0 ? job.editPlan.zooms : [],
      graphics: effectiveGraphics,
      captions: {
        words: [],
      },
    };
  }, [job.editPlan, job.rawDuration, job.format, job.genaiTier]);

  const [blobUrl, setBlobUrl] = useState<string | null>(() => {
    try {
      // Synchronously check memory cache for rendered video first
      const { getProjectBlobSync } = require("@/lib/projects-store");
      const rendered = getProjectBlobSync(`${job.id}_rendered`);
      if (rendered && rendered.size > 0) return URL.createObjectURL(rendered);
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
        // 1. Prioritize already-baked, fully-edited MP4/WebM video
        const rendered = await getProjectBlob(`${job.id}_rendered`);
        if (rendered && rendered.size > 0 && active) {
          setBlobUrl(URL.createObjectURL(rendered));
          setIsRenderedBaked(true);
          return;
        }

        // 2. If only raw video exists, auto-bake the cuts & zoom punches
        const rawBlob = await getProjectBlob(job.id);
        if (rawBlob && active) {
          setBlobUrl(URL.createObjectURL(rawBlob));
          setBakingPct(5);
          const { bakeEditedVideo } = await import("@/lib/video-baker");
          const baked = await bakeEditedVideo(job.id, rawBlob, resolvedPlan, {
            format: job.format,
            onProgress: (p) => setBakingPct(p.pct),
          });
          if (active && baked && baked.size > 0) {
            setBlobUrl(URL.createObjectURL(baked));
            setIsRenderedBaked(true);
            setBakingPct(null);
          }
        }
      } catch (err) {
        setBakingPct(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [job.id, resolvedPlan, job.format]);

  // Priorità SEMPRE al video reale editato (MP4 renderizzato dal server):
  // 1) renderedVideoUrl dal pipeline, 2) blob baked/auto-bake, 3) raw.
  // NIENTE più filtri "kling/raw-vlog": quei file demo non esistono più come fake —
  // raw-desktalk/raw-podcast sono sorgenti reali che passano dal pipeline completo.
  const getInitialSrc = () => {
    if (blobUrl) return blobUrl;
    const v = job.renderedVideoUrl;
    if (v && !v.includes("cloudflarestorage.com") && !v.includes("your_"))
      return v;
    if (
      job.rawVideoUrl &&
      !job.rawVideoUrl.includes("cloudflarestorage.com") &&
      !job.rawVideoUrl.includes("your_")
    )
      return job.rawVideoUrl;
    return "";
  };

  const [currentVideoSrc, setCurrentVideoSrc] = useState(getInitialSrc());
  const [currentTime, setCurrentTime] = useState(0);
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

    if (!isRenderedBaked && resolvedPlan.cuts) {
      for (const cut of resolvedPlan.cuts) {
        if (!cut.keep && t >= cut.start && t < cut.end) {
          v.currentTime = cut.end;
          break;
        }
      }
    }
  };

  // Dynamic zoom punch from EditPlan (active only as fallback if not yet baked)
  let currentScale = 1;
  if (!isRenderedBaked && resolvedPlan.zooms) {
    const activeZoom = resolvedPlan.zooms.find(
      (z) => currentTime >= z.time && currentTime < z.time + (z.duration || 0.8)
    );
    if (activeZoom) {
      currentScale = activeZoom.scale || 1.16;
    }
  }

  const handleDownloadBakedVideo = async () => {
    if (bakingPct !== null) return;
    try {
      const { getProjectBlob } = await import("@/lib/projects-store");
      const cleanTitle = (job.title || "video").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);

      // Check if already baked
      const cached = await getProjectBlob(`${job.id}_rendered`).catch(() => null);
      if (cached && cached.size > 0) {
        const url = URL.createObjectURL(cached);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${cleanTitle}_retention_edit.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }

      const rawBlob = await getProjectBlob(job.id).catch(() => null);
      const source = rawBlob || blobUrl || currentVideoSrc;
      if (!source) {
        setErr("Nessun video sorgente trovato per l'esportazione.");
        return;
      }

      setBakingPct(0);
      const { bakeEditedVideo } = await import("@/lib/video-baker");
      const baked = await bakeEditedVideo(job.id, source, resolvedPlan, {
        format: job.format,
        onProgress: (p) => setBakingPct(p.pct),
      });

      const url = URL.createObjectURL(baked);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${cleanTitle}_retention_edit.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBakingPct(null);
    } catch (e: any) {
      setErr("Errore esportazione MP4: " + (e?.message || e));
      setBakingPct(null);
    }
  };
  return (
    <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden select-none py-1">
      {/* Main Layout Container matching the wireframe photo */}
      <div className="w-full max-w-[720px] flex flex-col items-center my-auto">
        {/* 1. TOP VIDEO CONTAINER — Raised, clean, 16:9, fits the viewport perfectly */}
        <div className="relative w-full aspect-[16/9] max-h-[52vh] rounded-2xl sm:rounded-3xl overflow-hidden border border-white/10 bg-[#090a0f] shadow-2xl flex items-center justify-center shrink">
          {/* Ambient blurred backdrop for vertical videos */}
          {currentVideoSrc && (
            <video
              src={currentVideoSrc}
              muted
              playsInline
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover filter blur-3xl opacity-35 scale-125 pointer-events-none"
            />
          )}

          {/* Primary Video Element (Full Size with Dynamic Punch Zoom) */}
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
                const b = await getProjectBlob(`${job.id}_rendered`) || await getProjectBlob(job.id);
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
            className="w-full h-full object-contain relative z-10"
            style={{
              transform: isRenderedBaked ? "none" : `scale(${currentScale})`,
              transformOrigin: "center 38%",
              transition: "transform 0.22s cubic-bezier(0.2, 0.9, 0.2, 1)",
            }}
          />

          {/* Real-time Render Progress Badge (only while rendering) */}
          {bakingPct !== null && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none">
              <div className="px-4 py-2 rounded-full bg-black/85 border border-white/15 flex items-center gap-2.5 text-xs text-emerald-400 font-semibold shadow-2xl">
                <Loader2 size={14} className="animate-spin text-emerald-400" />
                <span>Montaggio MP4 in corso: tagli e zoom ({bakingPct}%)...</span>
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

            {/* Center: Download Baked MP4 button */}
            <button
              type="button"
              onClick={handleDownloadBakedVideo}
              disabled={bakingPct !== null}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 active:scale-95 px-4 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300 transition cursor-pointer"
            >
              {bakingPct !== null ? (
                <>
                  <Loader2 size={12} className="animate-spin text-emerald-400" />
                  <span>BAKING MP4 ({bakingPct}%)</span>
                </>
              ) : (
                <>
                  <Download size={12} className="text-emerald-400" />
                  <span>DOWNLOAD MP4</span>
                </>
              )}
            </button>

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
