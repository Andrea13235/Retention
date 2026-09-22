import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalShell } from '@/components/legal/LegalShell';

export const metadata: Metadata = {
  title: 'Termini di Servizio | RETENTIONVOLT',
  description:
    'Termini di Servizio di RETENTIONVOLT: oggetto, account, abbonamenti, rimborsi, uso consentito, proprietà intellettuale e limitazioni.',
};

const UPDATED = '20 settembre 2026';

export default function TermsPage() {
  return (
    <LegalShell
      title="Termini di Servizio"
      subtitle="Condizioni che regolano l’accesso e l’uso di RETENTIONVOLT (sito, catalogo video, tool AI Audit, API/MCP e piani Pro). Se non accetti, non usare il servizio."
      updatedAt={UPDATED}
    >
      <h2>1. Oggetto e accettazione</h2>
      <p>
        Questi Termini disciplinano l’uso di RETENTIONVOLT (il “Servizio”), inclusi sito, database video, sezioni Thumbnail/Motion,
        tool “AI Video Audit”, API e server MCP. Registrandoti, acquistando Pro o usando le API, accetti i Termini, la{' '}
        <Link href="/privacy">Privacy Policy</Link> e la <Link href="/cookies">Cookie Policy</Link>. Se agisci per conto di un’azienda,
        dichiari di avere i poteri per vincolarla.
      </p>

      <h2>2. Chi siamo</h2>
      <p>
        RETENTIONVOLT — progetto di <strong>Andrea Barretta</strong>. Contatti: <a href="mailto:support@retentionvolt.com">support@retentionvolt.com</a> ·{' '}
        <a href="mailto:privacy@retentionvolt.com">privacy@retentionvolt.com</a> · <a href="mailto:legal@retentionvolt.com">legal@retentionvolt.com</a>.<br />
        Dati completi (ragione sociale, sede, P.IVA/CF, PEC, REA) in <Link href="/legal-notice">Note Legali</Link> — da completare prima del go-live in produzione.
      </p>

      <h2>3. Account</h2>
      <ul>
        <li>Devi avere almeno 14 anni (16 dove richiesto) e fornire dati veritieri.</li>
        <li>Sei responsabile di password e sessione; notificaci accessi non autorizzati.</li>
        <li>Possiamo sospendere account che violano i Termini o la legge.</li>
        <li>Puoi cancellare l’account in qualsiasi momento da Settings → Account → Delete (cancella anche abbonamento Stripe e revoca le API key).</li>
      </ul>

      <h2>4. Cosa offre RETENTIONVOLT</h2>
      <ul>
        <li>Catalogo di reference di editing (CPM, ASL, hook, tagli) derivati da video YouTube pubblici, per finalità didattica/comparativa.</li>
        <li>Sezioni Thumbnail e Motion Graphics con ricette e snippet (Remotion/CSS).</li>
        <li>Tool “AI Video Audit” (stima su trascrizione/statistiche — non è consulenza professionale).</li>
        <li>API / MCP server per agenti AI (remoto, autenticato via API key o JWT Supabase).</li>
      </ul>
      <p className="rounded-xl bg-[#1a1a1a] border border-[#262626] px-4 py-3 text-xs">
        <strong>Non affiliazione:</strong> YouTube è un marchio di Google LLC. Le miniature/titoli appartengono ai rispettivi creator e sono mostrati
        per finalità di critica/studio (Fair Use / art. 70 L. 633/1941). Non siamo affiliati a YouTube/Google.
      </p>

      <h2>5. Piani, prezzi e pagamenti</h2>
      <ul>
        <li><strong>Free:</strong> 4 video in evidenza + anteprime limitate.</li>
        <li><strong>Pro:</strong> accesso completo, MCP, export EDL/XML, audit illimitati. Prezzi: $12/mese (monthly) o $72/anno ($6/mese, 50% OFF) con 7 giorni di trial sull’annuale.</li>
        <li>Pagamenti via <strong>Stripe</strong> (carta). Noi non vediamo il numero di carta.</li>
        <li>Rinnovo automatico fino a disdetta. Disdici in 1 click da Settings → Billing o via Stripe Customer Portal. La disdetta vale dal periodo successivo; nessun addebito ulteriore dopo la fine periodo.</li>
        <li>Fatture/ricevute disponibili in Billing. Prezzi IVA inclusa/esclusa come mostrato al checkout (Stripe gestisce IVA dove applicabile).</li>
      </ul>

      <h2>6. Diritto di recesso (consumatori UE) e trial</h2>
      <ul>
        <li>Se sei consumatore UE hai 14 giorni di recesso (artt. 52–59 Codice del Consumo, D.Lgs. 206/2005) per acquisti a distanza, <em>salvo</em> esecuzione immediata richiesta da te (es. sblocco Pro + uso del servizio): in tal caso acconsenti a perdere il recesso per la parte già fruita.</li>
        <li>Il trial annuale di 7 giorni è gratuito: se non disdici prima della scadenza, parte l’addebito annuale. Ti avvisiamo via email prima dell’addebito (Stripe <code>trial_will_end</code>).</li>
        <li>Per esercitare il recesso: <a href="mailto:support@retentionvolt.com">support@retentionvolt.com</a> con oggetto “Recesso — [email account]” entro 14 giorni.</li>
      </ul>

      <h2>7. Uso consentito e vietato</h2>
      <p><strong>Consentito:</strong> studiare i pattern, esportare EDL/XML per i tuoi progetti, usare MCP nei tuoi agenti (nei limiti del tuo piano).</p>
      <p><strong>Vietato:</strong></p>
      <ul>
        <li>Scraping massivo, dumping del DB, bypass del gating Free/Pro, reverse engineering dei modelli di scoring privati.</li>
        <li>Condividere o rivendere API key, aggirare rate limit (60 req/min Pro), usare il Servizio per addestrare modelli concorrenti senza autorizzazione.</li>
        <li>Caricare contenuti illegali, violare copyright/privacy di terzi, tentare accessi non autorizzati.</li>
        <li>Usare “AI Video Audit” per decisioni con effetti legali su terzi.</li>
      </ul>

      <h2>8. Contenuti di terzi &amp; DMCA / Notice &amp; Takedown</h2>
      <p>
        Le thumbnail/titoli sono dei rispettivi creator. Se sei titolare e ritieni violato un diritto, invia notice a{' '}
        <a href="mailto:legal@retentionvolt.com">legal@retentionvolt.com</a> con: (a) identificazione opera, (b) URL contestato su retentionvolt.com,
        (c) tuoi contatti, (d) dichiarazione di buona fede, (e) firma. Valutiamo entro 5 giorni lavorativi e rimuoviamo/oscuremo se fondato (art. 17 DSA / 17 U.S.C. §512).
      </p>

      <h2>9. Proprietà intellettuale di RETENTIONVOLT</h2>
      <p>
        Marchio, UI, testi, metriche derivate e codice sono nostri o in licenza. Ti concediamo licenza personale, non esclusiva e non trasferibile
        per usare il Servizio secondo i Termini. Le ricette Motion/Remotion sono utilizzabili nei tuoi progetti; non puoi ridistribuire il catalogo come dataset.
      </p>

      <h2>10. API / MCP</h2>
      <ul>
        <li>Richiedono piano Pro (tranne endpoint pubblici esplicitamente free).</li>
        <li>Autenticazione: <code>Authorization: Bearer &lt;rv_live_...&gt;</code> o JWT Supabase. Le key sono personali e revocabili.</li>
        <li>Rate limit e fair use applicati; violazioni → throttling/sospensione.</li>
      </ul>

      <h2>11. Garanzie e responsabilità</h2>
      <ul>
        <li>Il Servizio è fornito “as is”. Non garantiamo viralità, views o ranking YouTube: le metriche sono stime didattiche.</li>
        <li>Nei limiti di legge, la nostra responsabilità per danni diretti è limitata a quanto pagato negli ultimi 12 mesi. Nulla limita responsabilità per dolo/colpa grave o diritti inderogabili del consumatore.</li>
        <li>Manlevi RETENTIONVOLT da pretese derivanti da tuo uso illecito o violazione dei Termini.</li>
      </ul>

      <h2>12. Durata, sospensione, chiusura</h2>
      <ul>
        <li>Puoi chiudere l’account in qualsiasi momento (effetto immediato; l’abbonamento resta attivo fino a fine periodo salvo cancellazione immediata richiesta).</li>
        <li>Possiamo sospendere/chiudere per violazioni, frodi, mancati pagamenti o obblighi legali, con preavviso dove possibile.</li>
      </ul>

      <h2>13. Modifiche ai Termini</h2>
      <p>
        Possiamo aggiornarli per novità normative o di prodotto. Ti avvisiamo con 15 giorni di preavviso via email/banner per modifiche sostanziali.
        Continuare a usare il Servizio dopo l’entrata in vigore = accettazione.
      </p>

      <h2>14. Legge applicabile e foro</h2>
      <p>
        Legge italiana. Se sei consumatore UE, si applicano le tutele inderogabili del tuo Paese di residenza. Foro: quello del consumatore
        (art. 66-bis Codice del Consumo); per utenti business: foro di <em>[città — da inserire]</em>. Tentativo di conciliazione stragiudiziale
        prima del ricorso al giudice (anche via piattaforma ODR UE: <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a>).
      </p>

      <h2>15. Contatti legali</h2>
      <p>
        Supporto: <a href="mailto:support@retentionvolt.com">support@retentionvolt.com</a> · Privacy/GDPR: <a href="mailto:privacy@retentionvolt.com">privacy@retentionvolt.com</a> · Notice IP: <a href="mailto:legal@retentionvolt.com">legal@retentionvolt.com</a>.
      </p>
    </LegalShell>
  );
}
