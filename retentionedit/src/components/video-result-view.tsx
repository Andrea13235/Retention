"use client";
import React, { useState } from "react";
import {
  Download,
  CheckCircle2,
  Image as ImageIcon,
  Code2,
  RotateCcw,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Mic,
  Send,
  Loader2,
  Wand2,
} from "lucide-react";
import { PipelineJob } from "@/lib/types";
import { RetentionMetrics } from "./retention-metrics";

interface VideoResultViewProps {
  job: PipelineJob;
  onReset: () => void;
  /** Called after a successful Opus revision — parent should refetch or patch job. */
  onRevised?: (job: PipelineJob) => void;
}

/** Terracotta Opus badge — riusa il croma #D88C6A dello screenshot Connect Higgsfield. */
function OpusBadge() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold tracking-wide text-white"
      style={{ background: "#D88C6A", boxShadow: "0 2px 0 #B56E4F" }}
      aria-label="Powered by Opus 5.5"
    >
      {/* sparkle starburst icon — 4-point, matches Connect Higgsfield reference */}
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path
          d="M6 0L6.6 4.2L10.8 3.6L6.6 6L10.8 8.4L6.6 7.8L6 12L5.4 7.8L1.2 8.4L5.4 6L1.2 3.6L5.4 4.2L6 0Z"
          fill="white"
          opacity="0.95"
        />
        <circle cx="6" cy="6" r="1.4" fill="white" />
      </svg>
      Opus 5.5
    </span>
  );
}

function ReviseBar({
  jobId,
  disabled,
  onRevised,
}: {
  jobId: string;
  disabled?: boolean;
  onRevised?: (job: PipelineJob) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    const p = prompt.trim();
    if (p.length < 3) {
      setErr("Scrivi almeno qualche parola (es. \"rendi il taglio più veloce\")");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/pipeline/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, prompt: p }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Revisione fallita, riprova");
      setPrompt("");
      if (data?.job && onRevised) onRevised(data.job as PipelineJob);
      else window.location.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Errore imprevisto");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-md shadow-xl overflow-hidden">
      {/* header identico al wireframe: placeholder faint + pill centrale */}
      <div className="px-4 sm:px-6 pt-4 pb-3">
        <p className="text-center text-[10px] tracking-[0.18em] font-semibold text-white/40 uppercase">
          Edit the video on AI
        </p>
        <div className="mt-2 flex items-center justify-center">
          <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80 border border-white/10">
            Gesture Mode
          </span>
        </div>
      </div>
      <div className="px-3 sm:px-4 pb-4">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-2 py-2 shadow-inner">
          <OpusBadge />
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Chiedi a Claude Opus 5.5: cosa vuoi cambiare o aggiungere?"
            className="flex-1 bg-transparent px-2 text-sm text-white placeholder:text-white/40 focus:outline-none min-w-0"
            disabled={busy || disabled}
            aria-label="Prompt per revisione video"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy || disabled || prompt.trim().length < 3}
            className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-zinc-900 hover:bg-zinc-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Edit
          </button>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[11px] leading-relaxed text-white/45 px-1">
          <Wand2 size={12} className="shrink-0 text-white/50" />
          Le modifiche vengono eseguite da <span className="font-semibold text-white/70">Opus 5.5 con HyperFrames</span> — tagli, zooms e cover in modo professionale e perfetto.
        </p>
        {err && <p className="mt-2 text-xs font-medium text-red-300 px-1">{err}</p>}
      </div>
    </div>
  );
}

export function VideoResultView({ job, onReset, onRevised }: VideoResultViewProps) {
  const [showJson, setShowJson] = useState(false);
  const isShort = (job.format || "short").toLowerCase() === "short";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Success banner — compatta, dark app, con Opus badge */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] via-white/[0.03] to-transparent backdrop-blur-md p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <CheckCircle2 size={22} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase font-bold tracking-wider text-emerald-300">
                Quality Gate Verified · Broadcast Ready
              </span>
              <OpusBadge />
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-white truncate mt-0.5">{job.title || "Untitled edit"}</h2>
            <p className="text-xs text-white/50">
              ~{job.editPlan?.target_duration ?? 32}s · {(job.format || "9:16").toUpperCase()} · {(job.genaiTier || "balanced").toUpperCase()}
            </p>
          </div>
        </div>
        <button
          onClick={onReset}
          className="shrink-0 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-semibold text-white flex items-center gap-2 transition"
        >
          <RotateCcw size={14} /> New Edit
        </button>
      </div>

      {/* LAYOUT WIRE FRAME: VIDEO sopra (16:9-ish) + BAR sotto — proporzioni dal disegno, stile dark app */}
      <div className="space-y-4">
        {/* Top VIDEO — rettangolo grande centrato, proporzione wireframe */}
        <div className="flex justify-center">
          <div
            className={`relative w-full max-w-[720px] rounded-2xl overflow-hidden border border-white/10 bg-black shadow-2xl ${
              isShort ? "aspect-[9/16] max-w-[360px]" : "aspect-[16/9]"
            }`}
          >
            <video
              src={job.renderedVideoUrl}
              controls
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] text-emerald-300 font-mono flex items-center gap-1.5 pointer-events-none">
              <ShieldCheck size={12} /> Safe Areas Locked
            </div>
          </div>
        </div>

        {/* Bottom pill — barra prompt AI (proporzioni wireframe, stile app) */}
        <ReviseBar jobId={job.id} onRevised={onRevised} />
      </div>

      {/* Deliverables: struttura esistente, invariata sotto */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pt-2">
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-sm space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles size={14} className="text-emerald-400" /> Final Deliverable
            </h3>
            <p className="text-xs leading-relaxed text-white/50">
              Compilato su Modal NVENC. Sottotitoli karaoke, zoom dinamici e silence trim inclusi.
            </p>
            <a
              href={job.renderedVideoUrl}
              download={`${job.title}_retention.mp4`}
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2"
            >
              <Download size={16} /> Download Broadcast MP4
            </a>
          </div>

          {job.voiceoverUrl ? (
            <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Mic size={14} className="text-emerald-400" /> Hook Voiceover
              </h3>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio src={job.voiceoverUrl} controls preload="metadata" className="w-full" />
              <a
                href={job.voiceoverUrl}
                download={`${job.title}_voiceover.mp3`}
                className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-semibold text-xs transition flex items-center justify-center gap-2"
              >
                <Download size={14} /> Download Voiceover (MP3)
              </a>
            </div>
          ) : null}

          <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ImageIcon size={14} className="text-indigo-300" /> High-CTR Cover
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-200 border border-indigo-500/20 font-semibold">
                RETENTIONVOLT
              </span>
            </div>
            <div className="rounded-xl overflow-hidden border border-white/10 bg-zinc-950 aspect-[16/9] relative">
              {job.thumbnailUrl && job.thumbnailUrl.startsWith("/thumbnails/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={job.thumbnailUrl} alt={`${job.title} cover`} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-tr from-zinc-950 via-zinc-900 to-indigo-950">
                  <span className="px-2 py-0.5 rounded bg-emerald-400 text-black text-[10px] font-black uppercase mb-1">
                    {job.blueprint?.thumbnail.badge || "PROVEN HOOK"}
                  </span>
                  <span className="text-base sm:text-lg font-black tracking-tight text-white uppercase drop-shadow-md">
                    {job.blueprint?.thumbnail.title || "THE SECRET FORMULA"}
                  </span>
                  <span className="text-[10px] text-white/40 mt-2 font-mono">
                    Captured at {job.blueprint?.thumbnail.frame_time || "00:01.400"}
                  </span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => window.open(job.thumbnailUrl || "#", "_blank")}
              className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-semibold text-xs transition flex items-center justify-center gap-2"
            >
              <Download size={14} /> Download Thumbnail
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowJson(!showJson)}
            className="w-full py-2.5 px-4 rounded-xl border border-white/10 hover:border-white/15 bg-white/[0.03] text-white/60 hover:text-white text-xs font-mono transition flex items-center justify-center gap-2"
          >
            <Code2 size={14} />
            {showJson ? "Hide EditPlan JSON" : "Inspect EditPlan v1.3 JSON"}
          </button>
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles size={14} className="text-emerald-400" /> Delivery notes
            </h3>
            <p className="text-xs leading-relaxed text-white/50">
              La cover e il video vengono rigenerati da HyperFrames + Modal quando chiedi una revisione in barra.
            </p>
          </div>
        </div>
      </div>

      {showJson && (
        <div className="p-4 rounded-2xl bg-zinc-950 border border-white/10 font-mono text-xs text-zinc-300 max-h-96 overflow-auto">
          <pre>{JSON.stringify(job.editPlan, null, 2)}</pre>
        </div>
      )}

      {job.editPlan?.brolls && job.editPlan.brolls.length > 0 && (
        <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles size={14} className="text-emerald-400" />
              2.5D Ken Burns ({job.editPlan.brolls.length} · Higgsfield 4K)
            </h3>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold whitespace-nowrap">
              Zero AI Slime
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {job.editPlan.brolls.map((b, idx) => (
              <div
                key={b.id || idx}
                className="p-3 rounded-xl border border-white/10 bg-black/20 flex flex-col gap-3 group hover:border-white/15 transition"
              >
                <div className="relative aspect-video rounded-lg overflow-hidden border border-white/10 bg-black">
                  <img
                    src={b.source_url}
                    alt={b.prompt}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition duration-500"
                    loading="lazy"
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-[10px] text-emerald-300 font-mono">
                    {b.timeline_start.toFixed(2)}s → {b.timeline_end.toFixed(2)}s
                  </div>
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-[10px] text-white/80 font-semibold uppercase">
                    {b.camera_motion.replace(/_/g, " ")}
                  </div>
                </div>
                <p className="text-xs text-white/60 line-clamp-2 italic">&ldquo;{b.prompt}&rdquo;</p>
                <div className="flex items-center justify-between text-[11px] text-white/35 font-mono">
                  <span>
                    Drift {b.motion_params?.drift_x ?? 24}/{b.motion_params?.drift_y ?? -14}px
                  </span>
                  <a
                    href={b.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-300 hover:text-emerald-200 flex items-center gap-1"
                  >
                    <ExternalLink size={11} /> 4K
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <RetentionMetrics job={job} />
    </div>
  );
}
