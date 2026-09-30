import { NextRequest, NextResponse } from "next/server";
import { PipelineOrchestrator } from "@/lib/pipeline-orchestrator";
import { requireAuth } from "@/lib/server-auth";
import { presignPrivateGetUrl, sanitizeR2KeySegment } from "@/lib/r2";
import type { PipelineJob } from "@/lib/types";

type ClaimedJob = PipelineJob & { claimedAt?: number };

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Quanto un poll può far avanzare il pipeline (margine sotto maxDuration). */
const STEP_BUDGET_MS = 25_000;
/** Un'altra invocation sta già avanzando se il claim è più fresco di così. */
const CLAIM_TTL_MS = 90_000;

/**
 * GET /api/pipeline/status?jobId=<jobId>
 * Polls the real-time progress of a video editing job.
 * Privacy & Security:
 * - Requires authenticated session.
 * - Strictly verifies that the requesting user owns this job (IDOR prevention).
 * - Delivers private, time-limited presigned media URLs for that user.
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

  // Advance next stage on poll to guarantee continuous progress across serverless invocations
  // SERVERLESS-SAFE driver (stesso pattern di /api/local-render/status):
  // ogni poll avanza il job finché c'è budget, con claim anti-doppio su R2.
  // Senza questo, il fire-and-forget di /api/pipeline/start muore con la
  // Lambda e il job resta fermo a metà (mai transcribe→plan→render).
  let job = (await PipelineOrchestrator.getJobAsync(jobId, userId)) as ClaimedJob | undefined;
  if (!job || job.userId !== userId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (job.currentStage !== "done" && job.currentStage !== "error") {
    const claimedFresh =
      job.claimedAt != null && Date.now() - job.claimedAt < CLAIM_TTL_MS;
    if (!claimedFresh) {
      try {
        job.claimedAt = Date.now();
        const { persistJobAsync } = await import("@/lib/job-store");
        await persistJobAsync(job);
        const deadline = Date.now() + STEP_BUDGET_MS;
        let pumped: PipelineJob | null = job;
        while (
          pumped &&
          pumped.currentStage !== "done" &&
          pumped.currentStage !== "error" &&
          Date.now() < deadline
        ) {
          pumped = await PipelineOrchestrator.pumpNextStage(job.id);
          if (pumped) job = pumped as ClaimedJob;
          else break;
        }
        job.claimedAt = 0;
        await persistJobAsync(job);
      } catch (driveErr) {
        console.warn(`[pipeline/status] drive warning for ${jobId}:`, driveErr instanceof Error ? driveErr.message : driveErr);
      }
    } else {
      const pumped = await PipelineOrchestrator.pumpNextStage(jobId);
      if (pumped) job = pumped as ClaimedJob;
    }
  }

  // Resolve private URLs: if R2 keys, produce short-lived presigned URLs for this user
  let safeRenderedUrl = job.renderedVideoUrl;
  if (safeRenderedUrl && safeRenderedUrl.startsWith("r2://")) {
    const key = safeRenderedUrl.slice(5);
    safeRenderedUrl = presignPrivateGetUrl(key, 900) || `/api/r2/download?key=${encodeURIComponent(key)}`;
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
    format: job.format,
    genaiTier: job.genaiTier,
    rawDuration: job.rawDuration,
    rawVideoUrl: job.rawVideoUrl.startsWith("r2://")
      ? (presignPrivateGetUrl(job.rawVideoUrl.slice(5), 900) || job.rawVideoUrl)
      : job.rawVideoUrl,
    currentStage: job.currentStage,
    stages: job.stages,
    logs: job.logs,
    renderedVideoUrl: safeRenderedUrl,
    thumbnailUrl: safeThumbUrl,
    stats: job.stats,
    editPlan: job.editPlan,
  });

  res.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
  return res;
}
