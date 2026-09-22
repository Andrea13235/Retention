'use client';

/**
 * RETENTIONVOLT — Consent Management (GDPR / ePrivacy / DSA)
 *
 * Unico source of truth per:
 *  - consenso granulare (necessary / preferences / analytics / marketing)
 *  - persistenza in cookie + localStorage
 *  - eventi per sincronizzare banner / pagine legali / script condizionali
 *
 * Principi:
 *  - "necessary" sempre ON e non disattivabile
 *  - nessun cookie non-essenziale scritto prima del consenso
 *  - revoca semplice quanto il consenso (1 click)
 */

export type ConsentCategory = 'necessary' | 'preferences' | 'analytics' | 'marketing';

export type ConsentState = Record<ConsentCategory, boolean>;

export interface StoredConsent {
  v: 1;
  state: ConsentState;
  updatedAt: string; // ISO
  consentId: string;  // random id per tracciabilità revoca
}

export const CONSENT_COOKIE_NAME = 'rv_consent';
export const CONSENT_LS_KEY = 'rv_consent_v1';
export const CONSENT_EVENT = 'rv:consent-updated';
/** 12 mesi come da linee guida Garante / EDPB */
export const CONSENT_TTL_DAYS = 365;
export const CONSENT_TTL_SECONDS = CONSENT_TTL_DAYS * 24 * 60 * 60;

export const DEFAULT_CONSENT: ConsentState = {
  necessary: true,
  preferences: false,
  analytics: false,
  marketing: false,
};

export const ALL_ACCEPTED: ConsentState = {
  necessary: true,
  preferences: true,
  analytics: true,
  marketing: true,
};

export const ONLY_NECESSARY: ConsentState = {
  necessary: true,
  preferences: false,
  analytics: false,
  marketing: false,
};

function genId(): string {
  try {
    const a = new Uint8Array(16);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function writeCookie(name: string, value: string, maxAgeSec: number): void {
  if (typeof document === 'undefined') return;
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  // SameSite=Lax — necessario per login Stripe/Supabase cookie su stesso sito
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${secure}`;
}

function normalizeState(s: Partial<ConsentState> | null | undefined): ConsentState {
  return {
    necessary: true,
    preferences: Boolean(s?.preferences),
    analytics: Boolean(s?.analytics),
    marketing: Boolean(s?.marketing),
  };
}

function isConsentExpired(updatedAt: string | undefined): boolean {
  if (!updatedAt) return true;
  const t = new Date(updatedAt).getTime();
  if (isNaN(t)) return true;
  return Date.now() - t > CONSENT_TTL_SECONDS * 1000;
}

export function hasStoredConsent(): boolean {
  if (typeof window === 'undefined') return false;
  const fromLs = safeJsonParse<StoredConsent>(localStorage.getItem(CONSENT_LS_KEY));
  if (fromLs?.state && !isConsentExpired(fromLs.updatedAt)) return true;
  const fromCookie = safeJsonParse<StoredConsent>(readCookie(CONSENT_COOKIE_NAME) || '');
  return Boolean(fromCookie?.state && !isConsentExpired(fromCookie.updatedAt));
}

export function loadConsent(): StoredConsent | null {
  if (typeof window === 'undefined') return null;
  const fromLs = safeJsonParse<StoredConsent>(localStorage.getItem(CONSENT_LS_KEY));
  if (fromLs?.state && !isConsentExpired(fromLs.updatedAt)) {
    // riallinea cookie se mancante
    const ck = readCookie(CONSENT_COOKIE_NAME);
    if (!ck) writeCookie(CONSENT_COOKIE_NAME, JSON.stringify(fromLs), CONSENT_TTL_SECONDS);
    return { ...fromLs, state: normalizeState(fromLs.state) };
  }
  const rawCk = readCookie(CONSENT_COOKIE_NAME);
  const fromCk = safeJsonParse<StoredConsent>(rawCk || '');
  if (fromCk?.state && !isConsentExpired(fromCk.updatedAt)) {
    // riallinea localStorage se mancante
    try {
      localStorage.setItem(CONSENT_LS_KEY, JSON.stringify({ ...fromCk, state: normalizeState(fromCk.state) }));
    } catch {}
    return { ...fromCk, state: normalizeState(fromCk.state) };
  }
  return null;
}

export function saveConsent(state: ConsentState): StoredConsent {
  const normalized = normalizeState(state);
  const stored: StoredConsent = {
    v: 1,
    state: normalized,
    updatedAt: new Date().toISOString(),
    consentId: genId(),
  };
  const json = JSON.stringify(stored);
  try {
    localStorage.setItem(CONSENT_LS_KEY, json);
  } catch {}
  writeCookie(CONSENT_COOKIE_NAME, json, CONSENT_TTL_SECONDS);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: stored }));
    // Per test e2e / debug: window.__RV_CONSENT__
    (window as unknown as Record<string, unknown>).__RV_CONSENT__ = stored;
  }
  return stored;
}

export function clearNonEssentialStorage(prev: ConsentState, next: ConsentState): void {
  if (typeof window === 'undefined') return;
  // Se l'utente revoca analytics/marketing, facciamo best-effort per pulire
  // eventuali chiavi di terze parti (nessuna è usata oggi, ma il meccanismo resta per il futuro).
  if (prev.analytics && !next.analytics) {
    // placeholder: rimuovi cookie analytics se in futuro aggiungi GA4 / Mixpanel ecc.
  }
  if (prev.marketing && !next.marketing) {
    // placeholder: rimuovi cookie marketing
  }
  if (prev.preferences && !next.preferences) {
    // preferences = filtri salvati, onboarding flags: NON cancelliamo dati essenziali utente,
    // ma rispettiamo la scelta non ri-salvando preferenze future.
  }
}

export function consentLabel(cat: ConsentCategory): string {
  switch (cat) {
    case 'necessary':
      return 'Necessari';
    case 'preferences':
      return 'Preferenze';
    case 'analytics':
      return 'Analitici';
    case 'marketing':
      return 'Marketing';
    default:
      return cat;
  }
}

/** Verifica se una categoria è consentita (usa loadConsent o default negato). */
export function isAllowed(cat: ConsentCategory): boolean {
  const stored = loadConsent();
  if (!stored) return cat === 'necessary';
  return Boolean(stored.state[cat]);
}
