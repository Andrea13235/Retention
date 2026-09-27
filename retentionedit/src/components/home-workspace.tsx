"use client";
import React, { useState } from "react";
import { Crown, ChevronRight, CheckCircle2 } from "lucide-react";
import { GenAITier, VideoFormat } from "@/lib/types";
import { JobRequest } from "@/lib/job-request";
import { ProjectCard } from "@/components/project-card";
import { ProcessingProjectCard } from "@/components/processing-project-card";
import { LocalRenderCard } from "@/components/local-render-card";
import {
  ProjectEntry,
  deleteProject,
  loadProjectEntries,
  subscribeProjectsChanged,
} from "@/lib/projects-store";
import { useAuth } from "@/context/auth-context";

interface HomeWorkspaceProps {
  onStartJob?: (params: JobRequest) => void;
  loading?: boolean;
  initialUrl?: string;
  onOpenPricing?: () => void;
  onViewAllProjects?: () => void;
  onOpenJob?: (jobId: string) => void;
}

/**
 * Authentic OpusClip dashboard hero.
 *
 * - One big pill (720px x 56px): the REAL edit engine (LocalRenderCard).
 *   [folder-icon] Upload → Muse STT → silence cuts → MP4 download.
 * - No typed link input anywhere: the user always loads the video to edit
 *   via file picker.
 * - My projects: the user's edited videos with their covers already set,
 *   in large 3-column demo proportions like the reference photo.
 */
export function HomeWorkspace({
  onOpenPricing,
  onViewAllProjects,
  onOpenJob,
}: HomeWorkspaceProps) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectEntry[]>(() =>
    typeof window === "undefined" ? [] : loadProjectEntries(user?.id)
  );
  const [submittedToast, setSubmittedToast] = useState(false);

  React.useEffect(() => {
    if (!submittedToast) return;
    const t = setTimeout(() => setSubmittedToast(false), 6000);
    return () => clearTimeout(t);
  }, [submittedToast]);

  React.useEffect(() => {
    setProjects(loadProjectEntries(user?.id));
    return subscribeProjectsChanged(() => setProjects(loadProjectEntries(user?.id)));
  }, [user?.id]);

  const handleClearCover = async (project: ProjectEntry) => {
    await deleteProject(project.id);
    setProjects(loadProjectEntries());
  };

  return (
    <div className="flex flex-col text-[#f4f4f6]">
      {/* Top Notification Banner: Project submitted successfully! (Matching OpusClip screenshot) */}
      {submittedToast && (
        <div className="fixed top-4 sm:top-5 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto select-none">
          <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-[#242427] border border-[#3a3a3e] text-xs sm:text-sm text-[#f4f4f6] shadow-2xl backdrop-blur-md">
            <CheckCircle2 size={16} className="text-emerald-400 fill-emerald-400/20 shrink-0" />
            <span className="font-medium tracking-tight">Project submitted successfully!</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. UPGRADE WATERMARK BANNER (DESKTOP PROPORTIONS)                          */}
      {/* ========================================================================= */}
      <div className="flex justify-center mt-3">
        <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-xl border border-[#2c2d33] bg-[#1a1a1a] text-xs sm:text-sm shadow-sm">
          <Crown size={14} className="text-[#ffc241] fill-[#ffc241] shrink-0" />
          <span className="text-[#e2e3e7] text-xs sm:text-[13px] font-medium">
            Unlock watermark-free exports and make your content look pro.
          </span>
          <button
            type="button"
            onClick={onOpenPricing}
            className="ml-1 px-3 py-1 rounded-lg bg-[#27272a] hover:bg-[#343438] text-white font-semibold text-xs transition cursor-pointer"
          >
            Upgrade
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. REAL EDIT ENGINE — unica barra upload (pill 720px x 56px, stile OpusClip) */}
      {/* ========================================================================= */}
      <div className="w-full max-w-[720px] mx-auto flex flex-col items-center mt-10">
        <LocalRenderCard />
      </div>

      {/* ========================================================================= */}
      {/* 4. MY PROJECTS — USER'S EDITED VIDEOS WITH COVERS (DEMO PROPORTIONS)      */}
      {/*    Large cards in a 3-column grid, like the OpusClip reference photo.     */}
      {/* ========================================================================= */}
      <section className="flex flex-col gap-3 mt-10">
        <div className="flex items-center gap-2">
          <h2 className="text-sm sm:text-base font-medium text-[#8c8c90]">
            Recent projects
          </h2>
          {onViewAllProjects && projects.length > 0 && (
            <button
              type="button"
              onClick={onViewAllProjects}
              className="text-xs sm:text-sm text-[#8c8c90] hover:text-white transition flex items-center gap-0.5 cursor-pointer bg-transparent border-0"
            >
              <span>View all</span>
              <ChevronRight size={14} />
            </button>
          )}
        </div>

        {projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-6">
            {projects.slice(0, 6).map((project) =>
              project.status === "processing" ? (
                <ProcessingProjectCard key={project.id} project={project} />
              ) : (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClearCover={handleClearCover}
                  onOpen={onOpenJob ? () => onOpenJob(project.id) : undefined}
                />
              )
            )}
          </div>
        ) : (
          <p className="text-xs text-[#8c8c90]">
            No edited videos yet — upload your first video above.
          </p>
        )}
      </section>

    </div>
  );
}

// Keep type imports referenced for external consumers.
export type { GenAITier, VideoFormat };
