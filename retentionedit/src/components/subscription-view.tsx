"use client";
import React, { useState } from "react";
import { Info, Zap, Lock, ExternalLink, ShieldCheck, CreditCard, Sparkles, Loader2 } from "lucide-react";
import { STRIPE_PLANS, PlanId } from "@/lib/stripe";

interface SubscriptionViewProps {
  credits?: number;
  userEmail?: string;
  planId?: PlanId;
  onOpenPricing?: () => void;
}

export function SubscriptionView({
  credits = 25,
  userEmail = "andrea@retentionedit.com",
  planId = "free",
  onOpenPricing,
}: SubscriptionViewProps) {
  const [portalLoading, setPortalLoading] = useState(false);
  const currentPlan = STRIPE_PLANS[planId] || STRIPE_PLANS.free;
  const isPaid = planId !== "free";

  const handleOpenPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Impossibile aprire il portale Stripe");
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      alert(`Stripe Billing: ${err.message}`);
      setPortalLoading(false);
    }
  };

  return (
    <div className="flex flex-col text-[#f4f4f6] max-w-[960px] mx-auto pt-4 pb-20 select-none">
      {/* 1. Page Header */}
      <div>
        <h1 className="text-2xl sm:text-[28px] font-bold text-white tracking-tight">
          Subscription &amp; Billing
        </h1>
        <p className="text-xs sm:text-[13px] text-[#8c8c90] mt-1">
          Powered by Stripe &bull; Manage your active plan, credits, payment methods, and invoices.
        </p>
      </div>

      {/* 2. Top Card: Current Plan */}
      <div className="mt-6 rounded-2xl bg-[#232325] border border-[#2b2b2e] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2.5">
            <span className="text-lg font-bold text-white">{currentPlan.name}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
              isPaid
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-[#183925] text-[#34d399]"
            }`}>
              Active
            </span>
            {isPaid && (
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-white text-[10px] font-mono">
                {currentPlan.monthlyPriceEur}€ / mo
              </span>
            )}
          </div>
          <span className="text-xs sm:text-[13px] text-[#8c8c90] mt-1">
            {userEmail} &bull; {currentPlan.description}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {isPaid && (
            <button
              type="button"
              disabled={portalLoading}
              onClick={handleOpenPortal}
              className="px-4 py-2 rounded-full bg-[#2a2a2e] hover:bg-[#34343a] text-white text-xs sm:text-sm font-semibold border border-[#3b3b42] transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {portalLoading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Apertura portale...</span>
                </>
              ) : (
                <>
                  <CreditCard size={14} />
                  <span>Stripe Billing Portal</span>
                  <ExternalLink size={12} className="text-[#8c8c90]" />
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onOpenPricing}
            className="px-5 py-2 rounded-full bg-white text-black font-semibold text-xs sm:text-sm hover:bg-slate-200 transition cursor-pointer active:scale-95 shadow-md"
          >
            {isPaid ? "Change Plan" : "Upgrade"}
          </button>
        </div>
      </div>

      {/* 3. Two Columns: Credits & features / Billing & payment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* Left Card: Credits & features */}
        <div className="rounded-2xl bg-[#232325] border border-[#2b2b2e] p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center justify-between">
              <span>Credits &amp; Features</span>
              <span className="text-[11px] font-normal text-[#8c8c90]">Rollover enabled</span>
            </h2>

            {/* Row 1: Current balance */}
            <div className="flex items-center justify-between py-1.5 text-xs sm:text-[13px]">
              <span className="text-[#8c8c90] flex items-center gap-1.5">
                Current balance
                <Info size={13} className="text-[#8c8c90]" />
              </span>
              <span className="font-bold text-white flex items-center gap-1 text-sm">
                <Zap size={14} className="text-[#f59e0b] fill-[#f59e0b]" />
                {credits} Credits
              </span>
            </div>

            {/* Row 2: Plan credits */}
            <div className="flex items-center justify-between py-1.5 text-xs sm:text-[13px]">
              <span className="text-[#8c8c90]">Monthly plan allocation</span>
              <span className="text-white font-mono">{currentPlan.creditsMonthly} pts</span>
            </div>

            {/* Row 3: Max Tier */}
            <div className="flex items-center justify-between py-1.5 text-xs sm:text-[13px]">
              <span className="text-[#8c8c90]">Max GenAI Tier</span>
              <span className="text-white uppercase font-bold text-[11px] px-2 py-0.5 rounded bg-white/10">
                {currentPlan.capabilities.maxGenAITier}
              </span>
            </div>

            {/* Row 4: Max Resolution */}
            <div className="flex items-center justify-between py-1.5 text-xs sm:text-[13px]">
              <span className="text-[#8c8c90]">Hardware Export Speed</span>
              <span className="text-white font-mono text-[12px]">
                {currentPlan.capabilities.maxResolution.toUpperCase()} @ {currentPlan.capabilities.fps}fps
              </span>
            </div>

            {/* Credits expiration date box */}
            <div className="my-3 px-3.5 py-2.5 rounded-xl bg-[#1c1c1f] border border-[#2a2a2d] flex items-center justify-between text-xs">
              <span className="text-[#8c8c90]">Credits renewal &amp; rollover</span>
              <span className="text-emerald-400 font-medium">Automatic on cycle</span>
            </div>
          </div>
        </div>

        {/* Right Card: Billing & payment */}
        <div className="rounded-2xl bg-[#232325] border border-[#2b2b2e] p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white mb-4">
              Billing &amp; Payment
            </h2>

            {/* Row 1: Next cycle credits */}
            <div className="flex items-center justify-between py-1.5 text-xs sm:text-[13px]">
              <span className="text-[#8c8c90]">Monthly recurring credits</span>
              <span className="text-white font-mono">{currentPlan.creditsMonthly} pts</span>
            </div>

            {/* Row 2: Security */}
            <div className="flex items-center justify-between py-1.5 text-xs sm:text-[13px]">
              <span className="text-[#8c8c90]">Payment processor</span>
              <span className="text-white flex items-center gap-1">
                <ShieldCheck size={14} className="text-emerald-400" />
                Stripe 256-bit SSL
              </span>
            </div>

            {/* Row 3: Priority Queue */}
            <div className="flex items-center justify-between py-1.5 text-xs sm:text-[13px]">
              <span className="text-[#8c8c90]">Modal GPU Queue Priority</span>
              <span className={currentPlan.capabilities.priorityQueue ? "text-emerald-400 font-semibold" : "text-[#8c8c90]"}>
                {currentPlan.capabilities.priorityQueue ? "Priority (2x faster)" : "Standard Queue"}
              </span>
            </div>
          </div>

          {/* Manage Invoices / Portal Container */}
          <div className="mt-6 pt-3 border-t border-[#2a2a2d] flex items-center justify-between">
            <span className="text-xs text-[#8c8c90]">
              {isPaid ? "Invoices & receipts handled in Stripe" : "No active paid subscription"}
            </span>
            {isPaid ? (
              <button
                type="button"
                onClick={handleOpenPortal}
                className="text-xs text-white hover:text-emerald-400 transition font-medium cursor-pointer underline flex items-center gap-1"
              >
                Invoices &amp; Cards &rarr;
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenPricing}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition cursor-pointer"
              >
                Choose a plan &rarr;
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Bottom Card: Features Included in this Plan */}
      <div className="mt-4 rounded-2xl bg-[#232325] border border-[#2b2b2e] p-5">
        <h2 className="text-sm font-semibold text-white mb-3">
          Features included in {currentPlan.name}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {currentPlan.features.map((feat, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-[#b8b8be]">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span>{feat}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
