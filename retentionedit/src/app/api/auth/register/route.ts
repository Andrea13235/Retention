import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { registerUser, checkAuthRateLimit } from "@/lib/auth-store";
import { setSessionCookie } from "@/lib/server-auth";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email e password sono obbligatorie." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "La password deve contenere almeno 6 caratteri." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // SECURITY: rate-limit mass registration (5/min per IP)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!checkAuthRateLimit(`register:${ip}`, 5)) {
      return NextResponse.json(
        { error: "Troppe registrazioni. Riprova tra un minuto." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    // 1. If a DEDICATED Supabase Admin client is configured (not RetentionVolt), use it
    if (isSupabaseConfigured && supabaseAdmin) {
      const displayName = name?.trim() || cleanEmail.split("@")[0];

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          name: displayName,
          full_name: displayName,
          role: "Video Creator",
          onboarding_completed: false,
        },
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("already been registered") || msg.includes("already exists")) {
          return NextResponse.json(
            { error: "Questa email è già registrata. Accedi con le tue credenziali." },
            { status: 409 }
          );
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      const res = NextResponse.json({ success: true, user: data.user });
      const userId = data.user?.id || cleanEmail;
      await setSessionCookie(res, userId, cleanEmail);
      return res;
    }

    // 2. Standalone isolated store for RetentionEdit
    const result = registerUser(cleanEmail, password, name);
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    const res = NextResponse.json({
      success: true,
      user: result.user,
    });
    const userId = result.user?.id || cleanEmail;
    await setSessionCookie(res, userId, cleanEmail);
    return res;
  } catch (err: any) {
    console.error("Register route error:", err);
    return NextResponse.json(
      { error: err.message || "Errore durante la registrazione." },
      { status: 500 }
    );
  }
}
