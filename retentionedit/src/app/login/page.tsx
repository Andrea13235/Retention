"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AuthModal } from "@/components/auth-modal";
import { Brand } from "@/components/brand";
import { useAuth } from "@/context/auth-context";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoggedIn, isLoading } = useAuth();

  const initialMode = searchParams.get("mode") === "login" ? "login" : "signup";

  React.useEffect(() => {
    if (isLoggedIn) {
      router.push("/");
    }
  }, [isLoggedIn, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#09090c] flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="space-y-6 flex flex-col items-center">
          <Brand variant="volt" />
          <div className="flex items-center gap-3 text-sm text-[#8e8e8e]">
            <Loader2 className="w-4 h-4 animate-spin text-[#d1fe17]" />
            <span>Verifying session...</span>
          </div>
        </div>
      </div>
    );
  }

  if (isLoggedIn) {
    return null;
  }

  return (
    <AuthModal
      isOpen={true}
      isStandalone={true}
      initialMode={initialMode}
      onClose={() => router.push("/")}
      onSuccess={() => router.push("/")}
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0b0b0b] flex flex-col items-center justify-center p-6 text-white text-center">
          <div className="space-y-6 flex flex-col items-center">
            <Brand />
            <div className="flex items-center gap-3 text-sm text-[#8e8e8e]">
              <Loader2 className="w-4 h-4 animate-spin text-[#8B5CF6]" />
              <span>Loading secure login...</span>
            </div>
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
