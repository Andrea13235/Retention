"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ProjectEntry } from "@/lib/projects-store";
import { computeEta, estimateTotalSeconds } from "@/lib/eta";
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

/**
 * Card "uploading" ISTANTANEA — nasce al click su "Edit in one click",
 * PRIMA di qualsiasi upload/rete/backend:
 * 1. Sfondo NERO puro con animazione di caricamento (shimmer + anello conico rotante).
 * 2. Badge "New" verde lime in alto a destra (come foto OpusClip).
 * 3. Pill centrale: "Caricamento {pct}%" durante l'upload chunked.
 * 4. Sotto: titolo + "Upload in corso {pct}% · tempo stimato {ETA}" + data.
 *
 * Sull'animazione: NIENTE chiamata Higgsfield per il loading — SOUL impiega ~40s
 * a generare un'immagine mentre la card deve apparire in <100ms. L'animazione è
 * CSS pura (shimmer + conic ring), istantanea e a costo zero. Higgsfield resta
 * dove conta: B-roll illimitati nel pipeline + cover finale ad-hoc.
 *
 * Quando l'upload finisce, il parent la promuove a "processing" (stessa card,
 * stesso id → ProcessingProjectCard) via updateProject — MAI duplicare.
 */
export function UploadingProjectCard({ project }: { project: ProjectEntry }) {
  return (
    <article className="group w-full">
      {/* Cover: NERO puro + animazione */}
      <div className="relative aspect-video rounded-xl overflow-hidden bg-black ring-1 ring-white/10">
        {/* Shimmer che attraversa lo sfondo nero */}
        <div className="absolute inset-0 processing-shimmer" />
        {/* Anello conico rotante al centro */}
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
              <span>Caricamento {Math.min(99, Math.max(0, project.uploadPct ?? 0))}% (ETA {formatEtaShort(estimateTotalSeconds(project.rawDuration ?? 38))})</span>
            </div>
          </div>
        </div>

        {/* Top-right "New" lime badge */}
        <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-[#84cc16] text-black text-[11px] font-bold shadow-md select-none">
          New
        </span>
      </div>

      {/* Meta underneath: title + upload in corso + data */}
      <div className="pt-3 px-0.5 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white truncate leading-snug">
            {project.title}
          </h3>
          <p className="text-xs text-[#8c8c90] mt-1 font-normal">
            Upload in corso {Math.min(99, Math.max(0, project.uploadPct ?? 0))}% · tempo stimato {formatEtaShort(estimateTotalSeconds(project.rawDuration ?? 38))}
          </p>
          <p className="text-[11px] text-[#6b6b70] mt-0.5 font-normal">
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

/**
 * Card "in lavorazione" — layout ESATTO della foto OpusClip:
 * 1. Cover 16:9 (frame reale del video appena caricato, oscurata).
 * 2. Badge "New" verde lime in alto a destra.
 * 3. Pill centrale scura: spinner verde + "{pct}% (ETA {tempo})".
 * 4. Sotto: titolo + "Tempo medio di editing {medio} · ETA {rimanente}" + data.
 *
 * Tempo MEDIO di editing (sopra, fisso): stima calibrata sui run reali in
 * funzione della durata RAW — non si muove durante il poll, serve da
 * riferimento ("quanto ci mette di solito"). ETA live (sotto, nel pill):
 * residuo reale calcolato dallo stage corrente via computeEta.
 * A fine lavoro il parent chiude la card in "ready" (cover ad-hoc + titolo
 * YouTube) — MAI cancellarla: l'utente deve vedere il risultato.
 */
export function ProcessingProjectCard({ project }: { project: ProjectEntry }) {
  // Tempo MEDIO di editing: stima calibrata sui run reali per questa durata
  // RAW — fisso per tutta la lavorazione, è il riferimento "di solito".
  const avgSec = estimateTotalSeconds(project.rawDuration ?? 38);
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
          // 404 = il job non è ancora visibile a questo worker (serverless:
          // il poll può atterrare su un'istanza diversa) oppure è scaduto.
          // MAI cancellare in fretta: aspetta ~2 min prima di mollare, e solo
          // se il progetto è vecchio (evita di buttare job appena partiti).
          if (failCount >= 100 && Date.now() - project.createdAt > 120_000) {
            cancelled = true;
            const { deleteProject } = await import("@/lib/projects-store");
            try { await deleteProject(project.id); } catch {}
            return;
          }
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        failCount = 0;

        if (data.currentStage === "error") {
          // Errore server: NON cancellare — l'utente deve vedere il fallimento
          // (la card resta con s% finali, il parent mostra l'errore nel log).
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
            // SOLO video reale: renderedVideoUrl dal server (MP4 Modal GPU) oppure
            // blob montato col piano reale. NIENTE più filtri kling/raw-vlog/final-horizontal
            // (file demo rimossi) e NIENTE più fallback hero-preview come video.
            const rawCover = fullJob?.thumbnailUrl || fullJob?.coverUrl || data.thumbnailUrl || existing.coverUrl;
            const isDeadCover = !rawCover || rawCover.includes("ruzza");
            const finalCover = !isDeadCover
              ? rawCover
              : (existing.coverUrl || "/images/hero-preview.png");

            // Check if user uploaded a real video file stored in IndexedDB
            const userBlob = await getProjectBlob(project.id).catch(() => null);
            let finalVideo = "";
            if (userBlob) {
              // Montaggio reale del video editato: baked col piano REALE del server.
              // NIENTE piano finto (niente tagli/zoom hardcoded 6.5s): se non c'è
              // un editPlan reale, resta il raw — mai inventare tagli.
              let baked = await getProjectBlob(`${project.id}_rendered`).catch(() => null);
              if (!baked || baked.size === 0) {
                const realPlan = fullJob?.editPlan || existing.editPlan;
                if (realPlan?.cuts?.length || realPlan?.zooms?.length) {
                  try {
                    const { bakeEditedVideo } = await import("@/lib/video-baker");
                    baked = await bakeEditedVideo(project.id, userBlob, realPlan, {
                      format: project.format,
                    });
                  } catch (bakeErr) {
                    console.warn("[baker] Direct render error in card:", bakeErr);
                  }
                }
              }

              if (baked && baked.size > 0) {
                finalVideo = URL.createObjectURL(baked);
              } else {
                finalVideo = existing.videoUrl || URL.createObjectURL(userBlob);
              }
            } else {
              // SOLO video reale dal server (MP4 montato) — niente fallback inventati.
              const rawVid =
                fullJob?.renderedVideoUrl ||
                fullJob?.finalVideoUrl ||
                data.renderedVideoUrl ||
                existing.videoUrl;
              const isDeadVid =
                !rawVid ||
                rawVid.includes("cloudflarestorage.com") ||
                rawVid.includes("your_");
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
      {/* Cover: SFONDO NERO + animazione (niente frame finto, niente hero-preview).
          Il video reale appare SOLO a editing completato (status ready). */}
      <div className="relative aspect-video rounded-xl overflow-hidden bg-black ring-1 ring-white/10 group">
        {/* Shimmer che attraversa lo sfondo nero */}
        <div className="absolute inset-0 processing-shimmer" />
        {/* Anello conico rotante + % centrale */}
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
                  {eta.pct}%
                </span>
              </div>
            </div>
            <div className="px-3.5 py-1.5 rounded-full bg-black/75 backdrop-blur-md border border-white/10 flex items-center gap-2 text-xs font-semibold text-emerald-400 shadow-xl">
              <Loader2 size={13} className="animate-spin text-emerald-400" />
              <span>{eta.pct}% (ETA {formatEtaShort(eta.remainingSec || 660)})</span>
            </div>
          </div>
        </div>

        {/* Top-right "New" lime badge */}
        <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-[#84cc16] text-black text-[11px] font-bold shadow-md select-none">
          New
        </span>
      </div>

      {/* Meta underneath: title + tempo medio editing + ETA + date */}
      <div className="pt-3 px-0.5 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white truncate leading-snug">
            {project.title}
          </h3>
          <p className="text-xs text-[#8c8c90] mt-1 font-normal">
            Tempo medio di editing {formatEtaShort(avgSec)} · ETA {formatEtaShort(eta.remainingSec || 660)}
          </p>
          <p className="text-[11px] text-[#6b6b70] mt-0.5 font-normal">
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
