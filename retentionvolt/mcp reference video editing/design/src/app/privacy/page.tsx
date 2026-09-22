import type { Metadata } from 'next';
import { LegalShell } from '@/components/legal/LegalShell';

export const metadata: Metadata = {
  title: 'Privacy Policy | RETENTIONVOLT',
  description:
    'Informativa privacy GDPR di RETENTIONVOLT: dati raccolti, basi giuridiche, responsabili, conservazione e diritti (artt. 13-14, 15-22 GDPR).',
};

const UPDATED = '20 settembre 2026';

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      subtitle="Informativa sul trattamento dei dati personali ai sensi degli artt. 13–14 GDPR (Reg. UE 2016/679) e del D.Lgs. 196/2003 come modificato dal D.Lgs. 101/2018."
      updatedAt={UPDATED}
    >
      <p className="text-[11px] tracking-widest font-bold text-[#d1fe17]">INFORMATIVA GDPR — ART. 13/14</p>

      <h2>1. Titolare del trattamento</h2>
      <p>
        <strong>Titolare:</strong> Andrea Barretta — progetto RETENTIONVOLT.<br />
        <strong>Contatti privacy:</strong> <a href="mailto:privacy@retentionvolt.com">privacy@retentionvolt.com</a> · <a href="mailto:support@retentionvolt.com">support@retentionvolt.com</a><br />
        <strong>Sede / P.IVA / PEC:</strong> <em>[inserisci ragione sociale, indirizzo, P.IVA/CF e PEC prima della pubblicazione in produzione]</em>.<br />
        Per richieste privacy puoi anche usare il form in <a href="/#support">Supporto</a> (categoria “Privacy/GDPR”).
      </p>
      <p>
        RETENTIONVOLT è un servizio di <em>reference intelligence</em> per il video editing: indicizziamo metriche pubbliche
        (es. tagli, CPM/ASL, thumbnail) di video YouTube per finalità didattiche e di analisi comparativa. Non sostituiamo
        la visione dei video originali.
      </p>

      <h2>2. Categorie di dati che trattiamo — inventario completo</h2>
      <p>Trattiamo <strong>solo</strong> i dati strettamente necessari al servizio. Niente tracking pubblicitario, niente rivendita di dati.</p>

      <div className="not-prose overflow-x-auto rounded-2xl border border-[#262626] bg-[#0e0e0e]">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#171717] text-[#a3a3a3]">
            <tr>
              <th className="px-4 py-3 font-semibold">Categoria</th>
              <th className="px-4 py-3 font-semibold">Dati</th>
              <th className="px-4 py-3 font-semibold">Fonte</th>
              <th className="px-4 py-3 font-semibold">Obbligatorio?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222] text-[#a3a3a3]">
            <tr>
              <td className="px-4 py-3 font-semibold text-white">Account &amp; autenticazione</td>
              <td className="px-4 py-3">email, nome/display name, avatar (se Google), password hashata (mai in chiaro), user ID, data creazione, stato onboarding</td>
              <td className="px-4 py-3">Tu (form signup/login, Google OAuth) + Supabase Auth</td>
              <td className="px-4 py-3">Sì per creare l’account</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-semibold text-white">Profilo &amp; preferenze</td>
              <td className="px-4 py-3">ruolo (es. “Video Editor”), use case (Work/Personal/Education), “come ci hai conosciuto”, lingua/filtri salvati, flag onboarding</td>
              <td className="px-4 py-3">Tu (onboarding, settings)</td>
              <td className="px-4 py-3">Facoltativo (migliora l’esperienza)</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-semibold text-white">Pagamenti (Stripe)</td>
              <td className="px-4 py-3">email, ID cliente Stripe, stato abbonamento (free/pro, trial, past_due), periodo fatturazione, fatture/ID transazione. <strong>Non vediamo mai il numero di carta</strong></td>
              <td className="px-4 py-3">Stripe (checkout, portal, webhook)</td>
              <td className="px-4 py-3">Solo se acquisti Pro</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-semibold text-white">Supporto</td>
              <td className="px-4 py-3">email di contatto, oggetto, categoria, messaggio, user ID se loggato</td>
              <td className="px-4 py-3">Tu (form Supporto)</td>
              <td className="px-4 py-3">Sì per rispondere al ticket</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-semibold text-white">Uso prodotto &amp; sicurezza</td>
              <td className="px-4 py-3">IP (troncato nei log applicativi dove possibile), user-agent, endpoint chiamato, timestamp, esito rate-limit, conteggio audit free</td>
              <td className="px-4 py-3">Log applicativi / rate limiter</td>
              <td className="px-4 py-3">Automatico (legittimo interesse sicurezza)</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-semibold text-white">Visite sito (analytics first-party)</td>
              <td className="px-4 py-3">hash giornaliero anonimo del visitatore (SHA-256 di id casuale + giorno — non reversibile, non collegabile tra giorni), pagina visitata, giorno. MAI IP in chiaro, mai email, mai profilazione</td>
              <td className="px-4 py-3">Beacon interno del sito (solo con consenso “Analitici” attivo)</td>
              <td className="px-4 py-3">Facoltativo (il sito funziona anche senza)</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-semibold text-white">MCP / API</td>
              <td className="px-4 py-3">hash SHA-256 della API key (mai in chiaro), prefisso chiave, nome chiave, ultimo uso, tool invocato, IP</td>
              <td className="px-4 py-3">Tu (creazione chiave) + log chiamate</td>
              <td className="px-4 py-3">Solo se usi il server MCP</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-semibold text-white">Contenuti YouTube indicizzati</td>
              <td className="px-4 py-3">thumbnail, titolo, metadati pubblici (views, durata), metriche derivate (CPM/ASL) — <em>non</em> sono tuoi dati personali</td>
              <td className="px-4 py-3">YouTube Data / fonti pubbliche</td>
              <td className="px-4 py-3">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-[#666] mt-2">
        Non raccogliamo categorie particolari ex art. 9 GDPR (salute, opinioni politiche, ecc.), non facciamo profilazione
        pubblicitaria e non vendiamo dati a terzi.
      </p>

      <h2>3. Finalità e basi giuridiche (art. 6 GDPR)</h2>
      <div className="not-prose overflow-x-auto rounded-2xl border border-[#262626] bg-[#0e0e0e]">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#171717] text-[#a3a3a3]">
            <tr>
              <th className="px-4 py-3 font-semibold">Finalità</th>
              <th className="px-4 py-3 font-semibold">Base giuridica</th>
              <th className="px-4 py-3 font-semibold">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222] text-[#a3a3a3]">
            <tr>
              <td className="px-4 py-3 text-white">Creare e gestire l’account, autenticarti, recuperare la sessione</td>
              <td className="px-4 py-3">Esecuzione contratto (art. 6.1.b)</td>
              <td className="px-4 py-3">Senza questi dati non puoi registrarti</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-white">Erogare il servizio (catalogo, audit, esportazioni EDL/XML, MCP)</td>
              <td className="px-4 py-3">Esecuzione contratto</td>
              <td className="px-4 py-3">Incluso gating Pro/Free</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-white">Pagamenti, fatturazione, anti-frode, gestione abbonamento</td>
              <td className="px-4 py-3">Esecuzione contratto + obbligo legale (art. 6.1.c) per fattura</td>
              <td className="px-4 py-3">Stripe è responsabile autonomo per i dati carta</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-white">Assistenza (ticket)</td>
              <td className="px-4 py-3">Esecuzione contratto / misure precontrattuali + legittimo interesse a rispondere</td>
              <td className="px-4 py-3">Rispondiamo all’email che ci fornisci</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-white">Sicurezza, prevenzione abusi, rate limiting, log</td>
              <td className="px-4 py-3">Legittimo interesse (art. 6.1.f) — bilanciamento: IP troncato, retention breve</td>
              <td className="px-4 py-3">Puoi opporti ex art. 21 se prevalgono i tuoi interessi</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-white">Comunicazioni di servizio (es. scadenza trial, problemi pagamento)</td>
              <td className="px-4 py-3">Esecuzione contratto / legittimo interesse</td>
              <td className="px-4 py-3">Non sono newsletter marketing</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-white">Analitiche aggregate &amp; marketing</td>
              <td className="px-4 py-3">Consenso (art. 6.1.a) — <strong>oggi non attivi</strong></td>
              <td className="px-4 py-3">Vedi <a href="/cookies">Cookie Policy</a></td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>4. Cookie e tecnologie simili</h2>
      <p>
        Usiamo solo cookie/ storage <strong>necessari</strong> per far funzionare il sito (Supabase Auth, Stripe, consenso cookie)
        e — solo con tuo consenso — storage per preferenze. Nessun pixel pubblicitario attivo.
        Dettagli, durata e come revocare: <a href="/cookies">Cookie Policy</a>.
        Puoi rivedere le scelte in qualsiasi momento dal banner o dal link “Impostazioni cookie” nel footer.
      </p>

      <h2>5. Destinatari e responsabili (art. 28 GDPR)</h2>
      <ul>
        <li><strong>Supabase Inc.</strong> (USA/UE) — hosting database &amp; autenticazione. DPA con SCC UE.</li>
        <li><strong>Stripe Inc.</strong> (USA/UE) — pagamenti. Stripe è titolare autonomo per i dati carta.</li>
        <li><strong>Vercel Inc.</strong> (USA/UE) — hosting front-end.</li>
        <li><strong>Google LLC</strong> — solo se usi “Continua con Google” (OAuth). Dati: email, nome, avatar.</li>
        <li><strong>ElevenLabs</strong> — solo per trascrizione audio se usi ingestione video con STT (facoltativo).</li>
        <li>Fornitori di immagini: <code>i.ytimg.com / img.youtube.com / images.unsplash.com</code> per thumbnail (caricamento immagine = IP visibile al CDN).</li>
      </ul>
      <p>Non trasferiamo dati a terzi per marketing. L’elenco aggiornato dei responsabili è disponibile su richiesta a privacy@retentionvolt.com.</p>

      <h2>6. Trasferimenti extra-UE (artt. 44–49)</h2>
      <p>
        Alcuni fornitori trattano dati negli USA. Il trasferimento avviene con garanzie adeguate: <strong>Standard Contractual
        Clauses (SCC) UE</strong> + misure supplementari, e — dove applicabile — <strong>EU-US Data Privacy Framework</strong>
        (Stripe, Google). Puoi chiederne copia a privacy@retentionvolt.com.
      </p>

      <h2>7. Conservazione (storage limitation)</h2>
      <ul>
        <li>Account: fino a cancellazione + 30 giorni di grace tecnica nei backup.</li>
        <li>Fatture/abbonamenti: 10 anni (obbligo fiscale italiano, art. 2220 c.c.).</li>
        <li>Ticket supporto: 24 mesi dall’ultimo messaggio, poi anonimizzati.</li>
        <li>Log sicurezza/IP &amp; log MCP: 12 mesi, poi aggregati/anonimizzati (salvo contenzioso).</li>
        <li>Visite sito (hash anonimi giornalieri): 12 mesi, poi aggregati in conteggi mensili.</li>
        <li>Consenso cookie: 12 mesi (rinnovo su nuova scelta).</li>
        <li>API key revocate: hash conservato 12 mesi per audit sicurezza, poi eliminato.</li>
      </ul>

      <h2>8. I tuoi diritti (artt. 15–22 GDPR)</h2>
      <p>Puoi esercitare in qualsiasi momento:</p>
      <ul>
        <li><strong>Accesso</strong> (art. 15), <strong>rettifica</strong> (16), <strong>cancellazione</strong> (17) — “diritto all’oblio”,</li>
        <li><strong>limitazione</strong> (18), <strong>portabilità</strong> (20) — esportiamo i tuoi dati in JSON,</li>
        <li><strong>opposizione</strong> (21) per trattamenti su legittimo interesse,</li>
        <li><strong>revoca del consenso</strong> (art. 7) — in un click da “Impostazioni cookie” o scrivendo a privacy@retentionvolt.com (la revoca non retroagisce),</li>
        <li>diritto di <strong>non essere soggetto a decisioni automatizzate</strong> (art. 22) — non prendiamo decisioni automatizzate con effetti giuridici.</li>
      </ul>
      <p>
        Per esercitarli: email a <a href="mailto:privacy@retentionvolt.com">privacy@retentionvolt.com</a> con oggetto “Richiesta GDPR — [diritto]”.
        Rispondiamo entro <strong>30 giorni</strong> (prorogabili di 60 in casi complessi). Verifica identità via email dell’account.
      </p>
      <p className="rounded-xl bg-[#1a1a1a] border border-[#262626] px-4 py-3 text-xs">
        <strong>Self-service già disponibile:</strong> puoi modificare nome/email in <em>Settings → Account</em>, cambiare password,
        revocare API key, cancellare l’account (Settings → Account → Delete — cancella anche abbonamento Stripe).
        Esportazione completa su richiesta via email.
      </p>

      <h2>9. Reclamo all’autorità</h2>
      <p>
        Se ritieni violati i tuoi diritti, puoi reclamare al <strong>Garante per la protezione dei dati personali</strong>{' '}
        (<a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer">garanteprivacy.it</a>) o all’autorità
        del tuo Stato UE di residenza, impregiudicato il ricorso giurisdizionale.
      </p>

      <h2>10. Sicurezza (art. 32 GDPR)</h2>
      <ul>
        <li>Password mai in chiaro (hash Supabase), API key salvate solo come hash SHA-256.</li>
        <li>Comunicazioni in HTTPS, header di sicurezza (CSP, X-Frame-Options, HSTS su Vercel).</li>
        <li>Accesso ai dati con principio di minimo privilegio e log degli accessi.</li>
        <li>Backup cifrati e retention limitata.</li>
      </ul>
      <p>
        In caso di data breach con rischio per i tuoi diritti, notifichiamo il Garante entro 72h (art. 33) e — se rischio elevato —
        anche te (art. 34).
      </p>

      <h2>11. Minori</h2>
      <p>
        Il servizio è destinato a professionisti/maggiorenni. Non raccogliamo consapevolmente dati di minori di 14 anni.
        Se sei genitore/tutore e ritieni che un minore ci abbia fornito dati, scrivi a privacy@retentionvolt.com per la cancellazione immediata.
      </p>

      <h2>12. Processi decisionali automatizzati</h2>
      <p>
        Non utilizziamo profilazione con effetti giuridici né decisioni interamente automatizzate ex art. 22 GDPR.
        I punteggi (es. Retention Score) sono indicatori didattici non vincolanti.
      </p>

      <h2>13. Modifiche a questa informativa</h2>
      <p>
        Potremmo aggiornarla per novità normative o di prodotto. La versione vigente è sempre a questa URL con data di
        aggiornamento in alto. Modifiche sostanziali ti verranno notificate via email o banner in app con 15 giorni di preavviso.
      </p>

      <div className="not-prose mt-6 rounded-2xl border border-[#262626] bg-[#0e0e0e] p-4 text-xs leading-relaxed text-[#a3a3a3]">
        <p className="font-bold text-white">Riepilogo operativo per te</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>Vuoi vedere/cancellare/esportare i tuoi dati? → <a href="mailto:privacy@retentionvolt.com">privacy@retentionvolt.com</a> o Settings → Account.</li>
          <li>Vuoi revocare cookie non essenziali? → Footer → “Impostazioni cookie” (effetto immediato).</li>
          <li>Vuoi opporti ai log di sicurezza? → scrivici motivando ex art. 21.</li>
          <li>Usi Google OAuth? Puoi scollegarlo da Google Account e continuare con email/password.</li>
        </ul>
      </div>
    </LegalShell>
  );
}
