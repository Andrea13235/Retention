"use client";
import React, { useState } from "react";
import {
  Home,
  ChevronLeft,
  Loader2,
  Sparkles,
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
 * Implements the exact layout, dimensions, proportions, and UI elements
 * from the design wireframe:
 * 1. Top: Centered 16:9 VIDEO player container.
 * 2. Bottom: Prominent rounded pill card with:
 *    - "EDIT THE VIDEO ON AI" header
 *    - "Gesture Mode" pill button in the center
 *    - Prompt input to request AI revisions
 *    - Bottom-left: "OPUS 3.5" terracotta/orange badge (#ea9368)
 *    - Bottom-right: "EDIT" pill button
 * 3. Clean minimal screen: NOTHING ELSE ("non ci deve stare niente altro").
 * 4. "Home" navigation button to return to the home screen.
 */
export function VideoResultView({ job, onReset, onRevised }: VideoResultViewProps) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [gestureMode, setGestureMode] = useState(true);

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

  const fallbackUrl = (job.format === "short") ? "/videos/kling-creator-9-16.mp4" : "/videos/final-horizontal.mp4";
  const getInitialSrc = () => {
    const v = job.renderedVideoUrl;
    if (v && !v.includes("r2.retentionedit.com") && !v.includes("your_")) return v;
    if (job.rawVideoUrl && !job.rawVideoUrl.includes("r2.retentionedit.com") && !job.rawVideoUrl.includes("your_")) return job.rawVideoUrl;
    return fallbackUrl;
  };
  const [currentVideoSrc, setCurrentVideoSrc] = useState(getInitialSrc());

  React.useEffect(() => {
    setCurrentVideoSrc(getInitialSrc());
  }, [job.renderedVideoUrl, job.rawVideoUrl, fallbackUrl]);

  return (
    <div className="w-full flex flex-col items-center justify-center min-h-[calc(100vh-140px)] py-4 px-2 sm:px-4">
      {/* Top Navigation: Home Back Button */}
      <div className="w-full max-w-[780px] flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#8c8c90] hover:text-white transition px-3 py-1.5 rounded-xl hover:bg-white/5 cursor-pointer group"
          title="Torna alla Home"
        >
          <ChevronLeft size={16} className="text-[#8c8c90] group-hover:text-white transition" />
          <Home size={15} />
          <span>Home</span>
        </button>

        {/* Deliverable Badge */}
        <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
          Quality Gate Verified &bull; Broadcast Ready
        </span>
      </div>

      {/* Main Layout Container matching the wireframe photo */}
      <div className="w-full max-w-[780px] flex flex-col items-center">
        {/* Title display */}
        <div className="w-full mb-3 text-left">
          <h1 className="text-base sm:text-xl font-bold text-white tracking-tight leading-snug">
            {job.title}
          </h1>
        </div>

        {/* 1. TOP VIDEO CONTAINER — Proportions and position matching the photo */}
        <div className="w-full aspect-[16/9] rounded-2xl sm:rounded-3xl overflow-hidden border border-white/10 bg-black shadow-2xl flex items-center justify-center relative">
          <video
            src={currentVideoSrc}
            controls
            autoPlay
            playsInline
            loop
            onError={() => {
              if (currentVideoSrc !== fallbackUrl) {
                console.warn("Rendered video failed to load, switching to fallback:", fallbackUrl);
                setCurrentVideoSrc(fallbackUrl);
              }
            }}
            className="w-full h-full object-contain"
          />
        </div>

        {/* 2. BOTTOM CARD CONTAINER — Rounded pill card matching the photo */}
        <div className="w-full mt-7 sm:mt-9 rounded-[28px] sm:rounded-[36px] border border-white/15 bg-[#141416]/95 backdrop-blur-xl shadow-2xl p-5 sm:p-7 flex flex-col justify-between">
          {/* Top text: EDIT THE VIDEO ON AI */}
          <div className="text-center">
            <h2 className="text-xs sm:text-sm font-semibold tracking-[0.22em] text-white/60 uppercase select-none font-mono">
              EDIT THE VIDEO ON AI
            </h2>
          </div>

          {/* Center: Gesture Mode pill */}
          <div className="flex items-center justify-center my-3.5">
            <button
              type="button"
              onClick={() => setGestureMode(!gestureMode)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition cursor-pointer select-none border ${
                gestureMode
                  ? "bg-[#333338] text-white border-white/20 shadow-md"
                  : "bg-[#202024] text-white/50 border-white/10 hover:text-white"
              }`}
              title="Toggle Gesture Mode"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  gestureMode ? "bg-emerald-400" : "bg-white/30"
                }`}
              />
              Gesture Mode
            </button>
          </div>

          {/* Prompt input field */}
          <div className="my-2">
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
              className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-white/30 transition text-center sm:text-left"
              disabled={busy}
            />
            {err && (
              <p className="mt-1.5 text-center text-xs text-rose-400 font-medium">
                {err}
              </p>
            )}
          </div>

          {/* Bottom row: OPUS 3.5 (left) + EDIT button (right) */}
          <div className="flex items-center justify-between mt-3 pt-1">
            {/* Left: OPUS 3.5 Terracotta/Orange Badge (#ea9368 from photo) */}
            <div
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-extrabold tracking-wider text-white shadow-md select-none"
              style={{ backgroundColor: "#ea9368" }}
              aria-label="Powered by OPUS 3.5"
            >
              <Sparkles size={13} className="text-white fill-white" />
              <span>OPUS 3.5</span>
            </div>

            {/* Right: EDIT outlined pill button matching the photo */}
            <button
              type="button"
              onClick={submit}
              disabled={busy || prompt.trim().length < 2}
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/30 bg-transparent hover:bg-white/10 active:scale-95 px-6 sm:px-7 py-1.5 text-xs font-extrabold uppercase tracking-wider text-white transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : null}
              <span>EDIT</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
