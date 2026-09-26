"use client";
import React from "react";
import { TrendingUp, Scissors, Clock, Zap, ShieldCheck } from "lucide-react";
import { PipelineJob } from "@/lib/types";

interface RetentionMetricsProps {
  job: PipelineJob;
}

export function RetentionMetrics({ job }: RetentionMetricsProps) {
  const stats = job.stats || {
    cutsCount: 6,
    timeSavedSec: 14.5,
    retentionScore: 94,
    brollCount: job.genaiTier === "eco" ? 0 : 2,
    zoomCount: 5,
  };

  return (
    <div className="space-y-6">
      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Retention Boost</span>
            <TrendingUp size={16} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">+{stats.retentionScore - 50}%</div>
          <p className="text-[11px] text-slate-400 mt-1">Vs raw footage benchmark</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Cuts Applied</span>
            <Scissors size={16} className="text-indigo-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{stats.cutsCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">Dead air & filler eliminations</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Time Trimmed</span>
            <Clock size={16} className="text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">-{stats.timeSavedSec}s</div>
          <p className="text-[11px] text-slate-400 mt-1">Zero dead air or slow spots</p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pattern Interrupts</span>
            <Zap size={16} className="text-violet-400" />
          </div>
          <div className="text-2xl font-extrabold text-white">{stats.zoomCount + stats.brollCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">{stats.zoomCount} zooms & {stats.brollCount} 2.5D Cutaways</p>
        </div>
      </div>

      {/* Predictive Audience Retention Curve Comparison */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp size={16} className="text-emerald-400" />
              Audience Watch-Time Prediction (Retention Curve)
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Based on {job.blueprint?.title || "Native Retention Pacing Engine"}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-2.5 h-1 rounded-full bg-emerald-400" /> RetentionEdit
            </span>
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2.5 h-1 rounded-full bg-slate-600" /> Unedited RAW
            </span>
          </div>
        </div>

        {/* CSS Retention Graph Simulation */}
        <div className="h-32 w-full pt-4 flex items-end gap-1.5 border-b border-slate-800 pb-2">
          {[
            { raw: 100, edit: 100 },
            { raw: 68, edit: 96 },
            { raw: 54, edit: 94 },
            { raw: 42, edit: 91 },
            { raw: 38, edit: 89 },
            { raw: 32, edit: 88 },
            { raw: 28, edit: 85 },
            { raw: 24, edit: 84 },
            { raw: 22, edit: 82 },
            { raw: 18, edit: 81 },
            { raw: 15, edit: 80 },
            { raw: 12, edit: 79 },
          ].map((point, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full gap-1 group relative">
              {/* Tooltip */}
              <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-950 border border-slate-800 px-2 py-1 rounded text-[10px] text-white whitespace-nowrap z-20 pointer-events-none">
                RetentionEdit: {point.edit}% &bull; Raw: {point.raw}%
              </div>
              <div
                style={{ height: `${point.edit}%` }}
                className="w-full bg-gradient-to-t from-emerald-500/80 to-emerald-400 rounded-t-sm shadow-sm shadow-emerald-500/20"
              />
              <div
                style={{ height: `${point.raw}%` }}
                className="w-full bg-slate-700/50 rounded-t-sm"
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>00:00 (Hook)</span>
          <span>Mid-point</span>
          <span>End (CTA)</span>
        </div>
      </div>
    </div>
  );
}
