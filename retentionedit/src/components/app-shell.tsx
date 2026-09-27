"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Home,
  BookOpen,
  HelpCircle,
  Bell,
  Zap,
  ChevronDown,
  ChevronRight,
  UserPlus,
  LogOut,
  Headphones,
  Globe,
  ChevronLeft,
  User,
  CreditCard,
  Bot,
  Image as ImageIcon,
  Sparkles,
  Crown,
} from "lucide-react";
import { UserProfile } from "@/context/auth-context";
import { Brand } from "@/components/brand";

export type NavTab =
  | "home"
  | "projects"
  | "pricing"
  | "subscription";

interface AppShellProps {
  children: React.ReactNode;
  credits?: number;
  activeTab?: NavTab;
  user?: UserProfile | null;
  onTabChange?: (tab: NavTab) => void;
  onOpenSettings?: () => void;
  onOpenPricing?: () => void;
  onLogout?: () => void;
  onOpenLanding?: () => void;
  noScroll?: boolean;
}

export function AppShell({
  children,
  credits = 25,
  activeTab = "home",
  user,
  onTabChange,
  onOpenSettings,
  onOpenPricing,
  onLogout,
  onOpenLanding,
  noScroll = false,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Prevent window scrolling when in noScroll mode
  useEffect(() => {
    if (noScroll) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
        document.documentElement.style.overflow = "";
      };
    }
  }, [noScroll]);

  // Clear any legacy localStorage value so sidebar always starts natively closed
  useEffect(() => {
    try {
      localStorage.removeItem("retention_sidebar_open");
    } catch {
      // ignore
    }
  }, []);

  // Close sidebar on click outside
  useEffect(() => {
    if (!sidebarOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [sidebarOpen]);

  const handleToggleSidebar = () => {
    setProfileDropdownOpen(false);
    setSidebarOpen((prev) => !prev);
  };

  const fullName = user?.name || user?.email?.split("@")[0] || "Creator";
  const avatarLetter = (user?.name || user?.email || "C").charAt(0).toUpperCase();

  // Icon-rail button (collapsed): 36x36, white outline icons
  const navBtn = (isActive: boolean) =>
    `w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer shrink-0 ${
      isActive
        ? "bg-[#232328] text-white border border-[#34343b]"
        : "text-[#8c8c90] hover:text-white hover:bg-[#1b1b1e]"
    }`;

  // Open sidebar navigation button (expanded): full-width, icon + label + optional crown/badge
  const openNavBtn = (isActive: boolean) =>
    `w-full flex items-center justify-between px-3 py-2 rounded-xl transition cursor-pointer text-xs font-medium ${
      isActive
        ? "bg-[#232328] text-white border border-[#34343b]"
        : "text-[#8c8c90] hover:text-white hover:bg-[#18181c]"
    }`;

  // Bordered utility box (collapse / profile / invite) — matches Opus top cluster
  const boxBtn =
    "w-10 rounded-xl border border-white/10 bg-[#1A1A1A] flex flex-col items-center justify-center text-white hover:bg-white/10 transition cursor-pointer shrink-0";

  // Shared Accounts dropdown popup (positioned seamlessly beside whichever rail is active)
  const renderProfileDropdown = () => {
    if (!profileDropdownOpen) return null;
    return (
      <>
        <div
          className="fixed inset-0 z-40"
          onClick={() => setProfileDropdownOpen(false)}
        />
        <div
          className={`fixed ${
            sidebarOpen ? "left-[222px]" : "left-[72px]"
          } top-[54px] w-64 rounded-2xl bg-[#1c1c1f] border border-[#2e2e32] shadow-2xl p-1.5 z-50 text-xs animate-in fade-in select-none`}
        >
          <div className="px-3 pt-2 pb-1.5 text-[11px] font-medium text-[#8c8c90]">
            Accounts
          </div>

          <button
            type="button"
            onClick={() => {
              setProfileDropdownOpen(false);
              onOpenSettings?.();
            }}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-[#f4f4f6] hover:bg-[#28282c] transition text-left cursor-pointer group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <User
                size={15}
                className="text-[#8c8c90] group-hover:text-white shrink-0"
              />
              <span className="font-medium truncate">{fullName}</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#252528] text-[#8c8c90] font-normal shrink-0">
              Free Plan
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setProfileDropdownOpen(false);
              onTabChange?.("subscription");
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[#f4f4f6] hover:bg-[#28282c] transition text-left cursor-pointer group"
          >
            <CreditCard
              size={15}
              className="text-[#8c8c90] group-hover:text-white shrink-0"
            />
            <span>Subscription</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setProfileDropdownOpen(false);
              onTabChange?.("subscription");
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[#f4f4f6] hover:bg-[#28282c] transition text-left cursor-pointer group"
          >
            <Zap
              size={15}
              className="text-[#8c8c90] group-hover:text-white shrink-0"
            />
            <span>Credit usage history</span>
          </button>

          <div
            onClick={() => alert("Language: English (US)")}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-[#8c8c90] hover:text-white hover:bg-[#28282c] transition cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <Globe
                size={15}
                className="text-[#8c8c90] group-hover:text-white shrink-0"
              />
              <span>Language</span>
            </div>
            <span className="text-[11px] text-[#8c8c90] flex items-center gap-0.5">
              English (US) <ChevronRight size={13} />
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setProfileDropdownOpen(false);
              alert("OpusClip AI Producer (Beta)");
            }}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-[#f4f4f6] hover:bg-[#28282c] transition text-left cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <Bot
                size={15}
                className="text-[#8c8c90] group-hover:text-white shrink-0"
              />
              <span>OpusClip AI Producer</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#252528] text-[#8c8c90]">
              Beta
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setProfileDropdownOpen(false);
              alert("OpusClip Thumbnail Generator");
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[#f4f4f6] hover:bg-[#28282c] transition text-left cursor-pointer group"
          >
            <ImageIcon
              size={15}
              className="text-[#8c8c90] group-hover:text-white shrink-0"
            />
            <span>OpusClip Thumbnail</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setProfileDropdownOpen(false);
              alert("Opening Agent Opus");
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[#f4f4f6] hover:bg-[#28282c] transition text-left cursor-pointer group"
          >
            <Sparkles
              size={15}
              className="text-[#8c8c90] group-hover:text-white shrink-0"
            />
            <span>Go to Agent Opus</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setProfileDropdownOpen(false);
              onLogout?.();
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[#8c8c90] hover:text-rose-400 hover:bg-[#28282c] transition text-left cursor-pointer group"
          >
            <LogOut
              size={15}
              className="text-[#8c8c90] group-hover:text-rose-400 shrink-0"
            />
            <span>Logout</span>
          </button>
        </div>
      </>
    );
  };

  return (
    <div
      className={`min-h-screen bg-[#0F0F0F] text-[#f4f4f6] flex flex-row font-sans selection:bg-[#6723FF]/30 selection:text-white ${
        noScroll ? "h-screen max-h-screen overflow-hidden" : ""
      }`}
    >
      {/* ========================================================================= */}
      {/* 1. LEFT SIDEBAR (COLLAPSIBLE / EXPANDABLE VIA TOP ARROW BUTTON)            */}
      {/* ========================================================================= */}
      {/* 1. LEFT SIDEBAR (Fixed 68px width in flow so page schede/cards never move) */}
      <div
        ref={sidebarRef}
        className="relative w-[68px] min-w-[68px] max-w-[68px] h-screen shrink-0 z-30"
      >
        {sidebarOpen ? (
          /* ======================== EXPANDED SIDEBAR (OVERLAY) ======================== */
          <aside className="absolute left-0 top-0 w-[216px] h-screen px-2.5 py-3 bg-[#0F0F0F] flex flex-col z-30 select-none overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] border-r border-white/[0.08] shadow-2xl shadow-black/80 animate-in fade-in duration-150">
            {/* Top row: Brand mark + Collapse button (arrow pointing left into line) */}
            <div className="flex items-center justify-between px-1.5 pt-0.5 pb-2 shrink-0">
              <button
                type="button"
                onClick={() => onTabChange?.("home")}
                className="cursor-pointer hover:opacity-80 transition text-left"
                title="Home"
              >
                <Brand size="sm" />
              </button>
              <button
                type="button"
                onClick={handleToggleSidebar}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8c8c90] hover:text-white hover:bg-[#1f1f23] transition cursor-pointer"
                title="Collapse sidebar"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 4v16" />
                  <path d="m14 7-5 5 5 5" />
                  <path d="M9 12h11" />
                </svg>
              </button>
            </div>

            {/* Profile Pill Card */}
            <div className="relative mb-2 shrink-0">
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="w-full rounded-2xl bg-[#141416] border border-[#26262b] p-2 flex items-center justify-between text-left hover:bg-[#1d1d21] transition cursor-pointer"
                title="Account profile"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-7 h-7 rounded-full bg-[#c2185b] flex items-center justify-center font-bold text-xs text-white overflow-hidden shrink-0">
                    {user?.avatarUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={user.avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                    ) : (
                      avatarLetter
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-xs text-white truncate leading-tight">
                      {fullName}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-[#8c8c90] leading-none mt-0.5">
                      <User size={10} className="shrink-0" />
                      <span>0 Free</span>
                    </div>
                  </div>
                </div>
                <ChevronDown size={14} className="text-[#8c8c90] shrink-0" />
              </button>
            </div>

            {/* Invite members button */}
            <button
              type="button"
              onClick={onOpenPricing}
              className="w-full h-9 rounded-xl border border-[#26262b] bg-[#141416] flex items-center justify-between px-3 text-xs font-medium text-white hover:bg-[#1d1d21] transition cursor-pointer mb-3 shrink-0"
              title="Invite members"
            >
              <div className="flex items-center gap-2">
                <UserPlus size={14} className="text-[#8c8c90]" />
                <span>Invite members</span>
              </div>
              <Crown size={13} className="text-amber-400 fill-amber-400 shrink-0" />
            </button>

            {/* Section: Create */}
            <div className="px-2 pt-1 pb-1 text-[11px] font-medium text-[#71717a] shrink-0">
              Create
            </div>
            <nav className="flex flex-col gap-1 mb-3 shrink-0">
              <button
                type="button"
                onClick={() => onTabChange?.("home")}
                className={openNavBtn(activeTab === "home")}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Home size={17} strokeWidth={1.8} className="shrink-0" />
                  <span className="truncate">Home</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onTabChange?.("projects")}
                className={openNavBtn(activeTab === "projects")}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0"
                  >
                    <polyline points="21 8 21 21 3 21 3 8" />
                    <rect x="1" y="3" width="22" height="5" rx="1" />
                    <line x1="10" y1="12" x2="14" y2="12" />
                  </svg>
                  <span className="truncate">My projects</span>
                </div>
              </button>
            </nav>

            {/* Spacer */}
            <div className="flex-1 min-h-6" />

            {/* Bottom: Learning Center (libro) sopra Help Center */}
            <nav className="flex flex-col gap-1 pt-2 border-t border-white/[0.06] shrink-0 pb-1">
              <button
                type="button"
                onClick={() => alert("Learning Center documentation")}
                className={openNavBtn(false)}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <BookOpen size={17} strokeWidth={1.8} className="shrink-0" />
                  <span className="truncate">Learning center</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => alert("Help Center & Support")}
                className={openNavBtn(false)}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <HelpCircle size={17} strokeWidth={1.8} className="shrink-0" />
                  <span className="truncate">Help center</span>
                </div>
              </button>
            </nav>
          </aside>
        ) : (
          /* ======================== COLLAPSED RAIL ======================== */
          <aside className="w-[68px] h-screen py-2 bg-[#0F0F0F] flex flex-col items-center z-30 select-none overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none] border-r border-white/[0.04]">
            {/* ---- 1. Expand sidebar (arrow pointing right into line) --------- */}
            <button
              type="button"
              onClick={handleToggleSidebar}
              className="w-9 h-9 rounded-xl border border-[#26262b] bg-[#131316] flex items-center justify-center text-white hover:bg-[#1d1d21] transition cursor-pointer shrink-0"
              title="Expand sidebar"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 4v16" />
                <path d="m10 7 5 5-5 5" />
                <path d="M15 12H4" />
              </svg>
            </button>

            {/* ---- 2. Profile pill (avatar + chevron) ---------------------------- */}
            <div className="relative mt-2">
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className={`${boxBtn} py-1.5 gap-1`}
                title="Account profile"
              >
                <span className="w-6 h-6 rounded-full bg-[#c2185b] flex items-center justify-center font-bold text-xs text-white overflow-hidden">
                  {user?.avatarUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={user.avatarUrl} alt={fullName} className="w-full h-full object-cover" />
                  ) : (
                    avatarLetter
                  )}
                </span>
                <ChevronDown size={10} className="text-white" strokeWidth={2} />
              </button>
            </div>

            {/* ---- 3. Invite members ---------------------------------------------- */}
            <button
              type="button"
              onClick={onOpenPricing}
              className="w-9 h-9 mt-2 rounded-xl border border-[#26262b] bg-[#131316] flex items-center justify-center text-white hover:bg-[#1d1d21] transition cursor-pointer shrink-0"
              title="Invite members"
            >
              <span className="relative flex items-center justify-center">
                <UserPlus size={17} strokeWidth={1.8} />
                <span className="absolute -top-0.5 -right-1 text-[11px] font-bold leading-none">
                  +
                </span>
              </span>
            </button>

            {/* ---- 4–5. Main navigation (clean spacing, no jumps) --------- */}
            <nav className="flex flex-col items-center gap-2 mt-4 shrink-0">
              <button
                type="button"
                onClick={() => onTabChange?.("home")}
                className={navBtn(activeTab === "home")}
                title="Home"
              >
                <Home size={18} strokeWidth={1.8} />
              </button>

              <button
                type="button"
                onClick={() => onTabChange?.("projects")}
                className={navBtn(activeTab === "projects")}
                title="My projects"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="21 8 21 21 3 21 3 8" />
                  <rect x="1" y="3" width="22" height="5" rx="1" />
                  <line x1="10" y1="12" x2="14" y2="12" />
                </svg>
              </button>
            </nav>

            {/* Spacer */}
            <div className="flex-1 min-h-6" />

            {/* ---- Bottom: Learning center (libro) sopra Help center ---------------- */}
            <nav className="flex flex-col items-center gap-2 pt-2 border-t border-white/[0.06] shrink-0 pb-1">
              <button
                type="button"
                onClick={() => alert("Learning Center documentation")}
                className={navBtn(false)}
                title="Learning center"
              >
                <BookOpen size={18} strokeWidth={1.8} />
              </button>

              <button
                type="button"
                onClick={() => alert("Help Center & Support")}
                className={navBtn(false)}
                title="Help center"
              >
                <HelpCircle size={18} strokeWidth={1.8} />
              </button>
            </nav>
          </aside>
        )}

        {renderProfileDropdown()}
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN APP CONTENT CONTAINER                                             */}
      {/* ========================================================================= */}
      <div
        className={`flex-1 flex flex-col min-w-0 relative bg-[#0F0F0F] ${
          noScroll ? "h-screen max-h-screen overflow-hidden" : ""
        }`}
      >
        {/* Top Header Floating Actions (Matching Desktop OpusClip) */}
        <header className="sticky top-0 z-20 h-14 bg-[#0F0F0F]/95 backdrop-blur px-8 flex items-center justify-end gap-3 select-none">
          {/* Notifications Bell with Red Badge 1 */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="w-9 h-9 rounded-xl bg-[#28282b] hover:bg-[#323236] flex items-center justify-center text-white relative transition cursor-pointer"
              aria-label="Notifications"
            >
              <Bell size={15} />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#ef4444] text-[10px] font-bold text-white flex items-center justify-center shadow-md">
                1
              </span>
            </button>

            {notificationsOpen && (
              <div
                onMouseLeave={() => setNotificationsOpen(false)}
                className="absolute right-0 top-11 w-72 rounded-2xl bg-[#1c1c1f] border border-[#2e2e32] shadow-2xl p-3 z-50 text-xs animate-in fade-in"
              >
                <div className="flex items-center justify-between pb-2 border-b border-[#2b2b2e] mb-2 font-semibold text-white">
                  <span>Notifications</span>
                  <span className="text-[10px] text-violet-400 cursor-pointer">
                    Mark read
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#242427] text-slate-300">
                  <p className="font-semibold text-white text-xs">
                    Welcome to RetentionEdit
                  </p>
                  <p className="text-[11px] text-[#8c8c90] mt-0.5">
                    Your account has 25 credits ready. Drop a link to edit your first RAW video.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Credits Counter Pill (⚡ 25) */}
          <button
            type="button"
            onClick={() => onTabChange?.("subscription")}
            className="h-9 px-3.5 rounded-xl bg-[#28282b] hover:bg-[#323236] flex items-center gap-1.5 text-xs font-semibold text-white transition cursor-pointer"
            title="View subscription and credits"
          >
            <Zap size={14} className="text-[#f59e0b] fill-[#f59e0b]" />
            <span>{credits}</span>
          </button>

          {/* Add Credits Button */}
          <button
            type="button"
            onClick={onOpenPricing}
            className="h-9 px-3.5 rounded-xl bg-[#28282b] hover:bg-[#323236] text-xs font-semibold text-white transition cursor-pointer"
          >
            Add credits
          </button>
        </header>

        {/* Main Content View (Home Workspace, Projects, or Subscription) */}
        <main
          className={`flex-1 w-full max-w-[1320px] mx-auto ${
            noScroll
              ? "px-4 sm:px-6 flex flex-col justify-center items-center overflow-hidden py-1"
              : "px-6 sm:px-8 pb-16"
          }`}
        >
          {children}
        </main>

        {/* Bottom Navigation & Floating Controls (Matching Screenshots 1 & 3) */}
        {!noScroll && (
        <div className="fixed bottom-5 right-8 z-40 flex items-center gap-2.5 select-none">
          {/* Carousel Arrows */}
          <div className="flex items-center gap-1 mr-1">
            <button
              type="button"
              className="w-7 h-7 rounded-lg bg-[#28282b] hover:bg-[#323236] text-[#8c8c90] hover:text-white flex items-center justify-center transition cursor-pointer"
              title="Previous"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              className="w-7 h-7 rounded-lg bg-[#28282b] hover:bg-[#323236] text-[#8c8c90] hover:text-white flex items-center justify-center transition cursor-pointer"
              title="Next"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Floating Actions: Co-pilot + Headphones Stack */}
          <div className="flex flex-col gap-2 items-center">
            {/* Top: Black Co-pilot button */}
            <button
              type="button"
              onClick={() => alert("AI Assistant")}
              className="w-10 h-10 rounded-full bg-black shadow-2xl flex items-center justify-center text-white transition cursor-pointer hover:scale-105 active:scale-95 border border-[#2b2b2e]"
              title="AI Assistant"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </button>

            {/* Bottom: Headphones support button */}
            <button
              type="button"
              onClick={() => alert("Help & Support")}
              className="w-10 h-10 rounded-full bg-[#27272a] shadow-2xl flex items-center justify-center text-white transition cursor-pointer hover:scale-105 active:scale-95 border border-[#333336]"
              title="Help & Support"
            >
              <Headphones size={17} />
            </button>
          </div>
        </div>
        )}

        {/* Bottom Center Indicator capsule */}
        {!noScroll && (
          <div className="fixed bottom-2 left-1/2 -translate-x-1/2 w-16 h-1 rounded-full bg-[#383838] pointer-events-none" />
        )}
      </div>
    </div>
  );
}
