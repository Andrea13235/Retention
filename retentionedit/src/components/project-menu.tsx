"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  MoreHorizontal,
  FolderPlus,
  Plus,
  Check,
  X,
} from "lucide-react";
import {
  ProjectEntry,
  deleteProject,
  updateProject,
  loadCollections,
  addCollection,
} from "@/lib/projects-store";
import {
  generateProjectSrt,
  generateProjectTranscript,
  triggerDownload,
} from "@/lib/project-export";
import { showToast } from "./toast-notification";

interface ProjectMenuProps {
  project: ProjectEntry;
  onClearCover?: (project: ProjectEntry) => void;
  onShowToast?: (message: string) => void;
}

export function ProjectMenu({ project, onClearCover, onShowToast }: ProjectMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpwards, setOpenUpwards] = useState(true);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      if (rect.top < 260 && window.innerHeight - rect.bottom > 260) {
        setOpenUpwards(false);
      } else {
        setOpenUpwards(true);
      }
    }
    setIsOpen((prev) => !prev);
  };

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setCollectionModalOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const notify = (msg: string) => {
    showToast(msg);
    if (onShowToast) {
      onShowToast(msg);
    }
  };

  // 1. SAVE TO STORAGE
  const handleSaveToStorage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    updateProject(project.id, { savedToStorage: true });
    notify("✓ Progetto salvato nello storage permanente (Cloudflare R2 & Archivio)");
  };

  // 2. SHARE PROJECT
  const handleShareProject = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const shareUrl = `${origin}/?jobId=${encodeURIComponent(project.id)}`;

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      }
      if (navigator.share && /mobile|android|iphone/i.test(navigator.userAgent)) {
        await navigator.share({
          title: project.title,
          text: `Guarda questo edit ad alta retention: ${project.title}`,
          url: shareUrl,
        }).catch(() => {});
      }
      notify("✓ Link del progetto copiato negli appunti!");
    } catch {
      notify("✓ Link generato: " + shareUrl);
    }
  };

  // 3. ADD TO A COLLECTION
  const handleOpenCollection = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    setCollectionModalOpen(true);
  };

  const handleSelectCollection = (colName: string) => {
    updateProject(project.id, { collection: colName });
    setCollectionModalOpen(false);
    notify(`✓ Progetto aggiunto a "${colName}"`);
  };

  const handleCreateCollection = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCollectionName.trim();
    if (!trimmed) return;
    addCollection(trimmed);
    updateProject(project.id, { collection: trimmed });
    setNewCollectionName("");
    setCollectionModalOpen(false);
    notify(`✓ Creata e aggiunta alla collezione "${trimmed}"`);
  };

  // 4. DOWNLOAD SUBTITLES (SRT)
  const handleDownloadSubtitles = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    try {
      // Try to fetch full pipeline result for maximum accuracy if job exists
      let fullJob = null;
      try {
        const r = await fetch(`/api/pipeline/result?jobId=${encodeURIComponent(project.id)}`);
        if (r.ok) fullJob = await r.json();
      } catch {}

      const srt = generateProjectSrt(project, fullJob);
      const cleanTitle = project.title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40) || "video";
      triggerDownload(`${cleanTitle}_subtitles.srt`, srt, "text/plain;charset=utf-8");
      notify("✓ Download sottotitoli (.SRT) avviato");
    } catch (err: any) {
      notify("Errore generazione sottotitoli: " + err.message);
    }
  };

  // 5. DOWNLOAD TRANSCRIPT (TXT)
  const handleDownloadTranscript = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    try {
      let fullJob = null;
      try {
        const r = await fetch(`/api/pipeline/result?jobId=${encodeURIComponent(project.id)}`);
        if (r.ok) fullJob = await r.json();
      } catch {}

      const txt = generateProjectTranscript(project, fullJob);
      const cleanTitle = project.title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40) || "video";
      triggerDownload(`${cleanTitle}_transcript.txt`, txt, "text/plain;charset=utf-8");
      notify("✓ Download trascrizione (.TXT) avviato");
    } catch (err: any) {
      notify("Errore generazione trascrizione: " + err.message);
    }
  };

  // 6. DOWNLOAD VIDEO (MP4) — Physically rendered with cuts, zooms, graphics, subtitles
  const handleDownloadVideo = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    try {
      const { getProjectBlob } = await import("@/lib/projects-store");
      const cleanTitle = project.title.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40) || "video";

      // 1. Check if physically rendered MP4 blob is already cached
      const renderedBlob = await getProjectBlob(`${project.id}_rendered`).catch(() => null);
      if (renderedBlob && renderedBlob.size > 0) {
        const url = URL.createObjectURL(renderedBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${cleanTitle}_retention_edit.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        notify("✓ Download video editato (.MP4) completato");
        return;
      }

      // 2. Otherwise get raw footage source
      const rawBlob = await getProjectBlob(project.id).catch(() => null);
      const source = rawBlob || project.videoUrl;

      if (!source) {
        notify("Nessun file video disponibile per il montaggio");
        return;
      }

      // If we have an editPlan, physically bake the video with cuts, zooms, graphics, and subtitles
      if (project.editPlan) {
        notify("⚡ Elaborazione video in corso: applicando tagli silenzi, punch zoom e sottotitoli...");
        const { bakeEditedVideo } = await import("@/lib/video-baker");
        const bakedBlob = await bakeEditedVideo(project.id, source, project.editPlan, {
          format: project.format,
          onProgress: (p) => {
            if (p.pct % 25 === 0 || p.pct === 100) {
              notify(`Rendering video MP4: ${p.pct}%`);
            }
          },
        });

        const url = URL.createObjectURL(bakedBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${cleanTitle}_retention_edit.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        notify("✓ Video editato (.MP4) scaricato con successo!");
        return;
      }

      // Fallback if no editPlan yet: download source
      if (rawBlob) {
        const url = URL.createObjectURL(rawBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${cleanTitle}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        notify("✓ Download video (.MP4) avviato");
        return;
      }

      if (project.videoUrl) {
        const a = document.createElement("a");
        a.href = project.videoUrl;
        a.download = `${cleanTitle}.mp4`;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        notify("✓ Download video (.MP4) avviato");
        return;
      }
      notify("Nessun file video disponibile per il download");
    } catch (err: any) {
      notify("Errore esportazione video: " + err.message);
    }
  };

  // 7. DELETE
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    await deleteProject(project.id);
    if (onClearCover) {
      onClearCover(project);
    }
    notify("Progetto eliminato");
  };

  const collections = loadCollections();

  return (
    <div className="relative inline-block" ref={menuRef} onClick={(e) => e.stopPropagation()}>
      {/* 3 Dots Trigger Button */}
      <button
        type="button"
        className={`text-[#8c8c90] hover:text-white p-1.5 rounded-lg transition bg-transparent border-0 cursor-pointer ${
          isOpen ? "text-white bg-white/10" : ""
        }`}
        title="Options"
        aria-label="Opzioni progetto"
        onClick={handleToggle}
      >
        <MoreHorizontal size={17} />
      </button>

      {/* Floating Menu Popover (Exact Match to User Screenshot) */}
      {isOpen && (
        <div
          role="menu"
          className={`absolute right-0 ${openUpwards ? "bottom-full mb-2" : "top-full mt-2"} w-[230px] rounded-2xl bg-[#24252a] border border-white/10 shadow-2xl shadow-black/80 p-1.5 backdrop-blur-xl z-50 text-[#f0f0f2] animate-in fade-in zoom-in-95 duration-100`}
          style={{ transformOrigin: openUpwards ? "bottom right" : "top right" }}
        >
          {/* 1. Save to storage */}
          <button
            type="button"
            role="menuitem"
            onClick={handleSaveToStorage}
            className="w-full text-left px-3.5 py-2.5 rounded-xl text-[14px] text-[#ededef] hover:bg-white/10 transition-colors flex items-center justify-between font-normal cursor-pointer bg-transparent border-0"
          >
            <span>Save to storage</span>
          </button>

          {/* 2. Share project */}
          <button
            type="button"
            role="menuitem"
            onClick={handleShareProject}
            className="w-full text-left px-3.5 py-2.5 rounded-xl text-[14px] text-[#ededef] hover:bg-white/10 transition-colors flex items-center justify-between font-normal cursor-pointer bg-transparent border-0"
          >
            <span>Share project</span>
          </button>

          {/* 3. Add to a collection */}
          <button
            type="button"
            role="menuitem"
            onClick={handleOpenCollection}
            className="w-full text-left px-3.5 py-2.5 rounded-xl text-[14px] text-[#ededef] hover:bg-white/10 transition-colors flex items-center justify-between font-normal cursor-pointer bg-transparent border-0"
          >
            <span>Add to a collection</span>
          </button>

          {/* 4. Download video MP4 */}
          <button
            type="button"
            role="menuitem"
            onClick={handleDownloadVideo}
            className="w-full text-left px-3.5 py-2.5 rounded-xl text-[14px] text-[#ededef] hover:bg-white/10 transition-colors flex items-center justify-between font-normal cursor-pointer bg-transparent border-0"
          >
            <span>Download video</span>
            <span className="text-xs font-semibold text-emerald-400 tracking-wider">MP4</span>
          </button>

          {/* 5. Download subtitles SRT */}
          <button
            type="button"
            role="menuitem"
            onClick={handleDownloadSubtitles}
            className="w-full text-left px-3.5 py-2.5 rounded-xl text-[14px] text-[#ededef] hover:bg-white/10 transition-colors flex items-center justify-between font-normal cursor-pointer bg-transparent border-0"
          >
            <span>Download subtitles</span>
            <span className="text-xs font-semibold text-[#8e9099] tracking-wider">SRT</span>
          </button>

          {/* 6. Download transcript TXT */}
          <button
            type="button"
            role="menuitem"
            onClick={handleDownloadTranscript}
            className="w-full text-left px-3.5 py-2.5 rounded-xl text-[14px] text-[#ededef] hover:bg-white/10 transition-colors flex items-center justify-between font-normal cursor-pointer bg-transparent border-0"
          >
            <span>Download transcript</span>
            <span className="text-xs font-semibold text-[#8e9099] tracking-wider">TXT</span>
          </button>

          {/* Divider */}
          <div className="my-1 border-t border-[#35363c]" />

          {/* 6. Delete */}
          <button
            type="button"
            role="menuitem"
            onClick={handleDelete}
            className="w-full text-left px-3.5 py-2.5 rounded-xl text-[14px] text-[#ededef] hover:bg-red-500/15 hover:text-red-300 transition-colors flex items-center justify-between font-normal cursor-pointer bg-transparent border-0"
          >
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* Add to Collection Modal */}
      {collectionModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            e.stopPropagation();
            setCollectionModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-[#202126] border border-white/10 p-5 shadow-2xl text-white space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FolderPlus size={18} className="text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">Add to a collection</h3>
              </div>
              <button
                type="button"
                onClick={() => setCollectionModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Existing Collections List */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {collections.map((col) => {
                const isSelected = project.collection === col;
                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => handleSelectCollection(col)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition cursor-pointer text-left ${
                      isSelected
                        ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/40"
                        : "bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 border border-transparent"
                    }`}
                  >
                    <span>{col}</span>
                    {isSelected && <Check size={15} className="text-indigo-400" />}
                  </button>
                );
              })}
            </div>

            {/* Create New Collection Form */}
            <form onSubmit={handleCreateCollection} className="pt-2 border-t border-white/10 flex gap-2">
              <input
                type="text"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="Nuova collezione..."
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!newCollectionName.trim()}
                className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-semibold text-white transition flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} /> Add
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
