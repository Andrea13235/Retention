'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, ArrowLeft, Loader2, Sparkles, ShieldCheck, Mail, KeyRound } from 'lucide-react';
import { RetentionvoltLogo } from '@/components/RetentionvoltLogo';
import { useAuth } from '@/context/AuthContext';
import { VideoMarqueeRow } from '@/components/VideoMarqueeRow';
import { VIDEOS_DATA } from '@/data/videos';

interface MobbinAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialMode?: 'signup' | 'login';
  isStandalone?: boolean;
}

export const MobbinAuthModal: React.FC<MobbinAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'signup',
  isStandalone = false,
}) => {
  const {
    sendOtpCode,
    verifyOtpCode,
    signInWithPassword,
    signUpWithPassword,
    signInWithGoogle,
    loginAsDemo,
  } = useAuth();

  const [mode, setMode] = useState<'signup' | 'login'>(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);
  const [authMethod, setAuthMethod] = useState<'otp' | 'password'>('otp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isGoogleRedirecting, setIsGoogleRedirecting] = useState(false);

  const row1Videos = React.useMemo(() => VIDEOS_DATA.slice(0, 10), []);
  const row2Videos = React.useMemo(() => VIDEOS_DATA.slice(10, 20), []);
  const row3Videos = React.useMemo(() => VIDEOS_DATA.slice(20, 30), []);
  const row4Videos = React.useMemo(() => VIDEOS_DATA.slice(30, 40), []);

  if (!isOpen) return null;

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim()) return;
    setErrorMessage(null);
    setInfoMessage(null);
    setIsLoading(true);

    const res = await sendOtpCode(email.trim());
    setIsLoading(false);

    if (res.success) {
      setIsCodeSent(true);
      if (res.devCode) {
        setInfoMessage(`Development mode bypass: Code is ${res.devCode}`);
      }
    } else {
      setErrorMessage(res.error || 'Failed to send login code. Please try again.');
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!otpCode.trim()) {
      setErrorMessage('Please enter the 6-digit code');
      return;
    }
    setErrorMessage(null);
    setIsLoading(true);

    const res = await verifyOtpCode(email.trim(), otpCode.trim());
    setIsLoading(false);

    if (res.success) {
      onSuccess();
    } else {
      setErrorMessage(res.error || 'Invalid code. Please check and try again.');
    }
  };

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please fill in both email and password');
      return;
    }
    setErrorMessage(null);
    setIsLoading(true);

    const res =
      mode === 'signup'
        ? await signUpWithPassword(email.trim(), password)
        : await signInWithPassword(email.trim(), password);

    setIsLoading(false);

    if (res.success) {
      onSuccess();
    } else {
      setErrorMessage(res.error || 'Authentication failed. Please try again.');
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setIsGoogleRedirecting(true);
    setIsLoading(true);
    const res = await signInWithGoogle();
    if (res.success) {
      if (res.redirecting) {
        // Redirection to Google OAuth in progress.
        // DO NOT call onSuccess() because user is leaving the site!
        // Prevents the onboarding modal from flashing before redirection.
        return;
      }
      setIsLoading(false);
      setIsGoogleRedirecting(false);
      onSuccess();
    } else {
      setIsLoading(false);
      setIsGoogleRedirecting(false);
      setErrorMessage(res.error || 'Google sign-in failed');
    }
  };

  const handleQuickDemo = () => {
    if (process.env.NODE_ENV === 'production') return;
    loginAsDemo();
    onSuccess();
  };

  return (
    <div
      className={
        isStandalone
          ? 'min-h-screen flex flex-col bg-[#0b0b0b] text-white selection:bg-[#d1fe17] selection:text-black animate-fade-in'
          : 'fixed inset-0 z-50 flex flex-col bg-[#0b0b0b] text-white overflow-hidden animate-fade-in'
      }
    >
      {/* Top Bar with Navigation */}
      <div className="w-full flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f] bg-[#0b0b0b]/90 backdrop-blur z-20">
        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <RetentionvoltLogo variant="icon" size={28} />
          <span className="font-bold text-sm tracking-tight text-white hidden sm:inline">
            RETENTIONVOLT
          </span>
        </Link>

        {isStandalone ? (
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1c1c1c] text-xs font-medium text-[#8e8e8e] hover:text-white hover:bg-[#282828] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Torna al catalogo</span>
          </Link>
        ) : (
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-[#1c1c1c] text-[#8e8e8e] hover:text-white hover:bg-[#282828] transition-colors"
            title="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-y-auto lg:overflow-hidden">
        {/* LEFT COLUMN: Auth Form (Exact Mobbin Onboarding 1, 2, 3, 4 style) */}
        <div className="flex flex-col justify-between p-8 sm:p-12 lg:p-16 max-w-xl mx-auto w-full">
          <div className="my-auto space-y-7">
            {/* Mobbin Logo Header */}
            <div className="flex items-center justify-start">
              <RetentionvoltLogo variant="icon" size={36} />
            </div>

            {/* Title & Dynamic Subtitle */}
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                {mode === 'signup' ? 'Create your free account' : 'Welcome back'}
              </h1>

              {isCodeSent ? (
                <div className="text-sm text-[#999999] leading-relaxed">
                  We sent a temporary login code to{' '}
                  <span className="text-white font-medium">{email}</span>.{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsCodeSent(false);
                      setOtpCode('');
                      setErrorMessage(null);
                      setInfoMessage(null);
                    }}
                    className="text-white underline hover:text-[#d1fe17] font-semibold transition-colors ml-1"
                  >
                    Not you?
                  </button>
                </div>
              ) : (
                <p className="text-sm text-[#999999] leading-relaxed">
                  {mode === 'signup'
                    ? 'Create your free account to search or filter through 400,000+ video hooks, retention curves & pacing breakdowns. No credit card required.'
                    : 'Sign in to access your saved references, collections, and AI MCP server.'}
                </p>
              )}
            </div>

            {/* Google OAuth Button */}
            {!isCodeSent && (
              <>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-full bg-white hover:bg-neutral-200 text-[#111] font-semibold text-sm transition-all shadow-md active:scale-[0.99] disabled:opacity-80"
                >
                  {isGoogleRedirecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-neutral-800" />
                      <span>Redirecting to Google...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>

                {/* Divider */}
                <div className="relative flex items-center justify-center my-4">
                  <div className="w-full border-t border-[#262626]"></div>
                  <span className="bg-[#0b0b0b] px-4 text-xs uppercase tracking-wider text-[#666]">
                    or
                  </span>
                </div>
              </>
            )}

            {/* Error & Info Feedback */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium">
                {errorMessage}
              </div>
            )}
            {infoMessage && (
              <div className="p-3 rounded-xl bg-[#d1fe17]/10 border border-[#d1fe17]/30 text-[#d1fe17] text-xs font-medium">
                {infoMessage}
              </div>
            )}

            {/* Form Fields: OTP vs Password */}
            {authMethod === 'otp' ? (
              <div>
                {!isCodeSent ? (
                  /* Step 1: Enter Email */
                  <form onSubmit={handleSendOtp} className="space-y-4">
                    <div className="space-y-1.5">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter email address"
                        required
                        className="w-full bg-[#161616] text-white placeholder-[#666] px-4 py-3.5 rounded-xl border border-[#2a2a2a] focus:border-white focus:outline-none transition-all text-sm"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3.5 rounded-full bg-white hover:bg-neutral-200 text-black font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 active:scale-[0.99]"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Continue'
                      )}
                    </button>
                  </form>
                ) : (
                  /* Step 2: Enter Verification Code (Mobbin Onboarding 3 & 4) */
                  <form onSubmit={handleVerifyOtp} className="space-y-4">
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="Enter login code"
                        maxLength={6}
                        required
                        autoFocus
                        className="w-full bg-[#161616] text-white placeholder-[#666] px-4 py-3.5 rounded-xl border border-[#2a2a2a] focus:border-white focus:outline-none transition-all text-center tracking-widest font-mono text-lg font-bold"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3.5 rounded-full bg-white hover:bg-neutral-200 text-black font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 active:scale-[0.99]"
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Continue'
                      )}
                    </button>

                    <div className="flex items-center justify-between text-xs text-[#888] pt-1">
                      <button
                        type="button"
                        onClick={() => handleSendOtp()}
                        className="hover:text-white underline transition-colors"
                      >
                        Resend code
                      </button>
                      {process.env.NODE_ENV !== 'production' && (
                        <button
                          type="button"
                          onClick={() => {
                            setOtpCode('123456');
                          }}
                          className="text-[#d1fe17] hover:underline"
                        >
                          Auto-fill test code (123456)
                        </button>
                      )}
                    </div>
                  </form>
                )}

                {/* Method Switcher to Password */}
                {!isCodeSent && (
                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => setAuthMethod('password')}
                      className="text-xs text-[#888] hover:text-white transition-colors"
                    >
                      Or sign in with email and password →
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Password Mode */
              <form onSubmit={handlePasswordAuth} className="space-y-4">
                <div className="space-y-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email address"
                    required
                    className="w-full bg-[#161616] text-white placeholder-[#666] px-4 py-3.5 rounded-xl border border-[#2a2a2a] focus:border-white focus:outline-none transition-all text-sm"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    className="w-full bg-[#161616] text-white placeholder-[#666] px-4 py-3.5 rounded-xl border border-[#2a2a2a] focus:border-white focus:outline-none transition-all text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-full bg-white hover:bg-neutral-200 text-black font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 active:scale-[0.99]"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : mode === 'signup' ? (
                    'Create account'
                  ) : (
                    'Sign in'
                  )}
                </button>

                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={() => setAuthMethod('otp')}
                    className="text-xs text-[#888] hover:text-white transition-colors"
                  >
                    ← Use verification code (OTP) instead
                  </button>
                </div>
              </form>
            )}

            {/* Legal Notice */}
            <p className="text-[11px] text-[#666] leading-relaxed text-center">
              Continuando accetti i{' '}
              <a href="/terms" className="underline hover:text-white">
                Termini di Servizio
              </a>{' '}
              e la{' '}
              <a href="/privacy" className="underline hover:text-white">
                Privacy Policy
              </a>{' '}
              di RETENTIONVOLT. Info cookie: <a href="/cookies" className="underline hover:text-white">Cookie Policy</a>.
            </p>

            {/* Toggle Mode: Signup vs Login */}
            <div className="text-center pt-2 text-xs text-[#888]">
              {mode === 'signup' ? (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setIsCodeSent(false);
                      setErrorMessage(null);
                    }}
                    className="text-white font-semibold hover:underline"
                  >
                    Log in
                  </button>
                </>
              ) : (
                <>
                  Don’t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setIsCodeSent(false);
                      setErrorMessage(null);
                    }}
                    className="text-white font-semibold hover:underline"
                  >
                    Sign up
                  </button>
                </>
              )}
            </div>

            {/* Quick Demo Bypass for Instant Testing (dev only) */}
            {process.env.NODE_ENV !== 'production' && (
              <div className="pt-2 text-center border-t border-[#1c1c1c]">
                <button
                  type="button"
                  onClick={handleQuickDemo}
                  className="text-xs text-[#666] hover:text-[#d1fe17] transition-colors inline-flex items-center gap-1.5"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Quick demo login as Alex Smith (bypass auth)</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Alternating Scrolling Video Rows (YouTube JPGs + Click to Redirect) */}
        <div className="hidden lg:flex relative bg-[#0d0d0d] border-l border-[#1f1f1f] flex-col justify-center overflow-hidden py-8">
          {/* Ambient Glow */}
          <div className="absolute -top-32 -right-32 w-80 h-80 bg-[#d1fe17]/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header pill indicator */}
          <div className="relative z-10 px-8 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#d1fe17] animate-ping" />
              <span className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider">
                Live Retention Breakdowns
              </span>
            </div>
            <span className="text-[11px] text-neutral-500 font-medium">
              Click any video to watch
            </span>
          </div>

          {/* 4 Alternating Marquee Rows */}
          <div className="relative z-10 space-y-3.5 -mx-4">
            <VideoMarqueeRow
              videos={row1Videos}
              direction="left"
              speed="normal"
              cardWidth="w-[240px]"
            />
            <VideoMarqueeRow
              videos={row2Videos}
              direction="right"
              speed="normal"
              cardWidth="w-[240px]"
            />
            <VideoMarqueeRow
              videos={row3Videos}
              direction="left"
              speed="normal"
              cardWidth="w-[240px]"
            />
            <VideoMarqueeRow
              videos={row4Videos}
              direction="right"
              speed="normal"
              cardWidth="w-[240px]"
            />
          </div>

          {/* Subtle edge fade gradients */}
          <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#0d0d0d] to-transparent pointer-events-none z-10" />
          <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#0d0d0d] to-transparent pointer-events-none z-10" />
          <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-[#0d0d0d] to-transparent pointer-events-none z-10" />
          <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#0d0d0d] to-transparent pointer-events-none z-10" />
        </div>
      </div>

      {/* Bottom Bar: Curated By (Exact Mobbin Style) */}
      <div className="w-full flex items-center justify-between px-6 py-3 border-t border-[#1a1a1a] bg-[#0b0b0b] text-xs text-[#777] z-20">
        <div className="flex items-center gap-2">
          <RetentionvoltLogo variant="icon" size={20} />
          <span className="font-semibold text-white">RETENTIONVOLT</span>
        </div>
        <div className="flex items-center gap-1.5 font-medium">
          <span>curated by</span>
          <span className="text-white font-bold tracking-wide">RETENTIONVOLT</span>
        </div>
      </div>
    </div>
  );
};
