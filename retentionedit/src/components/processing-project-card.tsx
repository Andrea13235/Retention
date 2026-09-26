"use client";

import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ProjectEntry } from "@/lib/projects-store";
import { computeEta, formatEta } from "@/lib/eta";

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
      hasVoiceover: project.hasVoiceover ?? false,
      startedAt: project.createdAt,
    })
  );

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/pipeline/status?jobId=${project.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setEta(
          computeEta({
            currentStage: String(data.currentStage || "ingest"),
            stages: data.stages || {},
            rawDuration: project.rawDuration ?? 38,
            hasVoiceover: project.hasVoiceover ?? false,
            startedAt: project.createdAt,
          })
        );
      } catch {
        // poll fallito → tiene l'ultima ETA
      }
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [project.id, project.createdAt, project.rawDuration, project.hasVoiceover]);

  return (
    <article className="group w-full">
      {/* Cover animata */}
      <div className="relative aspect-video rounded-xl overflow-hidden bg-[#202022] ring-1 ring-white/10">
        {/* Shimmer di base */}
        <div className="absolute inset-0 processing-shimmer" />
        {/* Velo scuro + contenuto */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 p-4 text-center bg-black/45">
          <span className="relative flex items-center justify-center">
            <span className="absolute w-11 h-11 rounded-full bg-white/10 animate-ping" />
            <span className="relative w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow-lg">
              <Loader2 size={20} className="animate-spin" />
            </span>
          </span>
          <p className="text-[13px] font-semibold text-white">Editing in corso…</p>
          <p className="text-[11px] text-[#c9c9cf] font-mono">
            ~{formatEta(eta.remainingSec)} rimanenti
            <span className="text-[#8c8c90]"> · {eta.pct}%</span>
          </p>
          {/* Progress bar */}
          <div className="w-3/4 max-w-[220px] h-1.5 rounded-full bg-white/15 overflow-hidden">
            <div
              className="h-full rounded-full bg-white transition-all duration-700"
              style={{ width: `${eta.pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Meta */}
      <div className="pt-3 px-0.5">
        <h3 className="text-sm font-semibold text-white truncate leading-snug">
          {project.title}
        </h3>
        <p className="text-xs text-[#8c8c90] mt-1">
          Elaborazione · tempo stimato {formatEta(eta.totalSec)}
        </p>
      </div>
    </article>
  );
}
