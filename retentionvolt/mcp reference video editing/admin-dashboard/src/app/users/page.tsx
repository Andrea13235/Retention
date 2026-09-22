'use client';

import { Sidebar } from '@/components/Sidebar';
import { useState, useEffect } from 'react';
import {
  Users, Search, RefreshCw, AlertCircle,
  Crown, UserX, Clock, Mail, Globe, ChevronLeft, ChevronRight
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  plan: string;
  subscriptionStatus: string | null;
  role: string;
  hearSource: string;
  useCase: string;
  onboardingCompleted: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  provider: string;
  emailConfirmed: boolean;
  mcpApiKey: string | null;
}

const PlanBadge = ({ plan, status }: { plan: string; status: string | null }) => {
  if (plan === 'pro') {
    const isTrial = status === 'trialing';
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
        isTrial
          ? 'bg-amber-600/20 border border-amber-500/30 text-amber-300'
          : 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-300'
      }`}>
        <Crown className="w-2.5 h-2.5" />
        {isTrial ? 'TRIAL' : 'PRO'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 border border-slate-700 text-slate-400">
      FREE
    </span>
  );
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ filter, page: page.toString() });
      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [filter, page]);

  const filteredUsers = search
    ? users.filter(u =>
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.name?.toLowerCase().includes(search.toLowerCase())
      )
    : users;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatRelative = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Oggi';
    if (days === 1) return 'Ieri';
    if (days < 7) return `${days}gg fa`;
    if (days < 30) return `${Math.floor(days / 7)}sett fa`;
    return `${Math.floor(days / 30)}mesi fa`;
  };

  const tabs = [
    { key: 'all', label: 'Tutti', count: null },
    { key: 'pro', label: 'Pro', count: null },
    { key: 'free', label: 'Free', count: null },
    { key: 'trialing', label: 'Trial', count: null },
  ];

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <Sidebar />
      <main className="ml-60 flex-1 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Utenti</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {total.toLocaleString()} utenti registrati in totale
            </p>
          </div>
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#111118] border border-[#1e1e2e] rounded-xl text-xs text-slate-400 hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Aggiorna
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 text-sm text-red-400 bg-red-900/20 border border-red-800/30 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Filters Row */}
        <div className="flex items-center gap-4 mb-6">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-[#111118] border border-[#1e1e2e] rounded-xl p-1">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => { setFilter(tab.key); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filter === tab.key
                    ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-500 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Cerca email o nome..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#111118] border border-[#1e1e2e] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e1e2e]">
                <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Utente</th>
                <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Piano</th>
                <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Provider</th>
                <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Registrazione</th>
                <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Ultimo accesso</th>
                <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Onboarding</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-slate-600 text-sm">
                    <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-2" />
                    Caricamento...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-slate-600 text-sm">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Nessun utente trovato
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, i) => (
                  <tr
                    key={user.id}
                    className={`border-b border-[#1a1a24] hover:bg-white/[0.02] transition-colors ${
                      i === filteredUsers.length - 1 ? 'border-none' : ''
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600/30 to-purple-600/30 border border-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-300">
                          {(user.name || user.email || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white leading-none">{user.name || '—'}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <PlanBadge plan={user.plan} status={user.subscriptionStatus} />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {user.provider === 'google' ? (
                          <Globe className="w-3 h-3 text-blue-400" />
                        ) : (
                          <Mail className="w-3 h-3 text-slate-500" />
                        )}
                        <span className="text-xs text-slate-400 capitalize">{user.provider}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-400">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-600" />
                        <span className="text-xs text-slate-400">{formatRelative(user.lastSignInAt)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-[10px] font-medium ${user.onboardingCompleted ? 'text-emerald-400' : 'text-slate-600'}`}>
                        {user.onboardingCompleted ? '✓ Completato' : '– Non fatto'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-[#1e1e2e]">
              <span className="text-xs text-slate-500">
                Pagina {page} di {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg bg-[#0d0d14] border border-[#2d2d40] text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg bg-[#0d0d14] border border-[#2d2d40] text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
