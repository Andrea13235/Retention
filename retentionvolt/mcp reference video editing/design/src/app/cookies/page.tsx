import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalShell } from '@/components/legal/LegalShell';
import { OpenCookiePrefsButton } from '@/components/legal/OpenCookiePrefsButton';

export const metadata: Metadata = {
  title: 'Cookie Policy | RETENTIONVOLT',
  description:
    'Cookie Policy di RETENTIONVOLT: quali cookie usiamo, durata, finalità, base giuridica e come gestire/revocare il consenso (GDPR + ePrivacy).',
};

const UPDATED = '20 settembre 2026';

export default function CookiesPage() {
  return (
    <LegalShell
      title="Cookie Policy"
      subtitle="Informativa sull’uso di cookie e tecnologie simili ai sensi della Direttiva ePrivacy 2002/58/CE, del Provvedimento Garante 10 giugno 2021 e degli artt. 13 GDPR e 122 Codice Privacy."
      updatedAt={UPDATED}
    >
      <p className="text-[11px] tracking-widest font-bold text-[#d1fe17]">COOKIE POLICY — EPD + GDPR</p>

      <h2>1. Cosa sono</h2>
      <p>
        Cookie = piccoli file di testo salvati sul tuo dispositivo. Tecnologie simili: <code>localStorage</code>,{' '}
        <code>sessionStorage</code>, cookie <code>SameSite</code> di autenticazione. Alcuni sono <strong>necessari</strong> (il sito non
        funziona senza), altri richiedono il tuo <strong>consenso preventivo</strong> (art. 122 Codice Privacy + Linee Guida Garante 2021).
      </p>

      <h2>2. Come gestiamo il consenso</h2>
      <ul>
        <li>All’arrivo vedrai un banner con 3 scelte: <strong>Accetta tutti</strong>, <strong>Rifiuta non essenziali</strong>, <strong>Personalizza</strong>.</li>
        <li>Nessun cookie non-essenziale viene impostato <strong>prima</strong> del consenso.</li>
        <li>Puoi cambiare idea in qualsiasi momento: footer → <strong>Impostazioni cookie</strong> o cancella il cookie <code>rv_consent</code>.</li>
        <li>Il consenso dura <strong>12 mesi</strong>, poi ti richiederemo una nuova scelta.</li>
        <li>Registriamo prova del consenso (ID anonimo + timestamp) per dimostrare la conformità.</li>
      </ul>

      <h2>3. Tabella cookie — inventario reale del sito</h2>
      <p className="text-xs text-[#8e8e8e]">
        Stato attuale (settembre 2026): <strong>nessun tracker pubblicitario o analitico di terze parti attivo</strong>
        (niente GA4, niente pixel). L’unica misura analitica è il nostro <strong>conteggio visite first-party</strong>
        (riga “rb_vid” sotto): parte solo se attivi la categoria “Analitici”, conta una visita al giorno per visitatore,
        non salva IP in chiaro e non profila. Le righe “Marketing” sono OFF di default e restano disattivate
        finché non introdurremo un fornitore.
      </p>

      <div className="not-prose overflow-x-auto rounded-2xl border border-[#262626] bg-[#0e0e0e]">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#171717] text-[#a3a3a3]">
            <tr>
              <th className="px-4 py-3 font-semibold">Nome</th>
              <th className="px-4 py-3 font-semibold">Tipo / Categoria</th>
              <th className="px-4 py-3 font-semibold">Finalità</th>
              <th className="px-4 py-3 font-semibold">Durata</th>
              <th className="px-4 py-3 font-semibold">Base</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222] text-[#a3a3a3]">
            <tr>
              <td className="px-4 py-3 font-mono text-white">rv_consent</td>
              <td className="px-4 py-3">Cookie tecnico — Necessari</td>
              <td className="px-4 py-3">Memorizza le tue scelte cookie (ID + timestamp)</td>
              <td className="px-4 py-3">12 mesi</td>
              <td className="px-4 py-3">Necessario (art. 122 co.2)</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-white">sb-*-auth-token*</td>
              <td className="px-4 py-3">Cookie tecnico — Necessari</td>
              <td className="px-4 py-3">Sessione autenticata Supabase (JWT httpOnly dove previsto)</td>
              <td className="px-4 py-3">Sessione / fino a logout</td>
              <td className="px-4 py-3">Necessario</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-white">__stripe_*, stripe.csrf</td>
              <td className="px-4 py-3">Cookie tecnico — Necessari</td>
              <td className="px-4 py-3">Checkout/Portal Stripe, anti-frode, completamento pagamento</td>
              <td className="px-4 py-3">Sessione / 12 mesi (fraud)</td>
              <td className="px-4 py-3">Necessario</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-white">retentionvolt_user_profile_v1, retentionvolt_onboarding_*</td>
              <td className="px-4 py-3">localStorage — Preferenze</td>
              <td className="px-4 py-3">Persistenza profilo locale, onboarding, filtri UI</td>
              <td className="px-4 py-3">Persistente fino a cancellazione</td>
              <td className="px-4 py-3">Consenso “Preferenze”</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-white">retentionvolt_free_audits_count</td>
              <td className="px-4 py-3">localStorage — Necessari*</td>
              <td className="px-4 py-3">Conteggio audit free per fair-use (anti-abuso)</td>
              <td className="px-4 py-3">Persistente</td>
              <td className="px-4 py-3">Legittimo interesse (sicurezza)</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-white">Vercel / CDN</td>
              <td className="px-4 py-3">Cookie tecnico — Necessari</td>
              <td className="px-4 py-3">Bilanciamento carico, sicurezza edge</td>
              <td className="px-4 py-3">Sessione</td>
              <td className="px-4 py-3">Necessario</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-white">rb_vid (localStorage)</td>
              <td className="px-4 py-3">Analytics first-party</td>
              <td className="px-4 py-3">Conteggio visite: id anonimo casuale, 1 visita/giorno. Il server salva solo hash giornaliero (no IP in chiaro, no profilazione)</td>
              <td className="px-4 py-3">Persistente fino a cancellazione</td>
              <td className="px-4 py-3">Consenso “Analitici”</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-white">_ga / _gid (GA4) — NON ATTIVO</td>
              <td className="px-4 py-3">Analytics</td>
              <td className="px-4 py-3">Statistiche aggregate (solo se lo attiveremo + consenso)</td>
              <td className="px-4 py-3">—</td>
              <td className="px-4 py-3">Consenso</td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-mono text-white">Pixel Meta/Google — NON ATTIVO</td>
              <td className="px-4 py-3">Marketing</td>
              <td className="px-4 py-3">Remarketing (solo se lo attiveremo + consenso)</td>
              <td className="px-4 py-3">—</td>
              <td className="px-4 py-3">Consenso</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-[#666]">* Il conteggio audit è trattato come necessario per prevenire abusi del piano Free; puoi cancellarlo svuotando i dati sito.</p>

      <h2>4. Cookie di terze parti (quando carichi contenuti esterni)</h2>
      <p>
        Alcune immagini/thumbnail sono servite da <code>i.ytimg.com</code>, <code>img.youtube.com</code>,{' '}
        <code>images.unsplash.com</code>, <code>avatars.githubusercontent.com</code>. Caricare l’immagine espone il tuo IP al CDN
        (necessario per mostrare l’anteprima). Non impostiamo noi cookie di quei domini; loro possono applicare le proprie policy.
      </p>

      <h2>5. Come disattivare / revocare</h2>
      <ul>
        <li><strong>Dal sito:</strong> footer → “Impostazioni cookie” → disattiva Analytics/Marketing/Preferenze → “Salva preferenze”.</li>
        <li><strong>Dal browser:</strong> impostazioni → Privacy → Cancella cookie/dati sito per retentionvolt.com. Su mobile: Impostazioni → Safari/Chrome → Cancella dati.</li>
        <li><strong>Do Not Track:</strong> rispettiamo il segnale dove tecnicamente rilevabile, ma la revoca granulare resta il meccanismo primario.</li>
      </ul>
      <p>
        Revocare il consenso non pregiudica la liceità del trattamento precedente (art. 7.3 GDPR).
      </p>

      <h2>6. Se in futuro attiveremo Analytics/Marketing</h2>
      <p>
        Aggiorneremo questa tabella, ti chiederemo un nuovo consenso e — per Analytics — useremo IP anonimizzato,
        retention breve e opt-out immediato. Nessun dato sarà venduto a terzi.
      </p>

      <h2>7. Contatti</h2>
      <p>
        Domande sui cookie: <a href="mailto:privacy@retentionvolt.com">privacy@retentionvolt.com</a>. Reclami: Garante Privacy —{' '}
        <a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer">garanteprivacy.it</a>.
      </p>

      <div className="not-prose mt-4 flex flex-wrap gap-2">
        <Link href="/privacy" className="text-xs underline decoration-white/30 underline-offset-4 hover:text-white hover:decoration-white">
          Vai alla Privacy Policy
        </Link>
        <span className="text-[#333]">·</span>
        <OpenCookiePrefsButton className="text-xs underline decoration-white/30 underline-offset-4 hover:text-white hover:decoration-white">
          Gestisci preferenze cookie
        </OpenCookiePrefsButton>
      </div>
    </LegalShell>
  );
}
