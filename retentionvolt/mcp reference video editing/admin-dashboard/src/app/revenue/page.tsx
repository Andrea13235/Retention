'use client';

import { Sidebar } from '@/components/Sidebar';
import { KPICard } from '@/components/KPICard';
import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, RefreshCw,
  AlertCircle, Crown, Calendar
} from 'lucide-react';

interface RevenueData {
  mrr: number;
  arr: number;
  monthlyMRR: number;
  annualMRR: number;
  monthlyCount: number;
  annualCount: number;
  activeSubscriptions: number;
  canceledSubscriptions: number;
  churnRate: number;
  recentCancels: number;
  monthlyData: Array<{
    month: string;
    revenue: number;
    newSubs: number;
    cancels: number;
  }>;
  topCustomers: Array<{
    id: string;
    customerId: string;
    email: string;
    status: string;
    mrr: number;
    createdAt: string;
    cancelAt: string | null;
  }>;
  warning?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl p-3 text-xs shadow-xl">
        <p className="text-slate-400 mb-2 font-medium">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }} className="font-semibold">
            {p.name}: {p.name === 'Revenue' ? `$${p.value.toFixed(2)}` : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function RevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/revenue?months=6');
      if (!res.ok) throw new Error('Failed to fetch revenue data');
      setData(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const formatMonth = (m: string) => {
    const [year, month] = m.split('-');
    const d = new Date(parseInt(year), parseInt(month) - 1);
    return d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });
  };

  const chartData = data?.monthlyData.map(d => ({
    ...d,
    month: formatMonth(d.month),
  })) || [];

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <Sidebar />
      <main className="ml-60 flex-1 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Revenue</h1>
            <p className="text-sm text-slate-500 mt-0.5">Entrate, abbonamenti e metriche finanziarie — dati Stripe</p>
          </div>
          <button
            onClick={fetchData}
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
            {error} — controlla le credenziali Stripe in .env.local
          </div>
        )}

        {data?.warning && (
          <div className="mb-6 flex items-start gap-3 text-xs text-amber-300 bg-amber-900/20 border border-amber-700/30 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Avviso Stripe: Chiave API di test scaduta o non valida</p>
              <p className="text-slate-400 mt-0.5">
                La chiave in <code className="text-amber-300 font-mono">.env.local</code> (STRIPE_SECRET_KEY) risulta scaduta su Stripe.
                Aggiorna la chiave con una valida dalla dashboard di Stripe per visualizzare gli incassi e le sottoscrizioni in tempo reale.
              </p>
            </div>
          </div>
        )}

        {loading && !data ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500">Caricamento da Stripe...</p>
            </div>
          </div>
        ) : data ? (
          <div className="space-y-8">
            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="MRR"
                value={`$${data.mrr.toFixed(0)}`}
                subtitle="Monthly Recurring Revenue"
                icon={<DollarSign className="w-4 h-4" />}
                color="green"
                size="large"
              />
              <KPICard
                title="ARR"
                value={`$${data.arr.toFixed(0)}`}
                subtitle="Annual Recurring Revenue"
                icon={<TrendingUp className="w-4 h-4" />}
                color="blue"
              />
              <KPICard
                title="Abbonati Attivi"
                value={data.activeSubscriptions}
                subtitle={`${data.canceledSubscriptions} cancellati totali`}
                icon={<Crown className="w-4 h-4" />}
                color="indigo"
              />
              <KPICard
                title="Churn Rate"
                value={`${data.churnRate}%`}
                subtitle={`${data.recentCancels} cancel negli ultimi 30gg`}
                icon={data.churnRate > 5 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                color={data.churnRate > 5 ? 'red' : 'green'}
              />
            </div>

            {/* Plan Breakdown */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">Breakdown per Piano</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-indigo-600/10 border border-indigo-500/20 rounded-xl">
                    <div>
                      <p className="text-sm font-semibold text-indigo-300">Pro Monthly</p>
                      <p className="text-xs text-slate-500 mt-0.5">{data.monthlyCount} abbonati × $12/mese</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-white">${(data.monthlyCount * 12).toFixed(0)}</p>
                      <p className="text-xs text-slate-500">MRR</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-emerald-600/10 border border-emerald-500/20 rounded-xl">
                    <div>
                      <p className="text-sm font-semibold text-emerald-300">Pro Annual</p>
                      <p className="text-xs text-slate-500 mt-0.5">{data.annualCount} abbonati × $72/anno</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-white">${(data.annualCount * 6).toFixed(0)}</p>
                      <p className="text-xs text-slate-500">MRR equiv.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">Nuovi vs Cancellazioni (6 mesi)</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} barSize={12} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                    <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} width={25} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="newSubs" name="Nuovi" fill="#6366f1" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="cancels" name="Cancellazioni" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Revenue Chart */}
            <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-300">Revenue Mensile (6 mesi)</h3>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Calendar className="w-3.5 h-3.5" />
                  Dati da Stripe invoices
                </div>
              </div>
              {chartData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-slate-600 text-sm">
                  Nessuna invoice trovata in Stripe (modalità test?)
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                    <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} width={45} tickFormatter={v => `$${v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#22c55e" strokeWidth={2} fill="url(#revenueGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Top Customers */}
            {data.topCustomers.length > 0 && (
              <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#1e1e2e]">
                  <h3 className="text-sm font-semibold text-slate-300">Top Clienti per MRR</h3>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#1a1a24]">
                      <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-5 py-2.5">Cliente</th>
                      <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Status</th>
                      <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">MRR</th>
                      <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Dal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topCustomers.map((c, i) => (
                      <tr key={c.id} className={`border-b border-[#1a1a24] hover:bg-white/[0.02] ${i === data.topCustomers.length - 1 ? 'border-none' : ''}`}>
                        <td className="px-5 py-3 text-sm text-slate-300">{c.email || c.customerId}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            c.status === 'active' ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30' :
                            c.status === 'trialing' ? 'bg-amber-600/20 text-amber-300 border border-amber-500/30' :
                            'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}>
                            {c.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-emerald-400">${c.mrr.toFixed(2)}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {new Date(c.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
