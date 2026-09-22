'use client';

import { useState, FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { Lock, Eye, EyeOff, Terminal } from 'lucide-react';
import { Suspense } from 'react';

function LoginForm() {
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get('redirect') || '/';
  const safeRedirect = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/';

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        window.location.href = safeRedirect;
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || 'Password errata');
      }
    } catch {
      setError('Errore di connessione. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e1e2e33_1px,transparent_1px),linear-gradient(to_bottom,#1e1e2e33_1px,transparent_1px)] bg-[size:40px_40px]" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 mb-4">
            <Terminal className="w-7 h-7 text-indigo-400" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">RETENTIONVOLT</h1>
          <p className="text-xs text-slate-500 mt-1 font-mono">Admin Dashboard · localhost:4001</p>
        </div>

        {/* Card */}
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-6">
            <Lock className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-semibold text-slate-300">Accesso riservato</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 font-medium mb-1.5 block">Admin Password</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  maxLength={256}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full bg-[#0a0a0f] border border-[#2d2d40] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 transition-colors pr-10 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">
                <span className="font-mono">✗</span> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition-all duration-200"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Accesso...
                </span>
              ) : (
                'Entra nella Dashboard'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-600 mt-4 font-mono">
          🔒 Accessibile solo da localhost · Nessun accesso esterno
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0f]" />}>
      <LoginForm />
    </Suspense>
  );
}
