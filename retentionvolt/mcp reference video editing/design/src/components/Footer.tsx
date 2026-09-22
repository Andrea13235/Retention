'use client';

import React from 'react';
import Link from 'next/link';
import { RetentionvoltLogo } from '@/components/RetentionvoltLogo';

interface FooterProps {
  onOpenSettings: () => void;
  onOpenPaywall: () => void;
  onOpenLegal?: (tab: 'privacy' | 'terms' | 'copyright') => void;
  setActiveTab: (tab: 'videos' | 'thumbnails' | 'pricing') => void;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenSettings,
  onOpenPaywall,
  onOpenLegal,
  setActiveTab,
}) => {
  return (
    <footer className="border-t border-[#1c1c1c] bg-[#0e0e0e] py-14 mt-20 text-xs text-[#8e8e8e]">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-8 space-y-8">
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-8 border-b border-[#1c1c1c]">
          {/* Brand */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <RetentionvoltLogo variant="pill" size="sm" />
            </div>
            <p className="text-xs text-[#666] max-w-sm">
              Discover real-world video editing cuts, pacing, and retention structures from top creators.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-10 text-xs">
            <div className="space-y-2">
              <span className="text-white font-semibold block">Discover</span>
              <ul className="space-y-1.5 text-[#8e8e8e]">
                <li><button onClick={() => setActiveTab('videos')} className="hover:text-white">Videos</button></li>
                <li><button onClick={() => setActiveTab('thumbnails')} className="hover:text-white">Thumbnails</button></li>
              </ul>
            </div>

            <div className="space-y-2">
              <span className="text-white font-semibold block">Integrations</span>
              <ul className="space-y-1.5 text-[#8e8e8e]">
                <li><button onClick={onOpenSettings} className="hover:text-white">MCP Server</button></li>
                <li><button onClick={onOpenSettings} className="hover:text-white">Claude &amp; Cursor</button></li>
              </ul>
            </div>

            <div className="space-y-2">
              <span className="text-white font-semibold block">Plans</span>
              <ul className="space-y-1.5 text-[#8e8e8e]">
                <li><button onClick={onOpenPaywall} className="hover:text-white">Get Pro</button></li>
                <li><button onClick={onOpenSettings} className="hover:text-white">API Keys</button></li>
              </ul>
            </div>

            <div className="space-y-2">
              <span className="text-white font-semibold block">Legal</span>
              <ul className="space-y-1.5 text-[#8e8e8e]">
                <li><Link href="/terms" className="hover:text-white">Termini di Servizio</Link></li>
                <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
                <li><Link href="/cookies" className="hover:text-white">Cookie Policy</Link></li>
                <li><Link href="/legal-notice" className="hover:text-white">Note Legali (DSA)</Link></li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('rb:open-cookie-prefs'));
                    }}
                    className="hover:text-white underline decoration-white/20 underline-offset-4"
                  >
                    Impostazioni cookie
                  </button>
                </li>
                <li className="pt-1 border-t border-[#1c1c1c] mt-1">
                  <button onClick={() => onOpenLegal?.('copyright')} className="hover:text-white">Copyright / Fair Use</button>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-[#181818] text-[11px] text-[#555] leading-relaxed">
          YouTube è un marchio di Google LLC. Tutte le miniature, titoli e video appartengono ai rispettivi creator e canali e vengono mostrati esclusivamente per finalità didattiche, di critica, studio del design e video editing (Fair Use / Art. 70 Legge 633/1941).
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#666]">
          <div>© 2026 RETENTIONVOLT. All rights reserved.</div>
          <div>Dark mode • All systems operational</div>
        </div>

      </div>
    </footer>
  );
};
