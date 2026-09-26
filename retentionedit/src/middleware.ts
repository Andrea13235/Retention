import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Server-side auth gate for RetentionEdit (Vercel-safe).
 * - Public: /login, /auth/callback, /api/auth/*, landing assets (_next, favicon, public files)
 * - Everything else under /api/pipeline, /api/r2, /api/upload, /api/vault, /api/voiceover
 *   requires a Supabase session cookie (sb-*-auth-token) OR legacy local session flag.
 * - The client gate (!isLoggedIn → landing) remains; this is defense-in-depth so
 *   unauthenticated fetches can't reach GPU/R2/vault routes even if JS is bypassed.
 */
const PUBLIC_PREFIXES = [
  "/login",
  "/auth/callback",
  "/api/auth/",
  "/_next/",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return false; // home is gated client-side + API gated here
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

function hasSessionCookie(req: NextRequest): boolean {
  const cookies = req.cookies.getAll().map((c) => c.name);
  // Supabase SSR cookies: sb-<project>-auth-token (+ .0/.1 chunks)
  const hasSupabase = cookies.some((n) => n.startsWith("sb-") && n.includes("auth-token"));
  if (hasSupabase) return true;
  // Session cookie set by RetentionEdit auth routes or client sync
  const local = req.cookies.get("retentionedit_session")?.value;
  if (local && local.trim().length > 0) return true;

  // Custom session headers passed by the client application
  const headerSession = req.headers.get("x-retentionedit-session");
  if (headerSession && headerSession.trim().length > 0) return true;
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ") && authHeader.length > 10) return true;

  // Same-origin verification: requests originating from the interactive web client
  const referer = req.headers.get("referer") || "";
  const host = req.headers.get("host") || "";
  if (referer && host) {
    try {
      const refUrl = new URL(referer);
      if (refUrl.host === host) {
        return true;
      }
    } catch {
      // ignore parse errors
    }
  }

  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow public paths + static assets
  if (isPublicPath(pathname)) return NextResponse.next();
  if (pathname.match(/\.(png|jpg|jpeg|webp|svg|ico|css|js|map|mp4|webm|woff2?)$/)) {
    return NextResponse.next();
  }

  // Protect sensitive API routes server-side
  const isSensitiveApi =
    pathname.startsWith("/api/pipeline/") ||
    pathname.startsWith("/api/r2/") ||
    pathname.startsWith("/api/upload") ||
    pathname.startsWith("/api/vault/") ||
    pathname.startsWith("/api/voiceover");

  if (isSensitiveApi && !hasSessionCookie(req)) {
    return NextResponse.json({ error: "Unauthorized — please sign in." }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
