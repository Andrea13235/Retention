'use client';

import React, { useState } from 'react';
import { SlidersHorizontal, ChevronDown, X } from 'lucide-react';

interface FilterBarProps {
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  selectedNiche: string;
  setSelectedNiche: (niche: string) => void;
  selectedPacing: string;
  setSelectedPacing: (pacing: string) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
  activeSubTab: 'longs' | 'shorts';
  setActiveSubTab: (tab: 'longs' | 'shorts') => void;
  longsCount?: number;
  shortsCount?: number;
  onOpenPaywall: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  selectedCategory,
  setSelectedCategory,
  selectedNiche,
  setSelectedNiche,
  selectedPacing,
  setSelectedPacing,
  sortBy,
  setSortBy,
  activeSubTab,
  setActiveSubTab,
  longsCount,
  shortsCount,
  onOpenPaywall,
}) => {
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  const categories = [
    { id: 'all', label: 'All Formats' },
    { id: 'long_form', label: 'Long-Form (16:9)' },
    { id: 'shorts', label: 'Shorts & Reels (9:16)' },
    { id: 'documentary', label: 'Documentary (Vox)' },
    { id: 'talking_head', label: 'Talking Head' },
    { id: 'ads', label: 'Commercial Ads' },
  ];

  const niches = [
    { id: 'all', label: 'All Niches' },
    { id: 'tech', label: '💻 Technology' },
    { id: 'productivity', label: '⚡ Productivity' },
    { id: 'entertainment', label: '🎬 Entertainment' },
    { id: 'finance', label: '💰 Finance' },
    { id: 'storytelling', label: '📖 Storytelling' },
    { id: 'science', label: '🔬 Science' },
    { id: 'fitness', label: '💪 Fitness' },
    { id: 'podcast', label: '🎙️ Podcast' },
    { id: 'filmmaking', label: '🎥 Filmmaking' },
    { id: 'motivation', label: '🔥 Motivation' },
  ];

  const pacings = [
    { id: 'all', label: 'All Pacings' },
    { id: 'hyper', label: 'Hyper-Fast (>25 CPM)' },
    { id: 'moderate', label: 'Moderate (14-24 CPM)' },
    { id: 'cinematic', label: 'Cinematic (<14 CPM)' },
  ];

  const hasActiveFilters = selectedCategory !== 'all' || selectedNiche !== 'all' || selectedPacing !== 'all';

  return (
    <div className="w-full space-y-4 pt-6 pb-2">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-8">
        
        {/* Mobbin Subbar: Longs / Shorts Tabs on Left, Filter on Right */}
        <div className="flex items-center justify-between border-b border-[#1c1c1c] pb-4">
          
          {/* Left Tabs: Longs & Shorts */}
          <div className="flex items-center gap-6 text-sm font-medium">
            <button
              onClick={() => setActiveSubTab('longs')}
              className={`relative pb-2 transition-colors flex items-center gap-2 ${
                activeSubTab === 'longs'
                  ? 'text-white font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-white'
                  : 'text-[#8e8e8e] hover:text-white'
              }`}
            >
              <span>Longs</span>
              {longsCount !== undefined && (
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold transition-colors ${
                  activeSubTab === 'longs' ? 'bg-white/20 text-white' : 'bg-white/5 text-[#777]'
                }`}>
                  {longsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveSubTab('shorts')}
              className={`relative pb-2 transition-colors flex items-center gap-2 ${
                activeSubTab === 'shorts'
                  ? 'text-white font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#d1fe17]'
                  : 'text-[#8e8e8e] hover:text-white'
              }`}
            >
              <span>Shorts</span>
              {shortsCount !== undefined && (
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold transition-colors ${
                  activeSubTab === 'shorts' ? 'bg-[#d1fe17] text-black shadow-sm' : 'bg-white/10 text-[#aaa]'
                }`}>
                  {shortsCount}
                </span>
              )}
            </button>
          </div>

          {/* Right: Mobbin "Filter" Button */}
          <button
            onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
            className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
              isFilterPanelOpen || hasActiveFilters
                ? 'bg-white text-black font-semibold'
                : 'text-white hover:text-[#9e9e9e]'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filter</span>
            {hasActiveFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-black ml-0.5" />
            )}
          </button>

        </div>

        {/* Collapsible Filter Panel */}
        {isFilterPanelOpen && (
          <div className="pt-4 pb-2 grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-[#1c1c1c] animate-fade-in">
            <div className="space-y-1.5">
              <label className="text-xs text-[#8e8e8e]">Format</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full bg-[#181818] border border-[#2a2a2a] text-white text-xs px-3 py-2 rounded-xl focus:outline-none"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-[#8e8e8e]">Niche</label>
              <select
                value={selectedNiche}
                onChange={(e) => setSelectedNiche(e.target.value)}
                className="w-full bg-[#181818] border border-[#2a2a2a] text-white text-xs px-3 py-2 rounded-xl focus:outline-none"
              >
                {niches.map((n) => (
                  <option key={n.id} value={n.id}>{n.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-[#8e8e8e]">Pacing &amp; Cuts/Min</label>
              <select
                value={selectedPacing}
                onChange={(e) => setSelectedPacing(e.target.value)}
                className="w-full bg-[#181818] border border-[#2a2a2a] text-white text-xs px-3 py-2 rounded-xl focus:outline-none"
              >
                {pacings.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Mobbin Pro Upgrade Banner (Exact match from screenshot 2) */}
        <div className="mt-4 p-3 sm:px-4 rounded-xl bg-[#181818] border border-[#262626] flex items-center gap-3 text-xs sm:text-sm">
          <span className="px-2 py-0.5 rounded-md bg-white text-black font-extrabold text-[10px] font-mono tracking-wider">
            PRO
          </span>
          <span className="text-[#cccccc]">
            Upgrade for full access beyond the 4 latest {activeSubTab === 'shorts' ? 'Shorts' : 'videos'} —{' '}
            <button
              onClick={onOpenPaywall}
              className="text-white underline font-semibold hover:text-[#9e9e9e] transition-colors"
            >
              Get Pro
            </button>
          </span>
        </div>

      </div>
    </div>
  );
};
