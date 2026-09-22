'use client';

import React, { Suspense, useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2,
  Sparkles,
  CheckCircle2,
  Lock,
  ArrowRight,
  ShieldCheck,
  Key,
  Copy,
  Check,
  Bot
} from 'lucide-react';
import { RetentionvoltLogo } from '@/components/RetentionvoltLogo';
import { MobbinAuthModal } from '@/components/MobbinAuthModal';
import { MobbinOnboardingModal } from '@/components/MobbinOnboardingModal';
import { useAuth } from '@/context/AuthContext';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

const MCP_REDIRECT_STORAGE_KEY = 'retentionvolt_mcp_redirect_uri';

function validateLoopbackUri(uri: string | null): string | null {
  if (!uri) return null;
  const trimmed = uri.trim();
  try {
    const parsed = new URL(trimmed);
    if (
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    ) {
      return trimmed;
    }
  } catch {
    // Invalid URI format
  }
  return null;
}

function LoginMcpContent() {
  const searchParams = useSearchParams();
  const { user, isLoggedIn, isLoading, onboardingCompleted, refreshSession } = useAuth();

  // 1. Extract & validate loopback redirect_uri
  const paramRedirectUri = searchParams.get('redirect_uri');
  const [redirectUri, setRedirectUri] = useState<string | null>(() => {
    return validateLoopbackUri(paramRedirectUri);
  });

  // Persist / restore redirect_uri across OAuth & Stripe redirects
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const currentPath = window.location.pathname + window.location.search;
        localStorage.setItem('retentionvolt_auth_redirect', currentPath);
        sessionStorage.setItem('retentionvolt_auth_redirect', currentPath);
      } catch {}

      if (paramRedirectUri) {
        const valid = validateLoopbackUri(paramRedirectUri);
        if (valid) {
          try {
            sessionStorage.setItem(MCP_REDIRECT_STORAGE_KEY, valid);
            localStorage.setItem(MCP_REDIRECT_STORAGE_KEY, valid);
            setRedirectUri(valid);
          } catch {}
        }
      } else {
        try {
          const stored =
            sessionStorage.getItem(MCP_REDIRECT_STORAGE_KEY) ||
            localStorage.getItem(MCP_REDIRECT_STORAGE_KEY);
          if (stored) {
            const valid = validateLoopbackUri(stored);
            if (valid) setRedirectUri(valid);
          }
        } catch {}
      }
    }
  }, [paramRedirectUri]);

  // 2. Stripe return handler (?upgrade=success)
  const [isVerifyingUpgrade, setIsVerifyingUpgrade] = useState(false);
  const [upgradeNotice, setUpgradeNotice] = useState<string | null>(null);

  useEffect(() => {
    const upgradeParam = searchParams.get('upgrade');
    if (upgradeParam === 'success') {
      setIsVerifyingUpgrade(true);
      setUpgradeNotice('Conferma del tuo abbonamento Pro con Stripe in corso...');
      let mounted = true;

      (async () => {
        for (let attempt = 0; attempt < 8; attempt++) {
          const plan = await refreshSession();
          if (plan === 'pro') {
            if (mounted) {
              setUpgradeNotice('🎉 Abbonamento Pro attivato! Generazione chiave CyberMCP...');
              setIsVerifyingUpgrade(false);
            }
            return;
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
        if (mounted) {
          setIsVerifyingUpgrade(false);
          setUpgradeNotice(
            'Pagamento ricevuto. Se il tuo stato Pro tarda qualche secondo ad attivarsi, ricarica la pagina.'
          );
        }
      })();

      return () => {
        mounted = false;
      };
    } else if (upgradeParam === 'cancel') {
      setUpgradeNotice('Procedura di pagamento annullata. È necessario il piano Pro per usare il server MCP.');
    }
  }, [searchParams, refreshSession]);

  // 3. Pro Paywall Checkout state
  const [billingCycle, setBillingCycle] = useState<'yearly' | 'monthly'>('yearly');
  const [hasConsented, setHasConsented] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const handleStartProCheckout = async () => {
    setCheckoutError(null);
    if (!hasConsented) {
      setCheckoutError('Devi accettare Termini di Servizio e Privacy Policy per continuare.');
      return;
    }
    setIsCheckoutLoading(true);

    try {
      const currentUri = redirectUri ? `&redirect_uri=${encodeURIComponent(redirectUri)}` : '';
      const successUrl = `/login-mcp?session_id={CHECKOUT_SESSION_ID}&upgrade=success${currentUri}`;
      const cancelUrl = `/login-mcp?upgrade=cancel${currentUri}`;

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingCycle,
          userId: user?.id,
          userEmail: user?.email,
          successUrl,
          cancelUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore durante l\'avvio del checkout');

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('URL di checkout mancante');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setCheckoutError(err?.message || 'Impossibile avviare il checkout.');
      setIsCheckoutLoading(false);
    }
  };

  // 4. Pro Key generation and automatic redirect to client callback
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [redirectStatus, setRedirectStatus] = useState<string | null>(null);

  const triggerKeyConnect = useCallback(async () => {
    setIsGeneratingKey(true);
    setRedirectStatus('Generazione chiave di sicurezza CyberMCP...');

    try {
      let token = '';
      if (isSupabaseConfigured && supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token || '';
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/mcp/keys', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'AI Agent Auto-Connect Key',
          autoRotate: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Impossibile generare la chiave MCP');

      const fullKey = data.key;
      setGeneratedKey(fullKey);

      // Perform automatic loopback redirect if redirect_uri exists
      if (redirectUri) {
        setRedirectStatus('⚡ Collegamento in corso con il tuo client locale...');
        try {
          sessionStorage.removeItem(MCP_REDIRECT_STORAGE_KEY);
          localStorage.removeItem(MCP_REDIRECT_STORAGE_KEY);
        } catch {}

        const separator = redirectUri.includes('?') ? '&' : '?';
        const targetUrl = `${redirectUri}${separator}key=${encodeURIComponent(fullKey)}`;

        // Immediate redirect to local client callback
        window.location.href = targetUrl;
      } else {
        setRedirectStatus(null);
      }
    } catch (err: any) {
      console.error('Key generation error:', err);
      setRedirectStatus(`Errore: ${err?.message || 'Generazione chiave non riuscita'}`);
    } finally {
      setIsGeneratingKey(false);
    }
  }, [redirectUri]);

  // Automatically trigger key generation when user is authenticated Pro
  useEffect(() => {
    if (!isLoading && isLoggedIn && user?.plan === 'pro' && !generatedKey && !isGeneratingKey) {
      triggerKeyConnect();
    }
  }, [isLoading, isLoggedIn, user?.plan, generatedKey, isGeneratingKey, triggerKeyConnect]);

  // Loading state
  if (isLoading || isVerifyingUpgrade) {
    return (
      <div className="min-h-screen bg-[#0b0b0b] flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="space-y-6 flex flex-col items-center">
          <div className="p-4 rounded-3xl bg-[#141414] border border-[#262626] shadow-2xl">
            <RetentionvoltLogo variant="icon" size={48} />
          </div>
          <div className="flex items-center gap-3 text-sm text-[#8e8e8e]">
            <Loader2 className="w-4 h-4 animate-spin text-[#d1fe17]" />
            <span>{upgradeNotice || 'Verifica credenziali e stato CyberMCP...'}</span>
          </div>
        </div>
      </div>
    );
  }

  // CASE 1: Not Logged In -> Show Mobbin Auth Modal in Standalone Mode
  if (!isLoggedIn) {
    return (
      <MobbinAuthModal
        isOpen={true}
        isStandalone={true}
        initialMode="login"
        onClose={() => {
          window.location.href = '/';
        }}
        onSuccess={() => {
          // On login success, re-evaluate next step
          refreshSession();
        }}
      />
    );
  }

  // CASE 2: Logged In, but Never Completed Onboarding -> Mandatory Onboarding with Pro
  if (!onboardingCompleted) {
    return (
      <MobbinOnboardingModal
        isOpen={true}
        isMcpMode={true}
        onFinished={() => {
          // When onboarding finishes, check if Pro was activated or show paywall
          refreshSession();
        }}
      />
    );
  }

  // CASE 3: Logged In & Onboarded, but NOT PRO -> Mandatory Pro Subscription Required
  if (user?.plan !== 'pro') {
    return (
      <div className="min-h-screen bg-[#0b0b0b] text-white flex flex-col selection:bg-[#d1fe17] selection:text-black">
        {/* Top Bar */}
        <header className="w-full flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f] bg-[#0b0b0b]/90 backdrop-blur z-20">
          <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <RetentionvoltLogo variant="icon" size={28} />
            <span className="font-bold text-sm tracking-tight text-white hidden sm:inline">
              RETENTIONVOLT
            </span>
          </Link>
          <div className="flex items-center gap-2 text-xs font-mono text-[#d1fe17]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>CyberMCP AI Server Portal</span>
          </div>
        </header>

        {/* Mandatory Paywall Container */}
        <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-xl bg-[#14151a] border border-[#262835] rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6 relative overflow-hidden">
            <div className="absolute -top-32 -right-32 w-80 h-80 bg-[#d1fe17]/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-[#d1fe17]/10 border border-[#d1fe17]/30 flex items-center justify-center mx-auto text-[#d1fe17]">
                <Bot className="w-7 h-7" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#d1fe17]/10 text-[#d1fe17] text-[11px] font-mono font-bold uppercase tracking-wider border border-[#d1fe17]/30">
                <span>Abbonamento Pro Obbligatorio</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Collega CyberMCP al tuo Assistente AI
              </h1>
              <p className="text-xs sm:text-sm text-[#8e8e8e] leading-relaxed max-w-md mx-auto">
                Per permettere al tuo agente AI (Codex, Claude Code, Cursor) di interrogare oltre{' '}
                <span className="text-white font-semibold">500.000 curve di ritenzione</span> e iniettare ritmi di taglio virali, è richiesto un account Pro attivo.
              </p>
            </div>

            {upgradeNotice && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium text-center">
                {upgradeNotice}
              </div>
            )}

            {checkoutError && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium text-center">
                {checkoutError}
              </div>
            )}

            {/* Plan Selector */}
            <div className="grid grid-cols-2 gap-3 p-1.5 bg-[#0f1014] rounded-2xl border border-[#20222a]">
              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`p-3 rounded-xl text-left transition-all ${
                  billingCycle === 'yearly'
                    ? 'bg-[#1b1d25] border border-[#d1fe17]/40 shadow-sm'
                    : 'border border-transparent hover:bg-[#15171e]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Annuale (50% OFF)</span>
                  <span className="text-[10px] font-mono text-[#d1fe17] font-bold">Consigliato</span>
                </div>
                <div className="text-lg font-extrabold text-white mt-1">$6 <span className="text-xs text-[#8e8e8e] font-normal">/ mese</span></div>
                <p className="text-[10px] text-[#8e8e8e] mt-0.5">$72 fatturati all&apos;anno • 7 giorni gratis</p>
              </button>

              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`p-3 rounded-xl text-left transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-[#1b1d25] border border-[#d1fe17]/40 shadow-sm'
                    : 'border border-transparent hover:bg-[#15171e]'
                }`}
              >
                <div className="text-xs font-bold text-white">Mensile</div>
                <div className="text-lg font-extrabold text-white mt-1">$12 <span className="text-xs text-[#8e8e8e] font-normal">/ mese</span></div>
                <p className="text-[10px] text-[#8e8e8e] mt-0.5">Rinnovo flessibile • Disdici quando vuoi</p>
              </button>
            </div>

            {/* Feature List */}
            <ul className="space-y-2 text-xs text-[#ccc] border-y border-[#20222a] py-4">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#d1fe17] shrink-0" />
                <span>Accesso illimitato al server CyberMCP via Bearer Token</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#d1fe17] shrink-0" />
                <span>500.000+ ritmi di taglio, zoom dinamici e pattern interrupts</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#d1fe17] shrink-0" />
                <span>Configurazione automatica a 1 clic per Codex e Claude Code</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#d1fe17] shrink-0" />
                <span>Export EDL e XML per Premiere Pro e DaVinci Resolve</span>
              </li>
            </ul>

            {/* Consent Checkbox */}
            <label className="flex items-start gap-2.5 text-xs text-[#8e8e8e] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasConsented}
                onChange={(e) => setHasConsented(e.target.checked)}
                className="mt-0.5 rounded border-[#333] bg-[#1a1a1a] text-[#d1fe17] focus:ring-0"
              />
              <span>
                Accetto i{' '}
                <a href="/terms" target="_blank" className="text-white underline">
                  Termini di Servizio
                </a>{' '}
                e la{' '}
                <a href="/privacy" target="_blank" className="text-white underline">
                  Privacy Policy
                </a>{' '}
                di RETENTIONVOLT.
              </span>
            </label>

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleStartProCheckout}
              disabled={isCheckoutLoading}
              className="w-full py-3.5 rounded-full bg-white hover:bg-neutral-200 text-black font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-80"
            >
              {isCheckoutLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Apertura Stripe Checkout...</span>
                </>
              ) : (
                <>
                  <span>
                    {billingCycle === 'yearly'
                      ? 'Inizia Prova Gratuita di 7 Giorni & Connetti'
                      : 'Abbonati a Pro & Connetti ($12/mese)'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </main>
      </div>
    );
  }

  // CASE 4: Logged In & PRO USER -> Issue Key and Perform Loopback Redirect
  return (
    <div className="min-h-screen bg-[#0b0b0b] flex flex-col items-center justify-center p-6 text-white text-center">
      <div className="max-w-md w-full space-y-6 flex flex-col items-center bg-[#14151a] border border-[#262835] rounded-3xl p-8 sm:p-10 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-[#d1fe17]/10 border border-[#d1fe17]/30 flex items-center justify-center text-[#d1fe17]">
          {redirectStatus?.startsWith('⚡') ? (
            <CheckCircle2 className="w-8 h-8 animate-pulse text-[#d1fe17]" />
          ) : (
            <Key className="w-8 h-8 text-[#d1fe17]" />
          )}
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#d1fe17]/10 text-[#d1fe17] text-[11px] font-mono font-bold uppercase tracking-wider border border-[#d1fe17]/30">
            <span>CyberMCP Connesso • Piano Pro</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {redirectUri ? 'Collegamento in corso...' : 'Chiave CyberMCP Pronta'}
          </h2>
          <p className="text-xs text-[#8e8e8e] leading-relaxed">
            {redirectStatus ||
              (redirectUri
                ? 'Reindirizzamento al tuo assistente AI in corso...'
                : 'Copia la chiave per utilizzarla con Codex o Claude Code.')}
          </p>
        </div>

        {/* In case no redirect_uri was provided, show manual copy field */}
        {!redirectUri && generatedKey && (
          <div className="w-full space-y-3 pt-2">
            <div className="p-3 bg-[#0c0d12] rounded-xl border border-[#262835] font-mono text-xs text-[#d1fe17] break-all select-all text-left">
              {generatedKey}
            </div>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(generatedKey);
                setCopiedKey(true);
                setTimeout(() => setCopiedKey(false), 2500);
              }}
              className="w-full py-2.5 rounded-full bg-white hover:bg-neutral-200 text-black font-bold text-xs transition-all flex items-center justify-center gap-2"
            >
              {copiedKey ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              <span>{copiedKey ? 'Chiave Copiata!' : 'Copia Chiave API'}</span>
            </button>

            <Link
              href="/settings/mcp"
              className="inline-block text-xs text-[#8e8e8e] hover:text-white underline pt-2"
            >
              Visualizza documentazione in Impostazioni MCP →
            </Link>
          </div>
        )}

        {redirectUri && (
          <div className="flex items-center gap-2.5 text-xs text-[#d1fe17] pt-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Reindirizzamento verso {redirectUri}...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LoginMcpPage() {
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
              <span>Caricamento CyberMCP Portal...</span>
            </div>
          </div>
        </div>
      }
    >
      <LoginMcpContent />
    </Suspense>
  );
}
