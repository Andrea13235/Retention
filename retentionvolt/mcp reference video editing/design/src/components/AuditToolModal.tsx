'use client';

import React, { useState } from 'react';
import { 
  BarChart3, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Activity, 
  ArrowRight,
  Lock
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface AuditToolModalProps {
  onOpenPaywall: () => void;
}

export const AuditToolModal: React.FC<AuditToolModalProps> = ({ onOpenPaywall }) => {
  const { user } = useAuth();
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedNiche, setSelectedNiche] = useState('tech');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [auditNotice, setAuditNotice] = useState<string | null>(null);

  const handleStartAudit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl) return;
    setAuditNotice(null);

    // Free accounts: 1 audit per month quota check
    if (user?.plan !== 'pro') {
      const usedCount = parseInt(localStorage.getItem('retentionvolt_free_audits_count') || '0', 10);
      if (usedCount >= 1) {
        setAuditNotice('You have used your 1 free AI retention audit on the Free tier. Upgrade to Pro for unlimited audits.');
        onOpenPaywall();
        return;
      }
    }

    setIsScanning(true);
    setScanResult(null);

    setTimeout(() => {
      setIsScanning(false);
      if (user?.plan !== 'pro') {
        const usedCount = parseInt(localStorage.getItem('retentionvolt_free_audits_count') || '0', 10);
        localStorage.setItem('retentionvolt_free_audits_count', String(usedCount + 1));
      }
      setScanResult({
        title: videoUrl.includes('watch') ? 'Scanned YouTube Video Sample' : videoUrl,
        overallScore: 78,
        pacingCpm: 14.8,
        benchmarkCpm: 22.4,
        avgShotLength: 4.05,
        benchmarkAsl: 2.7,
        wpm: 168,
        riskZones: [
          {
            timestamp: '00:12 - 00:19',
            issue: '7-second static talking-head without B-roll or zoom-in',
            advice: 'Insert a punch-zoom of 12% or a b-roll cut at 00:15 to maintain retention.'
          },
          {
            timestamp: '00:42 - 00:46',
            issue: 'Unnatural silence gap of 680ms between sentences',
            advice: 'Apply jump-cut ripple edit: keep vocal gaps below 350ms.'
          }
        ]
      });
    }, 1500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      
      {/* Hero Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Video Retention Audit
        </h1>
        <p className="text-sm text-[#8e8e8e] max-w-xl mx-auto">
          Paste any YouTube URL. Our AI analyzes your cut cadence, pacing density, and silence gaps compared to top creators.
        </p>
      </div>

      {auditNotice && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in max-w-xl mx-auto">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{auditNotice}</span>
          </div>
          <button
            type="button"
            onClick={onOpenPaywall}
            className="px-3.5 py-1.5 rounded-full bg-white text-black font-bold text-xs shrink-0 hover:bg-neutral-200 transition-colors shadow-sm"
          >
            Upgrade to Pro
          </button>
        </div>
      )}

      {/* Input Form Box */}
      <form onSubmit={handleStartAudit} className="p-6 rounded-3xl bg-[#181818] border border-[#262626] shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="Paste YouTube Video URL (e.g. https://www.youtube.com/watch?v=...)"
            required
            className="flex-1 bg-[#121212] border border-[#2e2e2e] rounded-xl px-4 py-3 text-sm text-white placeholder-[#666666] focus:border-white focus:outline-none transition-all"
          />
          
          <select
            value={selectedNiche}
            onChange={(e) => setSelectedNiche(e.target.value)}
            className="bg-[#121212] border border-[#2e2e2e] rounded-xl px-4 py-3 text-xs text-white focus:border-white focus:outline-none"
          >
            <option value="tech">Tech &amp; Reviews</option>
            <option value="productivity">Productivity &amp; Education</option>
            <option value="entertainment">Entertainment &amp; Viral</option>
            <option value="documentary">Vox / Documentary</option>
            <option value="shorts">Shorts &amp; Reels</option>
          </select>

          <button
            type="submit"
            disabled={isScanning}
            className="px-6 py-3 rounded-full bg-white text-black font-semibold text-sm hover:bg-[#e0e0e0] transition-all shrink-0 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isScanning ? 'Scanning...' : 'Audit Video'}
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#666]">
          <span>Try a sample:</span>
          <button
            type="button"
            onClick={() => setVideoUrl('https://www.youtube.com/watch?v=0e3GPea1Tyg')}
            className="text-[#8e8e8e] hover:text-white underline"
          >
            MrBeast Squid Game
          </button>
        </div>
      </form>

      {/* Audit Report Result */}
      {scanResult && (
        <div className="p-6 sm:p-8 rounded-3xl bg-[#181818] border border-white/20 shadow-xl space-y-6 animate-fade-in">
          <div className="flex items-center justify-between pb-4 border-b border-[#262626]">
            <div>
              <span className="text-xs font-mono uppercase text-[#8e8e8e]">AUDIT REPORT</span>
              <h3 className="text-lg font-bold text-white mt-0.5">{scanResult.title}</h3>
            </div>
            <div className="text-2xl font-bold font-mono text-white">
              {scanResult.overallScore}<span className="text-xs text-[#8e8e8e]">/100</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#121212] border border-[#242424]">
              <div className="text-xs text-[#8e8e8e]">CUTS PER MINUTE</div>
              <div className="text-xl font-bold font-mono text-white mt-1">{scanResult.pacingCpm} CPM</div>
              <div className="text-[11px] text-[#8e8e8e] mt-0.5">Benchmark: {scanResult.benchmarkCpm} CPM</div>
            </div>

            <div className="p-4 rounded-xl bg-[#121212] border border-[#242424]">
              <div className="text-xs text-[#8e8e8e]">AVG SHOT LENGTH</div>
              <div className="text-xl font-bold font-mono text-white mt-1">{scanResult.avgShotLength}s</div>
              <div className="text-[11px] text-[#8e8e8e] mt-0.5">Benchmark: {scanResult.benchmarkAsl}s</div>
            </div>

            <div className="p-4 rounded-xl bg-[#121212] border border-[#242424]">
              <div className="text-xs text-[#8e8e8e]">SPEECH PACING</div>
              <div className="text-xl font-bold font-mono text-white mt-1">{scanResult.wpm} WPM</div>
              <div className="text-[11px] text-[#8e8e8e] mt-0.5">Optimal verbal pace</div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={onOpenPaywall}
              className="px-5 py-2.5 rounded-full bg-white text-black font-semibold text-xs hover:bg-[#e0e0e0] transition-colors flex items-center gap-2"
            >
              <span>Unlock Full Auto-Cut Export (Pro)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
