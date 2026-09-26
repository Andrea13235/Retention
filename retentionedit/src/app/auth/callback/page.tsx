"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Brand } from "@/components/brand";
import { Loader2 } from "lucide-react";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const processAuth = async () => {
      try {
        if (!isSupabaseConfigured || !supabase) {
          router.replace("/");
          return;
        }

        const code = searchParams.get("code");
        const next = searchParams.get("next") || "/?view=app";

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("Exchange code error:", error);
            if (isMounted) {
              setErrorMsg(error.message);
              setTimeout(() => {
                if (typeof window !== "undefined") window.location.href = "/";
              }, 3000);
            }
            return;
          }
        }

        // Check active session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error("Get session error:", sessionError);
          if (isMounted) {
            setErrorMsg(sessionError.message);
            setTimeout(() => {
              if (typeof window !== "undefined") window.location.href = "/";
            }, 3000);
          }
          return;
        }

        if (session?.user) {
          const meta = session.user.user_metadata || {};
          const appMeta = session.user.app_metadata || {};
          const liveUser = {
            id: session.user.id,
            email: session.user.email || "",
            name: meta.name || meta.full_name || session.user.email?.split("@")[0] || "Creator",
            role: meta.role || "Video Creator",
            hearSource: meta.hearSource || "Google",
            useCase: meta.useCase || "Work",
            plan: appMeta.plan === "pro" || meta.plan === "pro" ? "pro" : "free",
            avatarUrl: meta.avatar_url || meta.picture || "",
            createdAt: session.user.created_at,
            onboardingCompleted: true,
          };
          localStorage.setItem("retentionedit_user_profile_v1", JSON.stringify(liveUser));
          localStorage.setItem("retentionedit_onboarding_completed_v1", "true");
          if (typeof window !== "undefined") {
            window.location.href = next;
          } else {
            router.replace(next);
          }
          return;
        }

        // If session not immediately available (e.g., hash fragment being parsed)
        const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
          if (newSession?.user) {
            authListener.subscription.unsubscribe();
            const meta = newSession.user.user_metadata || {};
            const appMeta = newSession.user.app_metadata || {};
            const liveUser = {
              id: newSession.user.id,
              email: newSession.user.email || "",
              name: meta.name || meta.full_name || newSession.user.email?.split("@")[0] || "Creator",
              role: meta.role || "Video Creator",
              hearSource: meta.hearSource || "Google",
              useCase: meta.useCase || "Work",
              plan: appMeta.plan === "pro" || meta.plan === "pro" ? "pro" : "free",
              avatarUrl: meta.avatar_url || meta.picture || "",
              createdAt: newSession.user.created_at,
              onboardingCompleted: true,
            };
            localStorage.setItem("retentionedit_user_profile_v1", JSON.stringify(liveUser));
            localStorage.setItem("retentionedit_onboarding_completed_v1", "true");
            if (typeof window !== "undefined") {
              window.location.href = next;
            } else {
              router.replace(next);
            }
          }
        });

        // Timeout safeguard
        setTimeout(() => {
          authListener.subscription.unsubscribe();
          if (typeof window !== "undefined") {
            window.location.href = next;
          } else {
            router.replace(next);
          }
        }, 2500);
      } catch (err: any) {
        console.error("Auth callback exception:", err);
        if (isMounted) {
          setErrorMsg(err.message || "Errore imprevisto durante l'autenticazione");
          setTimeout(() => {
            if (typeof window !== "undefined") window.location.href = "/";
          }, 3000);
        }
      }
    };

    processAuth();

    return () => {
      isMounted = false;
    };
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-[#0e0e12] flex flex-col items-center justify-center p-6 text-white text-center">
      <div className="space-y-6 flex flex-col items-center max-w-sm">
        <Brand />
        {errorMsg ? (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs text-center space-y-2">
            <p className="font-semibold text-white">Autenticazione non riuscita</p>
            <p className="text-[11px] leading-relaxed">{errorMsg}</p>
            <p className="text-[10px] text-[#8c8f9f] pt-1">Ritorno alla pagina di login...</p>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-xs text-[#8c8f9f]">
            <Loader2 className="w-4 h-4 animate-spin text-white" />
            <span>Completamento accesso sicuro in corso...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0e0e12] flex flex-col items-center justify-center p-6 text-white text-center">
          <div className="space-y-6 flex flex-col items-center">
            <Brand />
            <div className="flex items-center gap-3 text-xs text-[#8c8f9f]">
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Inizializzazione sessione...</span>
            </div>
          </div>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
