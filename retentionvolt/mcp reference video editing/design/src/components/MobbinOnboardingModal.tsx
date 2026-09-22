'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, Lock, GitFork, Bookmark, EyeOff, Download, Check, Sparkles } from 'lucide-react';
import { RetentionvoltLogo } from '@/components/RetentionvoltLogo';
import { useAuth } from '@/context/AuthContext';

interface MobbinOnboardingModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onFinished: () => void;
  onOpenPaywall?: () => void;
  isMcpMode?: boolean;
}

export const MobbinOnboardingModal: React.FC<MobbinOnboardingModalProps> = ({
  isOpen,
  onClose,
  onFinished,
  onOpenPaywall,
  isMcpMode = false,
}) => {
  const { user, completeOnboarding, logout } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 states (start completely empty, no pre-selections)
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [hearSource, setHearSource] = useState('');

  // Step 2 state (no default choice pre-selected)
  const [useCase, setUseCase] = useState<'Work' | 'Personal' | 'Education' | ''>('');

  // Step 3 state
  const [isUpgrading, setIsUpgrading] = useState(false);

  if (!isOpen) return null;

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !role) {
      return;
    }
    setStep(2);
  };

  const handleStep2Select = (choice: 'Work' | 'Personal' | 'Education') => {
    setUseCase(choice);
    setStep(3);
  };

  const handleChoosePlan = async (choice: 'free' | 'pro') => {
    setIsUpgrading(true);
    try {
      await completeOnboarding({
        name: name.trim() || 'Creator',
        role: role || 'Video Editor',
        hearSource: hearSource.trim() || 'Direct',
        useCase: useCase || 'Work',
      });
    } catch (err) {
      console.error('Error completing onboarding:', err);
    } finally {
      setIsUpgrading(false);
      onFinished();
      if (choice === 'pro' && onOpenPaywall) {
        onOpenPaywall();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-[480px] bg-white text-black rounded-[28px] shadow-2xl p-8 sm:p-10 transition-all">
        {/* Centered Logo */}
        <div className="flex justify-center mb-6">
          <RetentionvoltLogo variant="icon" size={42} />
        </div>

        {/* STEP 1: Welcome & Profile (Screens 5 & 6) */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <h2 className="text-2xl sm:text-[26px] font-bold tracking-tight text-neutral-900">
                Welcome to RETENTIONVOLT
              </h2>
            </div>

            <form onSubmit={handleStep1Submit} className="space-y-3.5">
              {/* Name Field */}
              <div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name"
                  required
                  className="w-full bg-[#f1f1f1] hover:bg-[#ebebeb] focus:bg-white text-neutral-900 placeholder-neutral-500 px-4 py-3.5 rounded-xl border border-transparent focus:border-neutral-400 focus:outline-none transition-all text-sm font-medium"
                />
              </div>

              {/* Role Dropdown */}
              <div className="relative">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  required
                  className={`w-full bg-[#f1f1f1] hover:bg-[#ebebeb] focus:bg-white px-4 py-3.5 rounded-xl border border-transparent focus:border-neutral-400 focus:outline-none appearance-none transition-all text-sm font-medium pr-10 cursor-pointer ${
                    role ? 'text-neutral-900' : 'text-neutral-500'
                  }`}
                >
                  <option value="" disabled>What best describes you?</option>
                  <option value="Video Editor">Video Editor</option>
                  <option value="YouTuber / Creator">YouTuber / Creator</option>
                  <option value="Motion Designer">Motion Designer</option>
                  <option value="Creative Director">Creative Director</option>
                  <option value="Agency Owner">Agency Owner</option>
                  <option value="AI Video Engineer">AI Video Engineer</option>
                  <option value="Designer">Designer</option>
                </select>
                <ChevronDown className="w-4 h-4 text-neutral-500 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Hear About Us Field */}
              <div>
                <input
                  type="text"
                  value={hearSource}
                  onChange={(e) => setHearSource(e.target.value)}
                  placeholder="Where did you hear about us?"
                  className="w-full bg-[#f1f1f1] hover:bg-[#ebebeb] focus:bg-white text-neutral-900 placeholder-neutral-500 px-4 py-3.5 rounded-xl border border-transparent focus:border-neutral-400 focus:outline-none transition-all text-sm font-medium"
                />
              </div>

              {/* Continue Button */}
              <button
                type="submit"
                className="w-full py-3.5 rounded-full bg-black hover:bg-neutral-800 text-white font-semibold text-sm transition-all shadow-sm active:scale-[0.99] mt-2"
              >
                Continue
              </button>
            </form>

            <p className="text-[11px] text-neutral-400 text-center">
              We will never share your information with anyone else.
            </p>
          </div>
        )}

        {/* STEP 2: Use Case (Screen 7) */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <h2 className="text-2xl sm:text-[26px] font-bold tracking-tight text-neutral-900">
                What will you use RETENTIONVOLT for?
              </h2>
            </div>

            <div className="space-y-3 pt-2">
              {(['Work', 'Personal', 'Education'] as const).map((choice) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => handleStep2Select(choice)}
                  className={`w-full py-3.5 rounded-2xl text-sm font-semibold transition-all border ${
                    useCase === choice
                      ? 'bg-[#181818] text-white border-black'
                      : 'bg-[#f1f1f1] hover:bg-[#e6e6e6] text-neutral-900 border-transparent'
                  }`}
                >
                  {choice}
                </button>
              ))}
            </div>

            <p className="text-[11px] text-neutral-400 text-center pt-2">
              This helps us create a better experience.
            </p>
          </div>
        )}

        {/* STEP 3: Paywall / Pro Access (Screen 8) */}
        {step === 3 && (
          <div className="space-y-5 animate-fade-in">
            <div className="text-center space-y-1.5">
              <h2 className="text-2xl sm:text-[26px] font-bold tracking-tight text-neutral-900">
                {isMcpMode ? 'Attiva Pro per CyberMCP' : 'Get full access.'}
              </h2>
              <div className="flex items-center justify-center gap-1.5 text-xs text-neutral-600">
                {isMcpMode ? (
                  <span>Abbonamento Pro obbligatorio per collegare assistenti AI (prova gratuita di 7 giorni).</span>
                ) : (
                  <>
                    <span>Upgrade like</span>
                    <div className="inline-flex -space-x-1.5 overflow-hidden">
                      <div className="inline-block h-4 w-4 rounded-full ring-1 ring-white bg-purple-500" />
                      <div className="inline-block h-4 w-4 rounded-full ring-1 ring-white bg-amber-500" />
                      <div className="inline-block h-4 w-4 rounded-full ring-1 ring-white bg-emerald-500" />
                    </div>
                    <span>for only $12/mo (or $6/mo billed annually) — Cancel anytime.</span>
                  </>
                )}
              </div>
            </div>

            {/* Pro Card Container */}
            <div className="p-5 rounded-2xl bg-[#f6f6f6] border border-neutral-200/80 space-y-4">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-neutral-900">Pro</span>
                <span className="bg-[#0066ff] text-white text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider">
                  {isMcpMode ? 'OBBLIGATORIO PER MCP' : 'POPULAR'}
                </span>
              </div>

              {/* Locked Features List with clean icons */}
              <ul className="space-y-2.5 text-xs text-neutral-700 font-medium">
                <li className="flex items-center gap-2.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#0066ff] shrink-0" />
                  <span className="font-bold text-neutral-900">Accesso Server CyberMCP per Codex &amp; AI Agents</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Lock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                  <span>500.000+ ritmi di taglio, zoom e retention curves</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Bookmark className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                  <span>Collezioni e moodboard illimitati</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Download className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                  <span>Download Premiere/DaVinci EDL &amp; XML</span>
                </li>
              </ul>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleChoosePlan('pro')}
                  disabled={isUpgrading}
                  className="w-full py-3 rounded-full bg-black hover:bg-neutral-800 text-white font-bold text-xs transition-all shadow-sm active:scale-[0.99] flex items-center justify-center gap-2"
                >
                  {isUpgrading ? 'Reindirizzamento...' : 'Attiva Pro — 7 Giorni Gratis ($6/mese)'}
                </button>

                {!isMcpMode && (
                  <button
                    type="button"
                    onClick={() => handleChoosePlan('free')}
                    disabled={isUpgrading}
                    className="w-full py-2.5 rounded-full hover:bg-neutral-200/70 text-neutral-700 font-semibold text-xs transition-colors"
                  >
                    Or continue for free
                  </button>
                )}
              </div>
            </div>

            <div className="text-center text-[11px] text-neutral-400 space-y-0.5">
              <p>
                See all{' '}
                <button
                  type="button"
                  onClick={() => handleChoosePlan('pro')}
                  className="underline text-neutral-600 hover:text-black font-medium"
                >
                  plans &amp; features
                </button>
                .
              </p>
              <p>
                Are you a student?{' '}
                <span className="underline text-neutral-600 hover:text-black cursor-pointer">
                  Get a discount.
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Segmented Progress Indicator at Bottom (Exact Mobbin Style) */}
        <div className="pt-6 flex justify-center items-center gap-2">
          <div
            className={`h-1 rounded-full transition-all duration-300 ${
              step >= 1 ? 'w-8 bg-black' : 'w-8 bg-neutral-200'
            }`}
          />
          <div
            className={`h-1 rounded-full transition-all duration-300 ${
              step >= 2 ? 'w-8 bg-black' : 'w-8 bg-neutral-200'
            }`}
          />
          <div
            className={`h-1 rounded-full transition-all duration-300 ${
              step >= 3 ? 'w-8 bg-black' : 'w-8 bg-neutral-200'
            }`}
          />
        </div>

        {/* Sign out link */}
        <div className="pt-3 text-center">
          <button
            type="button"
            onClick={async () => {
              await logout();
              onClose?.();
            }}
            className="text-[11px] text-neutral-400 hover:text-neutral-700 transition-colors"
          >
            Wrong account? Sign out
          </button>
        </div>
      </div>
    </div>
  );
};
