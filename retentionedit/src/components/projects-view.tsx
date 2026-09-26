"use client";
import React, { useEffect, useState } from "react";
import {
  Plus,
  Crown,
  Heart,
} from "lucide-react";
import { ProjectCard } from "@/components/project-card";
import { ProcessingProjectCard } from "@/components/processing-project-card";
import {
  ProjectEntry,
  deleteProject,
  loadProjectEntries,
  subscribeProjectsChanged,
} from "@/lib/projects-store";

interface ProjectsViewProps {
  onNewEdit: () => void;
  onOpenPricing?: () => void;
  onOpenJob?: (jobId: string) => void;
}

/**
 * My Projects tab in OpusClip proportions.
 *
 * - Collections row stays compact (244px x 58px like the reference).
 * - Project cards are LARGE (3-column demo grid, aspect-video covers),
 *   exactly like the demo cards in the dashboard reference photo.
 * - Lists the user's edited videos with covers already set; entries
 *   persist in localStorage (+ IndexedDB for upload bytes).
 */
export function ProjectsView({ onNewEdit, onOpenPricing, onOpenJob }: ProjectsViewProps) {
  const [activeTab, setActiveTab] = useState<"all" | "collections" | "projects">("all");
  const [autoSave, setAutoSave] = useState(true);
  const [autoImport, setAutoImport] = useState(false);
  const [projects, setProjects] = useState<ProjectEntry[]>(() =>
    typeof window === "undefined" ? [] : loadProjectEntries()
  );

  useEffect(() => {
    setProjects(loadProjectEntries());
    return subscribeProjectsChanged(() => setProjects(loadProjectEntries()));
  }, []);

  const handleClearCover = async (project: ProjectEntry) => {
    await deleteProject(project.id);
    setProjects(loadProjectEntries());
  };

  const projectsLabel = `Projects (${projects.length})`;

  return (
    <div className="flex flex-col text-[#f4f4f6]">
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
      {/* 2. TITLE & SUB-TABS (DESKTOP PROPORTIONS)                                 */}
      {/* ========================================================================= */}
      <div className="mt-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">My projects</h1>

        {/* Sub-tabs: All, Collections, Projects */}
        <div className="flex items-center gap-6 mt-4 border-b border-[#262629] text-xs sm:text-sm font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`pb-3 transition relative cursor-pointer ${
              activeTab === "all" ? "text-white" : "text-[#8c8c90] hover:text-white"
            }`}
          >
            <span>All</span>
            {activeTab === "all" && (
              <span className="absolute bottom-0 inset-x-0 h-[2.5px] bg-white rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("collections")}
            className={`pb-3 transition relative cursor-pointer ${
              activeTab === "collections" ? "text-white" : "text-[#8c8c90] hover:text-white"
            }`}
          >
            <span>Collections (1)</span>
            {activeTab === "collections" && (
              <span className="absolute bottom-0 inset-x-0 h-[2.5px] bg-white rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("projects")}
            className={`pb-3 transition relative cursor-pointer ${
              activeTab === "projects" ? "text-white" : "text-[#8c8c90] hover:text-white"
            }`}
          >
            <span>{projectsLabel}</span>
            {activeTab === "projects" && (
              <span className="absolute bottom-0 inset-x-0 h-[2.5px] bg-white rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. COLLECTIONS ROW (EXACT OPUSCLIP PROPORTIONS: 244px x 58px)             */}
      {/* ========================================================================= */}
      {(activeTab === "all" || activeTab === "collections") && (
        <section className="flex flex-col mt-8">
          <h2 className="text-xs sm:text-sm text-[#8c8c90] font-medium mb-3">Collections</h2>

          <div className="flex flex-wrap items-center gap-4">
            {/* Add new collection button 👑 */}
            <button
              type="button"
              onClick={onOpenPricing}
              className="w-[244px] h-[58px] rounded-xl border border-dashed border-[#3a3a3a] hover:border-zinc-500 bg-[#222222]/40 hover:bg-[#282828] flex items-center justify-between px-4 text-xs text-[#8c8c90] font-medium hover:text-white transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Plus size={15} />
                <span>Add new collection</span>
              </div>
              <Crown size={13} className="text-[#f59e0b] fill-[#f59e0b]" />
            </button>

            {/* Favorites Card */}
            <div className="w-[244px] h-[58px] rounded-xl bg-[#252525] hover:bg-[#2b2b2b] px-4 flex items-center gap-3 cursor-pointer transition">
              <div className="w-8 h-8 rounded-lg bg-transparent flex items-center justify-center text-white shrink-0">
                <Heart size={16} className="fill-white text-white" />
              </div>
              <div className="min-w-0">
                <strong className="text-xs sm:text-[13px] font-semibold text-white block leading-tight">
                  Favorites
                </strong>
                <span className="text-[11px] text-[#8c8c90] block mt-0.5">0 clips</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 4. PROJECTS GRID — LARGE DEMO-SIZE CARDS (like the reference photo)       */}
      {/* ========================================================================= */}
      {(activeTab === "all" || activeTab === "projects") && (
        <section className="flex flex-col mt-8">
          {/* Header row with storage & auto-save / auto-import toggles */}
          <div className="flex items-center justify-between text-xs mb-4">
            <h2 className="text-xs sm:text-sm text-[#8c8c90] font-medium">Projects</h2>

            <div className="flex items-center gap-5 text-xs text-[#8c8c90]">
              <span>0 GB / 0 GB</span>

              {/* Auto-save toggle */}
              <button
                type="button"
                onClick={() => setAutoSave(!autoSave)}
                className="flex items-center gap-1.5 hover:text-white transition cursor-pointer bg-transparent border-0"
              >
                <span
                  className={`w-2 h-2 rounded-full ${autoSave ? "bg-white" : "bg-zinc-600"}`}
                />
                <span>Auto-save</span>
              </button>

              {/* Auto-import Beta toggle */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAutoImport(!autoImport)}
                  className="flex items-center gap-1.5 hover:text-white transition cursor-pointer bg-transparent border-0"
                >
                  <span
                    className={`w-2 h-2 rounded-full ${autoImport ? "bg-white" : "bg-zinc-600"}`}
                  />
                  <span>Auto-import</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2c2d38] text-zinc-300">Beta</span>
                </button>
                <span className="absolute -top-0.5 -right-1 w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
              </div>
            </div>
          </div>

          {/* Large cards grid + dashed "new video" tile */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-6">
            {/* Upload New Video (dashed, demo-card height) */}
            <button
              type="button"
              onClick={onNewEdit}
              className="aspect-video rounded-xl border border-dashed border-[#3a3a3a] hover:border-zinc-500 bg-[#222222]/30 hover:bg-[#282828] flex flex-col items-center justify-center gap-2 text-xs text-[#8c8c90] font-medium hover:text-white transition cursor-pointer group"
            >
              <Plus size={22} className="text-[#8c8c90] group-hover:text-white transition" />
              <span>Upload new video</span>
            </button>

            {projects.map((project) =>
              project.status === "processing" ? (
                <ProcessingProjectCard key={project.id} project={project} />
              ) : (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClearCover={handleClearCover}
                  onOpen={() => onOpenJob?.(project.id)}
                />
              )
            )}
          </div>
        </section>
      )}
    </div>
  );
}
