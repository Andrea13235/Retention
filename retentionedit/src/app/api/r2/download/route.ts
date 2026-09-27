import { NextRequest, NextResponse } from "next/server";
import { isR2Configured, presignPrivateGetUrl, sanitizeR2KeySegment } from "@/lib/r2";
import { requireAuth } from "@/lib/server-auth";

function stripR2Prefix(key: string): string {
  return key.startsWith("r2://") ? key.slice(5) : key;
}

/**
 * GET /api/r2/download?key=<r2Key>&redirect=1
 * Generates a private, short-lived presigned GET URL for the authenticated owner.
 * Total privacy guarantee:
 * - Requires authenticated session.
 * - Enforces that the key MUST belong to the user's isolated prefix:
 *   raw/<userId>/..., exports/<userId>/..., thumbnails/<userId>/...
 * - Never returns or uses public bucket URLs.
 * - Short expiry (900 seconds / 15 mins).
 */
export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult && authResult.errorResponse) {
    return authResult.errorResponse;
  }
  const userId = sanitizeR2KeySegment(authResult.user.userId, 50);

  const rawKey = (new URL(req.url).searchParams.get("key") || "").trim().slice(0, 600);
  const key = stripR2Prefix(rawKey);
  const redirect = new URL(req.url).searchParams.get("redirect") === "1";

  if (!key) {
    return NextResponse.json({ error: "key required" }, { status: 400 });
  }
  if (!isR2Configured()) {
    return NextResponse.json({ error: "R2 not configured" }, { status: 503 });
  }

  // Strict ownership check: key must belong to this authenticated user
  const isOwner =
    key.startsWith(`raw/${userId}/`) ||
    key.startsWith(`exports/${userId}/`) ||
    key.startsWith(`thumbnails/${userId}/`);

  if (!isOwner) {
    return NextResponse.json(
      { error: "Forbidden — You do not have permission to access this private video." },
      { status: 403 }
    );
  }

  // Always generate a private, signed GET URL with short TTL (15 minutes)
  const resolved = presignPrivateGetUrl(key, 900);
  if (!resolved) {
    return NextResponse.json({ error: "Failed to generate secure download link" }, { status: 500 });
  }

  if (redirect) {
    const res = NextResponse.redirect(resolved, 302);
    res.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
    return res;
  }

  const res = NextResponse.json({
    url: resolved,
    key,
    expiresInSec: 900,
    private: true,
  });
  res.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
  return res;
}
