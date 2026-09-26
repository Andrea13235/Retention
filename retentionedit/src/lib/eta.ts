/**
 * Stima accurata del tempo di editing (ETA) per i job RetentionEdit.
 *
 * Modello: ogni stage ha un peso calibrato su run reali + una componente
 * proporzionale alla durata del video (transcribe/render scalano coi secondi).
 * L'ETA residua si ricalcola a ogni poll: trascorsi reali sugli stage
 * completati + stima sugli stage restanti (adattiva alla durata del job).
 */

export type EtaStageId =
  | "ingest"
  | "transcribe"
  | "analyze"
  | "retentionvolt"
  | "plan"
  | "render"
  | "verify";

export const ETA_STAGE_ORDER: EtaStageId[] = [
  "ingest",
  "transcribe",
  "analyze",
  "retentionvolt",
  "plan",
  "render",
  "verify",
];

/** Costo base per stage (secondi, misurato su run reali). */
const BASE_SEC: Record<EtaStageId, number> = {
  ingest: 2,
  transcribe: 4,
  analyze: 2,
  retentionvolt: 1,
  plan: 5,
  render: 8,
  verify: 2,
};

/** Extra secondi per secondo di video (stage che scalano con la durata). */
const PER_SEC: Record<EtaStageId, number> = {
  ingest: 0.02,
  transcribe: 0.08,
  analyze: 0.02,
  retentionvolt: 0,
  plan: 0.04,
  render: 0.15,
  verify: 0.01,
};

export function estimateStageSeconds(stage: EtaStageId, rawDurationSec: number): number {
  const d = Math.max(1, rawDurationSec || 38);
  return BASE_SEC[stage] + PER_SEC[stage] * d;
}

export function estimateTotalSeconds(rawDurationSec: number): number {
  return ETA_STAGE_ORDER.reduce((acc, s) => {
    return acc + estimateStageSeconds(s, rawDurationSec);
  }, 0);
}

export interface JobProgressSnapshot {
  currentStage: string;
  stages: Record<string, { state: string; progress: number }>;
  rawDuration?: number;
  hasVoiceover?: boolean;
  startedAt?: number;
}

/**
 * Ritorna { elapsedSec, remainingSec, totalSec, pct } per la card in lavorazione.
 * - `pct`: avanzamento 0–100 pesato sui costi stimati (non conta stage).
 * - `remainingSec`: residuo adattivo (se il run reale è più lento, cresce).
 */
export function computeEta(snap: JobProgressSnapshot, nowMs = Date.now()): {
  elapsedSec: number;
  remainingSec: number;
  totalSec: number;
  pct: number;
} {
  const rawDuration = snap.rawDuration ?? 38;
  const costs = ETA_STAGE_ORDER.map((s) => estimateStageSeconds(s, rawDuration));
  const totalSec = Math.max(1, costs.reduce((a, b) => a + b, 0));

  let doneCost = 0;
  let runningFraction = 0;
  ETA_STAGE_ORDER.forEach((s, i) => {
    const st = snap.stages?.[s];
    if (!st) return;
    if (st.state === "completed") doneCost += costs[i];
    else if (st.state === "running") {
      const p = Math.min(100, Math.max(0, st.progress || 0)) / 100;
      runningFraction = costs[i] * p;
    }
  });

  if (snap.currentStage === "done" || snap.currentStage === "error") {
    const elapsedSec = snap.startedAt ? Math.max(0, Math.round((nowMs - snap.startedAt) / 1000)) : 0;
    return { elapsedSec, remainingSec: 0, totalSec: Math.round(totalSec), pct: 100 };
  }

  const elapsedSec = snap.startedAt ? Math.max(0, Math.round((nowMs - snap.startedAt) / 1000)) : 0;
  // Residuo = costo restante stimato. Se il run reale è più lento del modello,
  // l'ETA onestamente non scende sotto il 15% del totale finché non avanza.
  const modeledRemaining = Math.max(0, totalSec - doneCost - runningFraction);
  const floorSec = doneCost <= 0 ? Math.round(totalSec * 0.15) : 0;
  const remainingSec = Math.max(Math.round(modeledRemaining), floorSec);
  const pct = Math.min(99, Math.round(((doneCost + runningFraction) / totalSec) * 100));

  return { elapsedSec, remainingSec: Math.max(1, remainingSec), totalSec: Math.round(totalSec), pct };
}

/** "2m 14s" / "48s" — label compatta per la card. */
export function formatEta(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m}m` : `${m}m ${r}s`;
}
