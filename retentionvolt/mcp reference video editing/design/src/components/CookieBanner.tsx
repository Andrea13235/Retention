'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ALL_ACCEPTED,
  CONSENT_EVENT,
  ConsentState,
  ONLY_NECESSARY,
  StoredConsent,
  hasStoredConsent,
  loadConsent,
  saveConsent,
} from '@/lib/consent';
import { CookiePreferencesModal } from '@/components/CookiePreferencesModal';

export const CookieBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);

  useEffect(() => {
    // Mostra solo se non c'è consenso salvato
    const check = () => setVisible(!hasStoredConsent());
    check();
    const onConsent = () => setVisible(!hasStoredConsent());
    window.addEventListener(CONSENT_EVENT, onConsent as EventListener);
    window.addEventListener('storage', onConsent);
    return () => {
      window.removeEventListener(CONSENT_EVENT, onConsent as EventListener);
      window.removeEventListener('storage', onConsent);
    };
  }, []);

  const handleAcceptAll = () => {
    saveConsent(ALL_ACCEPTED);
    setVisible(false);
  };

  const handleRejectAll = () => {
    saveConsent(ONLY_NECESSARY);
    setVisible(false);
  };

  const handleSavePrefs = (state: ConsentState) => {
    saveConsent(state);
    setVisible(false);
    setPrefsOpen(false);
  };

  // Esposto per Footer / pagine legali: window.dispatchEvent(new CustomEvent('rb:open-cookie-prefs'))
  useEffect(() => {
    const open = () => {
      // Se il banner è nascosto perché consenso già dato, apriamo comunque le preferenze
      setPrefsOpen(true);
    };
    window.addEventListener('rb:open-cookie-prefs' as never, open as never);
    return () => window.removeEventListener('rb:open-cookie-prefs' as never, open as never);
  }, []);

  if (!visible && !prefsOpen) return null;

  // Se le preferenze sono aperte ma il banner era nascosto, mostriamo solo il modal
  const showBanner = visible;

  return (
    <>
      {showBanner && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Informativa cookie e consenso"
          className="fixed inset-x-0 bottom-0 z-[70] px-3 sm:px-6 pb-3 sm:pb-6 pointer-events-none"
        >
          <div className="mx-auto max-w-[1100px] pointer-events-auto rounded-2xl border border-[#2a2a2a] bg-[#141414]/95 backdrop-blur-xl shadow-[0_24px_64px_rgba(0,0,0,0.65)] overflow-hidden">
            <div className="px-4 sm:px-6 py-4 sm:py-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1.5">
                  <h2 className="text-sm font-bold text-white tracking-tight">
                    Usiamo i cookie per far funzionare RETENTIONVOLT.
                  </h2>
                  <p className="text-xs leading-relaxed text-[#a3a3a3]">
                    Usiamo cookie <span className="text-white font-medium">necessari</span> per autenticazione (Supabase),
                    sicurezza e pagamenti (Stripe), e — solo con il tuo consenso — cookie per{' '}
                    <span className="text-white">preferenze</span> (filtri salvati),{' '}
                    <span className="text-white">analitici</span> e <span className="text-white">marketing</span>.
                    Oggi non usiamo cookie analitici/marketing di terze parti (nessun pixel): le categorie restano
                    disattivate finché non le attivi tu. Puoi cambiare idea in qualsiasi momento.
                    {' '}
                    <Link href="/cookies" className="underline decoration-white/30 underline-offset-4 hover:text-white hover:decoration-white">
                      Cookie Policy
                    </Link>
                    {' · '}
                    <Link href="/privacy" className="underline decoration-white/30 underline-offset-4 hover:text-white hover:decoration-white">
                      Privacy
                    </Link>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleRejectAll}
                  className="px-4 py-2.5 rounded-full bg-[#1e1e1e] hover:bg-[#262626] border border-[#2a2a2a] text-xs font-semibold text-white transition-colors"
                >
                  Rifiuta non essenziali
                </button>
                <button
                  type="button"
                  onClick={() => setPrefsOpen(true)}
                  className="px-4 py-2.5 rounded-full bg-transparent hover:bg-white/5 border border-[#2a2a2a] text-xs font-semibold text-white transition-colors"
                >
                  Personalizza
                </button>
                <button
                  type="button"
                  onClick={handleAcceptAll}
                  className="px-5 py-2.5 rounded-full bg-white hover:bg-neutral-200 text-black text-xs font-bold transition-colors shadow-sm"
                >
                  Accetta tutti
                </button>
                <span className="text-[11px] text-[#666] ml-1 hidden sm:inline">
                  Puoi rivedere le scelte in <button type="button" onClick={() => setPrefsOpen(true)} className="underline underline-offset-4 hover:text-[#aaa]">Impostazioni cookie</button>.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <CookiePreferencesModal
        isOpen={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        onSave={handleSavePrefs}
        initialState={(() => {
          const s: StoredConsent | null = loadConsent();
          return s?.state ?? ONLY_NECESSARY;
        })()}
      />
    </>
  );
};
