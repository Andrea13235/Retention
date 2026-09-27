"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ProjectEntry } from "@/lib/projects-store";
import { computeEta } from "@/lib/eta";
import { ProjectMenu } from "./project-menu";

function formatProjectDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

function formatEtaShort(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.round(s / 60);
  return m <= 0 ? "1m" : `${m}m`;
}

/**
 * ProcessingProjectCard
 *
 * Matches the exact card layout from the OpusClip screenshot:
 * 1. 16:9 thumbnail cover preview.
 * 2. Top-right: Lime green "New" pill badge.
 * 3. Center: Dark translucent pill with green spinner and "{pct}% (ETA {eta}m)".
 * 4. Underneath: Title and date (e.g. 2026.9.27).
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
            const { upsertProject, loadProjectEntries, getProjectBlob } = await import("@/lib/projects-store");
            const existing = loadProjectEntries().find((p) => p.id === project.id) || project;
            const finalTitle = fullJob?.title || data.title || existing.title;
            const rawCover = fullJob?.thumbnailUrl || fullJob?.coverUrl || data.thumbnailUrl || existing.coverUrl;
            const isDeadCover = !rawCover || rawCover.includes("r2.retentionedit.com") || rawCover.includes("ruzza") || rawCover.includes("raw-vlog");
            const finalCover = !isDeadCover
              ? rawCover
              : (existing.coverUrl && !existing.coverUrl.includes("raw-vlog")
                ? existing.coverUrl
                : "/images/hero-preview.png");

            // Check if user uploaded a real video file stored in IndexedDB
            const userBlob = await getProjectBlob(project.id).catch(() => null);
            let finalVideo = "";
            if (userBlob) {
              // Ensure video is baked before setting status to ready!
              let baked = await getProjectBlob(`${project.id}_rendered`).catch(() => null);
              if (!baked || baked.size === 0) {
                try {
                  const { bakeEditedVideo } = await import("@/lib/video-baker");
                  const effectivePlan = fullJob?.editPlan || existing.editPlan || {
                    format: project.format || "short",
                    source_duration: project.rawDuration || 35,
                    target_duration: project.rawDuration || 35,
                    cuts: [{ start: 6.5, end: 7.1, keep: false }, { start: 14.8, end: 15.5, keep: false }],
                    zooms: [
                      { time: 1.0, type: "zoom_punch", scale: 1.18, duration: 0.8 },
                      { time: 4.2, type: "slow_zoom", scale: 1.14, duration: 1.5 },
                      { time: 7.4, type: "zoom_punch", scale: 1.18, duration: 0.8 },
                      { time: 10.6, type: "slow_zoom", scale: 1.14, duration: 1.5 },
                      { time: 13.8, type: "zoom_punch", scale: 1.18, duration: 0.8 },
                    ],
                  };
                  baked = await bakeEditedVideo(project.id, userBlob, effectivePlan, {
                    format: project.format,
                  });
                } catch (bakeErr) {
                  console.warn("[baker] Direct render error in card:", bakeErr);
                }
              }

              if (baked && baked.size > 0) {
                finalVideo = URL.createObjectURL(baked);
              } else {
                finalVideo = existing.videoUrl || URL.createObjectURL(userBlob);
              }
            } else {
              const rawVid =
                fullJob?.renderedVideoUrl ||
                fullJob?.finalVideoUrl ||
                data.renderedVideoUrl ||
                existing.videoUrl;
              const isDeadVid =
                !rawVid ||
                rawVid.includes("r2.retentionedit.com") ||
                rawVid.includes("cloudflarestorage.com") ||
                rawVid.includes("your_") ||
                rawVid.includes("kling") ||
                rawVid.includes("raw-vlog") ||
                rawVid.includes("final-horizontal");
              finalVideo = !isDeadVid ? rawVid : "";
            }

            await upsertProject(
              {
                ...existing,
                title: finalTitle,
                coverUrl: finalCover,
                videoUrl: finalVideo,
                clipsCount: fullJob?.stats?.cutsCount || 1,
                status: "ready",
                editPlan: fullJob?.editPlan || existing.editPlan,
              },
              null
            );
          } catch {
            const { upsertProject, loadProjectEntries } = await import("@/lib/projects-store");
            const existing = loadProjectEntries().find((p) => p.id === project.id) || project;
            await upsertProject(
              {
                ...existing,
                status: "ready",
              },
              null
            );
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
  }, [
    project.id,
    project.createdAt,
    project.rawDuration,
    project.format,
    project.title,
    project.coverUrl,
    project.videoUrl,
  ]);

  return (
    <article className="group w-full">
      {/* Cover container matching OpusClip card in screenshot */}
      <div className="relative aspect-video rounded-xl overflow-hidden bg-[#202022] ring-1 ring-white/10 group">
        {/* Background preview cover */}
        {project.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.coverUrl}
            alt={project.title}
            className="w-full h-full object-cover filter brightness-[0.7]"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/images/hero-preview.png"
            alt={project.title}
            className="w-full h-full object-cover filter brightness-[0.7]"
          />
        )}

        {/* Top-right "New" lime badge */}
        <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-[#84cc16] text-black text-[11px] font-bold shadow-md select-none">
          New
        </span>

        {/* Center pill: spinner + 0% (ETA 11m) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="px-3.5 py-1.5 rounded-full bg-black/75 backdrop-blur-md border border-white/10 flex items-center gap-2 text-xs font-semibold text-emerald-400 shadow-xl">
            <Loader2 size={13} className="animate-spin text-emerald-400" />
            <span>{eta.pct}% (ETA {formatEtaShort(eta.remainingSec || 660)})</span>
          </div>
        </div>
      </div>

      {/* Meta underneath: title + date */}
      <div className="pt-3 px-0.5 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white truncate leading-snug">
            {project.title}
          </h3>
          <p className="text-xs text-[#8c8c90] mt-1 font-normal">
            {formatProjectDate(project.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <ProjectMenu project={project} />
        </div>
      </div>
    </article>
  );
}
