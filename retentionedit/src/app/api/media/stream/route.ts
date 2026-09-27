import { NextRequest, NextResponse } from "next/server";
import { existsSync, statSync, createReadStream } from "node:fs";
import path from "node:path";
import { requireAuth } from "@/lib/server-auth";
import { sanitizeR2KeySegment } from "@/lib/r2";
import { Readable } from "node:stream";

export const dynamic = "force-dynamic";

/**
 * GET /api/media/stream?file=<storedFileName>
 * Secure, authenticated streaming for user's private uploaded videos.
 * - Enforces authentication.
 * - Prevents path traversal.
 * - Supports HTTP 206 Partial Content Range streaming.
 * - Cache-Control: private, no-store.
 */
export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult && authResult.errorResponse) {
    return authResult.errorResponse;
  }
  const userId = sanitizeR2KeySegment(authResult.user.userId, 50);

  const rawFile = (new URL(req.url).searchParams.get("file") || "").trim();
  const safeFile = path.basename(rawFile);
  if (!safeFile || safeFile.includes("..") || safeFile.startsWith(".")) {
    return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
  }

  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.NODE_ENV === "production"
  );

  const candidateDirs = isServerless
    ? [path.join(process.env.TMPDIR || "/tmp", "uploads", userId)]
    : [
        path.join(process.cwd(), ".vault", "uploads", userId),
        path.join(process.env.TMPDIR || "/tmp", "uploads", userId),
      ];

  let targetPath: string | null = null;
  for (const dir of candidateDirs) {
    const full = path.join(dir, safeFile);
    if (existsSync(full)) {
      targetPath = full;
      break;
    }
  }

  if (!targetPath) {
    return NextResponse.json({ error: "Media file not found or unauthorized" }, { status: 404 });
  }

  const stat = statSync(targetPath);
  const fileSize = stat.size;
  const range = req.headers.get("range");

  const ext = path.extname(safeFile).toLowerCase();
  const mimeType = ext === ".webm" ? "video/webm" : ext === ".mov" ? "video/quicktime" : "video/mp4";

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
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
        "X-Content-Type-Options": "nosniff",
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
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
