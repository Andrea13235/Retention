'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  CONSENT_EVENT,
  CONSENT_LS_KEY,
  isAllowed,
} from '@/lib/consent';

/**
 * VisitBeacon — contatore visite first-party (privacy-first).
 *
 * Come funziona il tracciamento (un concetto = un nome solo):
 *  - "visita sito" = UNA chiamata /api/track/visit per visitatore per giorno.
 *  - Il beacon parte SOLO se l'utente ha attivato la categoria Analytics
 *    nel banner cookie (isAllowed('analytics')). Se rifiuta o non ha scelto:
 *    zero chiamate, zero cookie di tracking, il sito funziona uguale.
 *  - Identità anonima: id casuale in localStorage (rb_vid, 32 hex), MAI
 *    collegato a login/email. Il server salva solo sha256(vid + giorno):
 *    non reversibile, non collegabile tra giorni.
 *  - Revoca: disattivare Analytics ferma subito i beacon futuri. Per
 *    cancellare l'id locale: footer → Impostazioni cookie → il browser
 *    cancella rb_vid con i dati sito (documentato in /cookies).
 */

const VID_LS_KEY = 'rb_vid';

function getOrCreateVid(): string {
  try {
    const existing = localStorage.getItem(VID_LS_KEY);
    if (existing && /^[0-9a-f]{32}$/i.test(existing)) return existing;
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const vid = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(VID_LS_KEY, vid);
    return vid;
  } catch {
    return '';
  }
}

export function VisitBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    const track = () => {
      // Doppio check: localStorage diretto + isAllowed (copre revoca live).
      let analyticsOn = false;
      try {
        const raw = localStorage.getItem(CONSENT_LS_KEY);
        if (raw) analyticsOn = Boolean(JSON.parse(raw)?.state?.analytics);
      } catch {
        analyticsOn = false;
      }
      if (!analyticsOn && !isAllowed('analytics')) return;

      const vid = getOrCreateVid();
      if (!vid) return;

      const payload = JSON.stringify({
        vid,
        path: (pathname || '/').slice(0, 200),
      });
      // sendBeacon: non blocca la navigazione, best-effort.
      try {
        if (navigator.sendBeacon) {
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon('/api/track/visit', blob);
        } else {
          fetch('/api/track/visit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        // best-effort: mai rompere la pagina per il tracking
      }
    };

    track(); // prima visita / cambio pagina
    // Re-invio se l'utente attiva Analytics DOPO aver caricato la pagina.
    window.addEventListener(CONSENT_EVENT, track as EventListener);
    return () => window.removeEventListener(CONSENT_EVENT, track as EventListener);
  }, [pathname]);

  return null;
}
