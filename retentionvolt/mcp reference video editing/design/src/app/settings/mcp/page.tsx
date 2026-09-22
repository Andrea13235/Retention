'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MobbinSettingsView } from '@/components/MobbinSettingsView';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';
import { RetentionvoltLogo } from '@/components/RetentionvoltLogo';

export default function McpSettingsPage() {
  const { isLoggedIn, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      router.replace('/login?redirect=/settings/mcp');
    }
  }, [isLoading, isLoggedIn, router]);

  if (isLoading || !isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#0b0b0b] flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="space-y-6 flex flex-col items-center">
          <div className="p-4 rounded-3xl bg-[#141414] border border-[#262626] shadow-2xl">
            <RetentionvoltLogo variant="icon" size={48} />
          </div>
          <div className="flex items-center gap-3 text-sm text-[#8e8e8e]">
            <Loader2 className="w-4 h-4 animate-spin text-[#d1fe17]" />
            <span>Verifica credenziali per l&apos;accesso MCP in corso...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <MobbinSettingsView
      initialTab="mcp"
      isModal={false}
    />
  );
}
