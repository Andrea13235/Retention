'use client';

import React, { useEffect } from 'react';
import { X, Sparkles, Zap, Wrench, Shield, ArrowRight } from 'lucide-react';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenMcp: () => void;
}

const RELEASES = [
  {
    version: 'v2.0.0',
    date: 'September 18, 2026',
    title: 'CyberMCP Engine & Full Mobbin Experience Integration',
    badge: 'Major Release',
    badgeColor: 'bg-[#d1fe17]/20 text-[#d1fe17] border-[#d1fe17]/30',
    description: 'A transformative release bringing native Model Context Protocol (MCP) server intelligence and a high-fidelity Mobbin-grade interface experience.',
    highlights: [
      'Native MCP Server protocol support (initialize, ping, tools/list, tools/call) deployed live.',
      'OpenAI Codex setup integration with 1-click CLI & JSON configuration.',
      'Claude Code, Cursor IDE, and v0 connector support.',
      'Full-screen Mobbin Settings dashboard with 5 complete sections (Account, Preferences, Billing, Team, MCP).',
      '8 atomic CyberMCP tools for cut cadence, thumbnail psychology, and retention flow.'
    ]
  },
  {
    version: 'v1.9.0',
    date: 'September 10, 2026',
    title: 'Motion Graphics Vault & Remotion Code Exporter',
    badge: 'New Feature',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    description: 'Instant access to viral motion graphic templates with ready-to-use CSS and Remotion animation source code.',
    highlights: [
      '6 production-grade motion patterns (MG-001 through MG-006).',
      'Direct copy-paste CSS keyframe animations and React components.',
      'Retention impact metrics and visual timing curves per animation.'
    ]
  },
  {
    version: 'v1.8.0',
    date: 'August 28, 2026',
    title: 'AI Speech Pacing & Cut Cadence Analyzer',
    badge: 'Improvement',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    description: 'Automated video audit engine calculating Words Per Minute (WPM) and Average Shot Length (ASL) against top creator benchmarks.',
    highlights: [
      'Multi-creator comparative retention graphs.',
      'Dead-air detection and retention dip warning alerts.',
      'Instant AI pacing optimization recommendations.'
    ]
  },
  {
    version: 'v1.5.0',
    date: 'August 14, 2026',
    title: 'Thumbnail Intelligence & CTR Blueprint Vault',
    badge: 'New Feature',
    badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    description: 'Reverse-engineered thumbnail compositions, color palettes, and psychological curiosity triggers.',
    highlights: [
      'Deconstructed thumbnail layers: focal point, text contrast, eye gaze.',
      'Midjourney v6.0 prompt recipes tuned for high-CTR YouTube covers.'
    ]
  }
];

export const ChangelogModal: React.FC<ChangelogModalProps> = ({
  isOpen,
  onClose,
  onOpenMcp,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
      <div 
        className="relative w-full max-w-2xl bg-[#141414] text-white rounded-3xl border border-[#262626] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        style={{ boxShadow: '0 25px 70px -15px rgba(0,0,0,0.9), 0 0 1px 1px rgba(255,255,255,0.06)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#222222] bg-[#171717] shrink-0">
          <div>
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-[#d1fe17]" />
              <h2 className="text-xl font-bold text-white">Changelog</h2>
            </div>
            <p className="text-xs text-[#8e8e8e] mt-0.5">
              Check out the latest features, improvements, and releases on RETENTIONVOLT.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#262626] hover:bg-[#333333] text-[#8e8e8e] hover:text-white flex items-center justify-center transition-colors"
            title="Chiudi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Timeline */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 divide-y divide-[#222222]">
          {RELEASES.map((release, idx) => (
            <div key={release.version} className={idx > 0 ? 'pt-8' : ''}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-white bg-[#222222] px-2.5 py-1 rounded-md border border-[#333333]">
                    {release.version}
                  </span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${release.badgeColor}`}>
                    {release.badge}
                  </span>
                </div>
                <span className="text-xs text-[#777777] font-medium">{release.date}</span>
              </div>

              <h3 className="text-base font-bold text-white mt-3 mb-1.5">{release.title}</h3>
              <p className="text-xs text-[#a3a3a3] leading-relaxed mb-4">{release.description}</p>

              <ul className="space-y-2 bg-[#1b1b1b] p-4 rounded-xl border border-[#262626]">
                {release.highlights.map((h, hIdx) => (
                  <li key={hIdx} className="text-xs text-[#d4d4d4] flex items-start gap-2">
                    <span className="text-[#d1fe17] font-bold mt-0.5">•</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>

              {release.version === 'v2.0.0' && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenMcp();
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#d1fe17] hover:underline"
                >
                  <span>Explore MCP Server documentation</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#222222] bg-[#171717] flex items-center justify-between text-xs text-[#8e8e8e] shrink-0">
          <span>Subscribe to release notifications in Preferences.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
