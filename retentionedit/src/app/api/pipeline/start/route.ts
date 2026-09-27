import { NextRequest, NextResponse } from "next/server";
import { PipelineOrchestrator } from "@/lib/pipeline-orchestrator";
import { persistJobAsync } from "@/lib/job-store";
import type { GenAITier, VideoFormat } from "@/lib/types";
import { requireAuth, setSessionCookie } from "@/lib/server-auth";
import { sanitizeR2KeySegment } from "@/lib/r2";

function sanitizeTitle(v: unknown): string {
  const s = typeof v === "string" ? v.trim() : "";
  // No control chars, max 160, strip leading/trailing quotes/brackets abuse
  return s.replace(/[\x00-\x1F\x7F]/g, "").slice(0, 160) || "Untitled Autonomous Edit";
}
function sanitizeUrl(v: unknown): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return "";
  const lower = s.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("file:")) {
    return "";
  }
  if (s.startsWith("r2://") || s.startsWith("/") || s.startsWith("blob:")) return s.slice(0, 500);
  try {
    const u = new URL(s);
    if (u.protocol === "r2:" || u.protocol === "https:" || u.protocol === "http:") return s.slice(0, 600);
    return "";
  } catch {
    return "";
  }
}
const FORMAT_SET = new Set<VideoFormat>(["short", "long"]);
const TIER_SET = new Set<GenAITier>(["eco", "balanced", "cinematic"]);

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult && authResult.errorResponse) {
      return authResult.errorResponse;
    }
    const userId = sanitizeR2KeySegment(authResult.user.userId, 50);

    const body = await req.json();
    const rawTitle = sanitizeTitle(body?.title);
    const rawVideoUrl = sanitizeUrl(body?.rawVideoUrl);
    const r2Key = typeof body?.r2Key === "string" ? body.r2Key.trim().slice(0, 400) : undefined;

    // R2 keys must belong to THIS authenticated user prefix (raw/<userId>/...)
    let safeR2Key: string | undefined = undefined;
    if (r2Key) {
      if (!r2Key.startsWith(`raw/${userId}/`) && !r2Key.startsWith(`exports/${userId}/`)) {
        return NextResponse.json(
          { error: "Forbidden — R2 storage key does not belong to your account." },
          { status: 403 }
        );
      }
      if (/^(raw|exports)\/[a-zA-Z0-9._/-]+$/.test(r2Key) && !r2Key.includes("..") && !r2Key.includes("//")) {
        safeR2Key = r2Key;
      }
    }

    const format: VideoFormat = FORMAT_SET.has(body?.format) ? (body.format as VideoFormat) : "short";
    const genaiTier: GenAITier = TIER_SET.has(body?.genaiTier) ? (body.genaiTier as GenAITier) : "balanced";
    const duration = Number.isFinite(body?.duration) ? Math.max(1, Math.min(4 * 3600, Math.round(Number(body.duration)))) : 48;

    // Feature gating per plan (Free, Starter, Pro, Agency)
    const { checkFeatureAccess } = await import("@/lib/stripe");
    const userPlanHeader = req.headers.get("x-user-plan");
    const userPlan = (body?.userPlan || userPlanHeader || "free") as any;

    if (genaiTier === "cinematic") {
      const gate = checkFeatureAccess(userPlan, "cinematic_tier");
      if (!gate.allowed) {
        return NextResponse.json(
          { error: gate.reason, code: "PLAN_UPGRADE_REQUIRED", requiredPlan: gate.requiredPlan },
          { status: 403 }
        );
      }
    } else if (genaiTier === "balanced") {
      const gate = checkFeatureAccess(userPlan, "balanced_tier");
      if (!gate.allowed && body?.userPlan && body.userPlan === "free") {
        return NextResponse.json(
          { error: gate.reason, code: "PLAN_UPGRADE_REQUIRED", requiredPlan: gate.requiredPlan },
          { status: 403 }
        );
      }
    }

    const job = PipelineOrchestrator.createJob({
      userId,
      title: rawTitle,
      rawVideoUrl: safeR2Key ? `r2://${safeR2Key}` : rawVideoUrl,
      format,
      genaiTier,
      duration,
    });

    // Cloud sync with safe timeout to prevent serverless freeze
    await Promise.race([
      persistJobAsync(job),
      new Promise((r) => setTimeout(r, 600)),
    ]).catch(() => {});

    // Prime first stage immediately so initial state is active
    try {
      await PipelineOrchestrator.pumpNextStage(job.id);
    } catch (pumpErr) {
      console.warn("[pipeline/start] Prime pump warning:", pumpErr);
    }

    // Continue background execution
    PipelineOrchestrator.executeAutonomousPipeline(job.id).catch((err) => {
      console.error(`Pipeline execution failed for job ${job.id}:`, err);
    });

    const res = NextResponse.json({
      success: true,
      jobId: job.id,
      format: job.format,
      genaiTier: job.genaiTier,
      currentStage: job.currentStage,
    });

    if (!req.cookies.get("retentionedit_session")?.value) {
      res.cookies.set("retentionedit_session", "active_session", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 8,
      });
    }

    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to start pipeline";
    // Don't leak stack/secret material — log server-side, return generic.
    console.error("[pipeline/start] error:", message);
    return NextResponse.json({ error: "Failed to start pipeline" }, { status: 500 });
  }
}
