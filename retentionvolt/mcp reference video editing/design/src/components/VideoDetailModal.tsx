'use client';

import React, { useState, useRef } from 'react';
import { VideoData, CutPoint } from '@/types';
import { 
  X, 
  Play, 
  Activity, 
  Clock, 
  ExternalLink, 
  Copy, 
  Check, 
  Bookmark,
  Share2,
  Film, 
  Layers, 
  Volume2, 
  Palette,
  Camera,
  ZoomIn,
  Scissors,
  Sparkles,
  Monitor,
  Eye,
  TrendingUp,
  Lock
} from 'lucide-react';
import { McpIcon } from '@/components/McpIcon';
import { useAuth } from '@/context/AuthContext';

interface VideoDetailModalProps {
  video: VideoData | null;
  onClose: () => void;
  onOpenPaywall: () => void;
  onOpenMcp?: () => void;
  onSelectMotionGraphic?: (id: string) => void;
}

export const VideoDetailModal: React.FC<VideoDetailModalProps> = ({
  video,
  onClose,
  onOpenPaywall,
  onOpenMcp,
  onSelectMotionGraphic
}) => {
  const { user } = useAuth();
  const [activeCutIndex, setActiveCutIndex] = useState<number>(0);
  const [selectedTechnique, setSelectedTechnique] = useState<string>('all');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [downloadedEdl, setDownloadedEdl] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  if (!video) return null;

  const handleExportEDL = () => {
    if (user?.plan !== 'pro') {
      onOpenPaywall();
      return;
    }

    let edl = `TITLE: ${video.title.replace(/[^a-zA-Z0-9 ]/g, '')}\nFCM: NON-DROP FRAME\n\n`;
    video.cuts.forEach((cut, i) => {
      const num = String(i + 1).padStart(3, '0');
      const startSec = Math.floor(cut.timeSeconds);
      const endSec = startSec + (cut.movementDurationSec || 2);
      const formatTimecode = (s: number) => {
        const hrs = String(Math.floor(s / 3600)).padStart(2, '0');
        const mins = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
        const secs = String(Math.floor(s % 60)).padStart(2, '0');
        return `${hrs}:${mins}:${secs}:00`;
      };
      edl += `${num}  AX       V     C        ${formatTimecode(startSec)} ${formatTimecode(endSec)} ${formatTimecode(startSec)} ${formatTimecode(endSec)}\n`;
      edl += `* FROM CLIP NAME: ${cut.label} (${cut.type})\n\n`;
    });

    const blob = new Blob([edl], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${video.creator.name.replace(/\s+/g, '_')}_${video.id}_cuts.edl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloadedEdl(true);
    setTimeout(() => setDownloadedEdl(false), 3000);
  };

  const activeCut = video.cuts[activeCutIndex] || video.cuts[0];

  const getTechniqueBadge = (type: string) => {
    switch (type) {
      case 'camera_angle_switch':
        return {
          label: 'Camera Angle',
          color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
          icon: <Camera className="w-3 h-3 text-purple-400" />
        };
      case 'punch_zoom':
        return {
          label: 'Punch Zoom',
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
          icon: <ZoomIn className="w-3 h-3 text-amber-400" />
        };
      case 'slow_push_in':
        return {
          label: 'Slow Push-In',
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
          icon: <TrendingUp className="w-3 h-3 text-emerald-400" />
        };
      case 'slow_pull_out':
        return {
          label: 'Slow Pull-Out',
          color: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
          icon: <TrendingUp className="w-3 h-3 text-sky-400 rotate-180" />
        };
      case 'camera_drift':
        return {
          label: 'Camera Drift',
          color: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
          icon: <Eye className="w-3 h-3 text-violet-400" />
        };
      case 'jump_cut_reframe':
        return {
          label: 'Reframe Jump',
          color: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
          icon: <Scissors className="w-3 h-3 text-orange-400" />
        };
      case 'motion_graphic':
        return {
          label: 'Motion Graphic',
          color: 'text-[#d1fe17] bg-[#d1fe17]/10 border-[#d1fe17]/30',
          icon: <Sparkles className="w-3 h-3 text-[#d1fe17]" />
        };
      case 'screen_recording':
        return {
          label: 'Screen Record',
          color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
          icon: <Monitor className="w-3 h-3 text-blue-400" />
        };
      case 'b_roll':
      case 'b_roll_cutaway':
        return {
          label: 'B-Roll Cutaway',
          color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
          icon: <Film className="w-3 h-3 text-cyan-400" />
        };
      case 'audio_riser':
        return {
          label: 'Audio Riser',
          color: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
          icon: <Volume2 className="w-3 h-3 text-pink-400" />
        };
      default:
        return {
          label: 'Inquadratura',
          color: 'text-white/80 bg-white/5 border-white/20',
          icon: <Eye className="w-3 h-3 text-white/80" />
        };
    }
  };

  const filteredCuts = selectedTechnique === 'all'
    ? video.cuts
    : video.cuts.filter(c => {
        if (selectedTechnique === 'camera_angle_switch') return c.type === 'camera_angle_switch';
        if (selectedTechnique === 'punch_zoom') return c.type === 'punch_zoom';
        if (selectedTechnique === 'slow_push_in') return c.type === 'slow_push_in' || c.type === 'slow_pull_out' || c.type === 'camera_drift';
        if (selectedTechnique === 'motion_graphic') return c.type === 'motion_graphic';
        if (selectedTechnique === 'b_roll') return c.type.includes('b_roll');
        return true;
      });

  const handleJumpToCut = (index: number) => {
    setActiveCutIndex(index);
    const cut = video.cuts[index];
    if (iframeRef.current && cut) {
      iframeRef.current.src = `https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&start=${Math.floor(cut.timeSeconds)}&rel=0`;
    }
  };


  const handleCopyLink = () => {
    navigator.clipboard.writeText(video.youtubeUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const colorSwatches = [
    { name: 'Pure Black', hex: '#0e0e0e' },
    { name: 'Card Dark', hex: '#181818' },
    { name: 'Pure White', hex: '#ffffff' },
    { name: 'Cool Grey', hex: '#8e8e8e' },
    { name: 'Accent Navy', hex: '#1e293b' }
  ];

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-8 bg-black/55 backdrop-blur-sm overflow-hidden animate-fade-in"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl lg:max-w-5xl bg-[#121212] border border-[#262626] rounded-3xl overflow-hidden shadow-2xl my-auto max-h-[92vh] flex flex-col"
      >
        
        {/* Top Bar (Identica alla copertina) */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#1f1f1f] bg-[#161616] gap-4 shrink-0">
          
          {/* Left: Creator Avatar + Video Title */}
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <img
              src={video.creator.avatarUrl}
              alt={video.creator.name}
              className="w-9 h-9 rounded-xl object-cover border border-white/10 shrink-0 bg-white/5"
            />
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-white truncate" title={video.title}>
                {video.title}
              </h3>
              <p className="text-[11px] text-[#8e8e8e] truncate font-mono">
                by <strong className="text-white">{video.creator.name}</strong> • {video.views} views • {video.duration}
              </p>
            </div>
          </div>

          {/* Right: Server MCP + Watch on YouTube Button + Close */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => {
                if (user?.plan !== 'pro') {
                  onOpenPaywall();
                } else if (onOpenMcp) {
                  onOpenMcp();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1c1c1c] hover:bg-[#252525] border border-[#2e2e2e] hover:border-[#d1fe17]/50 text-white text-xs font-mono transition-all group shrink-0"
              title={user?.plan === 'pro' ? 'Open CyberMCP Server' : 'CyberMCP requires Pro (7-Day Free Trial)'}
            >
              <McpIcon className="w-3.5 h-3.5 text-[#d1fe17] group-hover:scale-110 transition-transform shrink-0" />
              <span className="font-semibold uppercase text-[11px]">mcp</span>
              {user?.plan !== 'pro' && <Lock className="w-2.5 h-2.5 text-[#888] ml-0.5" />}
            </button>

            <a
              href={video.youtubeUrl || `https://youtu.be/${video.youtubeId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#ff0000] hover:bg-[#cc0000] text-white text-xs font-bold transition-all shadow-md group/yt shrink-0"
              title={`Apri su YouTube: youtu.be/${video.youtubeId}`}
            >
              <ExternalLink className="w-3.5 h-3.5 text-white group-hover/yt:scale-110 transition-transform" />
              <span>Vedi su YouTube</span>
              <span className="hidden sm:inline text-[11px] font-mono text-white/80 pl-1.5 border-l border-white/30">
                youtu.be/{video.youtubeId}
              </span>
            </a>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/10 text-[#8e8e8e] hover:text-white hover:bg-white/20 transition-colors"
              title="Chiudi (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

        </div>

        {/* Scrollable Body (Flusso verticale a colonna singola come la copertina) */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[82vh] overflow-y-auto">
          
          {/* 1. Video Player */}
          <div className="relative aspect-video rounded-2xl overflow-hidden border border-[#262626] bg-black shadow-xl">
            <iframe
              ref={iframeRef}
              src={`https://www.youtube.com/embed/${video.youtubeId}?autoplay=0&rel=0`}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="w-full h-full border-0"
            />
          </div>

          {/* If video is locked for Free account */}
          {(video.isLocked || video.cuts.length === 0) && user?.plan !== 'pro' ? (
            <div className="p-8 sm:p-10 rounded-2xl bg-[#181818] border border-white/20 text-center space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-[#d1fe17]/10 border border-[#d1fe17]/30 flex items-center justify-center mx-auto text-[#d1fe17]">
                <Lock className="w-7 h-7" />
              </div>
              <div className="space-y-2 max-w-md mx-auto">
                <h3 className="text-xl font-bold text-white">Full Retention Cadence Locked</h3>
                <p className="text-xs text-[#8e8e8e] leading-relaxed">
                  This detailed breakdown is part of the Retentionvolt Pro catalog. Upgrade to Pro ($12/mo or $6/mo annual with 7-day free trial) to view all cut timestamps, camera switches, speech pacing analysis, and export DaVinci/Premiere EDL files.
                </p>
              </div>
              <button
                onClick={onOpenPaywall}
                className="px-6 py-3 rounded-full bg-white hover:bg-neutral-200 text-black text-xs font-bold transition-all shadow-md active:scale-[0.99]"
              >
                Upgrade to Pro (Start 7-Day Free Trial)
              </button>
            </div>
          ) : (
            <>
          {/* 2. Barra Scorrevole (Identica alla foto caricata dall'utente) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#181818] border border-[#262626] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 text-xs text-white font-semibold">
                <Film className="w-3.5 h-3.5 text-white" />
                <span>Techniques &amp; Camera Flow</span>
                <span className="font-mono text-[11px] text-[#8e8e8e]">({video.cuts.length} visual events)</span>
              </div>
              
              {/* Technique Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] font-medium scrollbar-none pb-1 sm:pb-0">
                <button
                  onClick={() => setSelectedTechnique('all')}
                  className={`px-2 py-0.5 rounded-md transition-colors ${
                    selectedTechnique === 'all'
                      ? 'bg-white text-black font-semibold'
                      : 'bg-[#222] text-[#8e8e8e] hover:text-white'
                  }`}
                >
                  All ({video.cuts.length})
                </button>
                <button
                  onClick={() => setSelectedTechnique('camera_angle_switch')}
                  className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors ${
                    selectedTechnique === 'camera_angle_switch'
                      ? 'bg-purple-500 text-white font-semibold'
                      : 'bg-[#222] text-purple-400/80 hover:text-purple-300'
                  }`}
                >
                  <Camera className="w-2.5 h-2.5" />
                  <span>Inquadrature ({video.cuts.filter(c => c.type === 'camera_angle_switch').length})</span>
                </button>
                <button
                  onClick={() => setSelectedTechnique('punch_zoom')}
                  className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors ${
                    selectedTechnique === 'punch_zoom'
                      ? 'bg-amber-500 text-black font-semibold'
                      : 'bg-[#222] text-amber-400/80 hover:text-amber-300'
                  }`}
                >
                  <ZoomIn className="w-2.5 h-2.5" />
                  <span>Punch Zoom ({video.cuts.filter(c => c.type === 'punch_zoom').length})</span>
                </button>
                <button
                  onClick={() => setSelectedTechnique('slow_push_in')}
                  className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors ${
                    selectedTechnique === 'slow_push_in'
                      ? 'bg-emerald-500 text-black font-semibold'
                      : 'bg-[#222] text-emerald-400/80 hover:text-emerald-300'
                  }`}
                >
                  <TrendingUp className="w-2.5 h-2.5" />
                  <span>Slow Push-In ({video.cuts.filter(c => c.type === 'slow_push_in' || c.type === 'slow_pull_out' || c.type === 'camera_drift').length})</span>
                </button>
                <button
                  onClick={() => setSelectedTechnique('motion_graphic')}
                  className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors ${
                    selectedTechnique === 'motion_graphic'
                      ? 'bg-[#d1fe17] text-black font-semibold'
                      : 'bg-[#222] text-[#d1fe17]/80 hover:text-[#d1fe17]'
                  }`}
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>Motion ({video.cuts.filter(c => c.type === 'motion_graphic').length})</span>
                </button>
                <button
                  onClick={() => setSelectedTechnique('b_roll')}
                  className={`px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors ${
                    selectedTechnique === 'b_roll'
                      ? 'bg-cyan-500 text-black font-semibold'
                      : 'bg-[#222] text-cyan-400/80 hover:text-cyan-300'
                  }`}
                >
                  <Film className="w-2.5 h-2.5" />
                  <span>B-Roll ({video.cuts.filter(c => c.type.includes('b_roll')).length})</span>
                </button>
              </div>
            </div>

            {/* Horizontal Sequence Step Cards (Esattamente come lo screenshot dell'utente) */}
            <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin">
              {filteredCuts.map((cut, idx) => {
                const originalIndex = video.cuts.indexOf(cut);
                const isCurrent = activeCutIndex === originalIndex;
                const badge = getTechniqueBadge(cut.type);

                return (
                  <button
                    key={idx}
                    onClick={() => handleJumpToCut(originalIndex)}
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border text-left shrink-0 transition-all ${
                      isCurrent
                        ? 'bg-[#222] border-white shadow-md ring-1 ring-white/30 scale-[1.02]'
                        : 'bg-[#141414] border-[#2a2a2a] hover:border-[#444]'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg bg-black border border-white/10 flex items-center justify-center font-mono font-bold text-xs text-white shrink-0">
                      {Math.floor(cut.timeSeconds)}s
                    </div>
                    <div className="min-w-0 pr-1 space-y-0.5">
                      <div className="text-xs font-semibold text-white truncate max-w-[160px]">
                        {cut.label}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono border ${badge.color}`}>
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                        {cut.movementDurationSec && (
                          <span className="text-[9px] font-mono text-emerald-300 bg-emerald-400/10 px-1 rounded border border-emerald-400/20">
                            ⏳ {cut.movementDurationSec}s creep
                          </span>
                        )}
                        {cut.scaleChange && (
                          <span className="text-[9px] font-mono text-amber-300 bg-amber-400/10 px-1 rounded border border-amber-400/20">
                            {cut.scaleChange}
                          </span>
                        )}
                        {cut.cameraAngle && (
                          <span className="text-[9px] font-mono text-purple-300 bg-purple-400/10 px-1 rounded border border-purple-400/20 truncate max-w-[100px]">
                            {cut.cameraAngle}
                          </span>
                        )}
                        {cut.motionIntent && (
                          <span className="text-[9px] font-mono text-[#d1fe17] bg-[#d1fe17]/10 px-1 rounded border border-[#d1fe17]/20 flex items-center gap-0.5">
                            <Sparkles className="w-2 h-2" />
                            <span>{cut.motionIntent.intent.replace(/_/g, ' ')}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Dettaglio del taglio attivo selezionato */}
            {activeCut && (
              <div className="pt-3 border-t border-white/5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white text-xs truncate max-w-[320px]">
                    📍 Evento attivo: {activeCut.label}
                  </span>
                  <span className="text-[11px] font-mono text-white/80 bg-white/10 px-2 py-0.5 rounded">
                    @{Math.floor(activeCut.timeSeconds)}s
                  </span>
                </div>
                {activeCut.motionIntent && (
                  <div className="p-3 rounded-xl bg-[#d1fe17]/5 border border-[#d1fe17]/20 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono font-bold text-[#d1fe17]">
                      <span>Motion Intent: {activeCut.motionIntent.intent.replace(/_/g, ' ')}</span>
                      <span className="text-white/60 font-normal">
                        {activeCut.motionIntent.recommendedDurationSec}s • {activeCut.motionIntent.screenPosition.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#ccc] leading-relaxed">
                      {activeCut.motionIntent.retentionRole}
                    </p>
                  </div>
                )}
                {activeCut.description && !activeCut.motionIntent && (
                  <p className="text-[11px] text-[#8e8e8e] leading-snug">
                    {activeCut.description}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 3. Sotto Altre Info: Metriche Chiave di Retention & Pacing */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3.5 rounded-xl bg-[#181818] border border-[#262626]">
              <span className="text-[#8e8e8e] text-[10px] uppercase block">OVERALL CPM</span>
              <div className="text-white font-bold text-lg mt-0.5 font-mono">
                {video.cpm} <span className="text-xs font-normal text-[#8e8e8e]">cuts/m</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#181818] border border-[#262626]">
              <span className="text-[#8e8e8e] text-[10px] uppercase block">INTRO HOOK CPM</span>
              <div className="text-white font-bold text-lg mt-0.5 font-mono">
                {video.cpmIntro} <span className="text-xs font-normal text-[#8e8e8e]">cuts/m</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#181818] border border-[#262626]">
              <span className="text-[#8e8e8e] text-[10px] uppercase block">AVG SHOT LENGTH</span>
              <div className="text-white font-bold text-lg mt-0.5 font-mono">
                {video.averageShotLengthSec}s
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#181818] border border-[#262626]">
              <span className="text-[#8e8e8e] text-[10px] uppercase block">RETENTION SCORE</span>
              <div className="text-white font-bold text-lg mt-0.5 font-mono flex items-center gap-1.5">
                <span>{video.retentionScore}/100</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-[#d1fe17]">Score</span>
              </div>
            </div>
          </div>

          {/* 4. Dinamica Camera & Stimoli Visivi */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#181818] border border-purple-500/20 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-white">
              <div className="flex items-center gap-1.5 text-purple-400">
                <Camera className="w-3.5 h-3.5" />
                <span className="font-mono uppercase text-[11px]">Dinamica Camera &amp; Stimoli Visivi</span>
              </div>
              <span className="text-[10px] font-mono text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                VSI: {video.visualStimulusIntervalSec || 2.1}s
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
              <div className="p-2.5 rounded-xl bg-[#141414] border border-[#262626]">
                <span className="text-[#8e8e8e] block text-[9px] uppercase">Cambi Inquadratura</span>
                <span className="text-white font-bold text-base">
                  {video.cuts.filter(c => c.type === 'camera_angle_switch').length || video.cameraSwitchesCount || 3}
                </span>
                <span className="text-[#666] text-[10px] block">angolazioni</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#141414] border border-[#262626]">
                <span className="text-[#8e8e8e] block text-[9px] uppercase">Punch Zooms</span>
                <span className="text-amber-400 font-bold text-base">
                  {video.cuts.filter(c => c.type === 'punch_zoom').length || video.punchZoomsCount || 2}
                </span>
                <span className="text-[#666] text-[10px] block">zoom dinamici</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#141414] border border-[#262626]">
                <span className="text-[#8e8e8e] block text-[9px] uppercase">Slow Push-Ins</span>
                <span className="text-emerald-400 font-bold text-base">
                  {video.cuts.filter(c => c.type === 'slow_push_in' || c.type === 'slow_pull_out' || c.type === 'camera_drift').length || video.slowPushInsCount || 0}
                </span>
                <span className="text-[#666] text-[10px] block">creep lenti</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#141414] border border-[#262626]">
                <span className="text-[#8e8e8e] block text-[9px] uppercase">Max Frame Statico</span>
                <span className="text-white font-bold text-base">
                  {video.maxStaticHoldSec || 2.8}s
                </span>
                <span className="text-[#666] text-[10px] block">limite no-event</span>
              </div>
            </div>
          </div>

          {/* 5. Editing Strategy & Retention Architecture */}
          <div className="p-5 rounded-2xl bg-[#181818] border border-[#262626] space-y-4">
            <h4 className="text-xs font-mono font-bold uppercase text-white flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-white" />
              <span>Editing Strategy &amp; Retention Architecture</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
              <div className="space-y-1.5 p-3.5 rounded-xl bg-[#141414] border border-[#222]">
                <div className="font-bold font-mono text-[11px] uppercase text-white">
                  Hook Tactic (0 - 30s)
                </div>
                <p className="text-[#8e8e8e] leading-relaxed text-[11px]">
                  {video.editingAdvice.hookTactic}
                </p>
              </div>

              <div className="space-y-1.5 p-3.5 rounded-xl bg-[#141414] border border-[#222]">
                <div className="font-bold font-mono text-[11px] uppercase text-white">
                  Body Pacing Strategy
                </div>
                <p className="text-[#8e8e8e] leading-relaxed text-[11px]">
                  {video.editingAdvice.bodyPacing}
                </p>
              </div>

              <div className="space-y-1.5 p-3.5 rounded-xl bg-[#141414] border border-[#222]">
                <div className="font-bold font-mono text-[11px] uppercase text-white">
                  Sound Design &amp; SFX
                </div>
                <p className="text-[#8e8e8e] leading-relaxed text-[11px]">
                  {video.editingAdvice.soundDesign}
                </p>
              </div>
            </div>

            {/* Color Palette */}
            <div className="pt-3 border-t border-[#222] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Palette className="w-3.5 h-3.5 text-white" />
                <span>Extracted Visual Palette</span>
              </div>
              <div className="flex items-center gap-2">
                {colorSwatches.map((color, idx) => (
                  <div
                    key={idx}
                    title={`${color.name}: ${color.hex}`}
                    style={{ backgroundColor: color.hex }}
                    className="w-7 h-7 rounded-lg border border-white/10 hover:scale-110 transition-transform cursor-pointer shadow-sm"
                  />
                ))}
              </div>
            </div>
          </div>
          </>
          )}

          {/* 7. Action Suite Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSaved(!isSaved)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-xs font-medium transition-colors ${
                  isSaved
                    ? 'bg-white text-black border-white font-semibold'
                    : 'bg-[#181818] text-[#8e8e8e] hover:text-white border-[#262626]'
                }`}
              >
                <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                <span>{isSaved ? 'Saved' : 'Save'}</span>
              </button>

              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#181818] hover:bg-white/10 border border-[#262626] text-xs text-[#8e8e8e] hover:text-white transition-colors"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-white" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied Link' : 'Share'}</span>
              </button>

              <button
                onClick={() => {
                  if (user?.plan !== 'pro') {
                    onOpenPaywall();
                  } else if (onOpenMcp) {
                    onOpenMcp();
                  }
                }}
                className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#181818] hover:bg-[#252525] border border-[#262626] hover:border-[#d1fe17]/60 text-xs font-mono text-white transition-all group shadow-sm"
                title={user?.plan === 'pro' ? 'Connect to CyberMCP Server' : 'CyberMCP requires Pro (7-Day Free Trial)'}
              >
                <McpIcon className="w-3.5 h-3.5 text-[#d1fe17] group-hover:scale-110 transition-transform shrink-0" />
                <span className="font-semibold uppercase tracking-wider text-xs">mcp</span>
                {user?.plan !== 'pro' && <Lock className="w-2.5 h-2.5 text-[#888] ml-0.5" />}
              </button>
            </div>

            <button
              onClick={handleExportEDL}
              className="px-5 py-2 rounded-full bg-white text-black text-xs font-bold hover:bg-[#e0e0e0] transition-colors shadow-sm flex items-center gap-1.5"
            >
              {downloadedEdl ? (
                <>
                  <Check className="w-3.5 h-3.5 text-black" />
                  <span>EDL Exported!</span>
                </>
              ) : user?.plan === 'pro' ? (
                'Export EDL (Premiere/DaVinci)'
              ) : (
                'Export EDL (Pro)'
              )}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
