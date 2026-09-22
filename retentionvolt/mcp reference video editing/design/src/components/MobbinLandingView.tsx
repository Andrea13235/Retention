'use client';

import React, { useState } from 'react';
import { ArrowRight, Sparkles, Play, Flame, Layers, Award, Zap } from 'lucide-react';
import { RetentionvoltLogo } from '@/components/RetentionvoltLogo';
import { VIDEOS_DATA } from '@/data/videos';
import { VideoData } from '@/types';
import { VideoMarqueeRow } from '@/components/VideoMarqueeRow';

interface MobbinLandingViewProps {
  onJoinForFree: () => void;
  onLogin: () => void;
  onSeePlans: () => void;
  onExploreLibrary?: () => void;
  onSelectVideo: (video: VideoData) => void;
}

export const MobbinLandingView: React.FC<MobbinLandingViewProps> = ({
  onJoinForFree,
  onLogin,
  onSeePlans,
  onExploreLibrary,
  onSelectVideo,
}) => {
  const [previewFilter, setPreviewFilter] = useState<'all' | 'hooks' | 'pacing'>('all');

  // Alternating video datasets for smooth multi-row marquees (mixing top longs and viral shorts)
  const allShorts = React.useMemo(() => VIDEOS_DATA.filter(v => v.aspectRatio === '9:16' || v.category === 'shorts'), []);
  const allLongs = React.useMemo(() => VIDEOS_DATA.filter(v => v.aspectRatio !== '9:16' && v.category !== 'shorts'), []);

  const row1 = React.useMemo(() => allLongs.slice(0, 12), [allLongs]);
  const row2 = React.useMemo(() => (allShorts.length > 0 ? allShorts.slice(0, 15) : VIDEOS_DATA.slice(10, 20)), [allShorts]);
  const row3 = React.useMemo(() => allLongs.slice(12, 24), [allLongs]);

  const handleVideoClick = (video: VideoData) => {
    onSelectVideo(video);
  };

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white flex flex-col justify-between selection:bg-[#d1fe17] selection:text-black">
      
      {/* 1. MOBBIN FLOATING PILL NAVBAR (Screenshot 0) */}
      <div className="w-full pt-6 pb-4 px-4 sticky top-0 z-40 flex justify-center">
        <header className="w-full max-w-xl bg-[#161616]/90 backdrop-blur-xl border border-[#2a2a2a] rounded-full px-5 py-2.5 flex items-center justify-between shadow-2xl transition-all hover:border-[#383838]">
          {/* Logo */}
          <div
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
          >
            <RetentionvoltLogo variant="icon" size={26} />
            <span className="font-extrabold text-sm tracking-tight text-white">
              RETENTIONVOLT
            </span>
          </div>

          {/* Nav Links */}
          <div className="flex items-center gap-4 text-xs font-medium text-[#888]">
            <button
              onClick={onSeePlans}
              className="hover:text-white transition-colors"
            >
              Pricing
            </button>
            <button
              onClick={onLogin}
              className="hover:text-white transition-colors"
            >
              Log in
            </button>
            <button
              onClick={onJoinForFree}
              className="px-3.5 py-1.5 rounded-full bg-white hover:bg-neutral-200 text-black font-semibold text-xs transition-all shadow-sm"
            >
              Join
            </button>
          </div>
        </header>
      </div>

      {/* 2. HERO SECTION (Screenshot 0) */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-16 text-center space-y-7 flex flex-col items-center">
        
        {/* Brand App Badge */}
        <div className="transform hover:scale-105 transition-transform cursor-pointer drop-shadow-[0_12px_40px_rgba(209,254,23,0.3)]">
          <RetentionvoltLogo variant="icon" size={68} />
        </div>

        {/* Giant Headline */}
        <h1 className="text-4xl sm:text-6xl lg:text-[68px] font-extrabold tracking-tight text-white leading-[1.08] max-w-4xl">
          Discover real-world video editing inspiration.
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-[#8e8e8e] max-w-2xl mx-auto leading-relaxed">
          Featuring over 500,000 cuts, hooks and 1,000+ top YouTube, Reels &amp; TikTok creators — New retention breakdowns weekly.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3.5 pt-2">
          <button
            onClick={onJoinForFree}
            className="w-full sm:w-auto px-7 py-3 rounded-full bg-white hover:bg-neutral-200 text-black font-bold text-sm transition-all shadow-lg hover:shadow-white/10 active:scale-[0.98]"
          >
            Join
          </button>

          <button
            onClick={onSeePlans}
            className="w-full sm:w-auto px-6 py-3 rounded-full bg-transparent hover:bg-[#1c1c1c] text-white border border-[#2e2e2e] hover:border-[#444] font-semibold text-sm transition-all flex items-center justify-center gap-2 group"
          >
            <span>See our plans</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

      </section>

      {/* 3. MOBBIN INTERACTIVE SHOWCASE CONTAINER (Screenshot 0 bottom) */}
      <section className="w-full max-w-[1700px] mx-auto px-4 sm:px-8 pb-16">
        <div className="rounded-3xl bg-[#141414] border border-[#222222] p-6 sm:p-10 shadow-2xl space-y-6">
          
          {/* Showcase Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#222] pb-6">
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Curated Breakdown Highlights
              </h3>
              <p className="text-xs text-[#777]">
                Analyzed frame-by-frame with cadences, audio hooks, and visual triggers.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onJoinForFree}
                className="px-4 py-2 rounded-full bg-[#202020] hover:bg-[#282828] text-xs font-semibold text-white transition-colors flex items-center gap-1.5"
              >
                <span>Join to explore all 1,240+ videos</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Alternating Infinite Scrolling Video Rows (Clean & Fluid with YouTube JPGs) */}
          <div className="relative -mx-6 sm:-mx-10 overflow-hidden space-y-4 py-2">
            {/* Left and Right edge fade masks */}
            <div className="absolute inset-y-0 left-0 w-16 sm:w-28 bg-gradient-to-r from-[#141414] to-transparent pointer-events-none z-20" />
            <div className="absolute inset-y-0 right-0 w-16 sm:w-28 bg-gradient-to-l from-[#141414] to-transparent pointer-events-none z-20" />

            {/* Row 1: Right to Left */}
            <VideoMarqueeRow
              videos={row1}
              direction="left"
              speed="normal"
              cardWidth="w-[320px] sm:w-[360px]"
              onVideoClick={handleVideoClick}
            />

            {/* Row 2: Left to Right (Opposite Direction) */}
            <VideoMarqueeRow
              videos={row2}
              direction="right"
              speed="normal"
              cardWidth="w-[320px] sm:w-[360px]"
              onVideoClick={handleVideoClick}
            />

            {/* Row 3: Right to Left */}
            <VideoMarqueeRow
              videos={row3}
              direction="left"
              speed="normal"
              cardWidth="w-[320px] sm:w-[360px]"
              onVideoClick={handleVideoClick}
            />
          </div>

          {/* Sticky Join Banner */}
          <div className="mt-8 pt-8 border-t border-[#222] flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-neutral-900/60 to-black/60 p-6 rounded-2xl border border-white/5">
            <div className="space-y-1 text-center sm:text-left">
              <h4 className="text-base font-bold text-white">
                Ready to level up your video editing retention?
              </h4>
              <p className="text-xs text-[#888]">
                Join 24,000+ editors, creators and agencies studying the masters of YouTube.
              </p>
            </div>
            <button
              onClick={onJoinForFree}
              className="px-6 py-2.5 rounded-full bg-white hover:bg-neutral-200 text-black font-bold text-xs transition-all shadow-md shrink-0"
            >
              Join →
            </button>
          </div>

        </div>
      </section>

      {/* 4. MOBBIN BOTTOM BAR (Screenshot 0) */}
      <footer className="w-full border-t border-[#1a1a1a] bg-[#0b0b0b] py-5 px-6 sm:px-12 flex flex-col gap-3 text-xs text-[#777]">
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <RetentionvoltLogo variant="icon" size={24} />
            <span className="font-semibold text-white">RETENTIONVOLT</span>
            <span className="text-[#444]">|</span>
            <span>The Video Editing Reference Library</span>
          </div>

          <div className="flex items-center gap-6">
            <button onClick={onSeePlans} className="hover:text-white transition-colors">
              Pricing
            </button>
            <button onClick={onJoinForFree} className="hover:text-white transition-colors">
              Join
            </button>
            <div className="flex items-center gap-1.5 font-medium">
              <span>curated by</span>
              <span className="text-white font-bold tracking-wide">RETENTIONVOLT</span>
            </div>
          </div>
        </div>
        <div className="w-full flex flex-wrap items-center justify-center sm:justify-between gap-2 text-[11px] text-[#555]">
          <span>YouTube è un marchio di Google LLC. Thumbnail mostrate per finalità didattiche (Fair Use / art. 70 L. 633/1941).</span>
          <span className="flex flex-wrap items-center gap-2">
            <a href="/terms" className="underline decoration-white/20 underline-offset-4 hover:text-white">Termini</a>
            <span className="text-[#333]">·</span>
            <a href="/privacy" className="underline decoration-white/20 underline-offset-4 hover:text-white">Privacy</a>
            <span className="text-[#333]">·</span>
            <a href="/cookies" className="underline decoration-white/20 underline-offset-4 hover:text-white">Cookie</a>
            <span className="text-[#333]">·</span>
            <a href="/legal-notice" className="underline decoration-white/20 underline-offset-4 hover:text-white">Note Legali</a>
            <span className="text-[#333]">·</span>
            <button type="button" onClick={() => typeof window !== 'undefined' && window.dispatchEvent(new CustomEvent('rb:open-cookie-prefs'))} className="underline decoration-white/20 underline-offset-4 hover:text-white">Impostazioni cookie</button>
          </span>
        </div>
      </footer>

    </div>
  );
};
