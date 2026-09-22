# 🇺🇸 GUIDA IMPLEMENTAZIONE TERMINI PER IL MERCATO STATUNITENSE (US-CENTRIC)

Avendo specificato che **RETENTIONVOLT** viene erogato principalmente negli **Stati Uniti**, il documento legale principale da implementare sul sito è **`TERMS_OF_SERVICE.md`** (in lingua inglese, redatto secondo il diritto federale USA e dello Stato del Delaware/California).

---

## 🏛️ Cosa rende questo documento conforme al 100% per gli USA:

1. **Mandatory Binding Individual Arbitration & Class Action Waiver (Sezione 16)**:
   * *Fondamentale negli USA*: obbliga gli utenti a risolvere le dispute tramite arbitrato individuale (regole AAA - American Arbitration Association), **bloccando qualsiasi tentativo di Class Action collettiva milionaria** e rinunciando al processo con giuria (*Jury Trial Waiver*).
2. **DMCA Section 512 Safe Harbor & Designated Agent (Sezione 6)**:
   * Procedura formale di *Notice & Takedown* conforme a 17 U.S.C. § 512(c)(3) e procedura di contro-notifica (§ 512(g)), proteggendo la piattaforma dalla responsabilità per copyright sui video dei creator analizzati.
3. **U.S. Fair Use Doctrine - 17 U.S.C. § 107 (Sezione 5)**:
   * Dimostrazione dei 4 requisiti di Fair Use trasformativo (*Campbell v. Acuff-Rose*, *Authors Guild v. Google*), chiarendo che l'indicizzazione delle metriche di taglio (CPM/ASL) non sostituisce la visione dei video originali.
4. **FTC & California Auto-Renewal Law - ARL / ROSCA (Sezione 10)**:
   * Termini di abbonamento trasparenti su rinnovo automatico e cancellazione in 1-click ("Cancel anytime in Settings") per prevenire sanzioni della Federal Trade Commission o class action in California.
5. **Computer Fraud and Abuse Act - CFAA - 18 U.S.C. § 1030 (Sezione 8)**:
   * Divieto formale di web scraping, dumping massivo del database, reverse engineering o utilizzo dei dati per addestrare modelli AI concorrenti.
6. **COPPA (Children's Online Privacy Protection Act - Sezione 2)**:
   * Esclusione espressa dell'accesso a minori di 13 anni.
7. **California Consumer Notice (Cal. Civ. Code § 1789.3 - Sezione 15)**:
   * Informativa obbligatoria per legge per gli utenti residenti in California con i contatti del Department of Consumer Affairs.
8. **UCC § 2-316 Disclaimer & Viral Disclaimer (Sezione 11)**:
   * Clausola in maiuscolo (obbligatoria per la giurisprudenza USA) che esclude qualsiasi promessa o garanzia di crescita di iscritti o viralità su YouTube.
9. **OFAC & U.S. Export Controls (Sezione 14)**:
   * Conformità alle sanzioni del Dipartimento del Tesoro USA (divieto di fornitura a paesi sotto embargo o individui nella lista SDN).

---

## 💻 2. Come Implementarlo nel Sito Next.js

### A. Pagina Dedicata: `src/app/terms/page.tsx`
Crea il file `src/app/terms/page.tsx` per rendere i termini raggiungibili all'URL pubblico `https://retentionvolt.com/terms`:

```tsx
// src/app/terms/page.tsx
import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export const metadata = {
  title: 'Terms of Service | RETENTIONVOLT',
  description: 'Official Terms of Service, DMCA Policy, Fair Use and MCP Agent Rules.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0d0d0d] text-[#e5e5e5] font-sans selection:bg-[#d1fe17] selection:text-black">
      <header className="border-b border-[#222222] bg-[#141414]/90 backdrop-blur-md py-4 px-6 sticky top-0 z-30 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-xs font-semibold text-[#8e8e8e] hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to App</span>
        </Link>
        <div className="flex items-center gap-2 text-xs font-bold text-[#d1fe17]">
          <ShieldCheck className="w-4 h-4" />
          <span>RETENTIONVOLT LEGAL (US)</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12 prose prose-invert prose-headings:text-white prose-a:text-[#d1fe17] text-xs sm:text-sm leading-relaxed">
        {/* Renderizza o includi il contenuto di TERMS_OF_SERVICE.md */}
      </main>
    </div>
  );
}
```

### B. Aggiornamento del Modal Legale Esistente: `LegalModal.tsx`
Nel componente `src/components/CareersMerchLegalModals.tsx`, puoi inserire gli estratti salienti dei nuovi termini all'interno del tab `'terms'`:
* 1. Acceptance & Binding Arbitration
* 2. Fair Use & DMCA Notice (17 U.S.C. § 107 & § 512)
* 3. Model Context Protocol (MCP) & Anti-Scraping (CFAA)
* 4. Subscription Auto-Renewal & 1-Click Cancellation
* 5. Disclaimer of Viral Results (No Views Guarantee)
* 6. Governing Law: State of Delaware & Federal Law

### C. Checkbox di Consenso nel Checkout (`PaywallModal.tsx`)
Per ottemperare alle normative FTC / California ARL e garantire la validità della clausola arbitrale, aggiungi questa checkbox sopra il pulsante *"Subscribe to Pro"*:

```tsx
<label className="flex items-start gap-2.5 text-[11px] text-[#8e8e8e] cursor-pointer mt-3">
  <input type="checkbox" required className="mt-0.5 rounded border-[#333] bg-[#222] text-[#d1fe17] focus:ring-0" />
  <span>
    I agree to the <a href="/terms" target="_blank" className="underline text-white hover:text-[#d1fe17]">Terms of Service</a> (including the <strong className="text-white">Binding Arbitration Agreement and Class Action Waiver</strong> in Section 16) and acknowledge automatic renewal at ${billingCycle === 'yearly' ? '120/year' : '15/month'} until cancelled in Settings.
  </span>
</label>
```

---

## 📝 3. Dati da Personalizzare nel File `TERMS_OF_SERVICE.md`
Apri `TERMS_OF_SERVICE.md` (Sezione 3) e compila:
* `[Company Street Address, City, State ZIP, United States]` -> Sede o indirizzo del Registered Agent (es. Delaware LLC, o il tuo indirizzo se ditta individuale).
* `[Legal Mailing Address, Attn: Copyright Agent]` -> Indirizzo per le notifiche legali cartacee DMCA.
