'use client';

import React, { useState } from 'react';
import { VideoData } from '@/types';
import { Lock, Play, Bookmark } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface VideoCardProps {
  video: VideoData;
  index: number;
  onSelect: (video: VideoData) => void;
  onOpenPaywall?: () => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({ video, index, onSelect, onOpenPaywall }) => {
  const { user } = useAuth();
  const [isHovered, setIsHovered] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Pro users unlock all breakdowns. Server flag is authoritative.
  const isLocked = video.isLocked !== undefined ? video.isLocked : (user?.plan !== 'pro' && index > 3);

  const handleClick = () => {
    if (isLocked) {
      if (onOpenPaywall) {
        onOpenPaywall();
      } else {
        onSelect(video);
      }
    } else {
      onSelect(video);
    }
  };

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group flex flex-col gap-3 cursor-pointer"
    >
      {/* Mobbin Signature Card Container (Heavy rounded card with dark framing) */}
      <div
        className={`relative ${
          video.aspectRatio === '9:16'
            ? 'aspect-[9/14] p-4 sm:p-5 rounded-3xl'
            : 'aspect-[16/11] p-6 sm:p-7 rounded-3xl'
        } bg-[#181818] hover:bg-[#1f1f1f] flex items-center justify-center transition-colors duration-200 border border-transparent hover:border-[#2a2a2a] overflow-hidden`}
      >
        {/* Top-Left Badge: "New" pill or Lock icon */}
        <div className="absolute top-4 left-4 sm:top-5 sm:left-5 z-20">
          {!isLocked ? (
            <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-[#262626] text-white text-[11px] sm:text-xs font-medium tracking-tight">
              {index < 4 ? 'Featured' : 'Pro'}
            </span>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-white/90 border border-white/10 text-xs font-semibold">
              <Lock className="w-3 h-3 text-[#d1fe17]" />
              <span className="text-[10px] uppercase font-mono tracking-wider text-[#d1fe17]">PRO</span>
            </div>
          )}
        </div>

        {/* Top-Right Hover Bookmark Icon */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsSaved(!isSaved);
          }}
          className={`absolute top-4 right-4 sm:top-5 sm:right-5 z-20 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center transition-all ${
            isSaved
              ? 'bg-white text-black'
              : 'bg-black/50 text-white/80 hover:text-white opacity-0 group-hover:opacity-100'
          }`}
          title={isSaved ? 'Saved' : 'Save reference'}
        >
          <Bookmark className={`w-3 sm:w-3.5 h-3 sm:h-3.5 ${isSaved ? 'fill-current' : ''}`} />
        </button>

        {/* Floating Inner Viewport Mockup */}
        <div
          className={`relative w-full h-full ${
            video.aspectRatio === '9:16' ? 'rounded-2xl' : 'rounded-xl'
          } overflow-hidden bg-black shadow-2xl border border-white/[0.06] flex items-center justify-center`}
        >
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300 ease-out"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`;
            }}
          />

          {/* Subtle Bottom Badges on Thumbnail */}
          <div className="absolute bottom-2 left-2 sm:bottom-2.5 sm:left-2.5 flex items-center gap-1.5">
            <span className="px-1.5 sm:px-2 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[10px] font-mono text-purple-300 border border-purple-500/30">
              🎥 {video.cuts?.filter((c) => c.type === 'camera_angle_switch').length || video.cameraSwitchesCount || 3} inquadrature
            </span>
          </div>

          <div className="absolute bottom-2 right-2 sm:bottom-2.5 sm:right-2.5 px-1.5 sm:px-2 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[10px] font-mono text-white/90">
            {video.duration}
          </div>

          {/* Hover Play Button */}
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white text-black flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current ml-0.5" />
            </div>
          </div>
        </div>
      </div>

      {/* Mobbin Card Footer */}
      <div className="flex items-center gap-3 px-1">
        <img
          src={video.creator.avatarUrl}
          alt={video.creator.name}
          className="w-9 h-9 rounded-xl object-cover border border-white/10 shrink-0 bg-white/5"
        />
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm text-white truncate group-hover:underline">
            {video.creator.name}
          </h3>
          <p className="text-xs text-[#8e8e8e] truncate">
            {video.title} • {video.cpm} CPM • VSI {video.visualStimulusIntervalSec || 2.1}s
          </p>
        </div>
      </div>
    </div>
  );
};
