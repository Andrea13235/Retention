"use client";

import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: (opts?: { prompt?: string }) => void };
          hasGrantedAllScopes?: (...args: any[]) => boolean;
          revoke?: (...args: any[]) => void;
        };
      };
    };
  }
}

const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const OAUTH_SCOPE = "openid email profile";

function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("no window"));
    if (window.google?.accounts?.oauth2) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SCRIPT_SRC}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("GIS load failed")), {
        once: true,
      });
      return;
    }
    const s = document.createElement("script");
    s.src = GIS_SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("GIS load failed"));
    document.head.appendChild(s);
  });
}

function clientIdConfigured(): boolean {
  const cid = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim();
  return Boolean(
    cid &&
      !cid.includes("your-google-client-id") &&
      /\.apps\.googleusercontent\.com$/.test(cid)
  );
}

/**
 * useGoogleIdentity — Google Identity Services OAuth2 token flow (popup).
 * No OAuth redirect, no redirect_uri: Google returns an access_token to the
 * page via postMessage. The caller must POST it to /api/auth/google-token
 * for server-side verify (aud check + userinfo).
 */
export function useGoogleIdentity() {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tokenClientRef = useRef<{
    requestAccessToken: (opts?: { prompt?: string }) => void;
  } | null>(null);
  const pendingRef = useRef<{
    resolve: (accessToken: string) => void;
    reject: (e: Error) => void;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!clientIdConfigured()) return;
    loadGisScript()
      .then(() => {
        if (cancelled) return;
        try {
          tokenClientRef.current = window.google!.accounts!.oauth2!.initTokenClient({
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!.trim(),
            scope: OAUTH_SCOPE,
            callback: (resp) => {
              const pending = pendingRef.current;
              pendingRef.current = null;
              setLoading(false);
              if (resp?.access_token) {
                pending?.resolve(resp.access_token);
              } else {
                setError("Accesso Google annullato. Riprova.");
                pending?.reject(new Error("GIS: " + (resp?.error || "no token")));
              }
            },
          });
          setReady(true);
        } catch (e: any) {
          setError(e?.message || "Google non disponibile. Riprova.");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Impossibile caricare Google. Controlla la connessione.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const requestAccessToken = useCallback(async (): Promise<string> => {
    setError(null);
    if (!clientIdConfigured()) {
      throw new Error("Google Client ID non configurato.");
    }
    await loadGisScript();
    if (!tokenClientRef.current) {
      tokenClientRef.current = window.google!.accounts!.oauth2!.initTokenClient({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!.trim(),
        scope: OAUTH_SCOPE,
        callback: (resp) => {
          const pending = pendingRef.current;
          pendingRef.current = null;
          setLoading(false);
          if (resp?.access_token) {
            pending?.resolve(resp.access_token);
          } else {
            setError("Accesso Google annullato. Riprova.");
            pending?.reject(new Error("GIS: " + (resp?.error || "no token")));
          }
        },
      });
      setReady(true);
    }
    return new Promise<string>((resolve, reject) => {
      try {
        pendingRef.current = { resolve, reject };
        setLoading(true);
        // prompt="" lets Google pick: account chooser if needed, consent only on first grant.
        tokenClientRef.current!.requestAccessToken({ prompt: "" });
        // Safety: if popup blocked/closed with no callback, GIS still calls back
        // with an error — but guard against a hung spinner after 60s.
        setTimeout(() => {
          if (pendingRef.current) {
            pendingRef.current = null;
            setLoading(false);
            setError("Popup Google chiuso. Riprova.");
            reject(new Error("GIS timeout"));
          }
        }, 60000);
      } catch (e: any) {
        pendingRef.current = null;
        setLoading(false);
        reject(e instanceof Error ? e : new Error("GIS token request failed"));
      }
    });
  }, []);

  return { ready, loading, error, requestAccessToken, setError };
}
