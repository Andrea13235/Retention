'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { RetentionvoltLogo } from '@/components/RetentionvoltLogo';
import { useAuth } from '@/context/AuthContext';
import { Check, X, Sparkles, ArrowRight, Bot } from 'lucide-react';

export default function PricingPage() {
  const { user, isLoggedIn } = useAuth();
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('annual');
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCheckout = async () => {
    if (!isLoggedIn) {
      window.location.href = '/login?mode=signup&redirect=/pricing';
      return;
    }
    setIsLoadingCheckout(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: billingInterval,
          email: user?.email,
          userId: user?.id,
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
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col selection:bg-neutral-800">
      {/* Navbar Header */}
      <header className="sticky top-0 z-40 w-full bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#1f1f1f]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <RetentionvoltLogo variant="icon" size={30} />
            <span className="font-extrabold text-sm tracking-tight text-white group-hover:opacity-90 transition-opacity">
              RETENTIONVOLT
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
            >
              Browse Catalog
            </Link>
            {isLoggedIn ? (
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300">
                Plan: <span className="font-bold text-white capitalize">{user?.plan || 'Free'}</span>
              </span>
            ) : (
              <Link
                href="/login?redirect=/pricing"
                className="text-xs font-semibold px-4 py-2 rounded-full bg-white text-black hover:bg-neutral-200 transition-all"
              >
                Log in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 w-full space-y-16">
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            Simple, Transparent Pricing
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Supercharge your edits with retention intelligence.
          </h1>
          <p className="text-sm sm:text-base text-neutral-400">
            Access 500,000+ cut cadences, DaVinci/Premiere EDL exports, and connect AI coding agents via the CyberMCP server.
          </p>

          {/* Billing Switcher */}
          <div className="pt-4 flex justify-center">
            <div className="inline-flex items-center p-1 bg-[#161616] border border-[#2a2a2a] rounded-full text-xs font-medium">
              <button
                type="button"
                onClick={() => setBillingInterval('monthly')}
                className={`px-5 py-2 rounded-full transition-all ${
                  billingInterval === 'monthly'
                    ? 'bg-white text-black font-bold shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Monthly ($12/mo)
              </button>
              <button
                type="button"
                onClick={() => setBillingInterval('annual')}
                className={`px-5 py-2 rounded-full transition-all flex items-center gap-1.5 ${
                  billingInterval === 'annual'
                    ? 'bg-white text-black font-bold shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span>Annual ($6/mo)</span>
                <span className="bg-emerald-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded-full">
                  50% OFF + 7-DAY TRIAL
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Error Banner if any */}
        {errorMessage && (
          <div className="max-w-xl mx-auto p-3.5 rounded-xl bg-red-950/50 border border-red-800/80 text-red-300 text-xs text-center font-medium">
            {errorMessage}
          </div>
        )}

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Card 1: Free Starter */}
          <div className="bg-[#121212] border border-[#242424] rounded-3xl p-8 flex flex-col justify-between relative shadow-xl">
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Free Tier</span>
                <h3 className="text-2xl font-bold text-white mt-1">Starter</h3>
                <p className="text-xs text-neutral-400 mt-2">
                  Essential access to explore retention pacing and evaluate reference cuts.
                </p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-white">$0</span>
                <span className="text-xs text-neutral-400">/ forever</span>
              </div>

              <ul className="space-y-3 text-xs text-neutral-300 pt-2 border-t border-[#1f1f1f]">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>4 Featured benchmark video breakdowns</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Thumbnail breakdown &amp; inspiration</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Basic shot cadences &amp; ASL metrics</span>
                </li>
                <li className="flex items-center gap-2.5 text-neutral-500">
                  <X className="w-4 h-4 text-neutral-600 shrink-0" />
                  <span>No CyberMCP server access for AI agents</span>
                </li>
                <li className="flex items-center gap-2.5 text-neutral-500">
                  <X className="w-4 h-4 text-neutral-600 shrink-0" />
                  <span>No Premiere/DaVinci EDL &amp; XML exports</span>
                </li>
              </ul>
            </div>

            <div className="pt-8">
              <Link
                href="/"
                className="w-full py-3 rounded-full bg-[#1c1c1c] hover:bg-[#252525] border border-[#2e2e2e] text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <span>Current Plan (Free)</span>
              </Link>
            </div>
          </div>

          {/* Pro Card */}
          <div className="rounded-3xl p-7 sm:p-8 bg-gradient-to-b from-[#181818] to-[#121212] border-2 border-blue-500/80 flex flex-col justify-between space-y-6 shadow-2xl relative">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                  Creator Pro
                </span>
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  {billingInterval === 'annual' ? '7-Day Free Trial' : 'All-Inclusive'}
                </span>
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-black text-white">
                  {billingInterval === 'annual' ? '$6' : '$12'}
                </span>
                <span className="text-xs text-neutral-400">
                  / month {billingInterval === 'annual' ? '($72 billed annually)' : '(billed monthly)'}
                </span>
              </div>

              <p className="text-xs text-neutral-400">
                Full access for video editors, YouTube creators, agencies, and autonomous AI agents.
              </p>

              <ul className="space-y-3 text-xs text-neutral-200 pt-2 border-t border-[#222]">
                <li className="flex items-center gap-2.5 font-medium">
                  <Check className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Unlimited access to 500,000+ cuts &amp; video breakdowns</span>
                </li>
                <li className="flex items-center gap-2.5 font-medium">
                  <Bot className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>CyberMCP Server remote access for AI agents</span>
                </li>
                <li className="flex items-center gap-2.5 font-medium">
                  <Check className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Premiere Pro &amp; DaVinci Resolve EDL / XML export</span>
                </li>
                <li className="flex items-center gap-2.5 font-medium">
                  <Check className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Full timeline pacing curves &amp; sound markers</span>
                </li>
                <li className="flex items-center gap-2.5 font-medium">
                  <Check className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Continuous library updates &amp; viral breakdowns</span>
                </li>
                <li className="flex items-center gap-2.5 font-medium">
                  <Check className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Zero player watermarks &amp; high-bitrate references</span>
                </li>
              </ul>
            </div>

            <div className="pt-8">
              {isCurrentPro ? (
                <div className="w-full py-3 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 font-bold text-xs text-center">
                  ✓ Active Pro Subscription
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={isLoadingCheckout}
                  className="w-full py-3.5 rounded-full bg-white hover:bg-neutral-200 text-black font-extrabold text-xs transition-all shadow-lg hover:shadow-white/10 active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  {isLoadingCheckout ? (
                    'Connecting to Stripe Checkout...'
                  ) : billingInterval === 'annual' ? (
                    <>
                      <span>Start 7-Day Free Trial ($72/yr)</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <span>Subscribe to Pro ($12/mo)</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Feature Comparison Matrix */}
        <div className="max-w-4xl mx-auto pt-10 space-y-6">
          <h2 className="text-xl font-bold text-white text-center">Plan Comparison Matrix</h2>
          <div className="border border-[#222] rounded-2xl overflow-hidden bg-[#111]">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[#222] bg-[#161616]">
                  <th className="py-3 px-4 font-semibold text-neutral-300">Feature</th>
                  <th className="py-3 px-4 font-semibold text-neutral-400 text-center w-36">Starter Free</th>
                  <th className="py-3 px-4 font-bold text-blue-400 text-center w-48">Creator Pro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f1f1f] text-neutral-300">
                <tr>
                  <td className="py-3 px-4">Video Catalog Access</td>
                  <td className="py-3 px-4 text-center text-neutral-400">4 featured cuts</td>
                  <td className="py-3 px-4 text-center font-semibold text-emerald-400">500,000+ full cuts</td>
                </tr>
                <tr>
                  <td className="py-3 px-4">CyberMCP Server (Claude / Cursor / Windsurf)</td>
                  <td className="py-3 px-4 text-center text-neutral-500"><X className="w-3.5 h-3.5 mx-auto" /></td>
                  <td className="py-3 px-4 text-center font-bold text-emerald-400"><Check className="w-3.5 h-3.5 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3 px-4">EDL &amp; XML Exports (Premiere / DaVinci)</td>
                  <td className="py-3 px-4 text-center text-neutral-500"><X className="w-3.5 h-3.5 mx-auto" /></td>
                  <td className="py-3 px-4 text-center font-bold text-emerald-400"><Check className="w-3.5 h-3.5 mx-auto" /></td>
                </tr>
                <tr>
                  <td className="py-3 px-4">Player Watermark</td>
                  <td className="py-3 px-4 text-center text-neutral-400">Visible watermark</td>
                  <td className="py-3 px-4 text-center font-semibold text-white">Clean (No watermark)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQs */}
        <div className="max-w-3xl mx-auto pt-6 space-y-6">
          <h2 className="text-xl font-bold text-white text-center">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-[#141414] border border-[#222]">
              <h4 className="font-semibold text-sm text-white">How does the 7-day free trial work?</h4>
              <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                When you select the Annual plan ($6/month, billed $72 annually), you receive full access to all Pro features and the CyberMCP server for 7 days completely free. If you cancel before the 7 days are up, your card will not be charged.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-[#141414] border border-[#222]">
              <h4 className="font-semibold text-sm text-white">How do I connect the CyberMCP server to Claude or Cursor?</h4>
              <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                After subscribing to Pro, your API key is generated instantly in your Settings &gt; CyberMCP tab. You can paste the one-click configuration JSON directly into Claude Desktop or Cursor to query retention patterns and cut cadences natively from your prompt. Free accounts cannot authenticate with the MCP server.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-[#141414] border border-[#222]">
              <h4 className="font-semibold text-sm text-white">Can I switch between monthly and annual billing?</h4>
              <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                Yes, you can upgrade, downgrade, or cancel your subscription at any time directly through the Stripe Customer Portal accessible in your Billing settings.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1f1f1f] py-8 text-center text-xs text-neutral-500">
        <p>© 2026 RETENTIONVOLT. All rights reserved. Secure payments processed via Stripe.</p>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[11px]">
          <a href="/terms" className="underline decoration-white/20 underline-offset-4 hover:text-white">Termini</a>
          <span className="text-[#333]">·</span>
          <a href="/privacy" className="underline decoration-white/20 underline-offset-4 hover:text-white">Privacy</a>
          <span className="text-[#333]">·</span>
          <a href="/cookies" className="underline decoration-white/20 underline-offset-4 hover:text-white">Cookie</a>
          <span className="text-[#333]">·</span>
          <a href="/legal-notice" className="underline decoration-white/20 underline-offset-4 hover:text-white">Note Legali</a>
          <span className="text-[#333]">·</span>
          <button type="button" onClick={() => typeof window !== 'undefined' && window.dispatchEvent(new CustomEvent('rb:open-cookie-prefs'))} className="underline decoration-white/20 underline-offset-4 hover:text-white">Impostazioni cookie</button>
        </p>
      </footer>
    </div>
  );
}
