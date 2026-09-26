import { NextRequest, NextResponse } from "next/server";
import { isR2Configured, presignR2Url, r2ObjectUrl, sanitizeR2KeySegment } from "@/lib/r2";

function isR2Key(key: string): boolean {
  return key.startsWith("r2://");
}
function stripR2Prefix(key: string): string {
  return key.startsWith("r2://") ? key.slice(5) : key;
}

export async function GET(req: NextRequest) {
  const rawKey = (new URL(req.url).searchParams.get("key") || "").trim().slice(0, 600);
  const key = stripR2Prefix(rawKey);
  const userId = sanitizeR2KeySegment((new URL(req.url).searchParams.get("userId") || "anon").trim(), 40);
  const redirect = new URL(req.url).searchParams.get("redirect") === "1";
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
  if (!isR2Configured()) return NextResponse.json({ error: "R2 not configured" }, { status: 503 });
  // raw/ and exports/ and thumbnails/ are all valid; enforce per-user prefix
  if (!key.startsWith(`raw/${userId}/`) && !key.startsWith(`exports/${userId}/`) && !key.startsWith(`thumbnails/${userId}/`)) {
    return NextResponse.json({ error: "key does not match your user prefix" }, { status: 403 });
  }
  // Prefer public base URL if configured (no signing), else presigned GET
  const resolved = r2ObjectUrl(key) ?? presignR2Url({ method: "GET", key, expiresSec: 3600 });
  if (!resolved) return NextResponse.json({ error: "Failed to presign" }, { status: 500 });
  if (redirect) return NextResponse.redirect(resolved, 302);
  return NextResponse.json({ url: resolved, key, expiresInSec: 3600 });
}
