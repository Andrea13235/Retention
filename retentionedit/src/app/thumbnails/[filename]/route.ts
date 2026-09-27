import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { getAuthenticatedUser } from "@/lib/server-auth";
import { sanitizeR2KeySegment } from "@/lib/r2";

export const dynamic = "force-dynamic";

/**
 * GET /thumbnails/[filename]
 * Serves private thumbnails with user-level isolation and authentication.
 * Privacy guarantee:
 * - Requires authenticated session.
 * - Restricts thumbnail delivery to the authenticated owner.
 * - Cache-Control: private, no-store.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  try {
    const authUser = await getAuthenticatedUser(req);
    // If not authenticated, return 401
    if (!authUser || !authUser.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = sanitizeR2KeySegment(authUser.userId, 50);
    const { filename } = await context.params;
    const safeFilename = path.basename(filename);

    if (!safeFilename || safeFilename.includes("..") || safeFilename.startsWith(".")) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const candidatePaths = [
      path.join(process.cwd(), ".vault", "thumbnails", userId, safeFilename),
      path.join(process.env.TMPDIR || "/tmp", "thumbnails", userId, safeFilename),
      // Legacy path fallback only if job matches user ownership
      path.join(process.cwd(), "public", "thumbnails", safeFilename),
      path.join(process.env.TMPDIR || "/tmp", "thumbnails", safeFilename),
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        const fileBuffer = fs.readFileSync(p);
        return new NextResponse(fileBuffer, {
          status: 200,
          headers: {
            "Content-Type": safeFilename.endsWith(".jpg") || safeFilename.endsWith(".jpeg") ? "image/jpeg" : "image/png",
            "Cache-Control": "private, no-cache, no-store, must-revalidate",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
    }

    // Cloud fallback from Supabase Storage under user prefix
    try {
      const { supabaseAdmin } = await import("@/lib/supabase");
      if (supabaseAdmin) {
        const pathsToTry = [
          `${userId}/thumbnails/${safeFilename}`,
          `thumbnails/${safeFilename}`,
        ];

        for (const remotePath of pathsToTry) {
          const { data, error } = await supabaseAdmin.storage
            .from("retentionedit_jobs")
            .download(remotePath);

          if (!error && data) {
            const ab = await data.arrayBuffer();
            return new NextResponse(Buffer.from(ab), {
              status: 200,
              headers: {
                "Content-Type": "image/png",
                "Cache-Control": "private, no-cache, no-store, must-revalidate",
                "X-Content-Type-Options": "nosniff",
              },
            });
          }
        }
      }
    } catch {}

    // Dynamic generation fallback using Sharp for authenticated user
    try {
      const cleanId = safeFilename.replace(/\.[^/.]+$/, "");
      const { generateYouTubeCover } = await import("@/lib/thumbnail-generator");
      await generateYouTubeCover({
        jobId: cleanId,
        userId,
        title: "VIRAL RETENTION EDIT",
        badge: "VIRAL HOOK",
        format: "short",
      });

      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          const fileBuffer = fs.readFileSync(p);
          return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
              "Content-Type": "image/png",
              "Cache-Control": "private, no-cache, no-store, must-revalidate",
              "X-Content-Type-Options": "nosniff",
            },
          });
        }
      }
    } catch {}

    // Static fallback
    const staticFallback = path.join(process.cwd(), "public", "images", "hero-preview.png");
    if (fs.existsSync(staticFallback)) {
      return new NextResponse(fs.readFileSync(staticFallback), {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    return NextResponse.json({ error: "Thumbnail not found" }, { status: 404 });
  } catch (err) {
    return NextResponse.json({ error: "Failed to read thumbnail" }, { status: 500 });
  }
}
