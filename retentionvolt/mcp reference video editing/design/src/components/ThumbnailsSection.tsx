'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ThumbnailData } from '@/types';
import { THUMBNAILS_DATA } from '@/data/thumbnails';
import { 
  Eye, 
  Maximize2, 
  X,
  ExternalLink,
  Search,
  Copy,
  Check,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { McpIcon } from '@/components/McpIcon';

interface ThumbnailsSectionProps {
  onOpenPaywall: () => void;
  onOpenMcp?: () => void;
}

export const ThumbnailsSection: React.FC<ThumbnailsSectionProps> = ({ onOpenPaywall, onOpenMcp }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedNiche, setSelectedNiche] = useState<string>('all');
  const [selectedEmotion, setSelectedEmotion] = useState<string>('all');
  const [selectedComposition, setSelectedComposition] = useState<string>('all');
  const [inspectedThumbnail, setInspectedThumbnail] = useState<ThumbnailData | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setInspectedThumbnail(null);
      }
    };
    if (inspectedThumbnail) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectedThumbnail]);

  const handleCopyPrompt = (promptText?: string) => {
    if (!promptText) return;
    navigator.clipboard.writeText(promptText);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const isFiltered = searchQuery !== '' || selectedNiche !== 'all' || selectedEmotion !== 'all' || selectedComposition !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedNiche('all');
    setSelectedEmotion('all');
    setSelectedComposition('all');
  };

  const filteredThumbnails = useMemo(() => {
    return THUMBNAILS_DATA.filter((t) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        t.title.toLowerCase().includes(q) || 
        t.creator.toLowerCase().includes(q) || 
        (t.tags && t.tags.some(tag => tag.toLowerCase().includes(q))) ||
        t.niche.toLowerCase().includes(q);

      const matchesNiche = selectedNiche === 'all' || t.niche.toLowerCase() === selectedNiche.toLowerCase();
      const matchesEmotion = selectedEmotion === 'all' || t.faceEmotion.toLowerCase() === selectedEmotion.toLowerCase();
      const matchesComposition = selectedComposition === 'all' || t.compositionType.toLowerCase() === selectedComposition.toLowerCase();

      return matchesSearch && matchesNiche && matchesEmotion && matchesComposition;
    });
  }, [searchQuery, selectedNiche, selectedEmotion, selectedComposition]);

  return (
    <div className="space-y-6">
      
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 py-4 border-b border-[#1c1c1c]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-white tracking-tight">Thumbnails Vault</h2>
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/90 text-[11px] font-mono font-medium">
                {filteredThumbnails.length} of {THUMBNAILS_DATA.length} Blueprints
              </span>
            </div>
            <p className="text-xs text-[#8e8e8e] mt-1">
              Deep psychological visual breakdowns &amp; generative AI blueprints for high-CTR reference videos.
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 text-[#666] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search creator, title, tag..."
              className="w-full bg-[#181818] hover:bg-[#1e1e1e] focus:bg-[#1a1a1a] text-white text-xs pl-9 pr-8 py-2 rounded-xl border border-[#2a2a2a] focus:border-[#d1fe17]/50 focus:outline-none transition-all placeholder:text-[#666]"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#777] hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Badges / Dropdowns */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Niche Selector */}
          <select
            value={selectedNiche}
            onChange={(e) => setSelectedNiche(e.target.value)}
            className="bg-[#181818] text-white text-xs px-3 py-1.5 rounded-xl border border-[#2a2a2a] focus:outline-none focus:border-[#d1fe17]/50 transition-colors"
          >
            <option value="all">All Niches</option>
            <option value="tech">Tech</option>
            <option value="entertainment">Entertainment</option>
            <option value="productivity">Productivity</option>
            <option value="finance">Finance</option>
            <option value="science">Science</option>
            <option value="storytelling">Storytelling</option>
            <option value="filmmaking">Filmmaking</option>
            <option value="fitness">Fitness</option>
            <option value="podcast">Podcast</option>
            <option value="motivation">Motivation</option>
          </select>

          {/* Emotion Selector */}
          <select
            value={selectedEmotion}
            onChange={(e) => setSelectedEmotion(e.target.value)}
            className="bg-[#181818] text-white text-xs px-3 py-1.5 rounded-xl border border-[#2a2a2a] focus:outline-none focus:border-[#d1fe17]/50 transition-colors"
          >
            <option value="all">All Emotions</option>
            <option value="shock">Shock / High Intensity</option>
            <option value="excitement">Excitement / Joy</option>
            <option value="curiosity">Curiosity / Mystery</option>
            <option value="serious">Authoritative / Serious</option>
            <option value="none">No Face (Product / Asset)</option>
          </select>

          {/* Composition Selector */}
          <select
            value={selectedComposition}
            onChange={(e) => setSelectedComposition(e.target.value)}
            className="bg-[#181818] text-white text-xs px-3 py-1.5 rounded-xl border border-[#2a2a2a] focus:outline-none focus:border-[#d1fe17]/50 transition-colors"
          >
            <option value="all">All Compositions</option>
            <option value="rule_of_thirds">Rule of Thirds</option>
            <option value="split_screen">Split Screen / Contrast</option>
            <option value="centered_face">Centered Face Hero</option>
            <option value="object_focus">Object / Product Focus</option>
            <option value="minimalist">Minimalist Staging</option>
          </select>

          {/* Reset button */}
          {isFiltered && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1.5 text-xs text-[#8e8e8e] hover:text-white px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {filteredThumbnails.length === 0 && (
        <div className="py-20 text-center space-y-3">
          <p className="text-sm text-[#8e8e8e]">No thumbnails match your search or filters.</p>
          <button
            onClick={resetFilters}
            className="px-4 py-2 rounded-full bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Grid of Thumbnails (Mobbin 3-column Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredThumbnails.map((thumb) => (
          <div
            key={thumb.id}
            onClick={() => setInspectedThumbnail(thumb)}
            className="group flex flex-col gap-3 cursor-pointer"
          >
            {/* Card Frame with padding */}
            <div className="relative aspect-[16/10] bg-[#181818] hover:bg-[#1f1f1f] rounded-3xl p-5 flex items-center justify-center transition-colors border border-transparent hover:border-[#2a2a2a] overflow-hidden">
              
              {/* CTR Badge */}
              <div className="absolute top-4 left-4 z-10 px-2.5 py-0.5 rounded-full bg-black/80 backdrop-blur-md border border-white/10 text-[11px] font-mono font-bold text-white">
                {thumb.ctrEstimate} CTR
              </div>

              {/* Niche Badge */}
              <div className="absolute top-4 right-4 z-10 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono uppercase tracking-wider text-white/80">
                {thumb.niche}
              </div>

              {/* Floating Thumbnail Viewport */}
              <div className="relative w-full h-full rounded-xl overflow-hidden bg-black shadow-xl">
                <img
                  src={thumb.thumbnailUrl}
                  alt={thumb.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${thumb.youtubeId}/hqdefault.jpg`;
                  }}
                />

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="px-3 py-1.5 rounded-full bg-white text-black text-xs font-semibold shadow-md flex items-center gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Inspect</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-xs text-white truncate group-hover:underline">
                  {thumb.creator}
                </h3>
                <span className="text-[10px] text-[#666] font-mono shrink-0">
                  {thumb.views} views
                </span>
              </div>
              <p className="text-xs text-[#8e8e8e] truncate mt-0.5">
                {thumb.title}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Inspect Modal */}
      {inspectedThumbnail && (
        <div 
          onClick={() => setInspectedThumbnail(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/70 backdrop-blur-sm animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl bg-[#121212] border border-[#262626] rounded-3xl overflow-hidden shadow-2xl my-auto max-h-[92vh] flex flex-col"
          >
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f] bg-[#161616] gap-4">
              {/* Left: Video title and creator */}
              <div className="flex items-center gap-3 min-w-0 pr-2">
                <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-white shrink-0">
                  <Eye className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-white truncate" title={inspectedThumbnail.title}>
                    {inspectedThumbnail.title}
                  </h3>
                  <p className="text-[11px] text-[#8e8e8e] truncate font-mono">
                    by <strong className="text-white">{inspectedThumbnail.creator}</strong> • {inspectedThumbnail.views} views • <span className="text-white/90">{inspectedThumbnail.niche}</span>
                  </p>
                </div>
              </div>

              {/* Right: Watch on YouTube Button + Close */}
              <div className="flex items-center gap-2.5 shrink-0">
                <a
                  href={`https://youtu.be/${inspectedThumbnail.youtubeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#ff0000] hover:bg-[#cc0000] text-white text-xs font-bold transition-all group/yt shadow-md shrink-0"
                  title={`Apri https://youtu.be/${inspectedThumbnail.youtubeId}`}
                >
                  <ExternalLink className="w-3.5 h-3.5 text-white group-hover/yt:scale-110 transition-transform" />
                  <span>Vedi su YouTube</span>
                  <span className="hidden sm:inline text-[11px] font-mono text-white/80 pl-1.5 border-l border-white/30">
                    youtu.be/{inspectedThumbnail.youtubeId}
                  </span>
                </a>

                <button
                  onClick={() => setInspectedThumbnail(null)}
                  className="p-1.5 rounded-full bg-white/10 text-[#8e8e8e] hover:text-white hover:bg-white/20 transition-colors"
                  title="Chiudi (ESC)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="relative aspect-video rounded-2xl overflow-hidden border border-[#262626] bg-black">
                <img
                  src={inspectedThumbnail.thumbnailUrl}
                  alt={inspectedThumbnail.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${inspectedThumbnail.youtubeId}/hqdefault.jpg`;
                  }}
                />
              </div>

              {/* 4 Stat Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-[#181818] border border-[#262626]">
                  <span className="text-[#8e8e8e]">COMPOSITION</span>
                  <div className="text-white font-bold mt-0.5 capitalize">{inspectedThumbnail.compositionType.replace(/_/g, ' ')}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#181818] border border-[#262626]">
                  <span className="text-[#8e8e8e]">FACIAL EMOTION</span>
                  <div className="text-white font-bold mt-0.5 capitalize">{inspectedThumbnail.faceEmotion}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#181818] border border-[#262626]">
                  <span className="text-[#8e8e8e]">ESTIMATED CTR</span>
                  <div className="text-[#d1fe17] font-bold mt-0.5">{inspectedThumbnail.ctrEstimate}</div>
                </div>
                <div className="p-3 rounded-xl bg-[#181818] border border-[#262626]">
                  <span className="text-[#8e8e8e]">TEXT DENSITY</span>
                  <div className="text-white font-bold mt-0.5">{inspectedThumbnail.textCountWords} Words</div>
                </div>
              </div>

              {/* Psychological & Visual Breakdown */}
              <div className="p-5 rounded-2xl bg-[#181818] border border-[#262626] space-y-3">
                <h4 className="text-xs font-mono font-bold uppercase text-white tracking-wider">
                  Psychological &amp; Visual Analysis
                </h4>
                <ul className="space-y-2.5">
                  {inspectedThumbnail.analysisBreakdown.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-[#cccccc] leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#d1fe17] mt-1.5 shrink-0" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Generative AI Prompt Box */}
              {inspectedThumbnail.promptMidjourney && (
                <div className="p-5 rounded-2xl bg-[#151515] border border-[#2a2a2a] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-[#d1fe17]" />
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-white">
                        Generative AI Prompt Blueprint (Midjourney v6 / FLUX)
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopyPrompt(inspectedThumbnail.promptMidjourney)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-mono transition-colors"
                      title="Copia prompt"
                    >
                      {copiedPrompt ? (
                        <>
                          <Check className="w-3 h-3 text-[#d1fe17]" />
                          <span className="text-[#d1fe17]">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Prompt</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="p-3 rounded-xl bg-black/60 border border-white/5 text-[11px] font-mono text-[#a0a0a0] leading-relaxed break-words select-all">
                    {inspectedThumbnail.promptMidjourney}
                  </div>
                </div>
              )}

              {/* Modal Footer CTAs */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  onClick={onOpenMcp}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#1c1c1c] hover:bg-[#262626] border border-[#2e2e2e] hover:border-[#d1fe17]/60 text-xs font-mono text-white transition-all group shadow-sm"
                  title="Connetti al Server MCP"
                >
                  <McpIcon className="w-3.5 h-3.5 text-[#d1fe17] group-hover:scale-110 transition-transform shrink-0" />
                  <span className="font-semibold uppercase tracking-wider text-xs">mcp</span>
                </button>

                <button
                  onClick={onOpenPaywall}
                  className="px-4 py-2.5 rounded-full bg-white text-black text-xs font-bold hover:bg-[#e0e0e0] transition-colors"
                >
                  Generate Variations (Pro)
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
