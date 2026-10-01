import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { sanitizeR2KeySegment } from "@/lib/r2";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** How long one poll may drive the pipeline (leaves headroom under maxDuration). */
const STEP_BUDGET_MS = 25_000;
/** Another invocation owns stepping when its claim is fresher than this. */
const CLAIM_TTL_MS = 90_000;

/**
 * GET /api/local-render/status?jobId=<id>
 * Authenticated, owner-only. SERVERLESS-SAFE driver:
 *  - loads job from R2 (source of truth, survives instance changes),
 *  - claims exclusive stepping (R2-persisted lock),
 *  - advances the pipeline synchronously within a ~25s budget,
 *  - persists back to R2 and returns fresh state.
 * The browser polls every few seconds; each poll moves the job forward.
 */
export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult && authResult.errorResponse) {
    return authResult.errorResponse;
  }
  const userId = sanitizeR2KeySegment(authResult.user.userId, 50);
  const jobId = (new URL(req.url).searchParams.get("jobId") || "").trim().slice(0, 80);
  if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

  const { loadR2Job, saveR2Job, persistArtifact, scratchFilePath } = await import("@/lib/local-jobs-r2");
  const { advanceJob } = await import("@/lib/local-pipeline");
  const { localFilePath } = await import("@/lib/local-jobs");
  const { existsSync } = await import("node:fs");

  let job = await loadR2Job(userId, jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // Drive the pipeline when the job isn't terminal and nobody else is stepping.
  if (job.stage !== "done" && job.stage !== "error") {
    const claimedFresh = job.claimedAt && Date.now() - job.claimedAt < CLAIM_TTL_MS;
    if (!claimedFresh) {
      job.claimedAt = Date.now();
      await saveR2Job(job);
      try {
        job = await advanceJob(job, jobId, userId, {
          deadlineMs: Date.now() + STEP_BUDGET_MS,
          save: saveR2Job,
        });
        job.claimedAt = 0;
        await saveR2Job(job);
        // Persist fresh outputs so later polls (any instance) can serve them.
        if (job.stage === "done") {
          try {
            const fin = localFilePath(job, "final");
            const cov = localFilePath(job, "cover");
            if (existsSync(fin)) await persistArtifact(job, "final", fin);
            if (existsSync(cov)) await persistArtifact(job, "cover", cov);
          } catch {}
        }
      } catch (err: unknown) {
        job.stage = "error";
        job.error = (err instanceof Error ? err.message : "render failed").slice(0, 300);
        job.log.push(`[${new Date().toLocaleTimeString()}] [${jobId.slice(-6)}] Errore: ${job.error}`);
        job.claimedAt = 0;
        await saveR2Job(job);
      }
      // Re-read not needed: job object is current. Silence unused warning.
      void scratchFilePath;
    }
  }

  const res = NextResponse.json({
    jobId: job.jobId,
    title: job.youtubeTitle || job.title,
    rawTitle: job.title,
    format: job.format,
    stage: job.stage,
    progress: job.progress,
    log: job.log.slice(-30),
    language: job.language,
    transcriptWords: job.transcriptWords,
    transcriptPreview: job.transcriptPreview,
    cuts: job.cuts,
    cutsCount: job.cuts?.length ?? 0,
    captions: job.captions,
    captionsCount: job.captions?.length ?? 0,
    captionsBurned: job.captionsBurned ?? 0,
    scenes: job.scenes,
    scenesCount: job.scenes?.length ?? 0,
    zooms: job.zooms,
    zoomsCount: job.zooms?.length ?? 0,
    zoomsApplied: job.zoomsApplied ?? 0,
    broll: job.broll ? { finalStart: job.broll.finalStart, finalEnd: job.broll.finalEnd, prompt: job.broll.prompt, bytes: job.broll.bytes } : null,
    brollsApplied: job.brollsApplied ?? 0,
    volt: job.volt ?? null,
    sourceDuration: job.sourceDuration,
    finalDuration: job.finalDuration,
    timeSavedSec: job.timeSavedSec,
    bytes: job.bytes,
    error: job.error,
    soulPending: !!job.soul,
    hasFile: job.stage === "done",
    downloadUrl: job.stage === "done" ? `/api/local-render/file?jobId=${encodeURIComponent(job.jobId)}&kind=final` : null,
    coverUrl: job.stage === "done" ? `/api/local-render/file?jobId=${encodeURIComponent(job.jobId)}&kind=cover` : null,
    // Cover YouTube Higgsfield ad-hoc (se generata) — la card la preferisce al frame.
    youtubeCoverUrl: job.stage === "done" && job.youtubeCoverPath ? `/api/local-render/file?jobId=${encodeURIComponent(job.jobId)}&kind=ytcover` : null,
  });
  res.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
  return res;
}
