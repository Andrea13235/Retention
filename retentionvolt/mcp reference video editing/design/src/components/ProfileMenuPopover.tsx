'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  PlusCircle, 
  Settings, 
  Sun, 
  Moon, 
  Monitor, 
  ArrowUpRight 
} from 'lucide-react';
import { McpIcon } from '@/components/McpIcon';
import { useAuth } from '@/context/AuthContext';

interface ProfileMenuPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProfileSetup: () => void;
  onOpenMcp: () => void;
  onOpenRequestContent: () => void;
  onOpenSettings: () => void;
  onOpenPricing: () => void;
  onOpenChangelog: () => void;
  onOpenBlog: () => void;
  onOpenCareers: () => void;
  onOpenMerch: () => void;
  onOpenSupport: () => void;
  onOpenLegal: (tab: 'privacy' | 'terms' | 'copyright') => void;
  onLogout: () => void;
}

export const ProfileMenuPopover: React.FC<ProfileMenuPopoverProps> = ({
  isOpen,
  onClose,
  onOpenProfileSetup,
  onOpenMcp,
  onOpenRequestContent,
  onOpenSettings,
  onOpenPricing,
  onOpenChangelog,
  onOpenBlog,
  onOpenCareers,
  onOpenMerch,
  onOpenSupport,
  onOpenLegal,
  onLogout,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('dark');
  const { user } = useAuth();

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const displayName = user?.name || (user?.email ? user.email.split('@')[0] : 'Creator');
  const displayEmail = user?.email || '';

  return (
    <div 
      ref={popoverRef}
      className="absolute right-0 top-full mt-2 w-[270px] bg-[#1a1a1a] text-white border border-[#2a2a2a] rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100 font-sans select-none"
      style={{ boxShadow: '0 20px 40px -15px rgba(0,0,0,0.8), 0 0 1px 1px rgba(255,255,255,0.08)' }}
    >
      {/* 1. Header: User Info & Set up profile */}
      <div className="px-2 pt-1 pb-2.5">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-white text-base leading-tight capitalize">{displayName}</div>
          {user?.plan === 'pro' && (
            <span className="bg-[#0066ff] text-white text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded">
              PRO
            </span>
          )}
        </div>
        <div className="text-xs text-[#8e8e8e] truncate mt-0.5">{displayEmail}</div>

        <button
          onClick={() => {
            onClose();
            onOpenProfileSetup();
          }}
          className="mt-3 w-full py-2 px-3 rounded-full bg-[#272727] hover:bg-[#333333] active:bg-[#3a3a3a] text-white text-xs font-semibold transition-colors flex items-center justify-center border border-[#353535]/50"
        >
          Set up profile
        </button>
      </div>

      {/* 2. Core Actions: MCP, Request content, Settings */}
      <div className="pt-1 pb-1 space-y-0.5">
        <button
          onClick={() => {
            onClose();
            onOpenMcp();
          }}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-[#d4d4d4] hover:text-white hover:bg-[#252525] transition-colors group"
        >
          <McpIcon className="w-4 h-4 text-[#8e8e8e] group-hover:text-white transition-colors shrink-0" />
          <span className="font-medium">MCP</span>
        </button>

        <button
          onClick={() => {
            onClose();
            onOpenRequestContent();
          }}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-[#d4d4d4] hover:text-white hover:bg-[#252525] transition-colors group"
        >
          <PlusCircle className="w-4 h-4 text-[#8e8e8e] group-hover:text-white transition-colors" />
          <span className="font-medium">Request content</span>
        </button>

        <button
          onClick={() => {
            onClose();
            onOpenSettings();
          }}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm text-[#d4d4d4] hover:text-white hover:bg-[#252525] transition-colors group"
        >
          <Settings className="w-4 h-4 text-[#8e8e8e] group-hover:text-white transition-colors" />
          <span className="font-medium">Settings</span>
        </button>
      </div>

      {/* Divider */}
      <div className="h-px bg-[#262626] my-2" />

      {/* 3. Theme Toggle Row */}
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-sm font-medium text-white">Theme</span>
        <div className="flex items-center bg-[#242424] p-0.5 rounded-full border border-[#333333]">
          <button
            onClick={() => setTheme('light')}
            className={`p-1.5 rounded-full transition-all ${
              theme === 'light' 
                ? 'bg-white text-black shadow-sm' 
                : 'text-[#8e8e8e] hover:text-white'
            }`}
            title="Light theme"
          >
            <Sun className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setTheme('dark')}
            className={`p-1.5 rounded-full transition-all ${
              theme === 'dark' 
                ? 'bg-[#383838] text-white shadow-sm' 
                : 'text-[#8e8e8e] hover:text-white'
            }`}
            title="Dark theme"
          >
            <Moon className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setTheme('system')}
            className={`p-1.5 rounded-full transition-all ${
              theme === 'system' 
                ? 'bg-[#383838] text-white shadow-sm' 
                : 'text-[#8e8e8e] hover:text-white'
            }`}
            title="System theme"
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-[#262626] my-2" />

      {/* 4. Navigation Links */}
      <div className="space-y-0.5">
        <button
          onClick={() => {
            onClose();
            onOpenPricing();
          }}
          className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm text-[#d4d4d4] hover:text-white hover:bg-[#252525] transition-colors"
        >
          <span className="font-medium">Pricing</span>
        </button>

        <button
          onClick={() => {
            onClose();
            onOpenChangelog();
          }}
          className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm text-[#d4d4d4] hover:text-white hover:bg-[#252525] transition-colors"
        >
          <span className="font-medium">Changelog</span>
        </button>

        <button
          onClick={() => {
            onClose();
            onOpenBlog();
          }}
          className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm text-[#d4d4d4] hover:text-white hover:bg-[#252525] transition-colors"
        >
          <span className="font-medium">Blog</span>
        </button>

        <button
          onClick={() => {
            onClose();
            onOpenCareers();
          }}
          className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm text-[#d4d4d4] hover:text-white hover:bg-[#252525] transition-colors group"
        >
          <span className="font-medium">Careers</span>
          <ArrowUpRight className="w-3.5 h-3.5 text-[#8e8e8e] group-hover:text-white transition-colors" />
        </button>

        <button
          onClick={() => {
            onClose();
            onOpenMerch();
          }}
          className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm text-[#d4d4d4] hover:text-white hover:bg-[#252525] transition-colors group"
        >
          <div className="flex items-center gap-2">
            <span className="font-medium">Merch</span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-[#333333] text-white">
              New
            </span>
          </div>
          <ArrowUpRight className="w-3.5 h-3.5 text-[#8e8e8e] group-hover:text-white transition-colors" />
        </button>

        <button
          onClick={() => {
            onClose();
            onOpenSupport();
          }}
          className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm text-[#d4d4d4] hover:text-white hover:bg-[#252525] transition-colors group"
        >
          <span className="font-medium">Support</span>
          <ArrowUpRight className="w-3.5 h-3.5 text-[#8e8e8e] group-hover:text-white transition-colors" />
        </button>

        <button
          onClick={() => {
            onClose();
            onLogout();
          }}
          className="w-full flex items-center px-2 py-1.5 rounded-lg text-sm text-[#d4d4d4] hover:text-white hover:bg-[#252525] transition-colors"
        >
          <span className="font-medium">Log out</span>
        </button>
      </div>

      {/* Divider */}
      <div className="h-px bg-[#262626] my-2" />

      {/* 5. Footer: Privacy, Terms, Copyright & X */}
      <div className="px-2 pt-1 pb-1 flex items-center justify-between text-xs text-[#8e8e8e]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              onClose();
              onOpenLegal('privacy');
            }}
            className="hover:text-white transition-colors"
          >
            Privacy
          </button>
          <button
            onClick={() => {
              onClose();
              onOpenLegal('terms');
            }}
            className="hover:text-white transition-colors"
          >
            Terms
          </button>
          <button
            onClick={() => {
              onClose();
              onOpenLegal('copyright');
            }}
            className="hover:text-white transition-colors"
          >
            Copyright
          </button>
        </div>

        <a
          href="https://x.com/retentionvolt"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#8e8e8e] hover:text-white transition-colors p-1"
          title="Follow on X"
        >
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </a>
      </div>
    </div>
  );
};
