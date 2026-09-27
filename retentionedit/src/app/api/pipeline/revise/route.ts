import { NextRequest, NextResponse } from "next/server";
import { PipelineOrchestrator } from "@/lib/pipeline-orchestrator";
import { getSecret } from "@/lib/vault-store";
import { requireAuth } from "@/lib/server-auth";
import { sanitizeR2KeySegment } from "@/lib/r2";

function isNonEmptyString(v: unknown, max = 2000): string | null {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
  if (s.length < 3 || s.length > max) return null;
  return s;
}

/**
 * POST /api/pipeline/revise { jobId, prompt }
 * Refines a completed edit via Claude Opus 5.5.
 * Privacy & Security:
 * - Requires authenticated session.
 * - Strictly verifies that the requesting user owns the job before executing.
 * - Prompt sanitized, jobId allow-listed, no secret echo.
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult && authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const userId = sanitizeR2KeySegment(authResult.user.userId, 50);

    const body = (await req.json()) as Record<string, unknown>;
    const rawJobId = String(body?.jobId ?? "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
    const prompt = isNonEmptyString(body?.prompt, 2000);
    if (!rawJobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });
    if (!prompt) return NextResponse.json({ error: "prompt required (3–2000 chars)" }, { status: 400 });

    // Verify job exists and belongs to this authenticated user
    const existingJob = await PipelineOrchestrator.getJobAsync(rawJobId, userId);
    if (!existingJob || existingJob.userId !== userId) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const anthropicKey = getSecret("anthropic");
    if (!anthropicKey) {
      return NextResponse.json({ error: "Anthropic key not configured" }, { status: 503 });
    }

    const revised = await PipelineOrchestrator.reviseWithOpus({ jobId: rawJobId, userPrompt: prompt, anthropicKey });
    return NextResponse.json({ success: true, ...revised });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "revise failed";
    let status = 500;
    let hint = "Revise failed. Try again.";
    if (/not found/i.test(msg) && /job/i.test(msg)) { status = 404; hint = msg.slice(0, 200); }
    else if (/not configured/i.test(msg)) { status = 503; hint = msg.slice(0, 200); }
    else if (/401|auth|api key/i.test(msg)) { status = 503; hint = "Anthropic key not valid — check .env.local / vault."; }
    else if (/rate limited|429/i.test(msg)) { status = 429; hint = "Opus rate limited, riprova tra un attimo."; }
    console.error("[pipeline/revise] error:", msg);
    return NextResponse.json({ error: hint }, { status });
  }
}
