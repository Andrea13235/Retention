"use client";

import React, { useEffect, useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import { ProjectEntry, getProjectVideoUrl } from "@/lib/projects-store";
import { ProjectMenu } from "./project-menu";

interface ProjectCardProps {
  project: ProjectEntry;
  onClearCover?: (project: ProjectEntry) => void;
  onOpen?: () => void;
}

function formatProjectDate(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

/**
 * One project card in OpusClip demo proportions: large 16:9 cover
 * (aspect-video inside a 3-column grid), title + "{clips} clips" meta
 * + "Try it" CTA on hover/focus, centered like the reference photo.
 */
export function ProjectCard({ project, onClearCover, onOpen }: ProjectCardProps) {
  const [liveUrl, setLiveUrl] = useState<string | null>(
    project.coverUrl && project.coverUrl.length > 0 ? null : project.videoUrl || null
  );
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (project.coverUrl && project.coverUrl.length > 0) {
      setLiveUrl(null);
      setExpired(false);
      return;
    }
    setExpired(false);
    getProjectVideoUrl(project)
      .then((url) => {
        if (!cancelled) {
          if (url) setLiveUrl(url);
          else setExpired(true);
        }
      })
      .catch(() => {
        if (!cancelled) setExpired(true);
      });
    return () => {
      cancelled = true;
    };
  }, [project]);

  const hasCover = project.coverUrl && project.coverUrl.length > 0;

  return (
    <article className="group w-full cursor-pointer" onClick={onOpen} role={onOpen ? "button" : undefined} tabIndex={onOpen ? 0 : undefined} onKeyDown={onOpen ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } } : undefined}>
      {/* Cover */}
      <div className="relative aspect-video rounded-xl overflow-hidden bg-[#202022] ring-1 ring-white/5 group-hover:ring-white/15 transition">
        {hasCover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.coverUrl}
            alt={project.title}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition duration-200"
          />
        ) : liveUrl ? (
          <video
            src={liveUrl}
            muted
            playsInline
            preload="metadata"
            className="w-full h-full object-cover"
            onError={() => {
              setExpired(true);
            }}
          />
        ) : expired ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-center bg-gradient-to-tr from-[#202022] via-[#232326] to-[#1a1b22]">
            <RotateCcw size={18} className="text-[#8c8c90]" />
            <p className="text-[11px] text-[#8c8c90] font-medium">
              Session expired — re-upload to preview again
            </p>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/images/hero-preview.png"
            alt={project.title}
            className="w-full h-full object-cover"
          />
        )}

        {/* "Try it" CTA — like Opus demo cards in the reference photo */}
        <button
          type="button"
          className="absolute bottom-2.5 right-2.5 px-3.5 py-1.5 rounded-full bg-white text-black text-xs font-semibold shadow-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 transition hover:bg-slate-100 cursor-pointer"
        >
          Try it
        </button>
      </div>

      {/* Meta */}
      <div className="pt-3 px-0.5 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white truncate leading-snug">
            {project.title}
          </h3>
          <p className="text-xs text-[#8c8c90] mt-1">
            {project.clipsCount} clips | {formatProjectDate(project.createdAt)}
          </p>
          {onClearCover && expired && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClearCover(project);
              }}
              className="mt-1 text-[11px] text-[#8c8c90] hover:text-white underline underline-offset-2 cursor-pointer bg-transparent border-0 p-0"
            >
              Remove expired entry
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!hasCover && liveUrl && (
            <span className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition">
              <Play size={13} className="ml-0.5" fill="currentColor" />
            </span>
          )}
          <ProjectMenu project={project} onClearCover={onClearCover} />
        </div>
      </div>
    </article>
  );
}
