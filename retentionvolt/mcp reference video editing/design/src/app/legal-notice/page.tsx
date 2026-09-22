import type { Metadata } from 'next';
import { LegalShell } from '@/components/legal/LegalShell';

export const metadata: Metadata = {
  title: 'Note Legali | RETENTIONVOLT',
  description: 'Note legali, contatti, Dati societari, Informativa DSA e informativa consumatori di RETENTIONVOLT.',
};

const UPDATED = '20 settembre 2026';

export default function LegalNoticePage() {
  return (
    <LegalShell
      title="Note Legali & Informative Obbligatorie"
      subtitle="Dati del fornitore, contatti, informativa DSA (Reg. UE 2022/2065), informativa consumatori e trasparenza prezzi."
      updatedAt={UPDATED}
    >
      <h2>1. Dati del fornitore (art. 7 D.Lgs. 70/2003 — E-Commerce)</h2>
      <p>
        <strong>Denominazione:</strong> <em>[Ragione sociale / Nome e Cognome — da completare]</em><br />
        <strong>Forma giuridica:</strong> <em>[es. Ditta individuale / SRL]</em><br />
        <strong>Sede legale:</strong> <em>[indirizzo completo]</em><br />
        <strong>P.IVA / CF:</strong> <em>[numero]</em> · <strong>REA:</strong> <em>[numero]</em><br />
        <strong>PEC:</strong> <em>[indirizzo PEC]</em> · <strong>SDI:</strong> <em>[codice]</em><br />
        <strong>Email:</strong> <a href="mailto:support@retentionvolt.com">support@retentionvolt.com</a> · <strong>Privacy:</strong> <a href="mailto:privacy@retentionvolt.com">privacy@retentionvolt.com</a> · <strong>Legale/IP:</strong> <a href="mailto:legal@retentionvolt.com">legal@retentionvolt.com</a><br />
        <strong>Telefono:</strong> <em>[facoltativo — da inserire se disponibile]</em>
      </p>
      <p className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-xs text-amber-200">
        Azione richiesta prima del go-live: completa i campi tra [quadre] in questa pagina, in <a href="/terms">Termini</a> e in <a href="/privacy">Privacy</a>.
      </p>

      <h2>2. Hosting e infrastruttura</h2>
      <ul>
        <li><strong>Front-end:</strong> Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA.</li>
        <li><strong>Database &amp; Auth:</strong> Supabase Inc., USA/UE (Project: <code>huntczcloqxacakekzvn.supabase.co</code>).</li>
        <li><strong>Pagamenti:</strong> Stripe Inc., USA/UE.</li>
      </ul>

      <h2>3. Informativa DSA — Digital Services Act (Reg. UE 2022/2065)</h2>
      <p>RETENTIONVOLT non è un marketplace e non ospita contenuti generati dagli utenti come hosting provider su larga scala, ma in qualità di servizio online adottiamo:</p>
      <ul>
        <li>Punto di contatto DSA: <a href="mailto:legal@retentionvolt.com">legal@retentionvolt.com</a> (oggetto “DSA Notice”).</li>
        <li>Meccanismo di <strong>notice &amp; takedown</strong> per contenuti di terzi (vedi <a href="/terms">Termini §8</a>): rispondiamo entro 5 giorni lavorativi.</li>
        <li>Trasparenza su restrizioni/rimozioni: comunichiamo motivazione e rimedio.</li>
        <li>Nessun obbligo di sorveglianza generale ex art. 8 DSA; agiamo su segnalazione.</li>
      </ul>

      <h2>4. Informativa consumatori (D.Lgs. 206/2005 — Codice del Consumo)</h2>
      <ul>
        <li>Caratteristiche del servizio e prezzi sono descritti in <a href="/pricing">Pricing</a> e al checkout Stripe prima del pagamento.</li>
        <li>Diritto di recesso 14 giorni per consumatori UE, con eccezione per esecuzione immediata richiesta (vedi <a href="/terms">Termini §6</a>).</li>
        <li>Assistenza post-vendita: <a href="mailto:support@retentionvolt.com">support@retentionvolt.com</a> (risposta entro 2 giorni lavorativi).</li>
        <li>Garanzia legale di conformità: ove applicabile ai contenuti digitali, segnala difetti a support@retentionvolt.com per rimedio/rimborso.</li>
      </ul>

      <h2>5. Trasparenza prezzi &amp; fatturazione</h2>
      <ul>
        <li>Prezzi mostrati al checkout Stripe sono finali (IVA gestita da Stripe dove applicabile).</li>
        <li>Fatture/ricevute: disponibili in Settings → Billing e via Stripe Customer Portal.</li>
        <li>Nessun costo nascosto; rinnovo automatico disattivabile in 1 click.</li>
      </ul>

      <h2>6. Proprietà intellettuale &amp; marchi</h2>
      <p>
        “RETENTIONVOLT” e loghi sono segni distintivi del Titolare. YouTube e marchi citati appartengono ai rispettivi titolari
        (Google LLC ecc.) e sono citati per finalità descrittiva/comparativa.
      </p>

      <h2>7. Accessibilità</h2>
      <p>
        Ci impegniamo a rispettare le WCAG 2.1 AA per i contenuti essenziali. Segnalazioni su barriere: <a href="mailto:support@retentionvolt.com">support@retentionvolt.com</a>.
      </p>

      <h2>8. Risoluzione controversie</h2>
      <p>
        Piattaforma ODR UE: <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a>.
        Foro e legge applicabile: vedi <a href="/terms">Termini §14</a>.
      </p>
    </LegalShell>
  );
}
