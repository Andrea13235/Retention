'use client';

import { Sidebar } from '@/components/Sidebar';
import { KPICard } from '@/components/KPICard';
import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  Users, DollarSign, Cpu, TrendingUp, RefreshCw,
  ArrowUpRight, Percent, Clock, AlertCircle, CheckCircle, Zap,
  UserCheck, UserX, Star, Eye, FlaskConical
} from 'lucide-react';

interface Stats {
  totalUsers: number;
  freeUsers: number;
  proUsers: number;
  trialingSubscriptions: number;
  newUsersToday: number;
  newUsersWeek: number;
  newUsersMonth: number;
  conversionRate: number;
  // Funnel visite → account → trial → paid (un concetto = un nome solo)
  siteVisits30d: number;
  siteVisitsAvailable: boolean;
  trialsStarted: number;
  trialConversionRate: number;
  paidConversionRate: number;
  mrr: number;
  arr: number;
  totalRevenue: number;
  activeSubscriptions: number;
  monthlyPlanCount: number;
  annualPlanCount: number;
  churnRate: number;
  ltv: number;
  infraCostMonthly: number;
  costPerCustomer: number;
  estimatedMargin: number;
  canceledThisMonth: number;
  mcpTotal: number;
  mcpToday: number;
  mcpWeek: number;
  mcpMonth: number;
  mcpSuccessRate: number;
  mcpCostMonth: number;
  mcpCostPerRequest: number;
  mcpRequestsPerProUser: number;
  avgDailyRequests: number;
  generatedAt: string;
}

const PLAN_COLORS = ['#6366f1', '#22c55e', '#f59e0b'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl p-3 text-xs">
        <p className="text-slate-400 mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }} className="font-semibold">
            {p.name}: {typeof p.value === 'number' && p.name?.includes('$')
              ? `$${p.value.toFixed(2)}`
              : p.value}
          </p>
        ))}
        {/* Numero di utenti alla voce hoverata (payload[0].payload.users) */}
        {typeof payload[0]?.payload?.users === 'number' && (
          <p className="text-slate-300 mt-1 font-semibold">
            👥 {payload[0].payload.users.toLocaleString()} utenti
          </p>
        )}
      </div>
    );
  }
  return null;
};

export default function OverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const planDistribution = stats ? [
    { name: 'Free', value: stats.freeUsers, color: '#6b7280' },
    { name: 'Pro', value: stats.proUsers, color: '#6366f1' },
    { name: 'Trial', value: stats.trialingSubscriptions, color: '#f59e0b' },
  ] : [];

  // Grafico conversioni: %conversione-trial e %conversione.
  // Ogni barra porta `users` = n. utenti assoluti → il tooltip li mostra all'hover.
  const conversionBars = stats ? [
    {
      name: '% Conversione trial',
      rate: stats.trialConversionRate ?? 0,
      users: stats.trialsStarted ?? 0,
      fill: '#f59e0b',
    },
    {
      name: '% Conversione',
      rate: stats.paidConversionRate ?? stats.conversionRate ?? 0,
      users: stats.proUsers ?? 0,
      fill: '#22c55e',
    },
  ] : [];

  const planRevBreakdown = stats ? [
    { name: 'Monthly', value: stats.monthlyPlanCount * 12, label: `${stats.monthlyPlanCount} utenti × $12` },
    { name: 'Annual', value: Math.round(stats.annualPlanCount * 6), label: `${stats.annualPlanCount} utenti × $6/mese` },
  ] : [];

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <Sidebar />

      <main className="ml-60 flex-1 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Overview</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Business metrics in tempo reale · RETENTIONVOLT CyberMCP
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-slate-600 font-mono">
                Aggiornato: {lastUpdated.toLocaleTimeString('it-IT')}
              </span>
            )}
            <button
              onClick={fetchStats}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-[#111118] border border-[#1e1e2e] rounded-xl text-xs text-slate-400 hover:text-white hover:border-[#2d2d40] transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Aggiorna
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 text-sm text-red-400 bg-red-900/20 border border-red-800/30 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {loading && !stats ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500">Caricamento dati...</p>
            </div>
          </div>
        ) : stats ? (
          <div className="space-y-8">
            {/* === SECTION: KPI Principali === */}
            <section>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
                📊 KPI Principali
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                  title="MRR"
                  value={`$${stats.mrr.toFixed(0)}`}
                  subtitle={`ARR: $${stats.arr.toFixed(0)}`}
                  icon={<DollarSign className="w-4 h-4" />}
                  color="green"
                />
                <KPICard
                  title="Utenti Totali"
                  value={stats.totalUsers}
                  subtitle={`+${stats.newUsersWeek} questa settimana`}
                  icon={<Users className="w-4 h-4" />}
                  color="blue"
                />
                <KPICard
                  title="Abbonamenti Attivi"
                  value={stats.activeSubscriptions}
                  subtitle={`${stats.trialingSubscriptions} in trial`}
                  icon={<Star className="w-4 h-4" />}
                  color="indigo"
                />
                <KPICard
                  title="Richieste MCP / mese"
                  value={stats.mcpMonth.toLocaleString()}
                  subtitle={`Costo: $${stats.mcpCostMonth}`}
                  icon={<Cpu className="w-4 h-4" />}
                  color="purple"
                />
              </div>
            </section>

            {/* === SECTION: Utenti & Abbonamenti === */}
            <section>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
                👥 Utenti & Abbonamenti
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                  title="Utenti Free"
                  value={stats.freeUsers}
                  subtitle={`${(100 - stats.conversionRate).toFixed(1)}% del totale`}
                  icon={<UserX className="w-4 h-4" />}
                  color="amber"
                />
                <KPICard
                  title="Utenti Pro"
                  value={stats.proUsers}
                  subtitle={`${stats.monthlyPlanCount} mensile · ${stats.annualPlanCount} annuale`}
                  icon={<UserCheck className="w-4 h-4" />}
                  color="green"
                />
                <KPICard
                  title="Conversion Rate"
                  value={`${stats.conversionRate}%`}
                  subtitle="Free → Pro"
                  icon={<Percent className="w-4 h-4" />}
                  color="indigo"
                />
                <KPICard
                  title="Nuovi Oggi"
                  value={stats.newUsersToday}
                  subtitle={`+${stats.newUsersMonth} negli ultimi 30gg`}
                  icon={<TrendingUp className="w-4 h-4" />}
                  color="blue"
                />
              </div>
            </section>

            {/* === SECTION: Funnel visite → account → trial → paid === */}
            <section>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
                🧲 Funnel & Conversioni
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                  title="Visite sito (30gg)"
                  value={stats.siteVisitsAvailable ? stats.siteVisits30d.toLocaleString() : '—'}
                  subtitle={stats.siteVisitsAvailable
                    ? 'visitatori unici/giorno con consenso analytics'
                    : 'migration 002 da lanciare in Supabase'}
                  icon={<Eye className="w-4 h-4" />}
                  color="blue"
                />
                <KPICard
                  title="Trial startate"
                  value={stats.trialsStarted}
                  subtitle="subscription in trialing (Stripe)"
                  icon={<FlaskConical className="w-4 h-4" />}
                  color="amber"
                />
                <KPICard
                  title="Conversione"
                  value={`${stats.paidConversionRate ?? stats.conversionRate}%`}
                  subtitle="paganti / account totali"
                  icon={<Percent className="w-4 h-4" />}
                  color="green"
                />
                <KPICard
                  title="Conversione trial"
                  value={`${stats.trialConversionRate}%`}
                  subtitle="trial / account totali"
                  icon={<Percent className="w-4 h-4" />}
                  color="indigo"
                />
              </div>
            </section>

            {/* === SECTION: Revenue & Costi === */}
            <section>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
                💰 Revenue & Costi
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                  title="Churn Rate (30gg)"
                  value={`${stats.churnRate}%`}
                  subtitle={`${stats.canceledThisMonth} cancellazioni`}
                  icon={<ArrowUpRight className="w-4 h-4" />}
                  color={stats.churnRate > 5 ? 'red' : 'green'}
                />
                <KPICard
                  title="LTV Medio"
                  value={`$${stats.ltv}`}
                  subtitle="Lifetime value per Pro"
                  icon={<DollarSign className="w-4 h-4" />}
                  color="green"
                />
                <KPICard
                  title="Costo per Cliente"
                  value={`$${stats.costPerCustomer}`}
                  subtitle={`Infra: $${stats.infraCostMonthly}/mese`}
                  icon={<DollarSign className="w-4 h-4" />}
                  color="amber"
                />
                <KPICard
                  title="Margine Stimato"
                  value={`${stats.estimatedMargin}%`}
                  subtitle="MRR - costi infrastruttura"
                  icon={<TrendingUp className="w-4 h-4" />}
                  color={parseFloat(stats.estimatedMargin.toString()) > 50 ? 'green' : 'amber'}
                />
              </div>
            </section>

            {/* === SECTION: MCP Server === */}
            <section>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">
                🔌 MCP Server
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                  title="Richieste Oggi"
                  value={stats.mcpToday}
                  subtitle={`Media: ${stats.avgDailyRequests}/giorno`}
                  icon={<Zap className="w-4 h-4" />}
                  color="indigo"
                />
                <KPICard
                  title="Richieste (7gg)"
                  value={stats.mcpWeek.toLocaleString()}
                  subtitle={`Totale: ${stats.mcpTotal.toLocaleString()}`}
                  icon={<Cpu className="w-4 h-4" />}
                  color="blue"
                />
                <KPICard
                  title="Success Rate"
                  value={`${stats.mcpSuccessRate}%`}
                  subtitle="Richieste MCP riuscite"
                  icon={<CheckCircle className="w-4 h-4" />}
                  color={stats.mcpSuccessRate > 90 ? 'green' : 'red'}
                />
                <KPICard
                  title="Req. / Pro User"
                  value={stats.mcpRequestsPerProUser}
                  subtitle="Media mensile per utente"
                  icon={<Users className="w-4 h-4" />}
                  color="purple"
                />
              </div>
            </section>

            {/* === CHARTS ROW 1: funnel conversioni + distribuzione piani === */}
            <div className="grid grid-cols-2 gap-6">
              {/* Conversioni: %conversione-trial e %conversione (hover = n. utenti) */}
              <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-slate-300 mb-2">Conversioni (%)</h3>
                <p className="text-xs text-slate-600 mb-4">Passa il cursore sulle barre per il numero di utenti</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={conversionBars} barSize={48} barGap={24}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                    <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                      tickFormatter={(v: number) => `${v}%`}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Bar dataKey="rate" name="Tasso" radius={[6, 6, 0, 0]}>
                      {conversionBars.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Piano Distribution Pie */}
              <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">Distribuzione Piani</h3>
                <div className="flex items-center">
                  <ResponsiveContainer width="60%" height={180}>
                    <PieChart>
                      <Pie
                        data={planDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {planDistribution.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2d2d4a', borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-3">
                    {planDistribution.map((item, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
                          <span className="text-xs text-slate-400">{item.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-white">{item.value}</span>
                          <span className="text-xs text-slate-600 ml-1">
                            ({stats.totalUsers > 0 ? ((item.value / stats.totalUsers) * 100).toFixed(0) : 0}%)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Revenue Plan Breakdown */}
              <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-slate-300 mb-2">Revenue per Piano</h3>
                <p className="text-xs text-slate-600 mb-4">MRR per tipo di abbonamento</p>
                <div className="space-y-4">
                  {/* Monthly */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-slate-400">Pro Monthly ($12/mese)</span>
                      <span className="text-sm font-bold text-white">${(stats.monthlyPlanCount * 12).toFixed(0)}</span>
                    </div>
                    <div className="h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: stats.mrr > 0 ? `${((stats.monthlyPlanCount * 12) / stats.mrr) * 100}%` : '0%' }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1">{stats.monthlyPlanCount} abbonati</p>
                  </div>
                  {/* Annual */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-slate-400">Pro Annual ($6/mese × 12)</span>
                      <span className="text-sm font-bold text-white">${(stats.annualPlanCount * 6).toFixed(0)}/mese</span>
                    </div>
                    <div className="h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: stats.mrr > 0 ? `${((stats.annualPlanCount * 6) / stats.mrr) * 100}%` : '0%' }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1">{stats.annualPlanCount} abbonati</p>
                  </div>
                  {/* Trial */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-slate-400">In Trial (7 giorni)</span>
                      <span className="text-sm font-bold text-amber-400">{stats.trialingSubscriptions}</span>
                    </div>
                    <div className="h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: stats.activeSubscriptions > 0 ? `${(stats.trialingSubscriptions / stats.activeSubscriptions) * 100}%` : '0%' }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1">potenziale: ${stats.trialingSubscriptions * 12}/mese</p>
                  </div>
                </div>
              </div>
            </div>

            {/* === HEALTH SUMMARY === */}
            <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">📡 Stato del Business</h3>
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    label: 'Revenue',
                    status: stats.mrr > 0 ? 'online' : 'warning',
                    detail: stats.mrr > 0 ? `MRR $${stats.mrr.toFixed(0)} attivo` : 'Nessun abbonato Pro'
                  },
                  {
                    label: 'MCP Server',
                    status: stats.mcpSuccessRate > 80 ? 'online' : 'warning',
                    detail: `${stats.mcpSuccessRate}% success rate`
                  },
                  {
                    label: 'Churn',
                    status: stats.churnRate < 5 ? 'online' : stats.churnRate < 10 ? 'warning' : 'error',
                    detail: `${stats.churnRate}% mensile`
                  },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-[#0d0d14] rounded-xl border border-[#1e1e2e]">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      item.status === 'online' ? 'bg-emerald-400' :
                      item.status === 'warning' ? 'bg-amber-400' : 'bg-red-400'
                    }`} />
                    <div>
                      <p className="text-xs font-semibold text-white">{item.label}</p>
                      <p className="text-[10px] text-slate-500">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-700 mt-4 font-mono">
                Generato: {stats.generatedAt ? new Date(stats.generatedAt).toLocaleString('it-IT') : '—'}
              </p>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
