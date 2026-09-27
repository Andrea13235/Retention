import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { sanitizeR2KeySegment } from "@/lib/r2";
import { loadLocalJob } from "@/lib/local-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/local-render/status?jobId=<id>
 * Authenticated, owner-only. Returns stage/progress + real stats.
 */
export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult && authResult.errorResponse) {
    return authResult.errorResponse;
  }
  const userId = sanitizeR2KeySegment(authResult.user.userId, 50);
  const jobId = (new URL(req.url).searchParams.get("jobId") || "").trim().slice(0, 80);
  if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

  const job = loadLocalJob(userId, jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  // Safety net: if the fire-and-forget runner never started (serverless cold
  // start, restart), kick it from the poll. runLocalJob is idempotent via IN_FLIGHT.
  if (job.stage === "upload") {
    const { runLocalJob } = await import("@/lib/local-pipeline");
    runLocalJob(job.jobId, userId).catch(() => {});
  }

  const res = NextResponse.json({
    jobId: job.jobId,
    title: job.title,
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
    hasFile: job.stage === "done",
    downloadUrl: job.stage === "done" ? `/api/local-render/file?jobId=${encodeURIComponent(job.jobId)}&kind=final` : null,
    coverUrl: job.stage === "done" ? `/api/local-render/file?jobId=${encodeURIComponent(job.jobId)}&kind=cover` : null,
  });
  res.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
  return res;
}
