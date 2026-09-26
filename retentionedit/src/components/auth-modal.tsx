"use client";

import React, { useState } from "react";
import Link from "next/link";
import { X, ArrowLeft, Loader2, Mail, KeyRound, User, Sparkles } from "lucide-react";
import { Brand } from "./brand";
import { useAuth } from "@/context/auth-context";
import { useGoogleIdentity } from "@/hooks/use-google-identity";
import { LoginVideoMarquee } from "./login-video-marquee";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialMode?: "signup" | "login";
  isStandalone?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = "signup",
  isStandalone = false,
}) => {
  const {
    sendOtpCode,
    verifyOtpCode,
    signInWithPassword,
    signUpWithPassword,
    signInWithGoogle,
    signInWithGoogleToken,
  } = useAuth();
  const gis = useGoogleIdentity();

  const [mode, setMode] = useState<"signup" | "login">(initialMode);
  const [authMethod, setAuthMethod] = useState<"password" | "otp">("password");
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const accessToken = await gis.requestAccessToken();
      const tokenRes = await signInWithGoogleToken(accessToken);
      setIsLoading(false);
      if (tokenRes.success) {
        onSuccess();
        onClose();
        return;
      }
      setErrorMessage(tokenRes.error || "Accesso con Google non riuscito.");
      return;
    } catch (gisErr: any) {
      const msg = (gisErr?.message || "").toLowerCase();
      const dismissed =
        msg.includes("dismiss") ||
        msg.includes("popup") ||
        msg.includes("cancel") ||
        msg.includes("timeout");
      if (!dismissed) {
        const res = await signInWithGoogle();
        setIsLoading(false);
        if (res.success) {
          if (!res.redirecting) {
            onSuccess();
            onClose();
          }
        } else {
          setErrorMessage(res.error || "Accesso con Google non riuscito.");
        }
        return;
      }
      setIsLoading(false);
      setErrorMessage("Popup Google chiuso. Riprova.");
      return;
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage("Inserisci un indirizzo email valido.");
      return;
    }

    // If password input is not visible yet and user is in password auth method:
    // reveal password field for quick completion
    if (authMethod === "password" && !showPasswordInput) {
      setShowPasswordInput(true);
      return;
    }

    if (authMethod === "password") {
      if (!password.trim()) {
        setErrorMessage("Inserisci la password.");
        return;
      }
      setErrorMessage(null);
      setIsLoading(true);

      const res =
        mode === "signup"
          ? await signUpWithPassword(email.trim(), password, name.trim())
          : await signInWithPassword(email.trim(), password);

      setIsLoading(false);

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setErrorMessage(res.error || "Autenticazione non riuscita. Riprova.");
      }
    } else {
      // OTP method
      handleSendOtp();
    }
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim()) return;
    setErrorMessage(null);
    setIsLoading(true);

    const res = await sendOtpCode(email.trim());
    setIsLoading(false);

    if (res.success) {
      setIsCodeSent(true);
    } else {
      setErrorMessage(res.error || "Impossibile inviare il codice. Riprova.");
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!otpCode.trim()) {
      setErrorMessage("Inserisci il codice di verifica a 6 cifre.");
      return;
    }
    setErrorMessage(null);
    setIsLoading(true);

    const res = await verifyOtpCode(email.trim(), otpCode.trim());
    setIsLoading(false);

    if (res.success) {
      onSuccess();
      onClose();
    } else {
      setErrorMessage(res.error || "Codice non valido. Riprova.");
    }
  };

  return (
    <div
      className={
        isStandalone
          ? "min-h-screen flex flex-col bg-[#09090c] text-white selection:bg-[#d1fe17] selection:text-black overflow-x-hidden"
          : "fixed inset-0 z-50 flex flex-col bg-[#09090c] text-white overflow-hidden animate-in fade-in duration-200"
      }
    >
      {/* Top Header Bar */}
      <header className="w-full flex items-center justify-between px-6 sm:px-10 py-4 border-b border-[#181922] bg-[#09090c]/90 backdrop-blur z-30 shrink-0">
        <div className="flex items-center gap-3">
          <Brand variant="volt" />
        </div>

        <button
          type="button"
          onClick={isStandalone ? () => { window.location.href = "/"; } : onClose}
          className="w-9 h-9 rounded-full bg-[#16171e] border border-[#262835] text-[#8c8f9f] hover:text-white hover:bg-[#20222d] flex items-center justify-center transition-all cursor-pointer shadow-sm"
          title="Chiudi"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* Main Split Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
        {/* LEFT COLUMN: Clean Minimalist Auth Form (matching reference screenshot) */}
        <div className="lg:col-span-5 xl:col-span-5 flex flex-col justify-between p-6 sm:p-12 overflow-y-auto border-r border-[#161720] bg-[#09090c] z-20">
          <div className="my-auto max-w-sm sm:max-w-md w-full mx-auto space-y-6 py-6">
            
            {/* Big Neon Brand Mark Badge */}
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-2xl bg-[#d1fe17] text-black flex items-center justify-center font-black text-2xl tracking-tighter shadow-lg shadow-[#d1fe17]/20 select-none">
                R
              </div>
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
                {mode === "signup" ? "Create your free account" : "Welcome back"}
              </h1>
              <p className="text-xs sm:text-sm text-[#8c8f9f] leading-relaxed">
                {mode === "signup"
                  ? "Create your free account to edit raw footage with autonomous AI, generate hooks, retention curves & pacing breakdowns. No credit card required."
                  : "Accedi al tuo account per continuare a montare i tuoi video con tagli a 0ms, B-Roll 4K Higgsfield e audio mastering."}
              </p>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-xs font-medium leading-relaxed">
                {errorMessage}
              </div>
            )}

            {/* Primary Action: Continue with Google (Full width pill button) */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading || gis.loading}
              className="w-full flex items-center justify-center gap-3 py-3 px-5 rounded-full bg-white hover:bg-neutral-100 text-neutral-900 font-bold text-sm transition-all shadow-md active:scale-[0.99] cursor-pointer"
            >
              {isLoading || gis.loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-neutral-800" />
              ) : (
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
              )}
              <span>Continue with Google</span>
            </button>

            {/* Divider */}
            <div className="relative flex items-center justify-center my-3">
              <div className="w-full border-t border-[#1f202b]"></div>
              <span className="bg-[#09090c] px-3 text-[11px] uppercase font-bold tracking-wider text-[#636677]">
                OR
              </span>
            </div>

            {/* Email Form */}
            {authMethod === "password" ? (
              <form onSubmit={handleEmailSubmit} className="space-y-3">
                {mode === "signup" && showPasswordInput && (
                  <div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name or channel name (optional)"
                      className="w-full bg-[#13141a] text-white placeholder-[#5a5c6c] px-4 py-3 rounded-xl border border-[#232532] focus:border-white focus:outline-none transition-all text-sm"
                    />
                  </div>
                )}

                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email address"
                    required
                    className="w-full bg-[#13141a] text-white placeholder-[#5a5c6c] px-4 py-3 rounded-xl border border-[#232532] focus:border-white focus:outline-none transition-all text-sm"
                  />
                </div>

                {showPasswordInput && (
                  <div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password (min 6 characters)"
                      required
                      minLength={6}
                      autoFocus
                      className="w-full bg-[#13141a] text-white placeholder-[#5a5c6c] px-4 py-3 rounded-xl border border-[#232532] focus:border-white focus:outline-none transition-all text-sm"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-5 rounded-full bg-white hover:bg-neutral-200 text-black font-bold text-sm transition-all disabled:opacity-50 cursor-pointer shadow-md mt-1"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Elaborazione in corso...</span>
                    </span>
                  ) : (
                    "Continue"
                  )}
                </button>

                {/* Subtext link: Or sign in with email and password */}
                {!showPasswordInput && (
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => setShowPasswordInput(true)}
                      className="text-xs text-[#8c8f9f] hover:text-white transition-colors cursor-pointer"
                    >
                      Or sign in with email and password &rarr;
                    </button>
                  </div>
                )}
              </form>
            ) : (
              /* OTP Form */
              <div>
                {!isCodeSent ? (
                  <form onSubmit={handleSendOtp} className="space-y-3">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter email address"
                      required
                      className="w-full bg-[#13141a] text-white placeholder-[#5a5c6c] px-4 py-3 rounded-xl border border-[#232532] focus:border-white focus:outline-none transition-all text-sm"
                    />
                    <button
                      type="submit"
                      disabled={isLoading || !email.trim()}
                      className="w-full py-3 px-5 rounded-full bg-white hover:bg-neutral-200 text-black font-bold text-sm transition-all disabled:opacity-50 cursor-pointer shadow-md"
                    >
                      {isLoading ? "Invio codice in corso..." : "Invia codice monouso"}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-3">
                    <div className="text-xs text-[#8c8f9f] mb-1">
                      Abbiamo inviato un codice a <span className="text-white font-semibold">{email}</span>
                    </div>
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="123456"
                      maxLength={6}
                      required
                      autoFocus
                      className="w-full bg-[#13141a] text-white text-center tracking-[0.4em] text-xl placeholder-[#555] px-4 py-3 rounded-xl border border-[#232532] focus:border-white focus:outline-none transition-all font-mono"
                    />
                    <button
                      type="submit"
                      disabled={isLoading || otpCode.length < 6}
                      className="w-full py-3 px-5 rounded-full bg-white hover:bg-neutral-100 text-black font-extrabold text-sm transition-all disabled:opacity-50 cursor-pointer shadow-lg"
                    >
                      {isLoading ? "Verifica in corso..." : "Verifica codice & entra"}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Toggle OTP option */}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMethod(authMethod === "password" ? "otp" : "password");
                  setShowPasswordInput(false);
                  setErrorMessage(null);
                }}
                className="text-[11px] text-[#787a8b] hover:text-[#d1fe17] transition-colors cursor-pointer"
              >
                {authMethod === "password"
                  ? "Preferisci ricevere un codice email senza password?"
                  : "Torna ad accesso standard con password"}
              </button>
            </div>

            {/* Disclaimer matching screenshot */}
            <p className="text-[11px] text-[#616373] text-center leading-relaxed">
              Continuando accetti i{" "}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#8c8f9f] underline hover:text-white transition-colors"
              >
                Termini di Servizio
              </a>{" "}
              e la{" "}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#8c8f9f] underline hover:text-white transition-colors"
              >
                Privacy Policy
              </a>{" "}
              di RETENTIONEDIT. Info cookie:{" "}
              <a
                href="/cookies"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#8c8f9f] underline hover:text-white transition-colors"
              >
                Cookie Policy
              </a>
              .
            </p>

            {/* Bottom Mode Switch: Already have an account? Log in */}
            <div className="text-center text-xs text-[#8c8f9f] pt-2">
              {mode === "signup" ? (
                <span>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setShowPasswordInput(true);
                      setErrorMessage(null);
                    }}
                    className="text-white font-bold hover:underline transition-all cursor-pointer"
                  >
                    Log in
                  </button>
                </span>
              ) : (
                <span>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup");
                      setShowPasswordInput(false);
                      setErrorMessage(null);
                    }}
                    className="text-white font-bold hover:underline transition-all cursor-pointer"
                  >
                    Sign up
                  </button>
                </span>
              )}
            </div>

          </div>

          {/* Bottom Left Brand Mark */}
          <div className="pt-4 text-xs flex items-center justify-between text-[#555866]">
            <Brand variant="volt" size="sm" />
            <span className="lg:hidden text-[10px] text-[#555866]">
              curated by RETENTIONEDIT
            </span>
          </div>
        </div>

        {/* RIGHT COLUMN: Video Thumbnail Marquee Wall (matching screenshot) */}
        <div className="hidden lg:flex lg:col-span-7 xl:col-span-7 relative h-full flex-col justify-between bg-[#0a0a0d] overflow-hidden">
          {/* Infinite Marquee Wall */}
          <div className="flex-1 flex flex-col justify-center min-h-0">
            <LoginVideoMarquee />
          </div>

          {/* Bottom Right Curated Tag matching screenshot */}
          <div className="w-full flex items-center justify-end px-8 py-3.5 border-t border-[#161720] bg-[#0a0a0d]/80 text-[11px] text-[#636677] select-none">
            <span>
              curated by <strong className="text-[#8c8f9f] font-bold">RETENTIONEDIT</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
