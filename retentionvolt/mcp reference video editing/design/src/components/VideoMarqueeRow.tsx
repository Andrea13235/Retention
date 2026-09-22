'use client';

import React from 'react';
import { Play, Flame, ExternalLink } from 'lucide-react';
import { VideoData } from '@/types';

interface VideoMarqueeRowProps {
  videos: VideoData[];
  direction?: 'left' | 'right';
  speed?: 'normal' | 'fast';
  cardWidth?: string; // e.g. 'w-[280px]' or 'w-[320px]'
  onVideoClick?: (video: VideoData) => void;
}

export const VideoMarqueeRow: React.FC<VideoMarqueeRowProps> = ({
  videos,
  direction = 'left',
  speed = 'normal',
  cardWidth = 'w-[280px] sm:w-[320px]',
  onVideoClick,
}) => {
  if (!videos || videos.length === 0) return null;

  // Duplicate items twice to guarantee seamless infinite loop with -50% translation
  const duplicatedVideos = [...videos, ...videos];

  const trackClass =
    direction === 'left'
      ? speed === 'fast'
        ? 'marquee-left-fast'
        : 'marquee-left-track'
      : speed === 'fast'
      ? 'marquee-right-fast'
      : 'marquee-right-track';

  const handleClick = (video: VideoData) => {
    if (onVideoClick) {
      onVideoClick(video);
      return;
    }
    const targetUrl =
      video.youtubeUrl ||
      (video.youtubeId ? `https://www.youtube.com/watch?v=${video.youtubeId}` : null);
    if (targetUrl) {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="marquee-row relative w-full overflow-hidden py-1.5 cursor-grab active:cursor-grabbing select-none">
      <div className={trackClass}>
        {duplicatedVideos.map((video, idx) => {
          // Use YouTube JPG thumbnail for instant loading without CORS / video issues
          const youtubeJpg = video.youtubeId
            ? `https://img.youtube.com/vi/${video.youtubeId}/hqdefault.jpg`
            : video.thumbnailUrl;

          return (
            <div
              key={`${video.id}-${idx}`}
              onClick={() => handleClick(video)}
              className={`inline-block ${cardWidth} shrink-0 mx-2.5 group/card cursor-pointer transition-transform duration-300 hover:scale-[1.03] hover:z-20`}
            >
              <div className="relative rounded-2xl bg-[#161616] border border-[#262626] group-hover/card:border-neutral-400/50 shadow-lg group-hover/card:shadow-2xl group-hover/card:shadow-black/80 overflow-hidden transition-all duration-300">
                {/* 16:9 Image Area */}
                <div className="relative aspect-video w-full bg-[#111] overflow-hidden">
                  <img
                    src={youtubeJpg}
                    alt={video.title}
                    loading="lazy"
                    onError={(e) => {
                      // Fallback if hqdefault fails for any reason
                      const target = e.currentTarget;
                      if (video.thumbnailUrl && target.src !== video.thumbnailUrl) {
                        target.src = video.thumbnailUrl;
                      }
                    }}
                    className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

                  {/* Top Badges */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-black/75 backdrop-blur text-[9px] font-bold text-white border border-white/10 uppercase tracking-wider">
                      {video.niche || 'VIDEO'}
                    </span>
                  </div>

                  {video.retentionScore && (
                    <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#d1fe17] text-black text-[10px] font-black shadow-sm">
                      <Flame className="w-2.5 h-2.5 fill-black" />
                      <span>{video.retentionScore}%</span>
                    </div>
                  )}

                  {/* Duration Pill */}
                  {video.duration && (
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur text-[10px] font-medium text-neutral-300 border border-white/10">
                      {video.duration}
                    </div>
                  )}

                  {/* Play & Redirect Indicator Overlay on Hover */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity duration-200 bg-black/40 backdrop-blur-[1px]">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white text-black font-semibold text-xs shadow-xl transform translate-y-2 group-hover/card:translate-y-0 transition-transform duration-200">
                      <Play className="w-3.5 h-3.5 fill-black ml-0.5" />
                      <span>Watch & Analyze</span>
                      <ExternalLink className="w-3 h-3 text-neutral-600" />
                    </div>
                  </div>
                </div>

                {/* Card Meta */}
                <div className="p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-[11px] text-[#888]">
                    {video.creator?.avatarUrl && (
                      <img
                        src={video.creator.avatarUrl}
                        alt={video.creator.name}
                        className="w-4 h-4 rounded-full object-cover border border-white/10"
                      />
                    )}
                    <span className="text-neutral-300 font-medium truncate max-w-[140px]">
                      {video.creator?.name || 'Creator'}
                    </span>
                    {video.cpm && (
                      <>
                        <span className="text-[#555]">•</span>
                        <span className="text-[#aaa]">{video.cpm} CPM</span>
                      </>
                    )}
                  </div>

                  <h5 className="text-xs font-semibold text-white truncate group-hover/card:text-[#d1fe17] transition-colors">
                    {video.title}
                  </h5>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
