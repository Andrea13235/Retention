/**
 * RetentionEdit — R2-backed job persistence (SERVER ONLY).
 *
 * Problem: on Vercel serverless, /tmp is per-instance and fire-and-forget
 * background work dies when the function response ends. Polls land on
 * different instances → "Job not found".
 *
 * Solution: R2 is the source of truth.
 *  - jobs/<userId>/<jobId>.json — full LocalJob (sourcePath rewritten to /tmp on load).
 *  - jobs/<userId>/<jobId>/source.<ext> — the uploaded source media.
 *  - jobs/<userId>/<jobId>/final.mp4 + cover.jpg — rendered outputs.
 *
 * Each invocation: load state from R2 → materialize under /tmp → run ONE
 * pipeline step synchronously → persist state + new artifacts to R2.
 * Local dev (no R2 configured): falls back to the .vault filesystem store.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isR2Configured, downloadR2Object, uploadR2Object } from "./r2";
import { storageRoot } from "./storage-root";
import {
  loadLocalJob as loadFsJob,
  saveLocalJob as saveFsJob,
  createLocalJob as createFsJob,
  localFilePath as fsFilePath,
  type LocalJob,
} from "./local-jobs";

export type { LocalJob };

function jobKey(userId: string, jobId: string): string {
  const safeJob = jobId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  return `jobs/${userId}/${safeJob}.json`;
}

function sourceKey(userId: string, jobId: string, ext: string): string {
  const safeJob = jobId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  const safeExt = (ext || ".mp4").replace(/[^a-zA-Z0-9.]/g, "").slice(0, 8) || ".mp4";
  return `jobs/${userId}/${safeJob}/source${safeExt.startsWith(".") ? safeExt : `.${safeExt}`}`;
}

function artifactKey(userId: string, jobId: string, kind: "final" | "cover"): string {
  const safeJob = jobId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  return `jobs/${userId}/${safeJob}/${kind === "final" ? "final.mp4" : "cover.jpg"}`;
}

/** Local scratch dir for this job on the CURRENT instance (/tmp on Vercel). */
function scratchDir(userId: string, jobId: string): string {
  const safeJob = jobId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  return path.join(storageRoot(), "local-renders", userId, safeJob);
}

function extOf(name: string): string {
  const e = path.extname(name || "").toLowerCase();
  return e || ".mp4";
}

/**
 * Create a job: source bytes → R2 (serverless) or .vault (local).
 * Sets job.sourcePath to the LOCAL scratch path for the current invocation.
 */
export async function createR2Job(params: {
  jobId: string;
  userId: string;
  title: string;
  format: LocalJob["format"];
  sourceBytes: Buffer;
  sourceName: string;
}): Promise<LocalJob> {
  const dir = scratchDir(params.userId, params.jobId);
  mkdirSync(dir, { recursive: true });
  const localSrc = path.join(dir, `source_${params.sourceName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "upload.mp4"}`);
  writeFileSync(localSrc, params.sourceBytes);

  const job = createFsJob({
    jobId: params.jobId,
    userId: params.userId,
    title: params.title,
    format: params.format,
    sourcePath: localSrc,
  });

  if (isR2Configured()) {
    const ext = extOf(params.sourceName);
    const sKey = sourceKey(params.userId, params.jobId, ext);
    const up = await uploadR2Object(sKey, params.sourceBytes, "video/mp4");
    if (!up) throw new Error("R2 source persist failed");
    (job as LocalJob & { r2SourceKey?: string }).r2SourceKey = sKey;
    await saveR2Job(job);
  }
  return job;
}

/** Persist job.json (R2 when configured, else filesystem). */
export async function saveR2Job(job: LocalJob): Promise<void> {
  saveFsJob(job); // always keep local scratch copy too
  if (!isR2Configured()) return;
  const { _keep, ...persisted } = job as LocalJob & { _keep?: unknown };
  void _keep;
  await uploadR2Object(jobKey(job.userId, job.jobId), Buffer.from(JSON.stringify(persisted)), "application/json");
}

/**
 * Load a job: R2 first (source of truth), filesystem fallback.
 * Materializes sourcePath under the CURRENT instance scratch dir.
 * Returns null when the job doesn't exist anywhere.
 */
export async function loadR2Job(userId: string, jobId: string): Promise<LocalJob | null> {
  if (isR2Configured()) {
    try {
      const buf = await downloadR2Object(jobKey(userId, jobId));
      if (buf && buf.length > 0) {
        const job = JSON.parse(buf.toString("utf8")) as LocalJob & { r2SourceKey?: string };
        if (!job || job.jobId !== jobId || job.userId !== userId) return null;
        // Materialize source locally for this invocation.
        const dir = scratchDir(userId, jobId);
        mkdirSync(dir, { recursive: true });
        const localSrc = path.join(dir, `source${extOf(job.r2SourceKey || job.sourcePath || ".mp4")}`);
        if (!existsSync(localSrc) && job.r2SourceKey) {
          const media = await downloadR2Object(job.r2SourceKey);
          if (media && media.length > 0) writeFileSync(localSrc, media);
        }
        if (existsSync(localSrc)) {
          job.sourcePath = localSrc;
          return job;
        }
        // Source bytes missing (evicted?) — job exists but unusable here.
        return null;
      }
    } catch {
      // fall through to filesystem
    }
  }
  return loadFsJob(userId, jobId);
}

/** Persist a rendered artifact (final.mp4 / cover.jpg) to R2. */
export async function persistArtifact(job: LocalJob, kind: "final" | "cover", localPath: string): Promise<void> {
  if (!isR2Configured()) return;
  try {
    if (!existsSync(localPath)) return;
    const buf = readFileSync(localPath);
    await uploadR2Object(artifactKey(job.userId, job.jobId, kind), buf, kind === "final" ? "video/mp4" : "image/jpeg");
  } catch {}
}

/** Fetch a rendered artifact bytes (R2 first, local fallback). */
export async function fetchArtifact(job: LocalJob, kind: "final" | "cover"): Promise<{ bytes: Buffer; mime: string; filename: string } | null> {
  const cleanTitle = (job.title || "video").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40) || "video";
  if (isR2Configured()) {
    try {
      const buf = await downloadR2Object(artifactKey(job.userId, job.jobId, kind));
      if (buf && buf.length > 0) {
        return {
          bytes: buf,
          mime: kind === "final" ? "video/mp4" : "image/jpeg",
          filename: kind === "final" ? `${cleanTitle}_retention_edit.mp4` : `${cleanTitle}_cover.jpg`,
        };
      }
    } catch {}
  }
  try {
    const p = fsFilePath(job, kind);
    if (!existsSync(p)) return null;
    return {
      bytes: readFileSync(p),
      mime: kind === "final" ? "video/mp4" : "image/jpeg",
      filename: kind === "final" ? `${cleanTitle}_retention_edit.mp4` : `${cleanTitle}_cover.jpg`,
    };
  } catch {
    return null;
  }
}

/** Local scratch file path for final/cover on the current instance. */
export function scratchFilePath(userId: string, jobId: string, kind: "final" | "cover"): string {
  const dir = scratchDir(userId, jobId);
  return kind === "final" ? path.join(dir, "final.mp4") : path.join(dir, "cover.jpg");
}
