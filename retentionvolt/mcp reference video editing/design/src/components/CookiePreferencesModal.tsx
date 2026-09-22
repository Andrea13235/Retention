'use client';

import React, { useEffect, useState } from 'react';
import { X, ShieldCheck, Sliders, BarChart3, Megaphone, Lock } from 'lucide-react';
import { ConsentState, ONLY_NECESSARY } from '@/lib/consent';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (state: ConsentState) => void;
  initialState: ConsentState;
}

const ROWS: Array<{
  key: keyof ConsentState;
  title: string;
  desc: string;
  icon: React.ReactNode;
  alwaysOn?: boolean;
}> = [
  {
    key: 'necessary',
    title: 'Necessari (sempre attivi)',
    desc: 'Autenticazione Supabase, sessione, sicurezza, Stripe checkout/portal/webhook e preferenze essenziali. Senza questi il sito non funziona.',
    icon: <Lock className="w-4 h-4" />,
    alwaysOn: true,
  },
  {
    key: 'preferences',
    title: 'Preferenze',
    desc: 'Salvataggio filtri, lingua, onboarding e impostazioni UI in localStorage. Disattivandoli perdi solo la persistenza delle preferenze.',
    icon: <Sliders className="w-4 h-4" />,
  },
  {
    key: 'analytics',
    title: 'Analitici',
    desc: 'Conteggio visite first-party: 1 visita al giorno per visitatore anonimo (id casuale rb_vid, sul server solo hash giornaliero — no IP in chiaro, no profilazione). Parte solo con questa categoria attiva. Nessun tracker di terze parti (GA4/Mixpanel/pixel).',
    icon: <BarChart3 className="w-4 h-4" />,
  },
  {
    key: 'marketing',
    title: 'Marketing',
    desc: 'Nessun pixel pubblicitario attivo (Meta/Google Ads). Se in futuro lo attiveremo, sarà solo con consenso esplicito e revocabile.',
    icon: <Megaphone className="w-4 h-4" />,
  },
];

export const CookiePreferencesModal: React.FC<Props> = ({ isOpen, onClose, onSave, initialState }) => {
  const [draft, setDraft] = useState<ConsentState>(initialState);

  useEffect(() => {
    if (isOpen) setDraft(initialState);
  }, [isOpen, initialState]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const set = (k: keyof ConsentState, v: boolean) => {
    if (k === 'necessary') return;
    setDraft((d) => ({ ...d, [k]: v }));
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-[#141414] border border-[#262626] rounded-3xl shadow-[0_24px_64px_rgba(0,0,0,0.7)] overflow-hidden flex flex-col max-h-[88vh]">
        <div className="px-6 py-5 border-b border-[#222] bg-[#171717] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#1e1e1e] border border-[#2a2a2a] flex items-center justify-center text-[#d1fe17]">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Preferenze cookie</h2>
              <p className="text-[11px] text-[#8e8e8e]">Scegli quali cookie autorizzare. Puoi cambiare idea in qualsiasi momento.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="w-8 h-8 rounded-full bg-[#1e1e1e] hover:bg-[#262626] border border-[#222] text-[#8e8e8e] hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {ROWS.map((r) => {
            const checked = draft[r.key];
            const disabled = Boolean(r.alwaysOn);
            return (
              <label
                key={r.key}
                className={`flex gap-3 sm:gap-4 p-4 rounded-2xl border transition-colors ${
                  disabled ? 'bg-[#1a1a1a] border-[#262626] opacity-95' : 'bg-[#1c1c1c] border-[#262626] hover:border-[#333]'
                }`}
              >
                <div className="mt-0.5 w-8 h-8 rounded-full bg-[#222] border border-[#2e2e2e] flex items-center justify-center text-white shrink-0">
                  {r.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-white">{r.title}</span>
                    <span className="inline-flex items-center gap-2 shrink-0">
                      <span className={`text-[11px] font-semibold ${checked ? 'text-emerald-300' : 'text-[#777]'}`}>
                        {checked ? 'Attivo' : 'Disattivo'}
                      </span>
                      <span
                        role="switch"
                        aria-checked={checked}
                        aria-label={r.title}
                        onClick={(e) => {
                          e.preventDefault();
                          if (!disabled) set(r.key, !checked);
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors cursor-pointer ${
                          checked ? 'bg-white border-white' : 'bg-[#2a2a2a] border-[#333]'
                        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full shadow transition-transform ${
                            checked ? 'translate-x-6 bg-black' : 'translate-x-1 bg-white'
                          }`}
                        />
                      </span>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        disabled={disabled}
                        onChange={(e) => set(r.key, e.target.checked)}
                      />
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-[#8e8e8e] mt-1.5">{r.desc}</p>
                </div>
              </label>
            );
          })}

          <div className="rounded-2xl bg-[#181818] border border-[#262626] p-4 text-[11px] leading-relaxed text-[#8e8e8e]">
            <p className="font-semibold text-white text-xs mb-1">Cosa raccogliamo davvero oggi</p>
            <ul className="list-disc pl-4 space-y-1">
              <li><span className="text-white">Account:</span> email, nome, avatar (Supabase Auth), preferenze onboarding.</li>
              <li><span className="text-white">Pagamenti:</span> gestiti da Stripe (noi non vediamo mai il numero di carta).</li>
              <li><span className="text-white">Supporto:</span> email + messaggio del ticket (Supabase support_tickets).</li>
              <li><span className="text-white">Uso prodotto:</span> IP + conteggio audit/video richiesti per rate limit e anti-abuso (log applicativi).</li>
              <li><span className="text-white">MCP:</span> API key hash, IP e tool usato per sicurezza e audit.</li>
            </ul>
            <p className="mt-2">
              Dettagli completi in{' '}
              <a href="/privacy" className="underline decoration-white/30 underline-offset-4 hover:text-white hover:decoration-white">
                Privacy Policy
              </a>
              {' e '}
              <a href="/cookies" className="underline decoration-white/30 underline-offset-4 hover:text-white hover:decoration-white">
                Cookie Policy
              </a>
              .
            </p>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-4 border-t border-[#222] bg-[#171717] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onSave(ONLY_NECESSARY)}
            className="px-4 py-2.5 rounded-full bg-[#1e1e1e] hover:bg-[#262626] border border-[#2a2a2a] text-xs font-semibold text-white transition-colors"
          >
            Rifiuta non essenziali
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-full bg-transparent hover:bg-white/5 border border-[#2a2a2a] text-xs font-semibold text-white transition-colors"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={() => onSave(draft)}
              className="px-5 py-2.5 rounded-full bg-white hover:bg-neutral-200 text-black text-xs font-bold transition-colors"
            >
              Salva preferenze
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
