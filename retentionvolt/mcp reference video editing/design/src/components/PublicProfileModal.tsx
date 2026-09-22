'use client';

import React, { useEffect } from 'react';
import { X, User, Sparkles, Shield, Bookmark } from 'lucide-react';

interface PublicProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAccountSettings: () => void;
}

export const PublicProfileModal: React.FC<PublicProfileModalProps> = ({
  isOpen,
  onClose,
  onOpenAccountSettings,
}) => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
      <div 
        className="relative w-full max-w-[500px] bg-[#1a1a1a] text-white rounded-3xl border border-[#2b2b2b] shadow-2xl p-8 flex flex-col justify-between min-h-[520px]"
        style={{ boxShadow: '0 25px 60px -15px rgba(0,0,0,0.9), 0 0 1px 1px rgba(255,255,255,0.06)' }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 w-8 h-8 rounded-full bg-[#272727] hover:bg-[#353535] text-[#8e8e8e] hover:text-white flex items-center justify-center transition-colors z-10"
          title="Chiudi"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content Area */}
        <div className="flex-1 flex flex-col items-center text-center pt-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 leading-tight">
            Introducing<br />public profiles
          </h2>

          <p className="text-sm text-[#8e8e8e] max-w-sm mb-7 leading-relaxed">
            Be part of the Retention Community! You can now create your own public profile to share your role, editing benchmarks, collections and more.
          </p>

          {/* Central Illustration Card matching Mobbin */}
          <div className="w-full max-w-[280px] p-6 rounded-2xl bg-[#141414] border border-[#282828] flex flex-col items-center shadow-inner relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-[#d6336c]/10 to-transparent pointer-events-none" />
            
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-[#d6336c] text-white flex items-center justify-center font-bold text-2xl mb-3 shadow-lg ring-4 ring-[#262626]">
              a
            </div>

            {/* Profile placeholders */}
            <div className="w-20 h-2 bg-[#333] rounded-full mb-1.5" />
            <div className="w-32 h-1.5 bg-[#262626] rounded-full mb-5" />

            {/* Micro badges grid */}
            <div className="grid grid-cols-4 gap-2 w-full">
              <div className="h-8 rounded-lg bg-[#222] border border-[#2e2e2e] flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-[#d1fe17]" />
              </div>
              <div className="h-8 rounded-lg bg-[#222] border border-[#2e2e2e] flex items-center justify-center">
                <Bookmark className="w-3.5 h-3.5 text-pink-400" />
              </div>
              <div className="h-8 rounded-lg bg-[#222] border border-[#2e2e2e] flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className="h-8 rounded-lg bg-[#222] border border-[#2e2e2e] flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-6 border-t border-[#262626] mt-4">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-full bg-[#272727] hover:bg-[#333333] text-sm font-semibold text-white transition-colors"
          >
            Skip
          </button>

          {/* Indicator pills */}
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-1 rounded-full bg-white" />
            <div className="w-6 h-1 rounded-full bg-[#333333]" />
          </div>

          <button
            onClick={() => {
              onClose();
              onOpenAccountSettings();
            }}
            className="px-5 py-2.5 rounded-full bg-white text-black text-sm font-semibold hover:bg-[#e0e0e0] transition-colors shadow-sm"
          >
            Set up profile
          </button>
        </div>

      </div>
    </div>
  );
};
