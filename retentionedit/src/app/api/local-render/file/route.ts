import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { sanitizeR2KeySegment } from "@/lib/r2";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * GET /api/local-render/file?jobId=<id>&kind=final|cover
 * Authenticated, owner-only, range-capable download of the REAL edited MP4.
 * Only serves `done` jobs; Content-Disposition: attachment with .mp4 name.
 * Serverless-safe: artifacts come from R2 (any instance can serve them).
 */
export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult && authResult.errorResponse) {
    return authResult.errorResponse;
  }
  const userId = sanitizeR2KeySegment(authResult.user.userId, 50);
  const url = new URL(req.url);
  const jobId = (url.searchParams.get("jobId") || "").trim().slice(0, 80);
  const kind = url.searchParams.get("kind") === "cover" ? "cover" : "final";
  if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

  const { loadR2Job, fetchArtifact } = await import("@/lib/local-jobs-r2");
  const job = await loadR2Job(userId, jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.stage !== "done") {
    return NextResponse.json({ error: "Not ready yet", stage: job.stage }, { status: 409 });
  }

  const art = await fetchArtifact(job, kind);
  if (!art) return NextResponse.json({ error: "File missing" }, { status: 404 });

  const fileSize = art.bytes.length;
  const range = req.headers.get("range");
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = Math.max(0, parseInt(parts[0], 10) || 0);
    const end = parts[1] ? Math.min(fileSize - 1, parseInt(parts[1], 10)) : fileSize - 1;
    if (start >= fileSize || end < start) {
      return new NextResponse("Range Not Satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }
    const chunkSize = end - start + 1;
    const slice = art.bytes.subarray(start, end + 1);
    return new NextResponse(new Uint8Array(slice), {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": art.mime,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  }

  return new NextResponse(new Uint8Array(art.bytes), {
    status: 200,
    headers: {
      "Content-Length": String(fileSize),
      "Content-Type": art.mime,
      "Accept-Ranges": "bytes",
      "Content-Disposition": `attachment; filename="${art.filename}"`,
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
