"use client";
import React, { useState } from "react";
import {
  UploadCloud,
  Film,
  Smartphone,
  Monitor,
  Sparkles,
  Check,
  ArrowRight,
  Wand2,
  Link2,
  Play,
  Zap,
  ShieldCheck,
  Layers,
} from "lucide-react";
import { GenAITier, VideoFormat } from "@/lib/types";
import { calculateJobCredits } from "@/lib/credits";

interface UploaderProps {
  onStartJob: (params: {
    title: string;
    rawVideoUrl: string;
    format: VideoFormat;
    genaiTier: GenAITier;
    duration: number;
    file?: File | null;
  }) => void;
  loading: boolean;
  initialUrl?: string;
}

export function Uploader({ onStartJob, loading, initialUrl = "" }: UploaderProps) {
  const [format, setFormat] = useState<VideoFormat>("short");
  const [tier, setTier] = useState<GenAITier>("balanced");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoTitle, setVideoTitle] = useState("Viral Retention Take #1");
  const [urlInput, setUrlInput] = useState(initialUrl);
  const [dragActive, setDragActive] = useState(false);

  const DEMO_PRESETS = [
    {
      title: "Creator Talking Head (9:16 Vertical)",
      format: "short" as VideoFormat,
      duration: 38,
      url: "/videos/raw-vlog.mp4",
      tag: "TikTok / Shorts",
      hookScore: 9.8,
      desc: "Fast cadence with punch zooms & karaoke words",
    },
    {
      title: "Tech Explainer & Breakdown (16:9 Horizontal)",
      format: "long" as VideoFormat,
      duration: 64,
      url: "/videos/raw-podcast.mp4",
      tag: "YouTube Masterclass",
      hookScore: 9.5,
      desc: "Ali Abdaal pacing with demonstrative PiP slides",
    },
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setVideoTitle(file.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setVideoTitle(`Web Stream (${new URL(urlInput).hostname})`);
    handleStart();
  };

  const handleStart = () => {
    onStartJob({
      title: videoTitle,
      rawVideoUrl: selectedFile ? URL.createObjectURL(selectedFile) : "/videos/raw-vlog.mp4",
      format,
      genaiTier: tier,
      duration: selectedFile ? 45 : format === "short" ? 38 : 64,
      file: selectedFile || null,
    });
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#181a24] border border-[#282a39] text-[#8c8f9f] text-xs font-bold uppercase tracking-wider">
          <Wand2 size={13} className="text-white" />
          Autonomous AI Studio &bull; Powered by Claude Opus 5.5 &amp; Higgsfield 4K (2.5D Motion)
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white">
          Drop RAW Video. Get <br className="hidden sm:inline" />
          <span className="text-white">
            Publish-Ready Video
          </span>
        </h1>

        <p className="text-[#8c8f9f] text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
          The autonomous editor: eliminates silences, injects pacing curves, syncs kinetic subtitles, and renders on Modal GPU.
        </p>
      </div>

      {/* Main Container Card */}
      <div className="bg-[#121319] border border-[#21232d] rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-8">
        {/* URL Paste Bar */}
        <form onSubmit={handleUrlSubmit} className="relative flex items-center">
          <div className="absolute left-4 text-[#8c8f9f] pointer-events-none">
            <Link2 size={18} />
          </div>
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste YouTube link, Google Drive, or MP4 URL to auto-edit..."
            className="w-full pl-11 pr-32 sm:pr-40 py-4 rounded-2xl bg-[#181a24] border border-[#282a39] text-xs sm:text-sm text-white placeholder-[#656779] focus:outline-none focus:border-white transition-all"
          />
          <button
            type="submit"
            disabled={loading || !urlInput.trim()}
            className="absolute right-2 px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-200 disabled:opacity-40 text-black font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles size={13} />
            <span>Fetch &amp; Edit</span>
          </button>
        </form>

        <div className="flex items-center gap-4">
          <div className="flex-1 h-[1px] bg-slate-800/80" />
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500">
            OR UPLOAD LOCAL FOOTAGE
          </span>
          <div className="flex-1 h-[1px] bg-slate-800/80" />
        </div>

        {/* Dropzone with Glowing Border */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              const file = e.dataTransfer.files[0];
              setSelectedFile(file);
              setVideoTitle(file.name.replace(/\.[^/.]+$/, ""));
            }
          }}
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all cursor-pointer relative group ${
            dragActive
              ? "border-emerald-400 bg-emerald-500/10 shadow-lg shadow-emerald-500/10"
              : selectedFile
              ? "border-emerald-500/60 bg-emerald-500/5"
              : "border-slate-800 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-950/60"
          }`}
        >
          <input
            type="file"
            id="video-upload"
            accept="video/mp4,video/quicktime,video/webm"
            className="hidden"
            onChange={handleFileChange}
          />
          <label htmlFor="video-upload" className="cursor-pointer block space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600/20 via-slate-800 to-emerald-500/20 border border-slate-700/60 flex items-center justify-center mx-auto text-emerald-400 shadow-inner group-hover:scale-105 transition-transform">
              <UploadCloud size={28} />
            </div>

            {selectedFile ? (
              <div>
                <p className="text-sm sm:text-base text-emerald-400 font-bold">{selectedFile.name}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB &bull; Ready for Claude Opus Directorial Pass
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm sm:text-base text-white font-bold">
                  Drag &amp; drop your raw creator footage here
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Supports MP4, MOV, WebM up to 4GB &bull; 4K 60FPS Supported
                </p>
              </div>
            )}

            {/* Quality Capability Chips */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[10px] text-slate-300 font-mono">
                NVENC GPU Speed
              </span>
              <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[10px] text-slate-300 font-mono">
                Meta Muse STT
              </span>
              <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[10px] text-slate-300 font-mono">
                Auto-Face Reframe
              </span>
              <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-[10px] text-slate-300 font-mono">
                High-CTR Thumbnail
              </span>
            </div>
          </label>
        </div>

        {/* OpusClip 1-Click Demo Showcase Cards */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Or test with viral reference presets:
            </span>
            <span className="text-[11px] text-emerald-400 font-medium">1-Click Instant Preview</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {DEMO_PRESETS.map((demo) => {
              const isSelected = videoTitle === demo.title && !selectedFile;
              return (
                <div
                  key={demo.title}
                  onClick={() => {
                    setSelectedFile(null);
                    setVideoTitle(demo.title);
                    setFormat(demo.format);
                  }}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                    isSelected
                      ? "border-emerald-500/80 bg-emerald-500/10 shadow-lg shadow-emerald-500/5"
                      : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                        <Play size={18} fill="currentColor" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-white">{demo.title}</p>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{demo.desc}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold font-mono">
                        {demo.hookScore} / 10
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">~{demo.duration}s</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Aspect Ratio Selector (OpusClip Visual Cards) */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
            1. Target Aspect Ratio &amp; Platform Layout
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setFormat("short")}
              className={`p-4 rounded-2xl border transition-all text-left flex items-start gap-4 ${
                format === "short"
                  ? "border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/10"
                  : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
              }`}
            >
              <div
                className={`w-12 h-14 rounded-xl border flex flex-col items-center justify-between p-1.5 shrink-0 ${
                  format === "short"
                    ? "border-violet-500 bg-violet-600/20 text-violet-300"
                    : "border-slate-800 bg-slate-900 text-slate-500"
                }`}
              >
                <div className="w-4 h-1 rounded-full bg-current opacity-40" />
                <Smartphone size={20} />
                <div className="w-5 h-1 rounded bg-emerald-400" title="18% Safe Area" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white">9:16 Vertical (Shorts, Reels, TikTok)</p>
                  {format === "short" && <Check size={14} className="text-violet-400" />}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Enforces strict 18% bottom safe margin so subtitles are never hidden behind TikTok UI buttons.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFormat("long")}
              className={`p-4 rounded-2xl border transition-all text-left flex items-start gap-4 ${
                format === "long"
                  ? "border-violet-500 bg-violet-500/10 shadow-lg shadow-violet-500/10"
                  : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
              }`}
            >
              <div
                className={`w-14 h-12 rounded-xl border flex items-center justify-center shrink-0 ${
                  format === "long"
                    ? "border-violet-500 bg-violet-600/20 text-violet-300"
                    : "border-slate-800 bg-slate-900 text-slate-500"
                }`}
              >
                <Monitor size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white">16:9 Horizontal (YouTube, Podcasts)</p>
                  {format === "long" && <Check size={14} className="text-violet-400" />}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  10% title-safe margins, chapter banner cards, and PiP demonstration windows.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* GenAI Intensity & Credit Cost */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              2. Higgsfield 4K Cutaways &amp; 2.5D Motion
            </label>
            <span className="text-xs text-indigo-400 flex items-center gap-1 font-medium">
              <Sparkles size={12} /> Powered by Higgsfield 4K Image + 2.5D Drift
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Eco Tier */}
            <button
              type="button"
              onClick={() => setTier("eco")}
              className={`p-4 rounded-2xl border text-left transition-all ${
                tier === "eco"
                  ? "border-emerald-500 bg-emerald-500/10 shadow-md shadow-emerald-500/10"
                  : "border-slate-800 bg-slate-950/40 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-white">Eco</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-emerald-400 font-mono font-bold">
                  10 Credits
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Claude Opus + 100% HyperFrames code animations. Free zooms &amp; kinetic subtitles.
              </p>
            </button>

            {/* Balanced Tier (Recommended) */}
            <button
              type="button"
              onClick={() => setTier("balanced")}
              className={`p-4 rounded-2xl border text-left transition-all relative cursor-pointer ${
                tier === "balanced"
                  ? "border-white/50 bg-[#181a24] shadow-lg"
                  : "border-[#21232d] bg-[#121319] hover:border-[#2f3240]"
              }`}
            >
              <div className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-white text-black text-[10px] font-bold">
                RECOMMENDED
              </div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-white">Balanced</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono font-bold">
                  25 Credits
                </span>
              </div>
              <p className="text-xs text-[#8c8f9f] mt-1">
                AI Edit + 1-2 Higgsfield 4K Image cutaways with 2.5D Ken Burns camera drift.
              </p>
            </button>

            {/* Cinematic Pro Tier */}
            <button
              type="button"
              onClick={() => setTier("cinematic")}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                tier === "cinematic"
                  ? "border-white/50 bg-[#181a24] shadow-md"
                  : "border-[#21232d] bg-[#121319] hover:border-[#2f3240]"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-white">Cinematic Pro</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white font-mono font-bold">
                  55 Credits
                </span>
              </div>
              <p className="text-xs text-[#8c8f9f] mt-1">
                3-4 Higgsfield 4K Image cutaways with 2.5D Ken Burns zoom &amp; lateral camera drift.
              </p>
            </button>
          </div>
        </div>

        {/* CTA Launch Button */}
        <div className="pt-2">
          <button
            type="button"
            disabled={loading}
            onClick={handleStart}
            className="w-full py-4 sm:py-5 px-6 rounded-2xl bg-white hover:bg-neutral-200 text-black font-extrabold text-base shadow-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Launching Autonomous Engine...
              </span>
            ) : (
              <>
                <span>Launch Autonomous Edit</span>
                <span className="text-xs px-2.5 py-1 rounded-lg bg-black text-white font-mono">
                  {calculateJobCredits(tier)} Credits
                </span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
