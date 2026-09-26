import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { getOrCreateGoogleUser } from "@/lib/auth-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    // H2 server-side: reject mock/empty identity, fail loud.
    const email = (body.email || "").trim().toLowerCase();
    const name = body.name?.trim() || "";
    const avatarUrl = body.avatarUrl || "";
    if (!email || !email.includes("@") || email === "andrea.creator@gmail.com") {
      return NextResponse.json(
        { error: "Identità Google mancante o non valida." },
        { status: 400 }
      );
    }

    let supabaseUser: any = null;

    // 1. If dedicated Supabase is configured, create/sync user in Supabase
    if (isSupabaseConfigured && supabaseAdmin) {
      try {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existing = listData?.users?.find((u) => u.email?.toLowerCase() === email);

        if (existing) {
          supabaseUser = existing;
        } else {
          const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: {
              name,
              full_name: name,
              avatar_url: avatarUrl,
              picture: avatarUrl,
              role: "Video Creator",
              provider: "google",
              onboarding_completed: false,
            },
          });

          if (!error && created?.user) {
            supabaseUser = created.user;
          }
        }
      } catch (sbErr) {
        console.error("Supabase Google sync error:", sbErr);
      }
    }

    // 2. Local fallback store
    const fallbackUser = getOrCreateGoogleUser({
      email,
      name: name || email.split("@")[0] || "Creator",
      avatarUrl,
    });

    const res = NextResponse.json({
      success: true,
      user: supabaseUser
        ? {
            id: supabaseUser.id,
            email: supabaseUser.email,
            name: supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name || name,
            avatarUrl: supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture || avatarUrl,
            role: "Video Creator",
            plan: "free",
            createdAt: supabaseUser.created_at || new Date().toISOString(),
            onboardingCompleted: true,
          }
        : fallbackUser,
    });
    // ROOT-CAUSE FIX (origin_mismatch follow-up): the client gate (!isLoggedIn)
    // is not enough — middleware gates /api/pipeline/* server-side on a session
    // cookie. Mirror /api/auth/login: set the httpOnly session flag so Google
    // sign-in unlocks pipeline/R2/upload APIs exactly like email login.
    res.cookies.set("retentionedit_session", supabaseUser?.id || fallbackUser?.id || "google", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 8, // 8h
    });
    return res;
  } catch (err: any) {
    console.error("Google auth route error:", err);
    return NextResponse.json(
      { error: err.message || "Errore durante l'accesso con Google." },
      { status: 500 }
    );
  }
}

