import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await context.params;
    const safeFilename = path.basename(filename);
    const candidatePaths = [
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
            "Cache-Control": "public, max-age=86400",
          },
        });
      }
    }

    // Cloud fallback from Supabase Storage
    try {
      const { supabaseAdmin } = await import("@/lib/supabase");
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin.storage
          .from("retentionedit_jobs")
          .download(`thumbnails/${safeFilename}`);
        if (!error && data) {
          const ab = await data.arrayBuffer();
          return new NextResponse(Buffer.from(ab), {
            status: 200,
            headers: {
              "Content-Type": "image/png",
              "Cache-Control": "public, max-age=86400",
            },
          });
        }
      }
    } catch {}

    // Dynamic generation fallback using Sharp
    try {
      const cleanId = safeFilename.replace(/\.[^/.]+$/, "");
      const { generateYouTubeCover } = await import("@/lib/thumbnail-generator");
      await generateYouTubeCover({
        jobId: cleanId,
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
              "Cache-Control": "public, max-age=86400",
            },
          });
        }
      }
    } catch {}

    // Static fallback
    const staticFallback = path.join(process.cwd(), "public", "videos", "raw-vlog.jpg");
    if (fs.existsSync(staticFallback)) {
      return new NextResponse(fs.readFileSync(staticFallback), {
        status: 200,
        headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400" },
      });
    }

    return NextResponse.json({ error: "Thumbnail not found" }, { status: 404 });
  } catch (err) {
    return NextResponse.json({ error: "Failed to read thumbnail" }, { status: 500 });
  }
}
