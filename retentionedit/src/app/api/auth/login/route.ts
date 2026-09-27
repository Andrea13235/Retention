import { NextRequest, NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { verifyUserCredentials, checkAuthRateLimit } from "@/lib/auth-store";
import { setSessionCookie } from "@/lib/server-auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email e password sono obbligatorie." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // SECURITY: rate-limit brute force (8 tentativi/min per IP+email)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkAuthRateLimit(`login:${ip}:${cleanEmail}`)) {
      return NextResponse.json(
        { error: "Troppi tentativi. Riprova tra un minuto." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    // 1. If dedicated Supabase client is configured, authenticate through it
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      const res = NextResponse.json({ success: true, user: data.user, session: data.session });
      const userId = data.user?.id || cleanEmail;
      await setSessionCookie(res, userId, cleanEmail);
      return res;
    }

    // 2. Standalone isolated store for RetentionEdit
    const result = verifyUserCredentials(cleanEmail, password);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const res = NextResponse.json({
      success: true,
      user: result.user,
    });
    const userId = result.user?.id || cleanEmail;
    await setSessionCookie(res, userId, cleanEmail);
    return res;
  } catch (err: any) {
    console.error("Login route error:", err);
    return NextResponse.json(
      { error: err.message || "Errore durante l'accesso." },
      { status: 500 }
    );
  }
}
