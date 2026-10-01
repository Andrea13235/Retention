"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ProjectEntry } from "@/lib/projects-store";
import { ProjectMenu } from "./project-menu";

function formatProjectDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

function formatEtaShort(sec: number): string {
  const s = Math.max(1, Math.round(sec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m}m` : `${m}m ${r}s`;
}

const REAL_STAGE_LABEL: Record<string, string> = {
  upload: "⬆ Caricamento…",
  transcribe: "🎙 Trascrizione audio reale…",
  cuts: "✂ Taglio silenzi reali…",
  render: "🎬 Render frame-per-frame…",
  done: "✅ Pronto",
  error: "⚠ Errore",
};

/**
 * Card "uploading" ISTANTANEA — nasce al click su "Edit in one click",
 * PRIMA di qualsiasi rete. L'animazione (shimmer + conic ring) sta DENTRO
 * il riquadro video: quando finisce, al suo posto appare il video vero.
 * Nessun banner "%" fuori dalla card.
 */
export function UploadingProjectCard({ project }: { project: ProjectEntry }) {
  return (
    <article className="group w-full">
      <div className="relative aspect-video rounded-xl overflow-hidden bg-black ring-1 ring-white/10">
        <div className="absolute inset-0 processing-shimmer" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-14 h-14">
              <div
                className="absolute inset-0 rounded-full animate-spin"
                style={{
                  background:
                    "conic-gradient(from 0deg, transparent 0deg, #34d399 120deg, #a3e635 200deg, transparent 280deg)",
                  WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 5px), black calc(100% - 4px))",
                  mask: "radial-gradient(farthest-side, transparent calc(100% - 5px), black calc(100% - 4px))",
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-white tabular-nums">
                  {Math.min(99, Math.max(0, project.uploadPct ?? 0))}%
                </span>
              </div>
            </div>
            <div className="px-3.5 py-1.5 rounded-full bg-black/75 backdrop-blur-md border border-white/10 flex items-center gap-2 text-xs font-semibold text-emerald-400 shadow-xl">
              <Loader2 size={13} className="animate-spin text-emerald-400" />
              <span>Caricamento {Math.min(99, Math.max(0, project.uploadPct ?? 0))}%</span>
            </div>
          </div>
        </div>
        <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-[#84cc16] text-black text-[11px] font-bold shadow-md select-none">
          New
        </span>
      </div>
      <div className="pt-3 px-0.5 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white truncate leading-snug">{project.title}</h3>
          <p className="text-xs text-[#8c8c90] mt-1 font-normal">Upload in corso {Math.min(99, Math.max(0, project.uploadPct ?? 0))}%</p>
          <p className="text-[11px] text-[#6b6b70] mt-0.5 font-normal">{formatProjectDate(project.createdAt)}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <ProjectMenu project={project} />
        </div>
      </div>
    </article>
  );
}

/**
 * Card "in lavorazione" — montaggio REALE, per frame.
 *
 * Driver: il MOTORE REALE (local-render). L'animazione (anello + % + stage)
 * sta DENTRO il riquadro video — nessuna % fuori dalla card. Quando il
 * server passa a "done", la card diventa "ready" col video vero, titolo
 * YouTube e cover Higgsfield soffiarta in IDB.
 *
 * Non si auto-cancella mai: resta finché il server non torna done/error.
 * Se il componente si rimonta (reload), riprende dal progress già salvato
 * sul job R2 grazie a renderJobId.
 */
export function ProcessingProjectCard({ project }: { project: ProjectEntry }) {
  const [liveStage, setLiveStage] = useState<string>(project.status === "processing" ? "transcribe" : "ingest");
  const [liveError, setLiveError] = useState<string | null>(null);
  const [pct, setPct] = useState<number>(() => {
    if (project.status === "uploading") return Math.min(99, Math.max(0, project.uploadPct ?? 5));
    return 12;
  });

  useEffect(() => {
    let cancelled = false;
    // jobId REALE su R2: renderJobId se presente, altrimenti project.id (legacy)
    const jobId = project.renderJobId || project.id;
    const cardId = project.id;
    const tick = async () => {
      try {
        const res = await fetch(`/api/local-render/status?jobId=${encodeURIComponent(jobId)}`, {
          headers: { "x-retentionedit-session": "active" },
        });
        if (!res.ok) {
          // 404 = job non ancora visibile su questa istanza serverless, oppure
          // id legacy del pipeline finto (mai esistito su local-render).
          // Non cancellare: l'animazione continua finché il job reale non appare.
          // Solo dopo molti minuti senza mai apparire, mostra un errore soft.
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (data.stage === "error") {
          const msg = (data.error || (Array.isArray(data.log) && data.log.length > 0 ? String(data.log[data.log.length - 1]) : "Editing interrotto — riprova.")).slice(0, 160);
          setLiveError(msg);
          setLiveStage("error");
          // Non auto-cancellare: l'utente deve vedere l'errore e poter riprovare.
          // La promozione a "ready" fallita resta visibile (titolo con ⚠ gestito dal chiamante).
          return;
        }
        const stage = String(data.stage || "transcribe");
        setLiveStage(stage);
        setLiveError(null);
        const p = Number(data.progress);
        if (Number.isFinite(p)) setPct(Math.min(99, Math.max(0, Math.round(p))));

        if (data.stage === "done") {
          cancelled = true;
          try {
            const { upsertProject, loadProjectEntries, getProjectBlob, putProjectBlob } = await import("@/lib/projects-store");
            const existing = loadProjectEntries().find((p) => p.id === cardId) || project;
            // Titolo YouTube + cover Higgsfield dal server (job.done li ha già).
            const finalTitle = (data.title as string) || existing.title;
            const rawCover = (data.youtubeCoverUrl as string) || (data.coverUrl as string) || existing.coverUrl || "";
            const finalCover = rawCover && !rawCover.includes("ruzza") ? rawCover : existing.coverUrl || "";
            // MP4: scarica il blob reale e salvalo in IDB per la card giocabile.
            let finalVideo = existing.videoUrl || "";
            try {
              const dl = data.downloadUrl as string | null;
              if (dl) {
                const r = await fetch(dl, { headers: { "x-retentionedit-session": "active" } });
                if (r.ok) {
                  const blob = await r.blob();
                  if (blob && blob.size > 2048) {
                    await putProjectBlob(`${cardId}_rendered`, blob);
                    finalVideo = URL.createObjectURL(blob);
                  }
                }
              }
              // Cover Higgsfield in IDB (reload-safe).
              const yc = data.youtubeCoverUrl as string | null;
              if (yc) {
                const rc = await fetch(yc, { headers: { "x-retentionedit-session": "active" } });
                if (rc.ok) {
                  const cb = await rc.blob();
                  if (cb && cb.size > 2048) await putProjectBlob(`${cardId}_cover`, cb);
                }
              } else if (rawCover) {
                // Fallback: scarica la cover frame se non c'è Higgsfield
                try {
                  const rc2 = await fetch(rawCover);
                  if (rc2.ok) {
                    const cb2 = await rc2.blob();
                    if (cb2 && cb2.size > 2048) await putProjectBlob(`${cardId}_cover`, cb2);
                  }
                } catch {}
              }
            } catch {}
            if (!finalVideo) {
              const b = await getProjectBlob(`${cardId}_rendered`).catch(() => null);
              if (b && b.size > 0) finalVideo = URL.createObjectURL(b);
              else {
                const raw = await getProjectBlob(cardId).catch(() => null);
                if (raw) finalVideo = URL.createObjectURL(raw);
              }
            }
            await upsertProject(
              {
                ...existing,
                title: finalTitle,
                coverUrl: finalCover,
                videoUrl: finalVideo,
                clipsCount: Number(data.cutsCount) || existing.clipsCount || 1,
                status: "ready",
                renderJobId: jobId,
              },
              null
            );
          } catch {
            try {
              const { upsertProject, loadProjectEntries } = await import("@/lib/projects-store");
              const existing = loadProjectEntries().find((p) => p.id === cardId) || project;
              await upsertProject({ ...existing, status: "ready", renderJobId: jobId }, null);
            } catch {}
          }
          return;
        }
      } catch {
        // poll failed, keep last state
      }
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [project.id, project.createdAt, project.title, project.coverUrl, project.videoUrl]);

  const stageLabel = REAL_STAGE_LABEL[liveStage] || `⚙ ${liveStage}…`;

  return (
    <article className="group w-full">
      <div className="relative aspect-video rounded-xl overflow-hidden bg-black ring-1 ring-white/10 group">
        <div className="absolute inset-0 processing-shimmer" />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-14 h-14">
              <div
                className="absolute inset-0 rounded-full animate-spin"
                style={{
                  background:
                    "conic-gradient(from 0deg, transparent 0deg, #34d399 120deg, #a3e635 200deg, transparent 280deg)",
                  WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 5px), black calc(100% - 4px))",
                  mask: "radial-gradient(farthest-side, transparent calc(100% - 5px), black calc(100% - 4px))",
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-bold text-white tabular-nums">{pct}%</span>
              </div>
            </div>
            <div className="px-3.5 py-1.5 rounded-full bg-black/75 backdrop-blur-md border border-white/10 flex items-center gap-2 text-xs font-semibold text-emerald-400 shadow-xl">
              <Loader2 size={13} className="animate-spin text-emerald-400" />
              <span>{pct}%</span>
            </div>
          </div>
        </div>
        <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-[#84cc16] text-black text-[11px] font-bold shadow-md select-none">
          New
        </span>
      </div>
      <div className="pt-3 px-0.5 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white truncate leading-snug">{project.title}</h3>
          <p className="text-[11px] mt-1 font-medium">
            {liveError ? <span className="text-red-400">⚠ {liveError}</span> : <span className="text-emerald-400/90">{stageLabel}</span>}
          </p>
          <p className="text-[11px] text-[#6b6b70] mt-0.5 font-normal">{formatProjectDate(project.createdAt)}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <ProjectMenu project={project} />
        </div>
      </div>
    </article>
  );
}
