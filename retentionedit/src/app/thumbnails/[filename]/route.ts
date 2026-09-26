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
    const filePath = path.join(process.cwd(), "public", "thumbnails", safeFilename);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Thumbnail not found" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": safeFilename.endsWith(".jpg") || safeFilename.endsWith(".jpeg") ? "image/jpeg" : "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to read thumbnail" }, { status: 500 });
  }
}
