"use client";
import React from "react";
import { Info, Zap, Lock } from "lucide-react";

interface SubscriptionViewProps {
  credits?: number;
  userEmail?: string;
  onOpenPricing?: () => void;
}

export function SubscriptionView({
  credits = 25,
  userEmail = "barrettaandrea03@gmail.com",
  onOpenPricing,
}: SubscriptionViewProps) {
  return (
    <div className="flex flex-col text-[#f4f4f6] max-w-[960px] mx-auto pt-4 pb-20 select-none">
      {/* 1. Page Header */}
      <div>
        <h1 className="text-2xl sm:text-[28px] font-bold text-white tracking-tight">
          Subscription
        </h1>
        <p className="text-xs sm:text-[13px] text-[#8c8c90] mt-1">
          Manage your subscription plan and credit balance.
        </p>
      </div>

      {/* 2. Top Card: Free Plan Active */}
      <div className="mt-6 rounded-2xl bg-[#232325] border border-[#2b2b2e] p-5 flex items-center justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-2.5">
            <span className="text-base font-bold text-white">Free plan</span>
            <span className="px-2 py-0.5 rounded-full bg-[#183925] text-[#34d399] text-[11px] font-semibold">
              Active
            </span>
          </div>
          <span className="text-xs sm:text-[13px] text-[#8c8c90] mt-1">
            {userEmail}
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenPricing}
          className="px-5 py-2 rounded-full bg-white text-black font-semibold text-xs sm:text-sm hover:bg-slate-200 transition cursor-pointer active:scale-95 shadow-md"
        >
          Upgrade
        </button>
      </div>

      {/* 3. Two Columns: Credits & features / Billing & payment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* Left Card: Credits & features */}
        <div className="rounded-2xl bg-[#232325] border border-[#2b2b2e] p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white mb-4">
              Credits &amp; features
            </h2>

            {/* Row 1: Current balance */}
            <div className="flex items-center justify-between py-1.5 text-xs sm:text-[13px]">
              <span className="text-[#8c8c90] flex items-center gap-1.5">
                Current balance
                <Info size={13} className="text-[#8c8c90]" />
              </span>
              <span className="font-bold text-white flex items-center gap-1 text-sm">
                <Zap size={14} className="text-[#f59e0b] fill-[#f59e0b]" />
                {credits}
              </span>
            </div>

            {/* Row 2: Plan credits */}
            <div className="flex items-center justify-between py-1.5 text-xs sm:text-[13px]">
              <span className="text-[#8c8c90]">Plan credits</span>
              <span className="text-[#8c8c90]">{credits}</span>
            </div>

            {/* Row 3: Top-up credits */}
            <div className="flex items-center justify-between py-1.5 text-xs sm:text-[13px]">
              <span className="text-[#8c8c90]">Top-up credits</span>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-[#2c2c2f] text-[#8c8c90] text-[10px] font-medium flex items-center gap-1">
                  <Lock size={10} />
                  Locked
                </span>
                <span className="text-[#8c8c90]">0</span>
              </div>
            </div>

            {/* Credits expiration date box */}
            <div className="my-3 px-3.5 py-2.5 rounded-xl bg-[#1c1c1f] border border-[#2a2a2d] flex items-center justify-between text-xs">
              <span className="text-[#8c8c90]">Credits expiration date</span>
              <button
                type="button"
                onClick={() => alert("Credits renew on each billing cycle")}
                className="text-white hover:text-slate-300 font-medium transition cursor-pointer"
              >
                See details
              </button>
            </div>

            {/* Row 4: Seats */}
            <div className="flex items-center justify-between py-1.5 text-xs sm:text-[13px]">
              <span className="text-[#8c8c90] flex items-center gap-1.5">
                Seats
                <Info size={13} className="text-[#8c8c90]" />
              </span>
              <span className="text-[#8c8c90]">1/1</span>
            </div>
          </div>
        </div>

        {/* Right Card: Billing & payment */}
        <div className="rounded-2xl bg-[#232325] border border-[#2b2b2e] p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white mb-4">
              Billing &amp; payment
            </h2>

            {/* Row 1: Next cycle credits */}
            <div className="flex items-center justify-between py-1.5 text-xs sm:text-[13px]">
              <span className="text-[#8c8c90]">Next cycle credits</span>
              <span className="text-[#8c8c90]">60 per month</span>
            </div>

            {/* Row 2: Renew date */}
            <div className="flex items-center justify-between py-1.5 text-xs sm:text-[13px]">
              <span className="text-[#8c8c90]">Renew date</span>
              <span className="text-[#8c8c90]">Sep 20, 2026</span>
            </div>
          </div>

          {/* Empty state container */}
          <div className="mt-8 py-3.5 px-4 rounded-xl bg-[#202022] border border-[#28282b] flex items-center justify-center text-center">
            <span className="text-xs text-[#636366] font-medium">
              No billing information
            </span>
          </div>
        </div>
      </div>

      {/* 4. Bottom Card: Credit usage history */}
      <div className="mt-4 rounded-2xl bg-[#232325] border border-[#2b2b2e] p-5">
        <h2 className="text-sm font-semibold text-white mb-4">
          Credit usage history
        </h2>

        {/* Usage Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-[13px]">
            <thead>
              <tr className="text-[#8c8c90] border-b border-[#2b2b2e]">
                <th className="pb-3 font-normal">Date</th>
                <th className="pb-3 font-normal">Usage</th>
                <th className="pb-3 font-normal">Details</th>
                <th className="pb-3 font-normal">Status</th>
                <th className="pb-3 font-normal text-right">Credits</th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-white hover:bg-[#28282c]/40 transition">
                <td className="py-3.5 pr-4 whitespace-nowrap">
                  <span className="text-[11px] sm:text-xs text-white font-medium">
                    Sep 23, 2026, 20:50
                  </span>
                </td>
                <td className="py-3.5 pr-4 whitespace-nowrap">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#2c2c2f] text-[11px] text-[#f4f4f6] font-medium">
                    Clips
                  </span>
                </td>
                <td className="py-3.5 pr-4 max-w-md truncate">
                  <span className="text-xs text-white">
                    Mastering Short-Form Retention: 100% Viral Hook Guide
                  </span>
                </td>
                <td className="py-3.5 pr-4 whitespace-nowrap">
                  <span className="text-xs text-[#d1d1d6]">Used</span>
                </td>
                <td className="py-3.5 text-right whitespace-nowrap font-mono text-xs text-white">
                  -35
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
