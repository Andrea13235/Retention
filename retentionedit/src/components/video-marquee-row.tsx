"use client";

import React from "react";
import { Flame } from "lucide-react";
import { VideoReference } from "@/data/videos";

interface VideoMarqueeRowProps {
  videos: VideoReference[];
  direction?: "left" | "right";
  speed?: "normal" | "fast";
  cardWidth?: string;
  onVideoClick?: (video: VideoReference) => void;
}

export const VideoMarqueeRow: React.FC<VideoMarqueeRowProps> = ({
  videos,
  direction = "left",
  speed = "normal",
  cardWidth = "w-[260px]",
  onVideoClick,
}) => {
  if (!videos || videos.length === 0) return null;

  // Duplicate items twice to guarantee seamless infinite loop
  const duplicatedVideos = [...videos, ...videos, ...videos];

  const trackClass =
    direction === "left"
      ? speed === "fast"
        ? "marquee-left-fast"
        : "marquee-left-track"
      : speed === "fast"
      ? "marquee-right-fast"
      : "marquee-right-track";

  return (
    <div className="marquee-row relative w-full overflow-hidden py-1.5 cursor-grab active:cursor-grabbing select-none">
      <div className={trackClass}>
        {duplicatedVideos.map((video, idx) => (
          <div
            key={`${video.id}-${idx}`}
            onClick={() => onVideoClick?.(video)}
            className={`inline-block ${cardWidth} shrink-0 mx-2 group/card cursor-pointer transition-transform duration-300 hover:scale-[1.03] hover:z-20`}
          >
            <div className="relative rounded-2xl bg-[#161616] border border-[#262626] group-hover/card:border-neutral-400/50 shadow-lg group-hover/card:shadow-2xl overflow-hidden transition-all duration-300">
              {/* 16:9 Image Area */}
              <div className="relative aspect-video w-full bg-[#111] overflow-hidden">
                <img
                  src={video.thumbnailUrl}
                  alt={video.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />

                {/* Top Badges */}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-black/75 backdrop-blur text-[9px] font-bold text-white border border-white/10 uppercase tracking-wider">
                    {video.niche}
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
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur text-[10px] font-medium text-neutral-300 border border-white/10 font-mono">
                    {video.duration}
                  </div>
                )}
              </div>

              {/* Title & Creator bar */}
              <div className="p-3 bg-[#141414]">
                <p className="text-xs font-semibold text-white line-clamp-1 group-hover/card:text-[#d1fe17] transition-colors">
                  {video.title}
                </p>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-neutral-400">
                  <img
                    src={video.creator.avatarUrl}
                    alt={video.creator.name}
                    className="w-3.5 h-3.5 rounded-full object-cover"
                  />
                  <span>{video.creator.name}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
