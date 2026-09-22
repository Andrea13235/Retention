'use client';

import React, { useState } from 'react';
import { X, Check, ShieldCheck, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth?: () => void;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({ isOpen, onClose, onOpenAuth }) => {
  const { user, isLoggedIn } = useAuth();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);
  const [hasConsented, setHasConsented] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCheckout = async () => {
    setErrorMessage(null);

    if (isLoggedIn && !hasConsented) {
      setErrorMessage('Devi accettare Termini e Privacy Policy per continuare (vedi /terms e /privacy).');
      return;
    }

    // If user is not authenticated, prompt login/signup first
    if (!isLoggedIn) {
      onClose();
      if (onOpenAuth) {
        onOpenAuth();
      }
      return;
    }

    setIsLoadingCheckout(true);

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          billingCycle,
          userId: user?.id,
          userEmail: user?.email,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start Stripe checkout');
      }

      if (data.url && (data.url.startsWith('https://checkout.stripe.com/') || data.url.startsWith(window.location.origin))) {
        window.location.href = data.url;
      } else {
        throw new Error('Invalid or missing checkout URL received from Stripe');
      }
    } catch (err: unknown) {
      console.error('Checkout error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Error redirecting to Stripe');
      setIsLoadingCheckout(false);
    }
  };

  const isCurrentPro = user?.plan === 'pro';

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl bg-[#121212] border border-[#262626] rounded-3xl shadow-2xl overflow-hidden my-auto"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 z-20 p-2 rounded-full bg-[#1c1c1c] text-[#8e8e8e] hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-10 space-y-8 max-h-[88vh] overflow-y-auto">
          {/* Header */}
          <div className="text-center space-y-3 max-w-xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#d1fe17]/10 border border-[#d1fe17]/30 text-[#d1fe17] text-xs font-mono font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>CREATOR INTELLIGENCE SUITE</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Unlock RETENTIONVOLT Pro
            </h2>
            <p className="text-sm text-[#8e8e8e] leading-relaxed">
              Unlimited access to 500,000+ retention curves, Premiere/DaVinci EDL project files,
              and CyberMCP server integrations for autonomous AI agents.
            </p>

            {/* Billing Switcher */}
            <div className="inline-flex items-center gap-2 p-1 rounded-full bg-[#1c1c1c] border border-[#2a2a2a] mt-2">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'text-[#8e8e8e] hover:text-white'
                }`}
              >
                Monthly ($12/mo)
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                  billingCycle === 'yearly'
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'text-[#8e8e8e] hover:text-white'
                }`}
              >
                <span>Annual ($6/mo)</span>
                <span className="text-[10px] uppercase font-mono font-extrabold bg-[#d1fe17] text-black px-1.5 py-0.5 rounded-full">
                  50% OFF • 7-DAY TRIAL
                </span>
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium text-center">
              {errorMessage}
            </div>
          )}

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Free Starter Plan */}
            <div className="p-6 rounded-2xl bg-[#181818] border border-[#262626] flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-base text-white">Starter Free</h3>
                  <p className="text-xs text-[#8e8e8e] mt-1">Browse 4 featured benchmark studies.</p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white font-mono">$0</span>
                  <span className="text-xs text-[#8e8e8e]">/ forever</span>
                </div>

                <ul className="space-y-2.5 text-xs text-[#8e8e8e] pt-2 border-t border-[#262626]">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Browse 4 featured video breakdowns</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Thumbnail inspiration &amp; preview</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Pacing &amp; hook breakdown insights</span>
                  </li>
                  <li className="flex items-center gap-2 text-neutral-500">
                    <X className="w-3.5 h-3.5 text-neutral-600" />
                    <span>No MCP server access (Pro only)</span>
                  </li>
                  <li className="flex items-center gap-2 text-neutral-500">
                    <X className="w-3.5 h-3.5 text-neutral-600" />
                    <span>No EDL or XML timeline exports</span>
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-full bg-[#242424] hover:bg-[#303030] text-xs font-semibold text-white transition-colors"
              >
                {!isCurrentPro ? 'Current Plan' : 'Free Tier'}
              </button>
            </div>

            {/* Pro Plan */}
            <div className="p-6 rounded-2xl bg-[#181818] border-2 border-white flex flex-col justify-between space-y-6 shadow-xl relative">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base text-white">Pro Creator</h3>
                    <p className="text-xs text-[#8e8e8e] mt-1">For editors, studios &amp; AI agents.</p>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#d1fe17] text-black font-extrabold">
                    {billingCycle === 'yearly' ? '7-DAY TRIAL' : 'POPULAR'}
                  </span>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white font-mono">
                    {billingCycle === 'yearly' ? '$6' : '$12'}
                  </span>
                  <span className="text-xs text-[#8e8e8e]">
                    / month {billingCycle === 'yearly' ? '($72 billed yearly • 50% OFF)' : '(billed monthly)'}
                  </span>
                </div>

                {billingCycle === 'yearly' && (
                  <div className="text-[11px] font-mono text-[#d1fe17] bg-[#d1fe17]/10 px-2.5 py-1 rounded-lg border border-[#d1fe17]/20 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#d1fe17]" />
                    <span>Includes 7 days free trial. No charge today!</span>
                  </div>
                )}

                <ul className="space-y-2.5 text-xs text-white pt-2 border-t border-[#262626]">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#d1fe17]" />
                    <span className="font-semibold">Complete access to all videos &amp; cuts</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#d1fe17]" />
                    <span className="font-semibold text-[#d1fe17]">CyberMCP Server Remote Access</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#d1fe17]" />
                    <span>Export Premiere/DaVinci EDL &amp; XML</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#d1fe17]" />
                    <span>Full timeline pacing curves &amp; sound markers</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#d1fe17]" />
                    <span>Weekly new creator retention drops</span>
                  </li>
                </ul>
              </div>

              {isCurrentPro ? (
                <div className="w-full py-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold text-center flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>Your Plan: Pro Active</span>
                </div>
              ) : (
                <>
                  <label className="flex items-start gap-2 text-[11px] text-[#8e8e8e] leading-snug cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={hasConsented}
                      onChange={(e) => setHasConsented(e.target.checked)}
                      className="mt-0.5 w-3.5 h-3.5 accent-white rounded border-[#333]"
                    />
                    <span>
                      Accetto i <a href="/terms" className="underline decoration-white/30 underline-offset-4 hover:text-white">Termini di Servizio</a> e la{' '}
                      <a href="/privacy" className="underline decoration-white/30 underline-offset-4 hover:text-white">Privacy Policy</a> e acconsento all’uso dei cookie come da{' '}
                      <a href="/cookies" className="underline decoration-white/30 underline-offset-4 hover:text-white">Cookie Policy</a>. Ho compreso che l’abbonamento è ricorrente e si rinnova fino a disdetta (1 click in Settings → Billing).
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={handleCheckout}
                    disabled={isLoadingCheckout || (isLoggedIn && !isCurrentPro && !hasConsented)}
                    className="w-full py-2.5 rounded-full bg-white hover:bg-neutral-200 text-black text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoadingCheckout ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      <span>Opening Stripe Checkout...</span>
                    </>
                  ) : !isLoggedIn ? (
                    'Sign in to subscribe'
                  ) : billingCycle === 'yearly' ? (
                    'Start 7-Day Free Trial ($72/yr)'
                  ) : (
                    'Subscribe to Pro ($12/mo)'
                  )}
                </button>
                </>
              )}
            </div>
          </div>

          {/* Secure Payment Footer */}
          <div className="flex items-center justify-center gap-6 pt-4 text-xs text-[#666666] border-t border-[#262626]">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-white" />
              <span>Cancel anytime in 1 click • Encrypted 256-bit Stripe checkout</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
