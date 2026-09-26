"use client";
import React from "react";
import { CheckCircle2, CircleDashed, AlertCircle, Terminal, Layers } from "lucide-react";
import { PipelineJob, StageId } from "@/lib/types";

interface PipelineTrackerProps {
  job: PipelineJob;
}

export function PipelineTracker({ job }: PipelineTrackerProps) {
  const STAGE_ORDER: StageId[] = [
    "ingest",
    "transcribe",
    "analyze",
    "retentionvolt",
    "plan",
    "voiceover",
    "render",
    "verify",
  ];

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header Info */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Autonomous Pipeline Running
          </span>
          <h2 className="text-xl font-bold text-white mt-1">{job.title || "Untitled edit"}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Format: <strong className="text-slate-200">{(job.format || "9:16").toUpperCase()}</strong> &bull; Tier:{" "}
            <strong className="text-slate-200">{(job.genaiTier || "balanced").toUpperCase()}</strong> &bull; Raw duration: ~{job.rawDuration ?? 0}s
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300">
          <Layers size={14} className="text-indigo-400" />
          <span>Stage <strong>{Math.max(1, STAGE_ORDER.indexOf(job.currentStage as StageId) + 1)}</strong> of 8</span>
        </div>
      </div>

      {/* Sequential Stages Grid */}
      <div className="space-y-3">
        {STAGE_ORDER.map((stageId, idx) => {
          const stage = job.stages?.[stageId] || {
            id: stageId,
            label: stageId,
            description: "",
            state: "pending",
            progress: 0,
          };
          const isDone = stage.state === "completed";
          const isRunning = stage.state === "running";
          const isFailed = stage.state === "failed";

          return (
            <div
              key={stageId}
              className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                isRunning
                  ? "border-emerald-500/60 bg-emerald-500/10 shadow-lg shadow-emerald-500/5"
                  : isDone
                  ? "border-slate-800 bg-slate-900/40 opacity-90"
                  : isFailed
                  ? "border-red-500/50 bg-red-500/10"
                  : "border-slate-800/40 bg-slate-950/20 opacity-40"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs">
                  {isDone ? (
                    <CheckCircle2 size={20} className="text-emerald-400" />
                  ) : isRunning ? (
                    <CircleDashed size={20} className="text-emerald-400 animate-spin" />
                  ) : isFailed ? (
                    <AlertCircle size={20} className="text-red-400" />
                  ) : (
                    <span className="text-slate-600">0{idx + 1}</span>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">{stage.label}</h3>
                    {isRunning && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
                        In Progress
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{stage.description}</p>
                </div>
              </div>

              {/* Progress percentage */}
              <div className="text-right">
                <span className={`text-xs font-mono font-medium ${isDone ? "text-emerald-400" : isRunning ? "text-white" : "text-slate-600"}`}>
                  {isDone ? "100%" : isRunning ? `${stage.progress}%` : "Pending"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Terminal Log Stream */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="bg-slate-900/80 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-emerald-400" />
            <span className="font-mono text-slate-300">Autonomous Orchestrator Log Stream</span>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        <div className="p-4 font-mono text-xs text-slate-300 space-y-1.5 max-h-48 overflow-y-auto">
          {(job.logs || []).map((log, index) => (
            <div key={index} className="leading-relaxed">
              <span className="text-emerald-400/90">&gt;</span> {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
