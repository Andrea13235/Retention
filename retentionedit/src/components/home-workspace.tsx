"use client";
import React, { useRef, useState } from "react";
import {
  Folder,
  Crown,
  Scissors,
  Captions,
  Clapperboard,
  Video,
  Crop,
  Music,
  Maximize2,
  Languages,
  AudioLines,
  FileText,
  ChevronRight,
  Mic,
  CheckCircle2,
} from "lucide-react";
import { GenAITier, VideoFormat } from "@/lib/types";
import { JobRequest } from "@/lib/job-request";
import { ProjectCard } from "@/components/project-card";
import { ProcessingProjectCard } from "@/components/processing-project-card";
import {
  ProjectEntry,
  deleteProject,
  loadProjectEntries,
  subscribeProjectsChanged,
} from "@/lib/projects-store";
import { useAuth } from "@/context/auth-context";

interface HomeWorkspaceProps {
  onStartJob: (params: JobRequest) => void;
  loading: boolean;
  initialUrl?: string;
  onOpenPricing?: () => void;
  onViewAllProjects?: () => void;
  onOpenJob?: (jobId: string) => void;
  /** Motore reale: quando presente, l'upload usa /api/local-render invece del flusso demo. */
  realEdit?: (file: File, title: string) => Promise<void>;
  realEditBusy?: boolean;
  realEditStatus?: string | null;
  realEditError?: string | null;
}

/**
 * Authentic OpusClip dashboard hero.
 *
 * - One big pill (760px x 60px) whose content is the upload source:
 *   [folder-icon] Upload
 *   ("or Try a sample project?" underneath, exactly like the reference).
 * - No typed link input anywhere: the user always loads the video to edit
 *   via file picker.
 * - My projects: the user's edited videos with their covers already set,
 *   in large 3-column demo proportions like the reference photo.
 */
export function HomeWorkspace({
  onStartJob,
  loading,
  initialUrl = "",
  onOpenPricing,
  onViewAllProjects,
  onOpenJob,
  realEdit,
  realEditBusy,
  realEditStatus,
  realEditError,
}: HomeWorkspaceProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedName, setSelectedName] = useState<string>(initialUrl);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setSelectedFile(file);
    setSelectedName(file.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = selectedFile;
    if (!file && !selectedName) {
      alert("Trascina o seleziona un file video per iniziare.");
      return;
    }
    const baseName = file
      ? file.name.replace(/\.[^/.]+$/, "")
      : selectedName || "Creator Talking Head (9:16 Vertical)";

    // MOTORE REALE: upload → trascrizione → tagli → MP4 (stesso motore E2E).
    if (realEdit && file) {
      setSubmittedToast(true);
      await realEdit(file, baseName);
      return;
    }

    let objectUrl = "";
    let duration = 38;
    let uploadedFile: File | null = file || null;
    let r2Key: string | null = null;
    let generatedCover: string | null = null;

    if (file) {
      uploadedFile = file;
      const localBlob = URL.createObjectURL(file);

      // 1. Generate high-CTR YouTube thumbnail directly from real video frame
      try {
        const { captureVideoCover } = await import("@/lib/video-cover");
        generatedCover = await captureVideoCover(localBlob, 1.2, {
          title: baseName,
          badge: "VIRAL HOOK",
        });
      } catch {}

      // 2. Probe video duration
      try {
        const probed = await new Promise<number>((resolve) => {
          const v = document.createElement("video");
          v.preload = "metadata";
          v.onloadedmetadata = () => {
            const d = Math.round(v.duration);
            resolve(Number.isFinite(d) && d > 0 ? d : 38);
          };
          v.onerror = () => resolve(38);
          v.src = localBlob;
        });
        if (probed > 0) duration = probed;
      } catch {
        // keep default
      }

      const useR2 = async (): Promise<{ url: string; key: string; dur: number } | null> => {
        try {
          const presignRes = await fetch("/api/r2/presign", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(user?.id ? { "x-retentionedit-session": user.id } : {}),
            },
            body: JSON.stringify({
              filename: file.name,
              bytes: file.size,
              contentType: file.type || "video/mp4",
              plan: user?.plan || "free",
            }),
          });
          if (!presignRes.ok) return null;
          const presigned = (await presignRes.json()) as { url: string; key: string };
          const putRes = await fetch(presigned.url, {
            method: "PUT",
            headers: { "Content-Type": file.type || "video/mp4" },
            body: file,
          });
          if (!putRes.ok) return null;
          await fetch("/api/r2/confirm", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(user?.id ? { "x-retentionedit-session": user.id } : {}),
            },
            body: JSON.stringify({ r2Key: presigned.key, bytes: file.size, kind: "raw" }),
          }).catch(() => {});
          return { url: `r2://${presigned.key}`, key: presigned.key, dur: duration };
        } catch {
          return null;
        }
      };

      const r2 = await useR2();
      if (r2) {
        objectUrl = r2.url;
        r2Key = r2.key;
      } else {
        try {
          const form = new FormData();
          form.append("file", file);
          const res = await fetch("/api/upload", {
            method: "POST",
            headers: {
              ...(user?.id ? { "x-retentionedit-session": user.id } : {}),
            },
            body: form,
          });
          if (res.ok) {
            const data = await res.json();
            if (typeof data.rawVideoUrl === "string" && data.rawVideoUrl.length > 0) {
              objectUrl = data.rawVideoUrl as string;
              if (typeof data.duration === "number") duration = data.duration;
            } else {
              throw new Error("empty upload response");
            }
          } else {
            throw new Error("upload failed");
          }
        } catch {
          objectUrl = localBlob;
          uploadedFile = file;
        }
      }
    }

    setSubmittedToast(true);
    onStartJob({
      title: baseName,
      rawVideoUrl: objectUrl || (file ? URL.createObjectURL(file) : ""),
      format: "short",
      genaiTier: "balanced",
      duration,
      file: uploadedFile,
      coverUrl: generatedCover || undefined,
      ...(r2Key ? { r2Key } : {}),
    });
  };

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
      {/* 2. THE BIG UPLOAD PILL HERO (DESKTOP PROPORTIONS: 760px x 60px)           */}
      {/*    Inside the pill: Upload video file.                                    */}
      {/* ========================================================================= */}
      <div className="w-full max-w-[720px] mx-auto flex flex-col items-center mt-10">
        <form
          onSubmit={handleSubmit}
          className="w-full h-[56px] pl-5 pr-1.5 rounded-full bg-[#2B2B2E] flex items-center justify-between gap-3 shadow-lg border border-white/10 focus-within:border-white/15 transition"
        >
          <div className="flex items-center gap-7 flex-1 min-w-0 text-[14px] text-white">
            {/* Upload source */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 hover:opacity-80 transition cursor-pointer bg-transparent border-0 text-white min-w-0"
              title="Upload a video from your device"
            >
              <Folder size={18} className="text-[#38bdf8] fill-[#38bdf8] shrink-0" />
              <span className="font-medium truncate">
                {selectedFile ? selectedFile.name : "Upload"}
              </span>
            </button>
          </div>

          {/* Hidden pickers */}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || realEditBusy}
            className="h-[44px] px-7 rounded-full bg-white hover:bg-zinc-100 active:scale-[0.98] text-black font-semibold text-[13px] shadow-md transition-all shrink-0 cursor-pointer disabled:opacity-50"
          >
            {realEditBusy ? (realEditStatus || "Editing...") : loading ? "Editing..." : "Edit in one click"}
          </button>
        </form>

        {/* Stato motore reale: sempre visibile durante l'edit */}
        {realEdit && (realEditBusy || realEditStatus || realEditError) && (
          <div className="w-full mt-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3">
            <p className="text-xs font-semibold text-white flex items-center gap-2">
              {realEditBusy && (
                <span className="inline-block w-3 h-3 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
              )}
              {realEditError ? "Errore" : (realEditStatus || "Editing...")}
            </p>
            {realEditError && (
              <p className="mt-1 text-xs text-rose-400">{realEditError}</p>
            )}
          </div>
        )}

        {/* Sample project link — exactly like the reference photo */}
        <button
          type="button"
          onClick={() => {
            setSubmittedToast(true);
            onStartJob({
              title: "Creator Talking Head (9:16 Vertical)",
              rawVideoUrl: "/videos/kling-creator-9-16.mp4",
              format: "short",
              genaiTier: "balanced",
              duration: 38,
              file: null,
            });
          }}
          className="mt-3 text-[13px] text-[#9A9AA0] hover:text-white transition cursor-pointer bg-transparent border-0"
        >
          or Try a sample project?
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3. HORIZONTAL FEATURE PILLS (DESKTOP PROPORTIONS: h-[34px])               */}
      {/* ========================================================================= */}
      <div className="flex flex-col items-center gap-2 mx-auto mt-6">
        {/* ROW 1: 8 Items */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {/* 1. RAW to Perfect */}
          <div className="relative group">
            <button
              type="button"
              onClick={() => {}}
              className="flex items-center gap-2 px-3.5 rounded-full bg-[#1a1a1a] hover:bg-[#232326] border border-[#303033] text-xs sm:text-[13px] text-[#e2e3e7] font-medium transition cursor-pointer h-[34px]"
            >
              <span className="w-3.5 h-2.5 rounded-[2px] border border-white/60 bg-white/20" />
              <span>RAW to Perfect</span>
            </button>
            {/* Tooltip on hover */}
            <div className="absolute -top-9 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-white text-black text-xs font-semibold shadow-2xl opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-30">
              Trasforma video RAW grezzi in un video montato professionale.
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white" />
            </div>
          </div>

          {/* 2. Edit video */}
          <button
            type="button"
            onClick={() => {}}
            className="flex items-center gap-2 px-3.5 rounded-full bg-[#1a1a1a] hover:bg-[#232326] border border-[#303033] text-xs sm:text-[13px] text-[#e2e3e7] font-medium transition cursor-pointer h-[34px]"
          >
            <Scissors size={15} className="text-[#38bdf8]" />
            <span>Edit video</span>
          </button>

          {/* 3. AI Captions */}
          <button
            type="button"
            onClick={() => {}}
            className="flex items-center gap-2 px-3.5 rounded-full bg-[#1a1a1a] hover:bg-[#232326] border border-[#303033] text-xs sm:text-[13px] text-[#e2e3e7] font-medium transition cursor-pointer h-[34px]"
          >
            <Captions size={15} className="text-[#22d3ee]" />
            <span>AI Captions</span>
          </button>

          {/* 4. AI Producer (Beta) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {}}
              className="flex items-center gap-2 px-3.5 rounded-full bg-[#1a1a1a] hover:bg-[#232326] border border-[#303033] text-xs sm:text-[13px] text-[#e2e3e7] font-medium transition cursor-pointer h-[34px]"
            >
              <Clapperboard size={15} className="text-[#38bdf8]" />
              <span>AI Producer</span>
            </button>
            <span className="absolute -top-1.5 -right-1 text-[9px] font-semibold px-1 rounded-full bg-[#353538] text-[#a1a1aa] border border-[#27272a]">Beta</span>
          </div>

          {/* 5. AI B-Roll (red dot) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {}}
              className="flex items-center gap-2 px-3.5 rounded-full bg-[#1a1a1a] hover:bg-[#232326] border border-[#303033] text-xs sm:text-[13px] text-[#e2e3e7] font-medium transition cursor-pointer h-[34px]"
            >
              <Video size={15} className="text-[#06b6d4]" />
              <span>AI B-Roll</span>
            </button>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#ef4444]" />
          </div>

          {/* 6. AI Reframe */}
          <button
            type="button"
            onClick={() => {}}
            className="flex items-center gap-2 px-3.5 rounded-full bg-[#1a1a1a] hover:bg-[#232326] border border-[#303033] text-xs sm:text-[13px] text-[#e2e3e7] font-medium transition cursor-pointer h-[34px]"
          >
            <Crop size={15} className="text-[#0ea5e9]" />
            <span>AI Reframe</span>
          </button>

          {/* 7. Auto SFX (red dot) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {}}
              className="flex items-center gap-2 px-3.5 rounded-full bg-[#1a1a1a] hover:bg-[#232326] border border-[#303033] text-xs sm:text-[13px] text-[#e2e3e7] font-medium transition cursor-pointer h-[34px]"
            >
              <Music size={15} className="text-[#a855f7]" />
              <span>Auto SFX</span>
            </button>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#ef4444]" />
          </div>

          {/* 8. Upscale (red dot) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {}}
              className="flex items-center gap-2 px-3.5 rounded-full bg-[#1a1a1a] hover:bg-[#232326] border border-[#303033] text-xs sm:text-[13px] text-[#e2e3e7] font-medium transition cursor-pointer h-[34px]"
            >
              <Maximize2 size={15} className="text-[#8b5cf6]" />
              <span>Upscale</span>
            </button>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#ef4444]" />
          </div>
        </div>

        {/* ROW 2: 4 Items Centered */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {/* 1. Voice dubbing (red dot) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {}}
              className="flex items-center gap-2 px-3.5 rounded-full bg-[#1a1a1a] hover:bg-[#232326] border border-[#303033] text-xs sm:text-[13px] text-[#e2e3e7] font-medium transition cursor-pointer h-[34px]"
            >
              <Languages size={15} className="text-[#06b6d4]" />
              <span>Voice dubbing</span>
            </button>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#ef4444]" />
          </div>

          {/* 2. Enhance speech */}
          <button
            type="button"
            onClick={() => {}}
            className="flex items-center gap-2 px-3.5 rounded-full bg-[#1a1a1a] hover:bg-[#232326] border border-[#303033] text-xs sm:text-[13px] text-[#e2e3e7] font-medium transition cursor-pointer h-[34px]"
          >
            <AudioLines size={15} className="text-[#38bdf8]" />
            <span>Enhance speech</span>
          </button>

          {/* 3. Script to video (Beta) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {}}
              className="flex items-center gap-2 px-3.5 rounded-full bg-[#1a1a1a] hover:bg-[#232326] border border-[#303033] text-xs sm:text-[13px] text-[#e2e3e7] font-medium transition cursor-pointer h-[34px]"
            >
              <FileText size={15} className="text-[#0ea5e9]" />
              <span>Script to video</span>
            </button>
            <span className="absolute -top-1.5 -right-1 text-[9px] font-semibold px-1 rounded-full bg-[#353538] text-[#a1a1aa] border border-[#27272a]">Beta</span>
          </div>
        </div>
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
