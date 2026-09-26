"use client";
import React, { useCallback, useEffect, useState } from "react";
import { Check, KeyRound, Loader2, Trash2, FlaskConical } from "lucide-react";

/**
 * Settings → API Keys section.
 *
 * - Shows 5 providers with configured/not-configured badge + source
 *   (vault / .env.local). NEVER displays secret values.
 * - Paste a key → POST /api/vault/keys (AES-256-GCM at rest, gitignored).
 * - Test → POST /api/vault/test (server-side auth probe, no value echoed).
 * - Delete → removes the vault copy (env fallback, if any, stays).
 */

const PROVIDER_META: Array<{ id: string; label: string; hint: string }> = [
  { id: "anthropic", label: "Claude (Anthropic)", hint: "Direzione editoriale, hook, pacing" },
  { id: "elevenlabs", label: "ElevenLabs (voiceover)", hint: "Voiceover hook + dubbing AI" },
  { id: "higgsfield", label: "Higgsfield (cover 4K)", hint: "Cover ad-hoc SOUL text-to-image" },
  { id: "modal", label: "Modal GPU (token)", hint: "Render serverless NVENC T4/L4" },
  { id: "meta_muse", label: "Meta Muse Voice (STT)", hint: "Trascrizione word-level" },
];

type StatusMap = Record<string, { configured: boolean; source: "vault" | "env" | null }>;

export function ApiKeysSettings() {
  const [status, setStatus] = useState<StatusMap | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [testResult, setTestResult] = useState<Record<string, string>>({});
  const [savedTick, setSavedTick] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/vault/status");
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data.providers as StatusMap);
    } catch {
      // offline → keep previous state
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setRowBusy = (id: string, v: boolean) =>
    setBusy((prev) => ({ ...prev, [id]: v }));

  const handleSave = async (id: string) => {
    const apiKey = (drafts[id] || "").trim();
    if (apiKey.length < 8) {
      setTestResult((prev) => ({ ...prev, [id]: "Chiave troppo corta (min 8 caratteri)." }));
      return;
    }
    setRowBusy(id, true);
    try {
      const res = await fetch("/api/vault/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: id, apiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Salvataggio fallito");
      setStatus(data.providers as StatusMap);
      setDrafts((prev) => ({ ...prev, [id]: "" }));
      setTestResult((prev) => ({ ...prev, [id]: "" }));
      setSavedTick(id);
      setTimeout(() => setSavedTick((cur) => (cur === id ? null : cur)), 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Salvataggio fallito";
      setTestResult((prev) => ({ ...prev, [id]: message }));
    } finally {
      setRowBusy(id, false);
    }
  };

  const handleTest = async (id: string) => {
    setRowBusy(id, true);
    try {
      const res = await fetch("/api/vault/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: id }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        setTestResult((prev) => ({
          ...prev,
          [id]: data.error || "Test fallito — verifica la chiave.",
        }));
      } else if (data.testable === false) {
        setTestResult((prev) => ({
          ...prev,
          [id]: "Salvata in modo sicuro. Validità confermata alla prima chiamata reale.",
        }));
      } else {
        setTestResult((prev) => ({
          ...prev,
          [id]: `Connessione OK (${data.latencyMs ?? "?"} ms${data.source ? ` · ${data.source}` : ""}).`,
        }));
      }
    } catch {
      setTestResult((prev) => ({ ...prev, [id]: "Test fallito — errore di rete." }));
    } finally {
      setRowBusy(id, false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Rimuovere la chiave salvata nel vault per questo provider?")) return;
    setRowBusy(id, true);
    try {
      const res = await fetch(`/api/vault/keys?provider=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rimozione fallita");
      setStatus(data.providers as StatusMap);
      setTestResult((prev) => ({ ...prev, [id]: "" }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Rimozione fallita";
      setTestResult((prev) => ({ ...prev, [id]: message }));
    } finally {
      setRowBusy(id, false);
    }
  };

  return (
    <div className="pt-4 pb-4 border-b border-[#2b2b2e]">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound size={14} className="text-[#8c8c90]" />
        <span className="text-sm font-semibold text-white">API Keys</span>
      </div>
      <p className="text-xs text-[#8c8c90] mb-3 leading-relaxed">
        Cifrate (AES-256-GCM) e salvate solo su questo server — mai nel browser,
        mai nel repo. Il vault ha precedenza su .env.local.
      </p>

      <div className="space-y-2.5">
        {PROVIDER_META.map((p) => {
          const st = status?.[p.id];
          const configured = st?.configured ?? false;
          const source = st?.source ?? null;
          const loading = busy[p.id] ?? false;
          return (
            <div
              key={p.id}
              className="rounded-xl border border-[#2b2b2e] bg-[#141416] p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-white truncate">
                      {p.label}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold shrink-0 ${
                        configured
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-[#252528] text-[#8c8c90]"
                      }`}
                    >
                      {configured
                        ? `Configurata${source ? ` · ${source}` : ""}`
                        : "Non configurata"}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8c8c90] mt-0.5">{p.hint}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {savedTick === p.id && (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                      <Check size={12} /> Salvata
                    </span>
                  )}
                  {configured && source === "vault" && (
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      disabled={loading}
                      title="Rimuovi chiave dal vault"
                      className="w-7 h-7 rounded-lg hover:bg-[#28282c] flex items-center justify-center text-[#8c8c90] hover:text-rose-400 transition cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 mt-2.5">
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={drafts[p.id] || ""}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave(p.id);
                  }}
                  placeholder={
                    configured
                      ? "•••••••• — incolla per sostituire"
                      : "Incolla la chiave API…"
                  }
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-[#1c1c1f] border border-[#2e2e32] text-xs text-white placeholder-[#5c5c62] focus:outline-none focus:border-white/25 font-mono"
                />
                <button
                  type="button"
                  onClick={() => handleSave(p.id)}
                  disabled={loading}
                  className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {loading ? <Loader2 size={13} className="animate-spin" /> : "Salva"}
                </button>
                <button
                  type="button"
                  onClick={() => handleTest(p.id)}
                  disabled={loading || !configured}
                  title="Test connessione (server-side)"
                  className="px-2.5 py-1.5 rounded-lg bg-[#28282c] hover:bg-[#34343a] text-xs font-semibold text-white transition cursor-pointer disabled:opacity-40 flex items-center gap-1 shrink-0"
                >
                  <FlaskConical size={13} /> Test
                </button>
              </div>

              {testResult[p.id] ? (
                <p className="text-[11px] text-[#8c8c90] mt-1.5 leading-snug">
                  {testResult[p.id]}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
