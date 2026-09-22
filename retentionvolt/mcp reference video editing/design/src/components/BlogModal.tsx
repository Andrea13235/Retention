'use client';

import React, { useState, useEffect } from 'react';
import { X, BookOpen, Clock, ArrowRight, ArrowLeft, Share2, Sparkles } from 'lucide-react';

interface BlogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ARTICLES = [
  {
    id: 'art-1',
    title: 'The Anatomy of a 70% YouTube Retention Curve: How Top Editors Hook in 30 Seconds',
    excerpt: 'An empirical analysis of 120 high-retention videos showing the exact pattern of cut cadence, sound design markers, and premise stakes required to prevent the initial viewer drop-off.',
    category: 'Retention Engineering',
    readTime: '6 min read',
    date: 'Sep 15, 2026',
    author: 'Retention Lab',
    content: `
### The 30-Second Cliff
90% of YouTube viewers who leave a video do so within the first 30 seconds. In this breakdown, we dissect the three structural pillars used by MrBeast, Colin & Samir, and Ali Abdaal to keep average view duration (AVD) above 65%:

1. **Immediate Visual Stakes**: Zero logo intros, zero sponsor reads, zero meandering greetings. The promise is made in shot 1 (0:00 - 0:02).
2. **The Cut Escalation**: Cuts per minute in the first 15 seconds average 32 CPM, tapering down to a sustainable 18 CPM once the premise is locked.
3. **Audio Pattern Interrupts**: Every 4.5 seconds, a subtle auditory shift occurs (whoosh, riser cut, or ambient drop) to re-engage passive listeners.
    `
  },
  {
    id: 'art-2',
    title: 'Why Cut Cadence Beats Production Value: Measuring ASL Across 500+ Viral Shorts',
    excerpt: 'High-budget 8K RED footage consistently loses to clean 1080p footage with a disciplined Average Shot Length under 1.8 seconds. Here is the mathematical reason why.',
    category: 'Cadence Benchmarks',
    readTime: '4 min read',
    date: 'Sep 08, 2026',
    author: 'Cadence Team',
    content: `
### The Mathematics of Scroll Friction
In mobile short-form feeds, the cost of scrolling away is zero. We benchmarked 500 Shorts across 10 niches:

* **Videos with ASL > 2.8s**: Suffered a 42% swipe-away rate before second 5.
* **Videos with ASL between 1.2s - 1.8s**: Retained 78% of viewers through second 15.

The key takeaway: visual rhythm signals respect for the viewer’s time. Micro-zooms and J-cuts create artificial momentum even during static talking-head moments.
    `
  },
  {
    id: 'art-3',
    title: 'Speech Pacing (WPM) & Cognitive Load: When to Accelerate and When to Pause',
    excerpt: 'Speaking at 190 WPM keeps attention high, but without calculated 0.4s micro-pauses at key takeaways, comprehension drops and viewers bounce.',
    category: 'Audio Psychology',
    readTime: '5 min read',
    date: 'Aug 24, 2026',
    author: 'AI Audio Team',
    content: `
### Dynamic Speech Curves
Constant hyper-speed voiceover induces listener fatigue. The highest-performing educational videos follow a sinusoidal pacing curve:

* **Hook**: 185 - 200 Words Per Minute (creates urgency and momentum).
* **Core Insight**: 140 - 150 Words Per Minute (allows working memory to absorb the thesis).
* **Payoff**: 175 Words Per Minute with punchy sound effects.
    `
  }
];

export const BlogModal: React.FC<BlogModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedArticleId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (selectedArticleId) {
          setSelectedArticleId(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, selectedArticleId]);

  if (!isOpen) return null;

  const activeArticle = ARTICLES.find(a => a.id === selectedArticleId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
      <div 
        className="relative w-full max-w-3xl bg-[#141414] text-white rounded-3xl border border-[#262626] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        style={{ boxShadow: '0 25px 70px -15px rgba(0,0,0,0.9), 0 0 1px 1px rgba(255,255,255,0.06)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#222222] bg-[#171717] shrink-0">
          <div className="flex items-center gap-3">
            {activeArticle ? (
              <button
                onClick={() => setSelectedArticleId(null)}
                className="w-8 h-8 rounded-full bg-[#262626] hover:bg-[#333333] text-[#8e8e8e] hover:text-white flex items-center justify-center transition-colors"
                title="Tutti gli articoli"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#262626] flex items-center justify-center text-[#d1fe17]">
                <BookOpen className="w-4 h-4" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-white">
                {activeArticle ? 'Article Reading' : 'Retention Engineering Blog'}
              </h2>
              <p className="text-xs text-[#8e8e8e]">
                {activeArticle ? activeArticle.category : 'Deep-dives into video algorithms, cut pacing, and thumbnail psychology.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#262626] hover:bg-[#333333] text-[#8e8e8e] hover:text-white flex items-center justify-center transition-colors"
            title="Chiudi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeArticle ? (
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="flex items-center gap-3 text-xs text-[#8e8e8e]">
                <span className="px-2.5 py-0.5 rounded-full bg-[#242424] text-white border border-[#333]">
                  {activeArticle.category}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {activeArticle.readTime}
                </span>
                <span>•</span>
                <span>{activeArticle.date}</span>
              </div>

              <h1 className="text-2xl font-bold text-white leading-snug">
                {activeArticle.title}
              </h1>

              <div className="p-4 rounded-xl bg-[#1b1b1b] border border-[#262626] text-xs text-[#a3a3a3] leading-relaxed italic">
                {activeArticle.excerpt}
              </div>

              <div className="text-sm text-[#d4d4d4] leading-relaxed space-y-4 whitespace-pre-line font-normal">
                {activeArticle.content}
              </div>

              <div className="pt-6 border-t border-[#262626] flex items-center justify-between">
                <button
                  onClick={() => setSelectedArticleId(null)}
                  className="text-xs font-semibold text-[#d1fe17] hover:underline flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Torna a tutti gli articoli</span>
                </button>
                <div className="text-xs text-[#777]">By {activeArticle.author}</div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {ARTICLES.map((article) => (
                <div
                  key={article.id}
                  onClick={() => setSelectedArticleId(article.id)}
                  className="p-5 rounded-2xl bg-[#191919] hover:bg-[#202020] border border-[#262626] hover:border-[#383838] transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-[#d1fe17] tracking-wider uppercase">
                      {article.category}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-[#777]">
                      <Clock className="w-3 h-3" />
                      <span>{article.readTime}</span>
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-white group-hover:text-[#d1fe17] transition-colors mb-2 leading-snug">
                    {article.title}
                  </h3>

                  <p className="text-xs text-[#8e8e8e] leading-relaxed line-clamp-2 mb-3">
                    {article.excerpt}
                  </p>

                  <div className="flex items-center justify-between text-xs text-[#666]">
                    <span>{article.date}</span>
                    <span className="text-white group-hover:translate-x-1 transition-transform flex items-center gap-1 font-semibold text-xs">
                      Read article <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#222222] bg-[#171717] flex items-center justify-between text-xs text-[#8e8e8e] shrink-0">
          <span>New research published weekly by the Retention Engineering Lab.</span>
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
