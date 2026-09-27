/**
 * RetentionEdit — Local render job store (M1).
 *
 * SERVER ONLY. Jobs live in `.vault/local-renders/<userId>/<jobId>/job.json`
 * (gitignored, never pushed). Strict per-user ownership on every read.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { VideoFormat } from "./types";
import { storageRoot } from "./storage-root";

export type LocalStage = "upload" | "transcribe" | "cuts" | "render" | "done" | "error";

export interface LocalWord {
  word: string;
  start: number;
  end: number;
}

export interface LocalJob {
  jobId: string;
  userId: string;
  title: string;
  format: VideoFormat;
  stage: LocalStage;
  progress: number; // 0-100 within current stage semantics (overall)
  createdAt: number;
  updatedAt: number;
  sourcePath: string;
  language?: string;
  transcriptWords?: number;
  transcriptPreview?: string;
  segments?: Array<{ start: number; end: number; text: string }>;
  /** Real word timestamps (persisted, cap 2000) — M2 caption source. */
  words?: Array<{ word: string; start: number; end: number }>;
  /** Caption cues on FINAL timeline (real words, remapped post-cut). */
  captions?: Array<{ start: number; end: number; text: string }>;
  captionsBurned?: number;
  /** Real scene cuts (source timeline) — M3 zoom source. */
  scenes?: Array<{ at: number }>;
  /** Zoom windows on FINAL timeline (true scene changes only). */
  zooms?: Array<{ finalStart: number; finalEnd: number; peak: number }>;
  zoomsApplied?: number;
  /** RetentionVolt reference match (read-only, own DB). Null = local-only. */
  volt?: {
    title: string;
    creator: string;
    youtubeUrl: string | null;
    thumbnailUrl: string | null;
    niche: string;
    retentionScore: number;
    views: number | string | null;
    hookTactic: string | null;
    bodyPacing: string | null;
    voltZooms: number;
  } | null;
  /** Higgsfield SOUL B-roll (server image, composited with Ken Burns). Null = none. */
  broll?: {
    /** Absolute server path of the generated PNG (never exposed to client). */
    localPath: string;
    /** Window on the FINAL timeline where it overlays. */
    finalStart: number;
    finalEnd: number;
    /** Prompt used (from transcript keywords, never invented text). */
    prompt: string;
    bytes: number;
  } | null;
  brollsApplied?: number;
  silences?: Array<{ start: number; end: number }>;
  cuts?: Array<{ start: number; end: number }>;
  keepCount?: number;
  sourceDuration?: number;
  finalDuration?: number;
  timeSavedSec?: number;
  bytes?: number;
  error?: string;
  log: string[];
}

function jobDir(userId: string, jobId: string): string {
  const safeJob = jobId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  return path.join(storageRoot(), "local-renders", userId, safeJob);
}

function jobPath(userId: string, jobId: string): string {
  return path.join(jobDir(userId, jobId), "job.json");
}

export function createLocalJob(params: {
  jobId: string;
  userId: string;
  title: string;
  format: VideoFormat;
  sourcePath: string;
}): LocalJob {
  const job: LocalJob = {
    jobId: params.jobId,
    userId: params.userId,
    title: params.title || "Untitled edit",
    format: params.format,
    stage: "upload",
    progress: 5,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sourcePath: params.sourcePath,
    log: [`[${new Date().toLocaleTimeString()}] Upload ricevuto, motore locale avviato`],
  };
  mkdirSync(jobDir(params.userId, params.jobId), { recursive: true });
  writeFileSync(jobPath(params.userId, params.jobId), JSON.stringify(job));
  return job;
}

export function loadLocalJob(userId: string, jobId: string): LocalJob | null {
  try {
    const p = jobPath(userId, jobId);
    if (!existsSync(p)) return null;
    const parsed = JSON.parse(readFileSync(p, "utf8")) as LocalJob;
    if (!parsed || parsed.jobId !== jobId) return null;
    if (parsed.userId !== userId) return null; // IDOR guard
    return parsed;
  } catch {
    return null;
  }
}

export function saveLocalJob(job: LocalJob): void {
  job.updatedAt = Date.now();
  try {
    mkdirSync(jobDir(job.userId, job.jobId), { recursive: true });
    // Strip ephemeral in-memory fields (never persist _keep).
    const { _keep, ...persisted } = job as LocalJob & { _keep?: unknown };
    void _keep;
    writeFileSync(jobPath(job.userId, job.jobId), JSON.stringify(persisted));
  } catch {}
}

export function localFilePath(job: LocalJob, kind: "final" | "cover"): string {
  const dir = jobDir(job.userId, job.jobId);
  return kind === "final" ? path.join(dir, "final.mp4") : path.join(dir, "cover.jpg");
}
