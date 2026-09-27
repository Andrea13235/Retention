"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Link as LinkIcon,
  Upload,
  Scissors,
  Subtitles,
  Maximize2,
  Film,
  Volume2,
  Mic,
  ChevronDown,
  ArrowRight,
  Play,
  Pause,
  Layers,
  Calendar,
  Sparkles,
  Camera,
  RotateCcw,
} from "lucide-react";
import { Brand } from "./brand";
import { useAuth } from "@/context/auth-context";

interface LandingProps {
  onOpenStudio: () => void;
  onOpenLogin: () => void;
  onOpenPricing: () => void;
}

export default function Landing({
  onOpenStudio,
  onOpenLogin,
  onOpenPricing,
}: LandingProps) {
  const { isLoggedIn } = useAuth();
  const [selectedFeature, setSelectedFeature] = useState<string>("editing");
  const [linkInput, setLinkInput] = useState("");
  const [isPlaying, setIsPlaying] = useState(true);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [showFloatingBar, setShowFloatingBar] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setShowFloatingBar(window.scrollY > 450);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onOpenStudio();
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Top Creators
  const creators = [
    { name: "Mai Pham", count: "3.3M", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop" },
    { name: "Valuetainment", count: "5.3M", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop" },
    { name: "Jubilee Media", count: "9.79M", avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&h=120&fit=crop" },
    { name: "Tom Bilyeu", count: "4.5M", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop" },
    { name: "Jacksfilms", count: "5.08M", avatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=120&h=120&fit=crop" },
    { name: "Mark Rober", count: "65.9M", avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&h=120&fit=crop" },
    { name: "Grant Cardone", count: "4.7M", avatar: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=120&h=120&fit=crop" },
    { name: "Scott Galloway", count: "192K", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&h=120&fit=crop" },
  ];

  // Enterprise Brand Logos
  const brandLogos = [
    "NVIDIA",
    "GITHUB",
    "VISA",
    "TELEFÓNICA",
    "AUDACY",
    "UNIVISION",
    "HIGGSFIELD AI",
    "RETENTIONVOLT",
    "ZOOMINFO",
    "IHEART MEDIA",
  ];

  const faqs = [
    {
      q: "Cosa fa esattamente RetentionEdit?",
      a: "RetentionEdit è un editor video completamente autonomo basato su intelligenza artificiale. Carichi 1 o più video RAW grezzi (con errori, pause, esitazioni) e il sistema genera un video perfettamente editato: taglia i silenzi a 0ms, calibra il ritmo, bilancia l'audio, inserisce cutaway 4K fotorealistici con Higgsfield AI animati in 2.5D (Ken Burns & Camera Drift) e prepara il video finale pronto per la pubblicazione.",
    },
    {
      q: "Posso caricare più video RAW diversi per creare un unico video editato?",
      a: "Sì! RetentionEdit supporta la composizione Multi-RAW: puoi caricare più riprese separate (ad esempio diverse take, angolazioni differenti o spezzoni girati in momenti diversi). L'AI analizza il parlato, seleziona i passaggi migliori, rimuove le parti ripetute o morte e cuce tutto in un unico video fluido da studio.",
    },
    {
      q: "In che modo Higgsfield AI migliora i video?",
      a: "Higgsfield AI interviene nella componente cinematografica creando immagini fotografiche 4K ad altissima definizione. Invece di generare video AI pesanti e 'impastati', generiamo immagini statiche perfette che animiamo via codice in 2.5D (Ken Burns, camera drift millimetrico e whip-blur), garantendo zero artefatti e sincronizzazione perfetta al parlato.",
    },
    {
      q: "Quanto costa utilizzare il servizio?",
      a: "Ogni nuovo account riceve 25 crediti gratuiti all'iscrizione senza bisogno di inserire alcuna carta di credito. Un montaggio autonomo completo consuma 10 crediti. Puoi arricchirlo con cutaway 4K Higgsfield (+15 crediti).",
    },
    {
      q: "I video esportati hanno watermark o limiti di qualità?",
      a: "Nessun watermark. Tutti i video esportati sono puliti, privi di filigrana e renderizzati a 60fps in alta risoluzione su GPU serverless Nvidia.",
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black">
      {/* ========================================================================= */}
      {/* 1. TOP NAVIGATION BAR (EXACT OPUS.PRO LAYOUT)                             */}
      {/* ========================================================================= */}
      <nav className="sticky top-0 z-50 w-full bg-black/90 backdrop-blur-md border-b border-[#1b1c24] px-6 lg:px-12 py-3.5 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="cursor-pointer">
            <Brand />
          </Link>

          {/* Clean Desktop Navigation Links matching opus.pro */}
          <div className="hidden md:flex items-center gap-6 text-[13px] font-medium text-[#8c8f9f]">
            <button
              type="button"
              className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
            >
              <span>Features</span>
              <ChevronDown size={13} className="text-[#646777]" />
            </button>
            <button
              type="button"
              className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
            >
              <span>Solutions</span>
              <ChevronDown size={13} className="text-[#646777]" />
            </button>
            <button
              type="button"
              className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
            >
              <span>Resources</span>
              <ChevronDown size={13} className="text-[#646777]" />
            </button>
            <button
              type="button"
              onClick={onOpenPricing}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Pricing
            </button>
            <button
              type="button"
              className="hover:text-white transition-colors cursor-pointer"
            >
              For business
            </button>
            <Link
              href="/goal"
              className="hover:text-white transition-colors cursor-pointer"
            >
              Goal
            </Link>
          </div>
        </div>

        {/* Right CTA Actions */}
        <div className="flex items-center gap-5">
          {isLoggedIn ? (
            <Link
              href="/app"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-[#d1fe17] hover:bg-[#bce414] text-black text-xs font-black transition-all shadow-md shadow-[#d1fe17]/20 active:scale-95 cursor-pointer"
            >
              <span>Vai all'App</span>
              <ArrowRight size={13} strokeWidth={2.5} />
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={onOpenLogin}
                className="text-[13px] font-semibold text-[#8c8f9f] hover:text-white transition-colors cursor-pointer"
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={onOpenStudio}
                className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-white hover:bg-neutral-200 text-black text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
              >
                Sign up - It's FREE
              </button>
            </>
          )}
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* 2. HERO SECTION (EXACT OPUS.PRO STRUCTURE — 100% VIDEO EDITING FOCUS)     */}
      {/* ========================================================================= */}
      <header className="pt-16 pb-12 px-6 max-w-5xl mx-auto text-center space-y-6">
        {/* Eyebrow Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#14151b] border border-[#23242e] text-[11px] font-bold tracking-wider uppercase text-[#8c8f9f]">
          <span>#1 AI VIDEO EDITING TOOL</span>
        </div>

        {/* Clean Massive Headline matching opus.pro */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.08]">
          1 RAW video, 1 perfect edit. <br />
          Create 10x faster.
        </h1>

        {/* Subtitle */}
        <p className="text-sm sm:text-base text-[#8c8f9f] max-w-2xl mx-auto leading-relaxed">
          RetentionEdit turns raw video takes into a studio-grade edited video, with automated silence cutting and cinematic Higgsfield AI animations in one click.
        </p>

        {/* Center Pill Input Bar (Exact opus.pro look) */}
        <form
          onSubmit={handleInputSubmit}
          className="pt-2 max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 p-1.5 sm:p-2 rounded-2xl sm:rounded-full bg-[#14151b] border border-[#262835] shadow-2xl"
        >
          <div className="flex items-center gap-3 px-4 w-full sm:w-auto flex-1">
            <LinkIcon size={16} className="text-[#656779] shrink-0" />
            <input
              type="text"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="Drop a video link or RAW files"
              className="w-full bg-transparent text-white placeholder-[#656779] text-sm focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-white hover:bg-neutral-200 text-black text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap"
            >
              Edit video
            </button>
            <span className="text-xs text-[#5a5c6c] px-1 hidden sm:inline">or</span>
            <button
              type="button"
              onClick={onOpenStudio}
              className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-[#1b1c24] hover:bg-[#252631] border border-[#2b2d3b] text-white text-xs font-semibold transition-all cursor-pointer whitespace-nowrap"
            >
              Upload files
            </button>
          </div>
        </form>
      </header>

      {/* ========================================================================= */}
      {/* 3. HERO SHOWCASE CARD (EXACT OPUS.PRO 16:9 PREVIEW)                       */}
      {/* ========================================================================= */}
      <section className="px-4 sm:px-8 max-w-6xl mx-auto pb-16">
        <div className="relative rounded-3xl bg-[#121319] border border-[#21232d] shadow-2xl overflow-hidden p-3 sm:p-6">
          
          {/* Top Status */}
          <div className="flex items-center justify-between pb-4 border-b border-[#1b1c25] mb-4 px-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e] animate-pulse" />
              <span className="text-xs font-bold text-white tracking-wide">
                RAW to Perfect Master Video (16:9 4K)
              </span>
            </div>

            <button
              type="button"
              onClick={onOpenStudio}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1b1c24] hover:bg-[#252733] border border-[#2b2d3b] text-xs font-semibold text-white transition-all cursor-pointer"
            >
              <span>Edita il tuo video ora</span>
              <ArrowRight size={13} className="text-[#8c8f9f]" />
            </button>
          </div>

          {/* 16:9 Widescreen Video Player Card (Exact opus.pro style) */}
          <div className="relative aspect-video rounded-2xl overflow-hidden bg-[#0c0d12] border border-[#1d1f29] group">
            <video
              ref={videoRef}
              src="/videos/kling-podcast-16-9.mp4"
              poster="/videos/final-horizontal.jpg"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />

            {/* Duration Badge Bottom Right (matching opus.pro screenshot: 1:40:35) */}
            <div className="absolute bottom-4 right-4 px-2.5 py-1 rounded-md bg-black/80 backdrop-blur text-[11px] font-bold text-white tracking-wider border border-white/10">
              1:40:35
            </div>

            {/* Centered Interactive Pill overlay: "Drop a raw video and ... [Edit video 👆]" */}
            <div className="absolute inset-0 flex items-center justify-center p-4 bg-black/20 pointer-events-none">
              <button
                type="button"
                onClick={onOpenStudio}
                className="pointer-events-auto flex items-center gap-4 px-5 py-3 rounded-full bg-[#14151baa]/90 hover:bg-[#1a1b24] border border-[#2e3040] shadow-2xl backdrop-blur-md transition-transform hover:scale-105 cursor-pointer group/btn"
              >
                <div className="flex items-center gap-2.5 text-xs text-[#9b9dae] font-medium">
                  <LinkIcon size={14} className="text-[#8c8f9f]" />
                  <span>Drop a raw video and ...</span>
                </div>
                <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-black text-white text-xs font-bold border border-white/20 group-hover/btn:bg-white group-hover/btn:text-black transition-colors">
                  <span>Edit video</span>
                  <span className="text-[10px]">👆</span>
                </div>
              </button>
            </div>

            {/* Pause/Play Toggle Button */}
            <button
              type="button"
              onClick={togglePlay}
              className="absolute top-4 right-4 p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              title="Play/Pause"
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>
          </div>

          {/* Feature Filter Pills Below Showcase (Monochrome palette) */}
          <div className="pt-6 flex items-center justify-center flex-wrap gap-2 sm:gap-3">
            {[
              { id: "editing", label: "AI video editing", icon: Scissors },
              { id: "multiraw", label: "Multi-RAW assembly", icon: Layers },
              { id: "broll", label: "Higgsfield 4K B-Roll", icon: Film },
              { id: "reframe", label: "AI smart reframe", icon: Maximize2 },
              { id: "audio", label: "AI audio mastering", icon: Volume2 },
              { id: "captions", label: "AI dynamic captions", icon: Subtitles },
            ].map((feat) => {
              const Icon = feat.icon;
              const isSelected = selectedFeature === feat.id;
              return (
                <button
                  key={feat.id}
                  type="button"
                  onClick={() => setSelectedFeature(feat.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-white text-black font-bold shadow-md"
                      : "bg-[#181922] text-[#8c8f9f] hover:text-white hover:bg-[#20222d] border border-[#252733]"
                  }`}
                >
                  <Icon size={14} className={isSelected ? "text-black" : "text-[#757788]"} />
                  <span>{feat.label}</span>
                </button>
              );
            })}
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. SOCIAL PROOF & CREATOR AVATARS (EXACT OPUS.PRO MONOCHROME STRIP)       */}
      {/* ========================================================================= */}
      <section className="py-12 border-t border-b border-[#181922] bg-[#090a0e] text-center space-y-8">
        <p className="text-xs uppercase font-bold tracking-widest text-[#6f7283]">
          Used by 20M+ creators and businesses
        </p>

        {/* Creator Avatars */}
        <div className="flex items-center justify-center flex-wrap gap-6 sm:gap-10 px-6 max-w-5xl mx-auto">
          {creators.map((c, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 group">
              <div className="relative">
                <img
                  src={c.avatar}
                  alt={c.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-[#2b2d3b] group-hover:border-white transition-all shadow-md"
                />
                <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#ef4444] flex items-center justify-center text-[8px] text-white font-bold border border-[#08080a]">
                  ▶
                </span>
              </div>
              <span className="text-xs font-semibold text-white">
                {c.name}
              </span>
              <span className="text-[10px] text-[#6f7283] font-medium">{c.count}</span>
            </div>
          ))}
        </div>

        {/* Enterprise Logos Strip */}
        <div className="pt-6 border-t border-[#14151c] flex items-center justify-center flex-wrap gap-8 sm:gap-12 px-6 text-[#5b5d6e] text-xs font-extrabold tracking-widest">
          {brandLogos.map((logo, idx) => (
            <span key={idx} className="hover:text-white transition-colors cursor-default">
              {logo}
            </span>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. AI EDITING MODELS SECTION (MONOCHROME CARDS)                           */}
      {/* ========================================================================= */}
      <section className="py-20 px-6 max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#8c8f9f] flex items-center justify-center gap-1.5">
            <Scissors size={13} className="text-white" />
            AI EDITING MODELS
          </span>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
            AI that understands every frame of your video
          </h2>
          <p className="text-sm text-[#8c8f9f] max-w-xl mx-auto">
            The most powerful AI editing models that work on any raw video. Built for speed, pacing accuracy, and cinematic flow.
          </p>
        </div>

        {/* Side-by-side cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Card 1: Multi-RAW Assembly */}
          <div className="p-6 sm:p-8 rounded-3xl bg-[#121319] border border-[#21232d] shadow-xl flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#181a24] border border-[#282a39] text-xs text-[#9b9dae]">
                <span className="text-[#646777] block text-[10px] uppercase font-bold tracking-wider mb-1">Workflow</span>
                <span className="text-white font-medium">Da più riprese RAW disordinate a 1 video montato coerente</span>
              </div>

              <div className="relative aspect-video rounded-2xl overflow-hidden bg-[#0a0a0f] border border-[#1f202b]">
                <video
                  src="/videos/raw-vlog.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-black/80 backdrop-blur text-[10px] font-semibold text-white border border-white/10">
                    Silenzi 0ms
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-black/80 backdrop-blur text-[10px] font-semibold text-white border border-white/10">
                    Multi-Take Sync
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-black/80 backdrop-blur text-[10px] font-semibold text-white border border-white/10">
                    Audio Mastered
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold text-white mb-2">Multi-RAW Smart Assembly</h3>
              <p className="text-xs text-[#8c8f9f] leading-relaxed">
                Carica uno o più video RAW girati con smartphone o telecamera. RetentionEdit taglia automaticamente ogni silenzio o errore, seleziona i take migliori e cuce il video finale senza bisogno di aprire una timeline.
              </p>
            </div>
          </div>

          {/* Card 2: Higgsfield AI Cinema Studio */}
          <div className="p-6 sm:p-8 rounded-3xl bg-[#121319] border border-[#21232d] shadow-xl flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-[#181a24] border border-[#282a39] text-xs text-[#9b9dae]">
                <span className="text-[#646777] block text-[10px] uppercase font-bold tracking-wider mb-1">Higgsfield Engine</span>
                <span className="text-white font-medium">B-Roll 4K e movimenti di cinepresa fotorealistici</span>
              </div>

              <div className="relative aspect-video rounded-2xl overflow-hidden bg-[#0a0a0f] border border-[#1f202b]">
                <video
                  src="/videos/kling-podcast-16-9.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-black/80 backdrop-blur text-[10px] font-semibold text-white border border-white/10">
                    360° Orbit Motion
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-black/80 backdrop-blur text-[10px] font-semibold text-white border border-white/10">
                    4K Cinematic B-Roll
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold text-white mb-2">Higgsfield AI 4K Studio (2.5D Motion)</h3>
              <p className="text-xs text-[#8c8f9f] leading-relaxed">
                Genera immagini 4K fotorealistiche direttamente dalle parole del copione vocale, animate con precisione millimetrica in 2.5D (Ken Burns &amp; Camera Drift). Zero deformazioni AI video, 100% fotorealismo e ritmo perfetto.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. PROCESS ON AUTOPILOT SECTION                                           */}
      {/* ========================================================================= */}
      <section className="py-20 px-6 max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
            Your video creation process — now on autopilot
          </h2>
          <p className="text-sm text-[#8c8f9f] max-w-xl mx-auto">
            Create professional videos 10x faster with RetentionEdit. Upload your raw footage and let the autonomous pipeline edit everything for you.
          </p>
        </div>

        {/* 3 Step Connected Card */}
        <div className="p-8 sm:p-12 rounded-3xl bg-[#121319] border border-[#21232d] shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            
            {/* Step 1: Auto import */}
            <div className="space-y-4">
              <div className="aspect-video rounded-2xl bg-[#181924] border border-[#282a39] overflow-hidden relative flex items-center justify-center p-3">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-[#0e0f14] border border-[#242635] w-full">
                  <div className="w-10 h-10 rounded-lg bg-white/10 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    ▶
                  </div>
                  <div className="min-w-0">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white text-black">RAW File</span>
                    <p className="text-xs font-bold text-white truncate mt-0.5">Raw Takes (Single or Multi)</p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-white font-bold text-base">
                  <Upload size={16} className="text-[#8c8f9f]" />
                  <span>Auto import</span>
                </div>
                <p className="text-xs text-[#8c8f9f] leading-relaxed">
                  Trascina uno o più video RAW o incolla un link Google Drive o YouTube. L'AI importa e trascrive immediatamente ogni parola.
                </p>
              </div>
            </div>

            {/* Step 2: Auto editing */}
            <div className="space-y-4">
              <div className="aspect-video rounded-2xl bg-[#181924] border border-[#282a39] overflow-hidden relative flex items-center justify-center">
                <video
                  src="/videos/final-horizontal.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end justify-center p-3">
                  <span className="text-[11px] font-bold uppercase text-white tracking-wider bg-black/60 px-2 py-0.5 rounded">
                    HIGGSFIELD B-ROLL + CUTS
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-white font-bold text-base">
                  <Scissors size={16} className="text-[#8c8f9f]" />
                  <span>Auto editing</span>
                </div>
                <p className="text-xs text-[#8c8f9f] leading-relaxed">
                  Elimina le pause vuote a 0ms, inserisce B-Roll 4K cinematografici con Higgsfield e armonizza le voci con mastering audio automatico.
                </p>
              </div>
            </div>

            {/* Step 3: Master Export */}
            <div className="space-y-4">
              <div className="aspect-video rounded-2xl bg-[#181924] border border-[#282a39] overflow-hidden relative flex flex-col justify-between p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[10px] uppercase font-bold text-[#8c8f9f]">Export format</span>
                  <span className="px-2 py-0.5 rounded bg-white text-black font-bold text-[10px]">
                    4K 60FPS
                  </span>
                </div>

                <div>
                  <p className="text-lg font-black text-white">Full Edited Video</p>
                  <p className="text-[11px] text-[#8c8f9f]">Watermark-free studio master</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-white font-bold text-base">
                  <Calendar size={16} className="text-[#8c8f9f]" />
                  <span>Ready to publish</span>
                </div>
                <p className="text-xs text-[#8c8f9f] leading-relaxed">
                  Scarica subito il tuo video editato in alta definizione o pubblicalo direttamente sui tuoi canali senza perdere tempo.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. FAQ SECTION (CLEAN MONOCHROME ACCORDION)                               */}
      {/* ========================================================================= */}
      <section className="py-20 px-6 max-w-4xl mx-auto space-y-8" id="faq">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-black text-white">Frequently Asked Questions</h2>
          <p className="text-xs text-[#8c8f9f]">Tutto quello che c'è da sapere sull'editing video autonomo di RetentionEdit</p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-[#121319] border border-[#21232d] overflow-hidden transition-all"
              >
                <button
                  type="button"
                  onClick={() => setActiveFaq(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between p-5 text-left text-sm font-bold text-white hover:text-white transition cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    size={16}
                    className={`text-[#8c8f9f] transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs text-[#8c8f9f] leading-relaxed border-t border-[#1b1c25] pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. FLOATING BOTTOM BAR                                                    */}
      {/* ========================================================================= */}
      {showFloatingBar && (
        <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center px-4 pointer-events-none transition-all duration-300">
          <div className="pointer-events-auto flex items-center gap-3 p-2 rounded-full bg-[#14151baa]/95 border border-[#2e3040] shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-2 pl-3 pr-2 text-xs text-[#8c8f9f]">
              <LinkIcon size={14} className="text-[#656779]" />
              <span className="hidden sm:inline">Drop a video link</span>
            </div>
            <button
              type="button"
              onClick={onOpenStudio}
              className="px-5 py-2 rounded-full bg-white hover:bg-neutral-200 text-black text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap"
            >
              Edit video
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. MINIMALIST MONOCHROME FOOTER                                           */}
      {/* ========================================================================= */}
      <footer className="border-t border-[#1b1c24] py-12 px-6 lg:px-12 text-[#646777] text-xs flex flex-col sm:flex-row items-center justify-between gap-6 pb-24">
        <div className="flex items-center gap-3">
          <Brand compact />
          <span>&copy; {new Date().getFullYear()} RetentionEdit. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-6 text-[#8c8f9f]">
          <Link href="/goal" className="hover:text-white transition">
            Goal
          </Link>
          <a href="#faq" className="hover:text-white transition">FAQ</a>
          <button type="button" onClick={onOpenPricing} className="hover:text-white transition cursor-pointer">Pricing</button>
          {isLoggedIn ? (
            <Link href="/app" className="hover:text-white transition">Vai all'App</Link>
          ) : (
            <button type="button" onClick={onOpenLogin} className="hover:text-white transition cursor-pointer">Sign in</button>
          )}
        </div>
      </footer>
    </div>
  );
}
