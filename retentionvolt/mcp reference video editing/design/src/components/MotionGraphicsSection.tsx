'use client';

import React, { useState } from 'react';
import { MotionGraphicItem } from '@/types';
import { MOTION_GRAPHICS_DATA } from '@/data/motionGraphics';
import { Code, Check, Lock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface MotionGraphicsSectionProps {
  onOpenPaywall: () => void;
  highlightId?: string;
}

export const MotionGraphicsSection: React.FC<MotionGraphicsSectionProps> = ({
  onOpenPaywall,
  highlightId
}) => {
  const { user } = useAuth();
  const [selectedRegister, setSelectedRegister] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredItems = MOTION_GRAPHICS_DATA.filter((item) => {
    const matchesReg = selectedRegister === 'all' || item.register === selectedRegister;
    const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesReg && matchesCat;
  });

  const handleCopyCode = (item: MotionGraphicItem) => {
    if (user?.plan !== 'pro') {
      onOpenPaywall();
      return;
    }
    navigator.clipboard.writeText(item.codeSnippet);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 border-b border-[#1c1c1c]">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Motion Design Patterns</h2>
          <p className="text-xs text-[#8e8e8e] mt-0.5">
            Atomic motion graphics extracted from top creators. Rebuild formulas and code snippets.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedRegister}
            onChange={(e) => setSelectedRegister(e.target.value)}
            className="bg-[#181818] text-white text-xs px-3 py-2 rounded-xl border border-[#2a2a2a] focus:outline-none"
          >
            <option value="all">All Registers</option>
            <option value="clean/restrained">Clean / Restrained (Apple-Style)</option>
            <option value="loud/energetic">Loud / Energetic (MrBeast/TikTok)</option>
            <option value="documentary">Documentary (Vox/Johnny Harris)</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-[#181818] text-white text-xs px-3 py-2 rounded-xl border border-[#2a2a2a] focus:outline-none"
          >
            <option value="all">All Types</option>
            <option value="kinetic_text">Kinetic Text Hooks</option>
            <option value="timer_card">Timer &amp; Proof Cards</option>
            <option value="player_mockup">Fake Player Mockups</option>
            <option value="data_viz">Data Viz &amp; Map Sweeps</option>
            <option value="transition">Whip &amp; Paper Transitions</option>
          </select>
        </div>
      </div>

      {/* Grid of Motion Graphic Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => {
          const isHighlighted = highlightId === item.id;

          return (
            <div
              key={item.id}
              className={`flex flex-col bg-[#181818] rounded-2xl border overflow-hidden transition-all ${
                isHighlighted
                  ? 'border-white ring-2 ring-white/50'
                  : 'border-[#262626] hover:border-[#3a3a3a]'
              }`}
            >
              {/* Interactive Live Preview Box */}
              <div className="relative h-48 bg-[#121212] border-b border-[#242424] flex items-center justify-center p-6 overflow-hidden">
                
                {item.previewType === 'text_pop' && (
                  <div className="text-center animate-pulse">
                    <span className="text-2xl font-bold tracking-tight uppercase text-white">
                      MASTER IT.
                    </span>
                    <p className="text-[11px] font-mono text-[#8e8e8e] mt-1">Scale 0.85 → 1.05 (Overshoot)</p>
                  </div>
                )}

                {item.previewType === 'timer_ring' && (
                  <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-white/[0.06] backdrop-blur-md border border-white/10">
                    <svg className="w-6 h-6 -rotate-90">
                      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" fill="none" />
                      <circle
                        cx="12" cy="12" r="10"
                        stroke="#ffffff"
                        strokeWidth="2.5"
                        fill="none"
                        strokeDasharray="63"
                        strokeDashoffset="18"
                        className="animate-spin duration-3000"
                      />
                    </svg>
                    <div>
                      <div className="text-xs font-mono font-bold text-white tracking-wider">UNDER 20 MIN</div>
                      <div className="text-[9px] font-mono text-[#8e8e8e]">PROOF OBJECT</div>
                    </div>
                  </div>
                )}

                {item.previewType === 'mockup' && (
                  <div className="w-full max-w-[200px] aspect-video rounded-lg bg-neutral-900 border border-white/10 p-2 flex flex-col justify-between shadow-xl">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
                      <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
                      <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
                    </div>
                    <div className="space-y-1">
                      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-white w-[45%]" />
                      </div>
                      <div className="text-[9px] font-mono text-[#8e8e8e]">Apple-Style Player</div>
                    </div>
                  </div>
                )}

                {item.previewType === 'chart' && (
                  <div className="w-full px-4">
                    <svg className="w-full h-16" viewBox="0 0 200 60">
                      <path
                        d="M 10 50 Q 60 10, 110 35 T 190 15"
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="2"
                        className="animate-pulse"
                      />
                    </svg>
                    <div className="text-[10px] font-mono text-center text-[#8e8e8e]">3D Parallax Topographic Path</div>
                  </div>
                )}

                {item.previewType === 'whip_pan' && (
                  <div className="w-full h-12 bg-white/5 border border-dashed border-white/20 rounded-lg flex items-center justify-center font-mono text-xs text-white">
                    ✂️ Paper-Tear 1/12s Snip
                  </div>
                )}

                <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/80 backdrop-blur-md text-[10px] font-mono font-bold text-white border border-white/20">
                  {item.id}
                </div>

                <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-white/10 backdrop-blur-md text-[10px] font-mono text-[#8e8e8e]">
                  {item.register}
                </div>
              </div>

              {/* Pattern Info */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#8e8e8e]">
                    <span>Source: <strong className="text-white">{item.sourceCreator}</strong></span>
                    <span className="font-mono text-[11px] text-[#555]">{item.durationSec}s hold</span>
                  </div>
                  <h3 className="font-bold text-sm text-white">{item.title}</h3>
                  <p className="text-xs text-[#8e8e8e] leading-relaxed line-clamp-3">
                    {item.description}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#121212] border border-[#242424] space-y-1 text-xs">
                  <span className="text-[10px] font-mono uppercase font-bold text-white">Rebuild Formula:</span>
                  <p className="text-[11px] text-[#cccccc] font-mono leading-snug">
                    {item.rebuildFormula}
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-between gap-2 border-t border-[#242424]">
                  <button
                    onClick={() => handleCopyCode(item)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-[#242424] hover:bg-[#303030] text-xs font-mono text-white transition-colors"
                  >
                    {copiedId === item.id ? (
                      <Check className="w-3.5 h-3.5 text-[#d1fe17]" />
                    ) : user?.plan !== 'pro' ? (
                      <Lock className="w-3.5 h-3.5 text-neutral-400" />
                    ) : (
                      <Code className="w-3.5 h-3.5 text-white" />
                    )}
                    <span>
                      {copiedId === item.id ? 'Copied' : user?.plan === 'pro' ? 'Copy Code' : 'Copy Code (Pro)'}
                    </span>
                  </button>

                  <button
                    onClick={onOpenPaywall}
                    className="px-3 py-2 rounded-full bg-white text-black text-xs font-semibold hover:bg-neutral-200 transition-colors"
                  >
                    MOGRT
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
