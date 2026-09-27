import { NextRequest, NextResponse } from "next/server";
import { existsSync, statSync, createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { requireAuth } from "@/lib/server-auth";
import { sanitizeR2KeySegment } from "@/lib/r2";
import { loadLocalJob, localFilePath } from "@/lib/local-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * GET /api/local-render/file?jobId=<id>&kind=final|cover
 * Authenticated, owner-only, range-capable download of the REAL edited MP4.
 * Only serves `done` jobs; Content-Disposition: attachment with .mp4 name.
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

  const job = loadLocalJob(userId, jobId);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.stage !== "done") {
    return NextResponse.json({ error: "Not ready yet", stage: job.stage }, { status: 409 });
  }

  const targetPath = localFilePath(job, kind);
  if (!existsSync(targetPath)) {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }

  const stat = statSync(targetPath);
  const fileSize = stat.size;
  const isCover = kind === "cover";
  const mimeType = isCover ? "image/jpeg" : "video/mp4";
  const cleanTitle = (job.title || "video").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40) || "video";
  const filename = isCover ? `${cleanTitle}_cover.jpg` : `${cleanTitle}_retention_edit.mp4`;

  const range = req.headers.get("range");
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = Math.max(0, parseInt(parts[0], 10) || 0);
    const end = parts[1] ? Math.min(fileSize - 1, parseInt(parts[1], 10)) : fileSize - 1;
    const chunkSize = end - start + 1;
    const stream = createReadStream(targetPath, { start, end });
    const webStream = Readable.toWeb(stream) as ReadableStream<Uint8Array>;
    return new NextResponse(webStream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": mimeType,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  }

  const stream = createReadStream(targetPath);
  const webStream = Readable.toWeb(stream) as ReadableStream<Uint8Array>;
  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Length": String(fileSize),
      "Content-Type": mimeType,
      "Accept-Ranges": "bytes",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
