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

  // Advance next stage on poll to guarantee continuous progress across serverless invocations
  if (job.currentStage !== "done" && job.currentStage !== "error") {
    await PipelineOrchestrator.pumpNextStage(jobId);
    job = (await PipelineOrchestrator.getJobAsync(jobId)) || job;
  }

  return NextResponse.json({
    jobId: job.id,
    currentStage: job.currentStage,
    stages: job.stages,
    logs: job.logs,
  });
}
