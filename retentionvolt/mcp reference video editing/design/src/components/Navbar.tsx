'use client';

import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { RetentionvoltLogo } from '@/components/RetentionvoltLogo';
import { ProfileMenuPopover } from '@/components/ProfileMenuPopover';
import { McpIcon } from '@/components/McpIcon';
import { useAuth } from '@/context/AuthContext';

interface NavbarProps {
  activeTab: 'videos' | 'thumbnails' | 'pricing';
  setActiveTab: (tab: 'videos' | 'thumbnails' | 'pricing') => void;
  activeView?: 'landing' | 'app';
  onViewChange?: (view: 'landing' | 'app') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenSettings: () => void;
  onOpenPaywall: () => void;
  onOpenMcp?: () => void;
  onLogoClick?: () => void;
  onOpenAuth?: (mode?: 'signup' | 'login') => void;
  onOpenProfileSetup?: () => void;
  onOpenRequestContent?: () => void;
  onOpenChangelog?: () => void;
  onOpenBlog?: () => void;
  onOpenCareers?: () => void;
  onOpenMerch?: () => void;
  onOpenSupport?: () => void;
  onOpenLegal?: (tab: 'privacy' | 'terms' | 'copyright') => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeView = 'app',
  onViewChange,
  searchQuery,
  setSearchQuery,
  onOpenSettings,
  onOpenPaywall,
  onOpenMcp,
  onLogoClick,
  onOpenAuth,
  onOpenProfileSetup = onOpenSettings,
  onOpenRequestContent = () => {},
  onOpenChangelog = () => {},
  onOpenBlog = () => {},
  onOpenCareers = () => {},
  onOpenMerch = () => {},
  onOpenSupport = () => {},
  onOpenLegal = () => {},
  onLogout = () => {},
}) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const { user, isLoggedIn } = useAuth();


  return (
    <header className="sticky top-0 z-50 w-full bg-[#0e0e0e] border-b border-[#1f1f1f]">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-6">
        
        {/* Left: Logo Only (no text) + Main Navigation Tabs */}
        <div className="flex items-center gap-6">
          <button 
            onClick={onLogoClick ?? (() => setActiveTab('videos'))}
            className="flex items-center group transition-opacity hover:opacity-95 shrink-0"
            title="RETENTIONVOLT — Video Retention Reference"
          >
            <RetentionvoltLogo variant="icon" size={32} />
          </button>

          {/* Navigation Items (Videos / Thumbnails / Motion etc.) */}
          <nav className="hidden md:flex items-center gap-5 text-sm">

            <button
              onClick={() => {
                if (onViewChange) onViewChange('app');
                setActiveTab('videos');
              }}
              className={`transition-colors font-medium ${
                activeView === 'app' && activeTab === 'videos'
                  ? 'text-white font-semibold'
                  : 'text-[#8e8e8e] hover:text-white'
              }`}
            >
              Videos
            </button>

            <button
              onClick={() => {
                if (onViewChange) onViewChange('app');
                setActiveTab('thumbnails');
              }}
              className={`transition-colors font-medium ${
                activeView === 'app' && activeTab === 'thumbnails'
                  ? 'text-white font-semibold'
                  : 'text-[#8e8e8e] hover:text-white'
              }`}
            >
              Thumbnails
            </button>
          </nav>
        </div>

        {/* Center: Mobbin Long Search Input Bar */}
        <div className="flex-1 max-w-xl hidden sm:block">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#666666]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search videos, creators, pacing..."
              className="w-full bg-[#1c1c1c] text-sm text-white placeholder-[#666666] pl-11 pr-4 py-2.5 rounded-full border border-transparent hover:border-[#2e2e2e] focus:border-[#444] focus:outline-none transition-all"
            />
          </div>
        </div>

        {/* Right: Server MCP, Get Pro, Login/Signup, Avatar with Popover */}
        <div className="flex items-center gap-3 shrink-0">
          
          {/* Server MCP Action Button */}
          <button
            onClick={onOpenMcp ?? onOpenSettings}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#1c1c1c] hover:bg-[#252525] border border-[#2e2e2e] hover:border-[#444] text-xs font-semibold text-white transition-all shadow-sm group"
            title="Apri Server MCP"
          >
            <McpIcon className="w-3.5 h-3.5 text-[#d1fe17] group-hover:scale-110 transition-transform" />
            <span>Server MCP</span>
          </button>

          {!isLoggedIn ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenAuth?.('login')}
                className="px-3.5 py-1.5 text-xs font-semibold text-[#aaa] hover:text-white transition-colors"
              >
                Log in
              </button>
              <button
                onClick={() => onOpenAuth?.('signup')}
                className="px-4 py-1.5 rounded-full bg-white text-black text-xs font-bold hover:bg-[#e0e0e0] transition-colors shadow-sm"
              >
                Join
              </button>
            </div>
          ) : (
            <>
              {/* Mobbin Signature "Get Pro" Pure White Pill Button */}
              {user?.plan !== 'pro' ? (
                <button
                  onClick={onOpenPaywall}
                  className="px-4 py-2 rounded-full bg-white text-black text-xs sm:text-sm font-semibold hover:bg-[#e0e0e0] transition-colors shadow-sm"
                >
                  Get Pro
                </button>
              ) : (
                <span className="px-3 py-1 rounded-full bg-[#0066ff] text-white text-[11px] font-extrabold uppercase tracking-wide">
                  PRO MEMBER
                </span>
              )}
            </>
          )}

          {/* Mobbin Profile Circle Avatar with Interactive Popover */}
          <div className="relative">
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className={`w-8 h-8 rounded-full bg-[#d6336c] text-white flex items-center justify-center font-bold text-xs hover:opacity-90 transition-all ${
                isProfileMenuOpen ? 'ring-2 ring-white/60 scale-105' : ''
              }`}
              title="Profile & Settings"
            >
              {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
            </button>

            <ProfileMenuPopover
              isOpen={isProfileMenuOpen}
              onClose={() => setIsProfileMenuOpen(false)}
              onOpenProfileSetup={onOpenProfileSetup}
              onOpenMcp={onOpenMcp ?? onOpenSettings}
              onOpenRequestContent={onOpenRequestContent}
              onOpenSettings={onOpenSettings}
              onOpenPricing={onOpenPaywall}
              onOpenChangelog={onOpenChangelog}
              onOpenBlog={onOpenBlog}
              onOpenCareers={onOpenCareers}
              onOpenMerch={onOpenMerch}
              onOpenSupport={onOpenSupport}
              onOpenLegal={onOpenLegal}
              onLogout={onLogout}
            />
          </div>

        </div>

      </div>
    </header>
  );
};
