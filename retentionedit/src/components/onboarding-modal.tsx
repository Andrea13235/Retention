"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/auth-context";

interface OnboardingModalProps {
  isOpen: boolean;
  onFinished: () => void;
  onOpenPaywall?: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5;

interface Option {
  value: string;
  icon: string;
}

// ─── Step 1: role (8 options, 2-col grid) ─────────────────────────────────────
const ROLE_OPTIONS: Option[] = [
  { value: "Professional content creator", icon: "🎥" },
  { value: "Hobbyist creator", icon: "🎨" },
  { value: "Educator", icon: "📚" },
  { value: "Event organizer", icon: "🎤" },
  { value: "Business marketer", icon: "📢" },
  { value: "Agency professional", icon: "🏢" },
  { value: "Media professional", icon: "📰" },
  { value: "Other", icon: "❓" },
];

// ─── Step 2: organization size (4 options) ────────────────────────────────────
const ORG_OPTIONS: Option[] = [
  { value: "Small business (1-50 employees)", icon: "🏢" },
  { value: "Medium-sized business (51-500 employees)", icon: "🏭" },
  { value: "Large enterprise (500+ employees)", icon: "🌍" },
  { value: "Solo entrepreneur / freelancer", icon: "👤" },
];

// ─── Step 3: social reach (5 options) ─────────────────────────────────────────
const REACH_OPTIONS: Option[] = [
  { value: "0 - 1,000", icon: "🌱" },
  { value: "1,000 - 9,999", icon: "🚀" },
  { value: "10,000 - 99,999", icon: "🎯" },
  { value: "100,000 - 499,999", icon: "🔥" },
  { value: "500,000+", icon: "🎉" },
];

// ─── Step 4: content type (3 options) ─────────────────────────────────────────
const CONTENT_OPTIONS: Option[] = [
  { value: "Original content (e.g., created by me or by my client)", icon: "🎤" },
  { value: "I do both equally", icon: "✨" },
  { value: "Other content I found (e.g., remixing or curating existing content)", icon: "🎬" },
];

// ─── Step 5: hear-about-us — compact, only the most important choices ─────────
const HEAR_OPTIONS: Option[] = [
  { value: "Search engine", icon: "🔍" },
  { value: "Recommended by a friend or colleague", icon: "💬" },
  { value: "ChatGPT or other AI chatbot", icon: "🤖" },
  { value: "Saw a RetentionEdit watermark on a video", icon: "💧" },
  { value: "A RetentionEdit ad on social media (or YouTube)", icon: "📣" },
  { value: "Other", icon: "❓" },
];

const STEP_TITLES: Record<Step, string> = {
  1: "Which best describes your role when using RetentionEdit?",
  2: "If you create content for business reasons, what is the size of the organization you work at?",
  3: "What is your current social media reach by followers?",
  4: "What kind of content do you primarily want to clip on RetentionEdit?",
  5: "How did you first hear about us?",
};

function optionsForStep(step: Step): Option[] {
  switch (step) {
    case 1:
      return ROLE_OPTIONS;
    case 2:
      return ORG_OPTIONS;
    case 3:
      return REACH_OPTIONS;
    case 4:
      return CONTENT_OPTIONS;
    case 5:
      return HEAR_OPTIONS;
  }
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onFinished,
}) => {
  const { user, completeOnboarding } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Collected answers
  const [role, setRole] = useState(user?.onboardingRole || user?.role || "");
  const [orgSize, setOrgSize] = useState(user?.orgSize || "");
  const [socialReach, setSocialReach] = useState(user?.socialReach || "");
  const [contentType, setContentType] = useState(user?.contentType || "");

  if (!isOpen) return null;

  const handleSelect = async (value: string) => {
    if (isSaving) return;
    setSelected(value);

    // Brief highlight feedback, then advance (matches OpusClip behavior)
    await new Promise((resolve) => setTimeout(resolve, 160));

    if (step === 1) {
      setRole(value);
      setSelected(null);
      setStep(2);
    } else if (step === 2) {
      setOrgSize(value);
      setSelected(null);
      setStep(3);
    } else if (step === 3) {
      setSocialReach(value);
      setSelected(null);
      setStep(4);
    } else if (step === 4) {
      setContentType(value);
      setSelected(null);
      setStep(5);
    } else {
      // Step 5 (final, compact): persist everything and finish
      setIsSaving(true);
      try {
        await completeOnboarding({
          name: user?.name || "Creator",
          role,
          onboardingRole: role,
          orgSize,
          socialReach,
          contentType,
          hearSource: value,
          plan: user?.plan || "free",
        });
      } catch (err) {
        console.error("Error completing onboarding:", err);
      } finally {
        setIsSaving(false);
        setSelected(null);
        onFinished();
      }
    }
  };

  const handleBack = () => {
    if (isSaving) return;
    setSelected(null);
    setStep((prev) => (prev > 1 ? ((prev - 1) as Step) : prev));
  };

  const options = optionsForStep(step);
  const isLastStep = step === 5;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-[560px] max-h-[90vh] overflow-y-auto bg-[#121214] text-white rounded-2xl border border-[#2a2a2e] shadow-2xl px-6 py-7 sm:px-9 sm:py-8">
        {/* Segmented progress: 5 segments, filled = completed/current */}
        <div className="flex items-center gap-2 mb-7">
          {([1, 2, 3, 4, 5] as const).map((i) => (
            <div
              key={i}
              className={`h-[5px] flex-1 rounded-full transition-all duration-300 ${
                i <= step ? "bg-white" : "bg-[#2e2e33]"
              }`}
            />
          ))}
        </div>

        {/* Question */}
        <h2 className="text-center text-lg sm:text-xl font-bold tracking-tight text-white mb-6">
          {STEP_TITLES[step]}
        </h2>

        {/* Options — grid for steps 1-4, compact list for step 5 */}
        <div
          className={
            isLastStep
              ? "flex flex-col gap-2 max-w-[420px] mx-auto"
              : "grid grid-cols-1 sm:grid-cols-2 gap-3"
          }
        >
          {options.map((opt) => {
            const isActive = selected === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={isSaving}
                onClick={() => handleSelect(opt.value)}
                className={
                  isLastStep
                    ? `w-full px-4 py-2.5 rounded-xl border text-sm font-medium text-center transition-all cursor-pointer disabled:opacity-60 ${
                        isActive
                          ? "bg-[#2b2b31] border-white/60 text-white"
                          : "bg-[#1a1a1d] border-[#333338] text-white hover:bg-[#232327] hover:border-[#4a4a52]"
                      }`
                    : `flex flex-col items-center justify-center gap-2 px-4 py-5 rounded-xl border text-center transition-all cursor-pointer disabled:opacity-60 min-h-[104px] ${
                        isActive
                          ? "bg-[#2b2b31] border-white/60"
                          : "bg-[#1a1a1d] border-[#333338] hover:bg-[#232327] hover:border-[#4a4a52]"
                      }`
                }
              >
                {!isLastStep && (
                  <span className="text-[26px] leading-none" aria-hidden="true">
                    {opt.icon}
                  </span>
                )}
                <span
                  className={
                    isLastStep
                      ? "text-[13px]"
                      : "text-[13px] font-medium leading-snug text-white"
                  }
                >
                  {opt.value}
                </span>
              </button>
            );
          })}
        </div>

        {/* Back */}
        {step > 1 && (
          <div className="mt-6 flex justify-start">
            <button
              type="button"
              onClick={handleBack}
              disabled={isSaving}
              className="px-5 py-2 rounded-lg bg-[#26262b] hover:bg-[#313137] text-white text-sm font-medium transition cursor-pointer disabled:opacity-60"
            >
              Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
