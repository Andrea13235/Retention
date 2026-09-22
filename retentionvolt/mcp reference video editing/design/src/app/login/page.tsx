'use client';

import React, { Suspense, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { RetentionvoltLogo } from '@/components/RetentionvoltLogo';
import { MobbinAuthModal } from '@/components/MobbinAuthModal';
import { useAuth } from '@/context/AuthContext';

const REDIRECT_STORAGE_KEY = 'retentionvolt_auth_redirect';

function sanitizeRedirectUrl(url: string | null): string {
  if (!url) return '/settings/mcp';
  const trimmed = url.trim();

  // Allow relative URLs starting with single slash (exclude protocol-relative //)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }

  // Allow localhost / loopback callback URLs for local code agent CLI callbacks
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
      return trimmed;
    }
  } catch {
    // Invalid URL
  }

  return '/settings/mcp';
}

function LoginFormContent() {
  const searchParams = useSearchParams();
  const { isLoggedIn, isLoading } = useAuth();

  const rawRedirect =
    searchParams.get('redirect') ||
    searchParams.get('next') ||
    searchParams.get('return_to') ||
    searchParams.get('redirect_uri');

  const safeRedirect = useMemo(() => sanitizeRedirectUrl(rawRedirect), [rawRedirect]);
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login';

  // Persist redirect target in storage for OAuth callbacks (e.g. Google sign-in)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(REDIRECT_STORAGE_KEY, safeRedirect);
        sessionStorage.setItem(REDIRECT_STORAGE_KEY, safeRedirect);
      } catch {
        // storage disabled or quota exceeded
      }
    }
  }, [safeRedirect]);

  // If already logged in, redirect immediately to target
  useEffect(() => {
    if (!isLoading && isLoggedIn) {
      window.location.href = safeRedirect;
    }
  }, [isLoading, isLoggedIn, safeRedirect]);

  if (isLoading || isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#0b0b0b] flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="space-y-6 flex flex-col items-center">
          <div className="p-4 rounded-3xl bg-[#141414] border border-[#262626] shadow-2xl">
            <RetentionvoltLogo variant="icon" size={48} />
          </div>
          <div className="flex items-center gap-3 text-sm text-[#8e8e8e]">
            <Loader2 className="w-4 h-4 animate-spin text-[#d1fe17]" />
            <span>
              {isLoggedIn
                ? `Accesso completato. Reindirizzamento a ${safeRedirect}...`
                : 'Verifica sessione in corso...'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <MobbinAuthModal
      isOpen={true}
      isStandalone={true}
      initialMode={initialMode}
      onClose={() => {
        window.location.href = '/';
      }}
      onSuccess={() => {
        window.location.href = safeRedirect;
      }}
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0b0b0b] flex flex-col items-center justify-center p-6 text-white text-center">
          <div className="space-y-6 flex flex-col items-center">
            <div className="p-4 rounded-3xl bg-[#141414] border border-[#262626] shadow-2xl">
              <RetentionvoltLogo variant="icon" size={48} />
            </div>
            <div className="flex items-center gap-3 text-sm text-[#8e8e8e]">
              <Loader2 className="w-4 h-4 animate-spin text-[#d1fe17]" />
              <span>Caricamento pagina di accesso...</span>
            </div>
          </div>
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
