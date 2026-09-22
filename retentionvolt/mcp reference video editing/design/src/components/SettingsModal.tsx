'use client';

import React, { useEffect } from 'react';
import { MobbinSettingsView } from '@/components/MobbinSettingsView';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPaywall: () => void;
  initialTab?: 'account' | 'preferences' | 'billing' | 'team' | 'mcp';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onOpenPaywall,
  initialTab = 'mcp'
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
    <div className="fixed inset-0 z-50 bg-[#0e0e0e] animate-fade-in overflow-y-auto">
      <MobbinSettingsView
        onClose={onClose}
        onOpenPaywall={onOpenPaywall}
        initialTab={initialTab}
        isModal={true}
      />
    </div>
  );
};
