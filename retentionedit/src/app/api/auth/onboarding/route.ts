import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import { completeUserOnboarding } from "@/lib/auth-store";
import { requireAuth } from "@/lib/server-auth";

// POST /api/auth/onboarding
// Persists the OpusClip-style onboarding answers and marks the user as done.
// Requires authenticated session.
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult && authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const body = await req.json().catch(() => ({}));
    const email = (authResult.user.email || body.email || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Email mancante." }, { status: 400 });
    }

    const answers = {
      onboardingRole: body.onboardingRole || body.role || undefined,
      orgSize: body.orgSize || undefined,
      socialReach: body.socialReach || undefined,
      contentType: body.contentType || undefined,
      hearSource: body.hearSource || undefined,
    };

    // 1. Sync into dedicated Supabase (if configured, never RetentionVolt)
    // When Supabase is the source of truth, the local users.json store may
    // not contain this user — treat the Supabase update as success.
    let supabaseSynced = false;
    if (isSupabaseConfigured && supabaseAdmin) {
      try {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existing = listData?.users?.find(
          (u) => u.email?.toLowerCase() === email
        );
        if (existing) {
          const { error } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
            user_metadata: {
              ...(existing.user_metadata || {}),
              ...(answers.onboardingRole
                ? { role: answers.onboardingRole, onboardingRole: answers.onboardingRole }
                : {}),
              ...(answers.orgSize ? { orgSize: answers.orgSize } : {}),
              ...(answers.socialReach ? { socialReach: answers.socialReach } : {}),
              ...(answers.contentType ? { contentType: answers.contentType } : {}),
              ...(answers.hearSource ? { hearSource: answers.hearSource } : {}),
              onboarding_completed: true,
            },
          });
          if (!error) supabaseSynced = true;
        }
      } catch (sbErr) {
        console.error("Supabase onboarding sync error:", sbErr);
      }
    }

    // 2. Local store (source of truth when Supabase is not configured)
    const updated = completeUserOnboarding(email, answers);
    if (updated) {
      return NextResponse.json({ success: true, user: updated });
    }
    if (supabaseSynced) {
      return NextResponse.json({
        success: true,
        user: { email, onboardingCompleted: true, ...answers },
      });
    }
    return NextResponse.json({ error: "Utente non trovato." }, { status: 404 });
  } catch (err: any) {
    console.error("Onboarding route error:", err);
    return NextResponse.json(
      { error: err.message || "Errore durante il salvataggio dell'onboarding." },
      { status: 500 }
    );
  }
}
