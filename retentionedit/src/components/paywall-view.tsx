"use client";
import React, { useState } from "react";
import {
  Check,
  Sparkles,
  ShieldCheck,
  Zap,
  Lock,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Clock,
  ArrowRight,
  Star,
} from "lucide-react";
import { CREDIT_RATES } from "@/lib/credits";

interface PaywallViewProps {
  currentCredits: number;
  onSelectPlan?: (planId: string) => void;
  onBackToEditor?: () => void;
}

export function PaywallView({
  currentCredits,
  onSelectPlan,
  onBackToEditor,
}: PaywallViewProps) {
  const [annualBilling, setAnnualBilling] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const PLANS = [
    {
      id: "starter",
      name: "Creator Starter",
      monthlyPrice: 29,
      annualPrice: 19,
      credits: 300,
      badge: "SOLO CREATOR",
      description: "For creators publishing 2-3 high-retention shorts or YouTube videos per week.",
      features: [
        "300 Credits / month (Rolls over)",
        "Claude Opus Editorial Intelligence",
        "Meta Muse Voice STT (word-level)",
        "Native RetentionVolt Blueprints",
        "1080p Full HD NVENC GPU Export",
        "No Watermark & Full Commercial Rights",
      ],
      cta: "Start with Starter",
      highlight: false,
    },
    {
      id: "pro",
      name: "Pro Studio",
      monthlyPrice: 59,
      annualPrice: 39,
      credits: 750,
      badge: "MOST POPULAR — 83% OF CREATORS",
      description: "Designed for serious YouTubers and TikTokers scaling watch-time and followers.",
      features: [
        "750 Credits / month (Rolls over)",
        "Priority Modal.com GPU Queue (2x faster)",
        "Higgsfield DoP Cinematic Camera Moves",
        "Claude Opus Deep Psychology Analysis",
        "4K Ultra-HD NVENC 60FPS Hardware Export",
        "High-CTR Thumbnail Generator included",
        "Custom Brand Fonts & Styles",
      ],
      cta: "Claim Pro Studio Access",
      highlight: true,
    },
    {
      id: "agency",
      name: "Agency Virality",
      monthlyPrice: 149,
      annualPrice: 99,
      credits: 2200,
      badge: "MAXIMUM CAPACITY",
      description: "For agencies, media networks and production teams managing multiple brands.",
      features: [
        "2,200 Credits / month (Rolls over)",
        "Dedicated GPU Instance on Modal.com",
        "Higgsfield Cinematic Pro (4 AI clips/video)",
        "Team Workspace & Multi-Seat Access",
        "Direct API & Webhook Dispatch",
        "Dedicated VIP Slack Channel Support",
      ],
      cta: "Upgrade to Agency Scale",
      highlight: false,
    },
  ];

  const FAQS = [
    {
      q: "How are credits consumed when editing a video?",
      a: `Credits are calculated deterministically per render: A Base Autonomous Edit (Claude Opus + 100% HyperFrames + Subtitles + Cuts) uses ${CREDIT_RATES.BASE_EDIT} credits. Adding a 2.5D Ken Burns Cutaway (Higgsfield 4K + Camera Drift) uses +${CREDIT_RATES.GENAI_BROLL_CLIP} credits. Generating a High-CTR Thumbnail uses +${CREDIT_RATES.THUMBNAIL_COVER} credits.`,
    },
    {
      q: "What happens if I don't use all my credits this month?",
      a: "Unused credits automatically rollover into your next billing period as long as your subscription remains active. You will never lose credits you paid for.",
    },
    {
      q: "Can I cancel, upgrade or downgrade anytime?",
      a: "Yes, you can cancel or change your plan in 1 click from your Settings & Billing dashboard. No lock-in contracts, and your credits stay active until the end of your billing cycle.",
    },
    {
      q: "Do I retain full commercial rights to the rendered videos?",
      a: "100% Yes. All rendered MP4 files, audio mixes, and thumbnails are entirely your property with full commercial monetization rights on YouTube, TikTok, Meta, and paid ads.",
    },
  ];

  return (
    <div className="space-y-12 max-w-6xl mx-auto py-4">
      {/* Top Banner & Header */}
      <div className="text-center space-y-4">
        {onBackToEditor && (
          <button
            type="button"
            onClick={onBackToEditor}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400 hover:text-white transition-colors mb-2"
          >
            &larr; Back to Studio Editor
          </button>
        )}

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#181a24] border border-[#282a39] text-[#8c8f9f] text-xs font-bold uppercase tracking-wider">
          <Sparkles size={14} className="text-white" />
          Higgsfield DoP &bull; Claude Opus 5.5 &bull; Modal GPU Serverless
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white max-w-4xl mx-auto">
          Unlock Cinema-Grade <br />
          <span className="text-white">
            Video Editing Retention
          </span>
        </h1>

        <p className="text-[#8c8f9f] text-sm sm:text-base max-w-2xl mx-auto">
          Scale your content with AI video editing, Higgsfield DoP camera moves, and zero-wait GPU rendering on Modal.com.
        </p>

        {/* Higgsfield Annual vs Monthly Toggle */}
        <div className="pt-4 flex items-center justify-center gap-3">
          <span
            className={`text-xs font-semibold cursor-pointer ${
              !annualBilling ? "text-white" : "text-slate-500"
            }`}
            onClick={() => setAnnualBilling(false)}
          >
            Monthly Billing
          </span>

          <button
            type="button"
            onClick={() => setAnnualBilling(!annualBilling)}
            className="w-14 h-7 rounded-full bg-slate-800 border border-slate-700 p-1 relative transition-colors cursor-pointer"
          >
            <div
              className={`w-5 h-5 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 shadow-md transition-transform ${
                annualBilling ? "translate-x-7" : "translate-x-0"
              }`}
            />
          </button>

          <span
            className={`text-xs font-semibold cursor-pointer flex items-center gap-2 ${
              annualBilling ? "text-white" : "text-slate-500"
            }`}
            onClick={() => setAnnualBilling(true)}
          >
            Annual Billing
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-wider animate-pulse">
              SAVE 40% (2 MONTHS FREE)
            </span>
          </span>
        </div>
      </div>

      {/* Pricing Cards Grid (Higgsfield Style with Glowing Center) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {PLANS.map((plan) => {
          const price = annualBilling ? plan.annualPrice : plan.monthlyPrice;
          return (
            <div
              key={plan.id}
              className={`rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all relative ${
                plan.highlight
                  ? "bg-[#181a24] border-2 border-white/40 shadow-2xl scale-100 md:scale-105 z-10"
                  : "bg-[#121319] border border-[#21232d] hover:border-[#2f3240]"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-white text-black text-[10px] font-black uppercase tracking-wider shadow-lg whitespace-nowrap">
                  {plan.badge}
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-extrabold text-white">{plan.name}</h3>
                  <p className="text-xs text-[#8c8f9f] mt-1">{plan.description}</p>
                </div>

                {/* Price Display */}
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl sm:text-5xl font-black text-white">{price}€</span>
                    <span className="text-xs text-[#8c8f9f]">/ month</span>
                  </div>
                  {annualBilling ? (
                    <p className="text-[11px] text-white font-medium mt-1">
                      Billed annually ({price * 12}€/yr) &bull; Save {(plan.monthlyPrice - plan.annualPrice) * 12}€
                    </p>
                  ) : (
                    <p className="text-[11px] text-[#8c8f9f] mt-1">Billed monthly, cancel anytime</p>
                  )}
                </div>

                {/* Credits Pill */}
                <div className="p-3 rounded-2xl bg-[#14151d] border border-[#21232d] flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <Zap size={14} className="text-white" />
                    <span className="text-[#8c8f9f]">Monthly Credits:</span>
                  </div>
                  <span className="font-mono font-bold text-sm text-white">
                    {plan.credits} Credits
                  </span>
                </div>

                {/* Features List */}
                <ul className="space-y-3 text-xs text-[#8c8f9f]">
                  {plan.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0 mt-0.5">
                        <Check size={11} strokeWidth={3} />
                      </div>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Button */}
              <div className="pt-8">
                <button
                  type="button"
                  onClick={() => {
                    if (onSelectPlan) onSelectPlan(plan.id);
                    else alert(`Proceeding to Stripe Checkout for ${plan.name} (${price}€/mo)!`);
                  }}
                  className={`w-full py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-xl flex items-center justify-center gap-2 group cursor-pointer ${
                    plan.highlight
                      ? "bg-white hover:bg-neutral-200 text-black shadow-md"
                      : "bg-[#1e202b] hover:bg-[#282b3a] text-white border border-[#2c2f3e]"
                  }`}
                >
                  <span>{plan.cta}</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trust & Guarantee Badges (Higgsfield Risk-Reversal) */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-around gap-6 text-xs text-slate-400">
        <div className="flex items-center gap-2.5">
          <ShieldCheck size={20} className="text-emerald-400" />
          <div>
            <p className="font-bold text-white">7-Day Money-Back Guarantee</p>
            <p className="text-[11px] text-slate-500">100% refund if watch-time doesn't increase</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Clock size={20} className="text-indigo-400" />
          <div>
            <p className="font-bold text-white">Instant Activation & Rollover</p>
            <p className="text-[11px] text-slate-500">Credits available immediately on GPU</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Lock size={20} className="text-violet-400" />
          <div>
            <p className="font-bold text-white">Cancel Anytime in 1-Click</p>
            <p className="text-[11px] text-slate-500">Stripe 256-bit encrypted security</p>
          </div>
        </div>
      </div>

      {/* FAQ Accordion Section */}
      <div className="space-y-4 max-w-3xl mx-auto pt-6">
        <h3 className="text-xl font-bold text-white text-center">Frequently Asked Questions</h3>
        <div className="space-y-2">
          {FAQS.map((faq, index) => (
            <div
              key={index}
              className="rounded-2xl bg-slate-900/40 border border-slate-800/80 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                className="w-full p-4 text-left flex items-center justify-between text-xs sm:text-sm font-semibold text-white hover:text-emerald-400 transition-colors"
              >
                <span>{faq.q}</span>
                {openFaq === index ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {openFaq === index && (
                <div className="px-4 pb-4 text-xs text-slate-400 leading-relaxed border-t border-slate-800/40 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
