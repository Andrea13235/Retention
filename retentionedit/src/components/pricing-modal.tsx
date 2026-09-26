"use client";
import React from "react";
import { X, Check, Sparkles, Zap, ShieldCheck } from "lucide-react";
import { PRICING_PLANS, CREDIT_RATES } from "@/lib/credits";

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCredits: number;
}

export function PricingModal({ isOpen, onClose, currentCredits }: PricingModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-[#0b0e17] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#181a24] border border-[#282a39] text-[#8c8f9f] text-xs font-semibold uppercase tracking-wider">
            <Sparkles size={13} /> Transparent Credit System
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Choose Your <span className="text-white font-extrabold">RetentionEdit</span> Plan
          </h2>
          <p className="text-xs sm:text-sm text-[#8c8f9f] max-w-lg mx-auto">
            You currently have <strong className="text-white">{currentCredits} credits</strong> remaining. Upgrade to unlock more AI video editing and Higgsfield AI video generation.
          </p>
        </div>

        {/* How Credits Work Banner */}
        <div className="p-4 rounded-2xl bg-[#121319] border border-[#21232d] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center">
              <Zap size={16} />
            </div>
            <div>
              <p className="font-semibold text-white">How credits are deducted per video:</p>
              <p className="text-[#8c8f9f]">Never pay for what you don't use. All plans rollover unused credits.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span className="px-2.5 py-1 rounded-lg bg-[#181a24] border border-[#282a39] text-white">
              Base Edit: <strong>{CREDIT_RATES.BASE_EDIT} pts</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#181a24] border border-[#282a39] text-white">
              2.5D Cutaway: <strong>+{CREDIT_RATES.GENAI_BROLL_CLIP} pts</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#181a24] border border-[#282a39] text-white">
              Cover: <strong>+{CREDIT_RATES.THUMBNAIL_COVER} pts</strong>
            </span>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PRICING_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`p-6 rounded-2xl border flex flex-col justify-between transition-all relative ${
                plan.popular
                  ? "border-white/40 bg-[#181a24] shadow-xl"
                  : "border-[#21232d] bg-[#121319] hover:border-[#2f3240]"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-white text-black text-[10px] font-black uppercase tracking-wider">
                  MOST POPULAR
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  <p className="text-xs text-[#8c8f9f] mt-1">{plan.description}</p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-white">{plan.priceMonthlyEur}€</span>
                  <span className="text-xs text-[#8c8f9f]">/ month</span>
                </div>

                <div className="p-2.5 rounded-xl bg-[#14151d] border border-[#21232d] text-center">
                  <span className="text-xs font-mono font-bold text-white">
                    {plan.creditsMonthly} Credits / month
                  </span>
                </div>

                <ul className="space-y-2 text-xs text-[#8c8f9f]">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check size={14} className="text-white shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-6">
                <button
                  type="button"
                  onClick={() => {
                    alert(`Simulating subscription to ${plan.name} (${plan.priceMonthlyEur}€/mo)!`);
                    onClose();
                  }}
                  className={`w-full py-3 px-4 rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer ${
                    plan.popular
                      ? "bg-white hover:bg-neutral-200 text-black"
                      : "bg-[#1e202b] hover:bg-[#282b3a] text-white border border-[#2c2f3e]"
                  }`}
                >
                  Select {plan.name}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
