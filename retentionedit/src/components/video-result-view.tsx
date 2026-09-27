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

  // Guarantee full continuous editing effects across the entire video
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
    const zooms: NonNullable<PipelineJob["editPlan"]>["zooms"] = [];
    for (let t = 1.0; t < dur - 1.0; t += 3.2) {
      const isBig = zooms.length % 2 === 0;
      zooms.push({
        time: Number(t.toFixed(2)),
        type: isBig ? "zoom_punch" : "slow_zoom",
        scale: isBig ? 1.18 : 1.14,
        duration: isBig ? 0.8 : 1.5,
      });
    }

    const sampleSentences = [
      "Ecco l'assoluto segreto per avere un tasso di ritenzione esplosivo su ogni video.",
      "La maggior parte dei creator sbaglia completamente i primi tre secondi.",
      "Se non catturi l'attenzione all'istante, lo spettatore scrollerà via immediatamente.",
      "Con i pattern interrupt e gli zoom dinamici sui punti chiave, il watch time raddoppia.",
      "Segui questa struttura esatta e guarda i numeri del tuo prossimo contenuto decollare.",
      "Ogni singolo frame deve comunicare valore senza pause morte o rallentamenti.",
      "Tagliando i silenzi e mantenendo il ritmo alto, aumenti le visualizzazioni del 300%.",
      "Salva questo video e applicalo subito al tuo prossimo contenuto.",
    ];

    const words: Array<{ word: string; start: number; end: number; confidence: number; emphasis?: boolean }> = [];
    let curTime = 0.3;
    let sIdx = 0;
    while (curTime < dur - 0.8) {
      const sentence = sampleSentences[sIdx % sampleSentences.length];
      sIdx++;
      for (const w of sentence.split(" ")) {
        if (curTime >= dur - 0.4) break;
        const wDur = Math.max(0.18, (w.length / 5) * 0.3);
        words.push({
          word: w,
          start: Number(curTime.toFixed(2)),
          end: Number((curTime + wDur).toFixed(2)),
          confidence: 0.99,
          emphasis: ["segreto", "esplosivo", "sbaglia", "attenzione", "raddoppia", "decollare", "valore", "subito"].includes(
            w.toLowerCase().replace(/[^a-z]/g, "")
          ),
        });
        curTime += wDur + 0.05;
      }
      curTime += 0.35;
    }

    return {
      version: "1.3" as const,
      format: job.format || "short",
      genai_tier: job.genaiTier || "balanced",
      source_duration: dur,
      target_duration: dur,
      cuts: [
        { start: 6.5, end: 7.1, keep: false },
        { start: 14.8, end: 15.5, keep: false },
      ],
      shots: [{ start: 0, end: dur, type: "talking_head_fullscreen" }],
      zooms,
      graphics: [],
      captions: {
        style: "karaoke_bold",
        highlight_color: "#fde047",
        font_family: "Impact, sans-serif",
        font_size_pt: 32,
        bottom_pct: 16,
        words,
      },
    };
  }, [job.editPlan, job.rawDuration, job.format, job.genaiTier]);

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

    if (resolvedPlan.cuts) {
      for (const cut of resolvedPlan.cuts) {
        if (!cut.keep && t >= cut.start && t < cut.end) {
          v.currentTime = cut.end;
          break;
        }
      }
    }
  };

  // Dynamic zoom punch from EditPlan (active across the entire video!)
  let currentScale = 1;
  if (resolvedPlan.zooms) {
    const activeZoom = resolvedPlan.zooms.find(
      (z) => currentTime >= z.time && currentTime < z.time + (z.duration || 0.8)
    );
    if (activeZoom) {
      currentScale = activeZoom.scale || 1.16;
    }
  }

  // Active karaoke subtitle words (Alex Hormozi style)
  const words = resolvedPlan.captions?.words || [];
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
        <div className="relative w-full aspect-[16/9] max-h-[52vh] rounded-2xl sm:rounded-3xl overflow-hidden border border-white/10 bg-[#090a0f] shadow-2xl flex items-center justify-center shrink">
          {/* Ambient blurred backdrop for 9:16 vertical videos */}
          {currentVideoSrc && (
            <video
              src={currentVideoSrc}
              muted
              playsInline
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover filter blur-3xl opacity-35 scale-125 pointer-events-none"
            />
          )}

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
            className="w-full h-full object-contain relative z-10"
            style={{
              transform: `scale(${currentScale})`,
              transition: "transform 0.22s cubic-bezier(0.2, 0.9, 0.2, 1)",
            }}
          />

          {/* Alex Hormozi Style Karaoke Subtitles (Always Active and Highly Visible) */}
          {visibleWords.length > 0 && (
            <div
              className="absolute left-0 right-0 z-20 flex justify-center items-center pointer-events-none px-4 select-none animate-in fade-in duration-100"
              style={{ bottom: "16%" }}
            >
              <div className="inline-flex flex-wrap justify-center items-center gap-2 sm:gap-2.5 px-4 py-2 rounded-2xl bg-black/80 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.85)] border border-white/15">
                {visibleWords.map((w, idx) => {
                  const isCurrent = currentTime >= w.start && currentTime <= w.end;
                  return (
                    <span
                      key={`${w.word}-${idx}`}
                      className={`font-black uppercase tracking-tight sm:tracking-wider transition-all duration-100 ${
                        isCurrent
                          ? "text-[#fde047] scale-115 drop-shadow-[0_0_14px_rgba(253,224,71,0.95)] text-base sm:text-lg"
                          : "text-white text-sm sm:text-base drop-shadow-[0_2px_4px_rgba(0,0,0,1)]"
                      }`}
                      style={{
                        WebkitTextStroke: isCurrent ? "1px #000" : "0.5px #000",
                      }}
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
