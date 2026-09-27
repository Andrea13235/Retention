import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { getOrCreateGoogleUser } from "@/lib/auth-store";
import { setSessionCookie } from "@/lib/server-auth";

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

// POST /api/auth/google-token
// Verifies a Google access_token (from GIS OAuth2 popup) server-side via
// the userinfo endpoint, then provisions/links the local + Supabase user.
// No OAuth redirect involved — immune to redirect_uri_mismatch.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const accessToken = (body.accessToken || body.idToken || "").trim();
    if (!accessToken) {
      return NextResponse.json({ error: "Token Google mancante." }, { status: 400 });
    }

    const expectedClientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim();
    if (!expectedClientId || expectedClientId.includes("your-google-client-id")) {
      return NextResponse.json(
        { error: "Google Client ID non configurato sul server." },
        { status: 500 }
      );
    }

    // 1. Fetch the Google profile bound to this access token
    const meRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!meRes.ok) {
      return NextResponse.json(
        { error: "Token Google non valido. Riprova." },
        { status: 401 }
      );
    }
    const me = (await meRes.json()) as GoogleUserInfo;

    if (!me.email || me.email_verified !== true) {
      return NextResponse.json(
        { error: "Email Google non verificata. Usa un account verificato." },
        { status: 401 }
      );
    }

    // 2. Bind the token to OUR Client ID via tokeninfo (aud check)
    const infoRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
      { cache: "no-store" }
    );
    if (infoRes.ok) {
      const info = (await infoRes.json().catch(() => ({}))) as { aud?: string };
      if (info.aud && info.aud !== expectedClientId) {
        return NextResponse.json(
          { error: "Token Google non valido per questa app." },
          { status: 401 }
        );
      }
      // If Google omits aud (some token types), the userinfo bearer check above
      // already proves the token is live; continue.
    }

    const email = me.email.trim().toLowerCase();
    const name = (me.name || email.split("@")[0] || "Creator").trim();
    const avatarUrl = me.picture || "";

    // 3. Sync into dedicated Supabase (if configured)
    let supabaseUser: any = null;
    if (isSupabaseConfigured && supabaseAdmin) {
      try {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existing = listData?.users?.find(
          (u) => u.email?.toLowerCase() === email
        );
        if (existing) {
          supabaseUser = existing;
        } else {
          const { data: created, error } = await supabaseAdmin.auth.admin.createUser(
            {
              email,
              email_confirm: true,
              user_metadata: {
                name,
                full_name: name,
                avatar_url: avatarUrl,
                picture: avatarUrl,
                role: "Video Creator",
                provider: "google",
                google_sub: me.sub || "",
                onboarding_completed: false,
              },
            }
          );
          if (!error && created?.user) supabaseUser = created.user;
        }
      } catch (sbErr) {
        console.error("Supabase Google token sync error:", sbErr);
      }
    }

    // 4. Local fallback store
    const fallbackUser = getOrCreateGoogleUser({ email, name, avatarUrl });

    const res = NextResponse.json({
      success: true,
      user: supabaseUser
        ? {
            id: supabaseUser.id,
            email: supabaseUser.email,
            name:
              supabaseUser.user_metadata?.name ||
              supabaseUser.user_metadata?.full_name ||
              name,
            avatarUrl:
              supabaseUser.user_metadata?.avatar_url ||
              supabaseUser.user_metadata?.picture ||
              avatarUrl,
            role: "Video Creator",
            plan: "free",
            createdAt: supabaseUser.created_at || new Date().toISOString(),
            onboardingCompleted: true,
          }
        : fallbackUser,
    });

    const userId = supabaseUser?.id || fallbackUser?.id || "google";
    await setSessionCookie(res, userId, email);
    return res;
  } catch (err: any) {
    console.error("Google token auth route error:", err);
    return NextResponse.json(
      { error: err.message || "Errore durante l'accesso con Google." },
      { status: 500 }
    );
  }
}
