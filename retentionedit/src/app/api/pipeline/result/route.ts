import { NextRequest, NextResponse } from "next/server";
import { PipelineOrchestrator } from "@/lib/pipeline-orchestrator";
import { requireAuth } from "@/lib/server-auth";
import { presignPrivateGetUrl, sanitizeR2KeySegment } from "@/lib/r2";

export const dynamic = "force-dynamic";

/**
 * GET /api/pipeline/result?jobId=<jobId>
 * Delivers final edited video and thumbnails.
 * Privacy & Security:
 * - Requires authenticated session.
 * - Strictly verifies that the requesting user owns this job (IDOR prevention).
 * - Converts all private storage keys to time-limited presigned URLs.
 */
export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult && authResult.errorResponse) {
    return authResult.errorResponse;
  }
  const userId = sanitizeR2KeySegment(authResult.user.userId, 50);

  const raw = new URL(req.url).searchParams.get("jobId") || "";
  const jobId = raw.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);

  if (!jobId) {
    return NextResponse.json({ error: "Missing or invalid jobId" }, { status: 400 });
  }

  // IDOR protection: only load if user owns the job
  let job = await PipelineOrchestrator.getJobAsync(jobId, userId);
  if (!job || job.userId !== userId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Ensure fully finished before returning deliverables
  let attempts = 0;
  while (job && job.currentStage !== "done" && job.currentStage !== "error" && attempts < 10) {
    attempts++;
    const pumped = await PipelineOrchestrator.pumpNextStage(jobId);
    if (pumped) job = pumped;
  }

  // Resolve private URLs: if R2 keys, produce short-lived presigned URLs for this user
  let safeRenderedUrl = job.renderedVideoUrl;
  if (safeRenderedUrl && safeRenderedUrl.startsWith("r2://")) {
    const key = safeRenderedUrl.slice(5);
    if (key.startsWith("exports/")) {
      if (job.rawVideoUrl && job.rawVideoUrl.startsWith("r2://")) {
        safeRenderedUrl = presignPrivateGetUrl(job.rawVideoUrl.slice(5), 900) || `/api/r2/download?key=${encodeURIComponent(job.rawVideoUrl.slice(5))}`;
      } else if (job.rawVideoUrl && (job.rawVideoUrl.startsWith("/") || job.rawVideoUrl.startsWith("http") || job.rawVideoUrl.startsWith("blob:"))) {
        safeRenderedUrl = job.rawVideoUrl;
      } else {
        safeRenderedUrl = presignPrivateGetUrl(key, 900) || `/api/r2/download?key=${encodeURIComponent(key)}`;
      }
    } else {
      safeRenderedUrl = presignPrivateGetUrl(key, 900) || `/api/r2/download?key=${encodeURIComponent(key)}`;
    }
  }

  let safeThumbUrl = job.thumbnailUrl;
  if (safeThumbUrl && safeThumbUrl.startsWith("r2://")) {
    const key = safeThumbUrl.slice(5);
    safeThumbUrl = presignPrivateGetUrl(key, 900) || `/api/r2/download?key=${encodeURIComponent(key)}`;
  }

  const res = NextResponse.json({
    jobId: job.id,
    userId: job.userId,
    title: job.title,
    currentStage: job.currentStage,
    format: job.format,
    genaiTier: job.genaiTier,
    renderedVideoUrl: safeRenderedUrl,
    finalVideoUrl: safeRenderedUrl,
    thumbnailUrl: safeThumbUrl,
    coverUrl: safeThumbUrl,
    stats: job.stats,
    qualityGate: job.qualityGate,
    blueprint: job.blueprint,
    editPlan: job.editPlan,
  });

  res.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
  return res;
}
