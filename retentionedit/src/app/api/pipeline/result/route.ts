import { NextRequest, NextResponse } from "next/server";
import { PipelineOrchestrator } from "@/lib/pipeline-orchestrator";

export async function GET(req: NextRequest) {
  const raw = new URL(req.url).searchParams.get("jobId") || "";
  const jobId = raw.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);

  if (!jobId) {
    return NextResponse.json({ error: "Missing or invalid jobId" }, { status: 400 });
  }

  let job = await PipelineOrchestrator.getJobAsync(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Ensure fully finished before returning deliverables
  let attempts = 0;
  while (job && job.currentStage !== "done" && job.currentStage !== "error" && attempts < 10) {
    attempts++;
    const pumped = await PipelineOrchestrator.pumpNextStage(jobId);
    if (pumped) job = pumped;
  }

  return NextResponse.json({
    jobId: job.id,
    title: job.title,
    currentStage: job.currentStage,
    format: job.format,
    genaiTier: job.genaiTier,
    renderedVideoUrl: job.renderedVideoUrl,
    finalVideoUrl: job.renderedVideoUrl,
    thumbnailUrl: job.thumbnailUrl,
    coverUrl: job.thumbnailUrl,
    stats: job.stats,
    qualityGate: job.qualityGate,
    blueprint: job.blueprint,
    editPlan: job.editPlan,
  });
}
