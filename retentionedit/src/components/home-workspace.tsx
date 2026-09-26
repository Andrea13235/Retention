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
  Mic,
  AudioLines,
  FileText,
  ChevronRight,
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

interface HomeWorkspaceProps {
  onStartJob: (params: JobRequest) => void;
  loading: boolean;
  initialUrl?: string;
  onOpenPricing?: () => void;
  onViewAllProjects?: () => void;
  onOpenJob?: (jobId: string) => void;
}

/**
 * Authentic OpusClip dashboard hero.
 *
 * - One big pill (760px x 60px) whose content is the two upload sources:
 *   [folder-icon] Upload   [drive-logo] Google Drive
 *   ("or Try a sample project?" underneath, exactly like the reference).
 * - No typed link input anywhere: the user always loads the video to edit
 *   via file picker or Google Drive.
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
}: HomeWorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const driveInputRef = useRef<HTMLInputElement>(null);
  const [selectedName, setSelectedName] = useState<string>(initialUrl);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [voiceoverOpen, setVoiceoverOpen] = useState(false);
  const [voiceoverText, setVoiceoverText] = useState("");
  const [projects, setProjects] = useState<ProjectEntry[]>(() =>
    typeof window === "undefined" ? [] : loadProjectEntries()
  );

  React.useEffect(() => {
    setProjects(loadProjectEntries());
    return subscribeProjectsChanged(() => setProjects(loadProjectEntries()));
  }, []);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setSelectedFile(file);
    setSelectedName(file.name);
  };

  const handleDriveFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    // Drive import = same local bytes; title cleaned like a Drive file name.
    setSelectedFile(file);
    setSelectedName(file.name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = selectedFile;
    // Upload path: prova R2 presigned (zero egress), fallback a /api/upload locale, fallback a blob sicuro
    let objectUrl = "/videos/raw-vlog.mp4";
    let duration = 38;
    let uploadedFile: File | null = null;
    let r2Key: string | null = null;
    if (file) {
      // Proba durata reale del file video direttamente nel browser
      try {
        const probed = await new Promise<number>((resolve) => {
          const v = document.createElement("video");
          v.preload = "metadata";
          const tempUrl = URL.createObjectURL(file);
          v.onloadedmetadata = () => {
            const d = Math.round(v.duration);
            URL.revokeObjectURL(tempUrl);
            resolve(Number.isFinite(d) && d > 0 ? d : 38);
          };
          v.onerror = () => {
            URL.revokeObjectURL(tempUrl);
            resolve(38);
          };
          v.src = tempUrl;
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
              "x-retentionedit-session": "active",
            },
            body: JSON.stringify({
              filename: file.name,
              bytes: file.size,
              contentType: file.type || "video/mp4",
              userId: "anon",
              plan: "free",
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
              "x-retentionedit-session": "active",
            },
            body: JSON.stringify({ r2Key: presigned.key, userId: "anon", bytes: file.size, kind: "raw" }),
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
            headers: { "x-retentionedit-session": "active" },
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
          objectUrl = URL.createObjectURL(file);
          uploadedFile = file;
        }
      }
    }
    const baseName = file
      ? file.name.replace(/\.[^/.]+$/, "")
      : selectedName || "Quanto fattura Ruzza? Il 2026";
    onStartJob({
      title: baseName,
      rawVideoUrl: objectUrl,
      format: "short",
      genaiTier: "balanced",
      duration,
      file: uploadedFile,
      ...(r2Key ? { r2Key } : {}),
      ...(voiceoverText.trim() ? { voiceoverText: voiceoverText.trim().slice(0, 900) } : {}),
    });
  };

  const handleClearCover = async (project: ProjectEntry) => {
    await deleteProject(project.id);
    setProjects(loadProjectEntries());
  };

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
      {/* 2. THE BIG UPLOAD PILL HERO (DESKTOP PROPORTIONS: 760px x 60px)           */}
      {/*    Inside the pill: Upload + Google Drive (like the reference crop).      */}
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

            {/* Google Drive source */}
            <button
              type="button"
              onClick={() => driveInputRef.current?.click()}
              className="flex items-center gap-2 hover:opacity-80 transition cursor-pointer bg-transparent border-0 text-white min-w-0"
              title="Import a video from Google Drive"
            >
              {/* Google Drive Official Icon */}
              <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 87.3 78" fill="none">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 10.15z" fill="#ea4335"/>
                <path d="M43.65 25 57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.4-4.5 1.2z" fill="#00832d"/>
                <path d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.4 4.5-1.2z" fill="#2684fc"/>
                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 59.8 53h27.5c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
              </svg>
              <span className="font-medium truncate">Google Drive</span>
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
          <input
            ref={driveInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => handleDriveFiles(e.target.files)}
          />

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="h-[44px] px-7 rounded-full bg-white hover:bg-zinc-100 active:scale-[0.98] text-black font-semibold text-[13px] shadow-md transition-all shrink-0 cursor-pointer disabled:opacity-50"
          >
            {loading ? "Editing..." : "Edit in one click"}
          </button>
        </form>

        {/* Sample project link — exactly like the reference photo */}
        <button
          type="button"
          onClick={() =>
            onStartJob({
              title: "Quanto fattura Ruzza? Il 2026",
              rawVideoUrl: "/videos/raw-vlog.mp4",
              format: "short",
              genaiTier: "balanced",
              duration: 38,
              file: null,
            })
          }
          className="mt-3 text-[13px] text-[#9A9AA0] hover:text-white transition cursor-pointer bg-transparent border-0"
        >
          or Try a sample project?
        </button>

        {/* Optional ElevenLabs hook voiceover (collapsed by default) */}
        <div className="w-full mt-3 rounded-2xl border border-[#303033] bg-[#1a1a1a]/60 overflow-hidden">
          <button
            type="button"
            onClick={() => setVoiceoverOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs sm:text-[13px] text-[#e2e3e7] font-medium hover:bg-[#232326] transition cursor-pointer bg-transparent border-0"
          >
            <span className="flex items-center gap-2">
              <Mic size={15} className="text-white" />
              <span>Voiceover hook (ElevenLabs, opzionale)</span>
            </span>
            <span className="text-[#8c8c90] text-xs">{voiceoverOpen ? "−" : "+"}</span>
          </button>
          {voiceoverOpen && (
            <div className="px-4 pb-3.5">
              <textarea
                value={voiceoverText}
                onChange={(e) => setVoiceoverText(e.target.value.slice(0, 900))}
                rows={2}
                placeholder="Scrivi l'hook da sintetizzare (es. «In 30 secondi ti mostro…»). Vuoto = nessun voiceover."
                className="w-full px-3 py-2.5 rounded-xl bg-[#0F0F0F] border border-[#303033] text-xs sm:text-[13px] text-white placeholder-[#5c5c62] focus:outline-none focus:border-white/25 resize-none"
              />
              <p className="text-[11px] text-[#8c8c90] mt-1.5">
                Richiede la chiave ElevenLabs in Settings → API Keys. Senza chiave, lo stage viene skippato.
              </p>
            </div>
          )}
        </div>
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

          {/* 3. Voiceover hook */}
          <button
            type="button"
            onClick={() => {}}
            className="flex items-center gap-2 px-3.5 rounded-full bg-[#1a1a1a] hover:bg-[#232326] border border-[#303033] text-xs sm:text-[13px] text-[#e2e3e7] font-medium transition cursor-pointer h-[34px]"
          >
            <Mic size={15} className="text-white" />
            <span>Voiceover hook</span>
          </button>

          {/* 4. Script to video (Beta) */}
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
            My projects
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

      {/* ========================================================================= */}
      {/* 5. WHAT'S NEW SECTION (DESKTOP PROPORTIONS)                               */}
      {/* ========================================================================= */}
      <section className="flex flex-col gap-2 mt-8 opacity-90">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-bold text-white">What&apos;s new</h2>
        </div>
      </section>
    </div>
  );
}

// Keep type imports referenced for external consumers.
export type { GenAITier, VideoFormat };
