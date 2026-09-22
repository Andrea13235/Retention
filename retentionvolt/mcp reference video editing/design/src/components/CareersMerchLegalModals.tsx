'use client';

import React, { useState, useEffect } from 'react';
import { X, Briefcase, ShoppingBag, ShieldCheck, Check, ArrowRight } from 'lucide-react';

/* =========================================================================
   1. CAREERS MODAL
   ========================================================================= */
interface CareersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const JOBS = [
  {
    id: 'job-1',
    title: 'Senior Video Retention Analyst',
    department: 'Video Intelligence',
    type: 'Full-time · Remote',
    description: 'Deconstruct cut cadences, pacing curves, and narrative structures across top-performing YouTube channels to expand our pattern database.'
  },
  {
    id: 'job-2',
    title: 'AI Agent & MCP Systems Engineer',
    department: 'Core Infrastructure',
    type: 'Full-time · Remote',
    description: 'Build high-performance MCP protocol servers, real-time audio STT processing pipelines, and integrations with OpenAI Codex and Claude.'
  },
  {
    id: 'job-3',
    title: 'Motion Graphics Designer (Remotion / CSS)',
    department: 'Design Systems',
    type: 'Contract · Remote',
    description: 'Create programmatic motion graphics, lower thirds, and callout assets exported directly to Remotion React components and CSS animations.'
  }
];

export const CareersModal: React.FC<CareersModalProps> = ({ isOpen, onClose }) => {
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedJob(null);
      setApplied(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
      <div 
        className="relative w-full max-w-2xl bg-[#141414] text-white rounded-3xl border border-[#262626] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        style={{ boxShadow: '0 25px 70px -15px rgba(0,0,0,0.9), 0 0 1px 1px rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#222222] bg-[#171717] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#262626] flex items-center justify-center text-[#d1fe17]">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Careers at RETENTIONVOLT</h2>
              <p className="text-xs text-[#8e8e8e]">Help build the intelligence engine powering the next generation of video creators.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#262626] hover:bg-[#333333] text-[#8e8e8e] hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {applied ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-[#10b981]/20 border border-[#10b981]/40 flex items-center justify-center mb-4">
                <Check className="w-6 h-6 text-[#10b981]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Application Received!</h3>
              <p className="text-xs text-[#8e8e8e] max-w-sm">
                Thank you for applying. We will review your portfolio and reach out via team@retentionvolt.com.
              </p>
            </div>
          ) : (
            JOBS.map((job) => (
              <div
                key={job.id}
                className="p-5 rounded-2xl bg-[#191919] border border-[#262626] hover:border-[#383838] transition-all flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-[#d1fe17] uppercase tracking-wider">{job.department}</span>
                    <span className="text-xs text-[#777]">{job.type}</span>
                  </div>
                  <h3 className="text-base font-bold text-white mb-1.5">{job.title}</h3>
                  <p className="text-xs text-[#a3a3a3] leading-relaxed">{job.description}</p>
                </div>

                <div className="flex items-center justify-end">
                  <button
                    onClick={() => setApplied(true)}
                    className="px-4 py-2 rounded-full bg-white hover:bg-neutral-200 text-black font-semibold text-xs transition-colors"
                  >
                    Quick Apply
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#222222] bg-[#171717] flex items-center justify-between text-xs text-[#8e8e8e] shrink-0">
          <span>We are 100% remote-first across European and US timezones.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full bg-[#272727] hover:bg-[#333] text-white font-semibold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   2. MERCH MODAL
   ========================================================================= */
interface MerchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MERCH_ITEMS = [
  {
    id: 'merch-1',
    name: 'CyberMCP Heavyweight Hoodie',
    price: '$85.00',
    tag: 'Limited Edition',
    description: '500 GSM French Terry cotton with embroidered CyberMCP protocol badge and neon green contrast stitching.',
    imageIcon: '🧥'
  },
  {
    id: 'merch-2',
    name: 'Retention Curve Ceramic Desk Mug',
    price: '$28.00',
    tag: 'Top Seller',
    description: '14oz matte black ceramic featuring the iconic 70% YouTube retention curve graph printed in gloss finish.',
    imageIcon: '☕'
  },
  {
    id: 'merch-3',
    name: 'Cadence Cherry MX Keycap Set',
    price: '$45.00',
    tag: 'Custom PBT',
    description: 'Custom keycap kit with dedicated J-Cut, L-Cut, Hook, and MCP shortcut keycaps.',
    imageIcon: '⌨️'
  }
];

export const MerchModal: React.FC<MerchModalProps> = ({ isOpen, onClose }) => {
  const [orderedId, setOrderedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setOrderedId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
      <div 
        className="relative w-full max-w-2xl bg-[#141414] text-white rounded-3xl border border-[#262626] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        style={{ boxShadow: '0 25px 70px -15px rgba(0,0,0,0.9), 0 0 1px 1px rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#222222] bg-[#171717] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#262626] flex items-center justify-center text-[#d1fe17]">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Official Merch</h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-[#d1fe17] text-black">
                  New Drop
                </span>
              </div>
              <p className="text-xs text-[#8e8e8e]">Premium gear designed for video creators and AI workflow engineers.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#262626] hover:bg-[#333333] text-[#8e8e8e] hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {MERCH_ITEMS.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-2xl bg-[#191919] border border-[#262626] flex items-center justify-between gap-5"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-[#222] border border-[#2e2e2e] flex items-center justify-center text-3xl shrink-0">
                  {item.imageIcon}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base font-bold text-white">{item.name}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#252525] border border-[#333] text-[#aaa]">
                      {item.tag}
                    </span>
                  </div>
                  <p className="text-xs text-[#8e8e8e] leading-relaxed max-w-md">{item.description}</p>
                </div>
              </div>

              <div className="text-right shrink-0 flex flex-col items-end gap-2">
                <div className="text-base font-bold text-white">{item.price}</div>
                <button
                  onClick={() => setOrderedId(item.id)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                    orderedId === item.id
                      ? 'bg-[#10b981] text-black font-bold'
                      : 'bg-white hover:bg-neutral-200 text-black'
                  }`}
                >
                  {orderedId === item.id ? 'Pre-ordered ✓' : 'Pre-order'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-[#222222] bg-[#171717] flex items-center justify-between text-xs text-[#8e8e8e] shrink-0">
          <span>Worldwide express carbon-neutral shipping available.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full bg-[#272727] hover:bg-[#333] text-white font-semibold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   3. LEGAL MODAL (Privacy, Terms, Copyright)
   ========================================================================= */
interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'privacy' | 'terms' | 'copyright';
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'privacy',
}) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms' | 'copyright'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
      <div 
        className="relative w-full max-w-2xl bg-[#141414] text-white rounded-3xl border border-[#262626] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        style={{ boxShadow: '0 25px 70px -15px rgba(0,0,0,0.9), 0 0 1px 1px rgba(255,255,255,0.06)' }}
      >
        {/* Header & Tabs */}
        <div className="px-6 py-5 border-b border-[#222222] bg-[#171717] shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-[#d1fe17]" />
              <h2 className="text-xl font-bold text-white">Legal &amp; Compliance</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#262626] hover:bg-[#333333] text-[#8e8e8e] hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 border-b border-[#262626]">
            <button
              onClick={() => setActiveTab('privacy')}
              className={`pb-2.5 text-xs font-semibold transition-colors border-b-2 ${
                activeTab === 'privacy'
                  ? 'border-white text-white'
                  : 'border-transparent text-[#8e8e8e] hover:text-white'
              }`}
            >
              Privacy Policy
            </button>
            <button
              onClick={() => setActiveTab('terms')}
              className={`pb-2.5 text-xs font-semibold transition-colors border-b-2 ${
                activeTab === 'terms'
                  ? 'border-white text-white'
                  : 'border-transparent text-[#8e8e8e] hover:text-white'
              }`}
            >
              Terms of Service
            </button>
            <button
              onClick={() => setActiveTab('copyright')}
              className={`pb-2.5 text-xs font-semibold transition-colors border-b-2 ${
                activeTab === 'copyright'
                  ? 'border-white text-white'
                  : 'border-transparent text-[#8e8e8e] hover:text-white'
              }`}
            >
              Copyright &amp; Fair Use
            </button>
          </div>
        </div>

        {/* Text Content */}
        <div className="flex-1 overflow-y-auto p-6 text-xs text-[#a3a3a3] leading-relaxed space-y-4">
          {activeTab === 'privacy' && (
            <>
              <h3 className="text-sm font-bold text-white">Informativa breve (vedi pagina completa)</h3>
              <p>
                Raccogliamo solo email, nome, preferenze e — se acquisti — dati di fatturazione via Stripe (mai la carta). Usiamo cookie necessari + preferenze solo con consenso. Nessun pixel pubblicitario attivo. Diritti GDPR: accesso, rettifica, cancellazione, portabilità, opposizione e revoca consenso — scrivi a <a href="mailto:privacy@retentionvolt.com" className="underline hover:text-white">privacy@retentionvolt.com</a>.
              </p>
              <a href="/privacy" className="inline-flex items-center gap-1.5 text-xs font-semibold text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">
                Leggi la Privacy Policy completa <ArrowRight className="w-3 h-3" />
              </a>
              <h3 className="text-sm font-bold text-white mt-4">Cookie</h3>
              <p>
                Banner con Accetta/Rifiuta/Personalizza. Nessun cookie non-essenziale prima del consenso. Revoca in 1 click da “Impostazioni cookie” nel footer.
              </p>
              <a href="/cookies" className="inline-flex items-center gap-1.5 text-xs font-semibold text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">
                Cookie Policy <ArrowRight className="w-3 h-3" />
              </a>
            </>
          )}

          {activeTab === 'terms' && (
            <>
              <h3 className="text-sm font-bold text-white">Termini in breve</h3>
              <p>
                Uso consentito per studio dei pattern di editing; vietati scraping massivo e rivendita API key. Pro = rinnovo automatico disattivabile in 1 click (Settings → Billing). Trial annuale 7 giorni. Recesso consumatori UE 14 giorni (salvo esecuzione immediata richiesta).
              </p>
              <a href="/terms" className="inline-flex items-center gap-1.5 text-xs font-semibold text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">
                Leggi i Termini completi <ArrowRight className="w-3 h-3" />
              </a>
              <p className="pt-3 border-t border-[#222] text-[11px] text-[#666]">
                Rate limit MCP: 60 req/min (Pro). Abuso → throttling/sospensione.
              </p>
            </>
          )}

          {activeTab === 'copyright' && (
            <>
              <h3 className="text-sm font-bold text-white">1. Fair Use Educational Notice</h3>
              <p>All video snippets, creator thumbnails, and audio benchmarks indexed on RETENTIONVOLT are reproduced strictly under fair use principles for educational, analytical, and critical review purposes (17 U.S. Code § 107 / art. 70 L. 633/1941).</p>

              <h3 className="text-sm font-bold text-white">2. Creator Rights</h3>
              <p>All video assets and original source materials remain the exclusive copyright of their respective creators and rights holders. If you are a creator and wish to update or remove your benchmark reference, contact <a href="mailto:legal@retentionvolt.com" className="underline hover:text-white">legal@retentionvolt.com</a> — rispondiamo entro 5 giorni lavorativi (DSA notice &amp; takedown).</p>
              <a href="/legal-notice" className="inline-flex items-center gap-1.5 text-xs font-semibold text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">
                Note Legali &amp; DSA <ArrowRight className="w-3 h-3" />
              </a>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#222222] bg-[#171717] flex items-center justify-between text-xs text-[#8e8e8e] shrink-0">
          <span>Aggiornato: 20 settembre 2026 · <a href="/privacy" className="underline hover:text-white">Privacy</a> · <a href="/cookies" className="underline hover:text-white">Cookie</a> · <a href="/terms" className="underline hover:text-white">Termini</a></span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-colors"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
