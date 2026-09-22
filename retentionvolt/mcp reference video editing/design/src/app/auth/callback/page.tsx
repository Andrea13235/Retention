'use client';

import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { RetentionvoltLogo } from '@/components/RetentionvoltLogo';

const LOCAL_STORAGE_KEY = 'retentionvolt_user_profile_v1';
const ONBOARDING_KEY = 'retentionvolt_onboarding_completed_v1';

export default function AuthCallbackPage() {
  const [status, setStatus] = useState('Verifica credenziali Google in corso...');
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  useEffect(() => {
    let finished = false;

    async function handleAuthCallback() {
      try {
        if (!isSupabaseConfigured || !supabase) {
          window.location.href = '/';
          return;
        }

        const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
        const urlObj = new URL(currentUrl);
        const searchParams = urlObj.searchParams;

        // Check for error parameters from OAuth / Supabase
        const errParam = searchParams.get('error') || searchParams.get('error_description');
        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        const hasHashError = hash.includes('error=');

        if (errParam || hasHashError) {
          const rawMsg = searchParams.get('error_description') || searchParams.get('error') || 'Accesso non autorizzato o annullato';
          const msg = decodeURIComponent(rawMsg.replace(/\+/g, ' '));
          console.error('OAuth callback error:', msg);
          setErrorDetails(msg);
          return;
        }

        // Check for authorization code (PKCE)
        const code = searchParams.get('code');
        if (code) {
          setStatus('Scambio token di sicurezza...');
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.warn('exchangeCodeForSession notice:', error.message);
          }
        }

        // Fetch current session after callback or token exchange
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.warn('Session retrieval notice:', sessionError.message);
        }

        if (session?.user) {
          const meta = session.user.user_metadata || {};
          const isCompleted = Boolean(
            meta.onboarding_completed ||
            meta.onboardingCompleted ||
            localStorage.getItem(`retentionvolt_onboarding_${session.user.id}`) === 'true'
          );

          const userProfile = {
            id: session.user.id,
            email: session.user.email || '',
            name: meta.name || meta.full_name || session.user.email?.split('@')[0] || 'Creator',
            role: meta.role || (isCompleted ? 'Video Editor' : ''),
            hearSource: meta.hearSource || '',
            useCase: meta.useCase || '',
            plan: meta.plan || 'free',
            avatarUrl: meta.avatar_url || meta.picture || '',
            createdAt: session.user.created_at,
            onboardingCompleted: isCompleted,
          };

          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(userProfile));
          if (isCompleted) {
            localStorage.setItem(ONBOARDING_KEY, 'true');
            localStorage.setItem(`retentionvolt_onboarding_${session.user.id}`, 'true');
          } else {
            localStorage.removeItem(ONBOARDING_KEY);
            localStorage.removeItem(`retentionvolt_onboarding_${session.user.id}`);
          }
          setStatus('Accesso completato! Caricamento applicazione...');
        }

        finished = true;

        let targetRedirect = '/';
        try {
          const stored =
            localStorage.getItem('retentionvolt_auth_redirect') ||
            sessionStorage.getItem('retentionvolt_auth_redirect');
          localStorage.removeItem('retentionvolt_auth_redirect');
          sessionStorage.removeItem('retentionvolt_auth_redirect');
          if (stored) {
            const trimmed = stored.trim();
            if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
              targetRedirect = trimmed;
            } else {
              try {
                const parsed = new URL(trimmed);
                if (
                  parsed.protocol === 'http:' &&
                  (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
                ) {
                  targetRedirect = trimmed;
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        } catch {
          // Ignore storage access errors
        }

        window.location.href = targetRedirect;
      } catch (err: any) {
        console.error('Unexpected auth callback error:', err);
        setErrorDetails(err?.message || 'Errore imprevisto durante il login');
      }
    }

    handleAuthCallback();

    // Fallback timer: if after 3.5s we haven't finished or errored, go to target
    const fallbackTimer = setTimeout(() => {
      if (!finished) {
        let fallbackTarget = '/';
        try {
          const stored =
            localStorage.getItem('retentionvolt_auth_redirect') ||
            sessionStorage.getItem('retentionvolt_auth_redirect');
          if (stored && stored.startsWith('/') && !stored.startsWith('//')) {
            fallbackTarget = stored;
          }
        } catch {
          // Ignore storage errors
        }
        window.location.href = fallbackTarget;
      }
    }, 3500);

    return () => clearTimeout(fallbackTimer);
  }, []);

  if (errorDetails) {
    return (
      <div className="min-h-screen bg-[#0b0b0b] flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="max-w-md w-full space-y-6 flex flex-col items-center bg-[#141414] border border-[#262626] rounded-3xl p-8 shadow-2xl">
          <div className="p-3 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-white">Accesso con Google non riuscito</h2>
            <p className="text-xs text-[#a0a0a0] leading-relaxed break-words">{errorDetails}</p>
          </div>
          <button
            onClick={() => { window.location.href = '/'; }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black font-semibold text-xs hover:bg-[#e0e0e0] transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Torna alla Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0b0b] flex flex-col items-center justify-center p-6 text-white text-center">
      <div className="space-y-6 flex flex-col items-center">
        <div className="p-4 rounded-3xl bg-[#141414] border border-[#262626] shadow-2xl">
          <RetentionvoltLogo variant="icon" size={48} />
        </div>
        <div className="flex items-center gap-3 text-sm text-[#8e8e8e]">
          <Loader2 className="w-4 h-4 animate-spin text-[#d1fe17]" />
          <span>{status}</span>
        </div>
      </div>
    </div>
  );
}
