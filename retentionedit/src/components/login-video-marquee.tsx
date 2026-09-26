"use client";

import React, { useState } from "react";
import {
  FAMOUS_ROW_1_VIDEOS,
  FAMOUS_ROW_2_VIDEOS,
  VideoReference,
} from "@/data/videos";

interface VideoCardProps {
  video: VideoReference;
}

const VideoCard: React.FC<VideoCardProps> = ({ video }) => {
  const [imgSrc, setImgSrc] = useState(
    `https://img.youtube.com/vi/${video.youtubeId}/maxresdefault.jpg`
  );

  return (
    <a
      href={`https://www.youtube.com/watch?v=${video.youtubeId}`}
      target="_blank"
      rel="noopener noreferrer"
      title={`Guarda su YouTube: ${video.title}`}
      className="group relative inline-block shrink-0 mx-2.5 sm:mx-3 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-2xl"
    >
      <div className="relative w-[300px] sm:w-[340px] md:w-[370px] lg:w-[400px] xl:w-[420px] aspect-[16/9] rounded-2xl overflow-hidden bg-[#121319] border border-[#232534] shadow-xl shadow-black/80 transition-transform duration-300 group-hover:scale-[1.03] group-hover:border-white/50 group-hover:shadow-2xl">
        <img
          src={imgSrc}
          alt=""
          loading="eager"
          onError={() => {
            // Fallback cleanly to standard definition thumbnail if maxres is unavailable
            setImgSrc(`https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg`);
          }}
          className="w-full h-full object-contain block select-none"
        />

        {/* Subtle dark gradient overlay on hover only */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        {/* Subtle YouTube Play button indicator on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <div className="w-11 h-11 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-xl backdrop-blur-sm transform scale-90 group-hover:scale-100 transition-transform duration-300">
            <svg
              className="w-4 h-4 fill-current ml-0.5"
              viewBox="0 0 24 24"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        </div>
      </div>
    </a>
  );
};

interface MarqueeRowProps {
  videos: VideoReference[];
  direction: "left" | "right";
  speedClass?: string;
}

const MarqueeRow: React.FC<MarqueeRowProps> = ({
  videos,
  direction,
  speedClass,
}) => {
  // Duplicate once for exact 50% translation infinite seamless loop
  const duplicated = [...videos, ...videos];

  const animationClass =
    direction === "left"
      ? "animate-marquee-scroll-left"
      : "animate-marquee-scroll-right";

  return (
    <div className="relative w-full overflow-hidden py-2 select-none">
      <div className={`${animationClass} ${speedClass || ""}`}>
        {duplicated.map((video, idx) => (
          <VideoCard key={`${video.youtubeId}-${idx}`} video={video} />
        ))}
      </div>
    </div>
  );
};

export const LoginVideoMarquee: React.FC = () => {
  return (
    <div className="relative w-full h-full flex flex-col justify-center gap-6 sm:gap-8 px-2 py-8 bg-[#0a0a0d] overflow-hidden">
      {/* Edge gradient fades ONLY on left and right edges horizontally */}
      <div className="pointer-events-none absolute left-0 inset-y-0 w-16 sm:w-24 bg-gradient-to-r from-[#09090c] via-[#09090c]/80 to-transparent z-10" />
      <div className="pointer-events-none absolute right-0 inset-y-0 w-16 sm:w-24 bg-gradient-to-l from-[#09090c] via-[#09090c]/80 to-transparent z-10" />

      {/* Row 1: Right to Left ("da destra verso sinistra") - 24 UNIQUE FAMOUS VIDEOS */}
      <MarqueeRow videos={FAMOUS_ROW_1_VIDEOS} direction="left" />

      {/* Row 2: Left to Right ("da sinistra verso destra") - 23 UNIQUE FAMOUS VIDEOS */}
      <MarqueeRow videos={FAMOUS_ROW_2_VIDEOS} direction="right" />
    </div>
  );
};
