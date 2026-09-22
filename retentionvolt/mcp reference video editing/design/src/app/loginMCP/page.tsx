'use client';

import React, { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { RetentionvoltLogo } from '@/components/RetentionvoltLogo';

function LoginMcpAliasContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    window.location.replace(`/login-mcp${qs ? `?${qs}` : ''}`);
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-[#0b0b0b] flex flex-col items-center justify-center p-6 text-white text-center">
      <div className="space-y-6 flex flex-col items-center">
        <div className="p-4 rounded-3xl bg-[#141414] border border-[#262626] shadow-2xl">
          <RetentionvoltLogo variant="icon" size={48} />
        </div>
        <div className="flex items-center gap-3 text-sm text-[#8e8e8e]">
          <Loader2 className="w-4 h-4 animate-spin text-[#d1fe17]" />
          <span>Reindirizzamento al portale CyberMCP...</span>
        </div>
      </div>
    </div>
  );
}

export default function LoginMcpAliasPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0b0b0b] flex flex-col items-center justify-center p-6 text-white text-center">
          <div className="space-y-6 flex flex-col items-center">
            <div className="p-4 rounded-3xl bg-[#141414] border border-[#262626] shadow-2xl">
              <RetentionvoltLogo variant="icon" size={48} />
            </div>
            <div className="flex items-center gap-3 text-sm text-[#8e8e8e]">
              <Loader2 className="w-4 h-4 animate-spin text-[#d1fe17]" />
              <span>Reindirizzamento al portale CyberMCP...</span>
            </div>
          </div>
        </div>
      }
    >
      <LoginMcpAliasContent />
    </Suspense>
  );
}
