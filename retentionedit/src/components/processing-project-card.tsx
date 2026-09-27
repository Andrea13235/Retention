"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ProjectEntry } from "@/lib/projects-store";
import { computeEta, formatEta } from "@/lib/eta";
import { ProjectMenu } from "./project-menu";

/**
 * Card "in lavorazione" per My Projects: mentre il job è attivo mostra
 * una bella animazione di caricamento (shimmer + spinner + progress bar)
 * con stima accurata del tempo residuo (ETA adattiva, ricalcolata via poll).
 *
 * Quando il job finisce, il parent la sostituisce con la ProjectCard normale.
 */
export function ProcessingProjectCard({ project }: { project: ProjectEntry }) {
  const [eta, setEta] = useState(() =>
    computeEta({
      currentStage: "ingest",
      stages: {},
      rawDuration: project.rawDuration ?? 38,
      startedAt: project.createdAt,
    })
  );

  useEffect(() => {
    let cancelled = false;
    let failCount = 0;
    const tick = async () => {
      try {
        const res = await fetch(`/api/pipeline/status?jobId=${encodeURIComponent(project.id)}`, {
          headers: { "x-retentionedit-session": "active" },
        });
        if (!res.ok) {
          failCount++;
          // Only cancel if repeated severe failures (at least 15 polls = >20s of errors)
          if (failCount >= 15) {
            cancelled = true;
            const { deleteProject } = await import("@/lib/projects-store");
            await deleteProject(project.id);
            return;
          }
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        failCount = 0;

        if (data.currentStage === "error") {
          cancelled = true;
          // Errored job: remove bugged project so it doesn't spin forever
          const { deleteProject } = await import("@/lib/projects-store");
          await deleteProject(project.id);
          return;
        }

        if (data.currentStage === "done") {
          cancelled = true;
          try {
            const resResult = await fetch(`/api/pipeline/result?jobId=${encodeURIComponent(project.id)}`, {
              headers: { "x-retentionedit-session": "active" },
            });
            const fullJob = resResult.ok ? await resResult.json() : null;
            const { upsertProject, loadProjectEntries } = await import("@/lib/projects-store");
            const existing = loadProjectEntries().find((p) => p.id === project.id) || project;
            const finalTitle = fullJob?.title || data.title || existing.title;
            const rawCover = fullJob?.thumbnailUrl || fullJob?.coverUrl || data.thumbnailUrl || existing.coverUrl;
            const isDeadCover = !rawCover || rawCover.includes("r2.retentionedit.com") || rawCover.includes("ruzza");
            const finalCover = !isDeadCover ? rawCover : (project.format === "short" ? "/videos/raw-vlog.jpg" : "/images/hero-preview.png");

            const rawVid = fullJob?.renderedVideoUrl || fullJob?.finalVideoUrl || data.renderedVideoUrl || existing.videoUrl;
            const isDeadVid = !rawVid || rawVid.includes("r2.retentionedit.com") || rawVid.includes("your_");
            const finalVideo = !isDeadVid ? rawVid : (project.format === "short" ? "/videos/raw-vlog.mp4" : "/videos/final-horizontal.mp4");

            await upsertProject({
              ...existing,
              title: finalTitle,
              coverUrl: finalCover,
              videoUrl: finalVideo,
              clipsCount: fullJob?.stats?.cutsCount || 1,
              status: "ready",
            }, null);
          } catch {
            const { upsertProject, loadProjectEntries } = await import("@/lib/projects-store");
            const existing = loadProjectEntries().find((p) => p.id === project.id) || project;
            await upsertProject({
              ...existing,
              status: "ready",
            }, null);
          }
          return;
        }

        setEta(
          computeEta({
            currentStage: String(data.currentStage || "ingest"),
            stages: data.stages || {},
            rawDuration: project.rawDuration ?? 38,
            startedAt: project.createdAt,
          })
        );
      } catch {
        // poll failed, keep last ETA
      }
    };
    tick();
    const id = setInterval(tick, 1200);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [project.id, project.createdAt, project.rawDuration, project.format, project.title, project.coverUrl, project.videoUrl]);

  return (
    <article className="group w-full">
      {/* Cover animata */}
      <div className="relative aspect-video rounded-xl overflow-hidden bg-[#202022] ring-1 ring-white/10">
        {/* Background preview cover if available */}
        {project.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.coverUrl}
            alt={project.title}
            className="absolute inset-0 w-full h-full object-cover filter brightness-50"
          />
        ) : null}
        {/* Shimmer di base */}
        <div className="absolute inset-0 processing-shimmer" />
        {/* Velo scuro + contenuto */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center bg-black/65 backdrop-blur-[2px]">
          <span className="relative flex items-center justify-center">
            <span className="absolute w-12 h-12 rounded-full bg-emerald-500/20 animate-ping" />
            <span className="relative w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow-xl">
              <Loader2 size={22} className="animate-spin text-black" />
            </span>
          </span>
          <div>
            <p className="text-[13px] font-bold text-white tracking-wide">
              Editing in corso…
            </p>
            {/* Pillola percentuale + tempo rimanente */}
            <div className="mt-1.5 inline-flex items-center gap-2 text-xs text-white font-mono bg-white/10 px-3 py-1 rounded-full border border-white/15 shadow-sm">
              <span className="font-bold text-emerald-400">{eta.pct}%</span>
              <span className="text-white/40">&bull;</span>
              <span className="text-[#e2e3e7]">~{formatEta(eta.remainingSec)} rimanenti</span>
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-4/5 max-w-[240px] h-2 rounded-full bg-white/15 overflow-hidden p-[1px] shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-300 to-white transition-all duration-700 shadow-sm"
              style={{ width: `${Math.max(4, eta.pct)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="pt-3 px-0.5 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white truncate leading-snug">
            {project.title}
          </h3>
          <p className="text-xs text-[#8c8c90] mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="truncate">Elaborazione in corso &bull; tempo stimato: {formatEta(eta.totalSec)}</span>
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <ProjectMenu project={project} />
        </div>
      </div>
    </article>
  );
}
