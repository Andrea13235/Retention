'use client';

import { Sidebar } from '@/components/Sidebar';
import { KPICard } from '@/components/KPICard';
import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import {
  Cpu, RefreshCw, AlertCircle, CheckCircle,
  XCircle, Clock, Zap, AlertTriangle, Database, Info
} from 'lucide-react';

interface McpData {
  tableExists: boolean;
  message?: string;
  totalRequests: number;
  successRequests: number;
  deniedRequests: number;
  errorRequests: number;
  successRate: number;
  avgLatencyMs: number;
  costEstimate: number;
  dailyData: Array<{ date: string; total: number; success: number; denied: number; errors: number }>;
  topTools: Array<{ tool: string; count: number; successRate: number }>;
  topUsers: Array<{ email: string; plan: string; count: number }>;
  recentLogs: Array<any>;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-[#1a1a2e] border border-[#2d2d4a] rounded-xl p-3 text-xs shadow-xl">
        <p className="text-slate-400 mb-2">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color }} className="font-semibold">{p.name}: {p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

const STATUS_COLORS: Record<string, string> = {
  success: '#22c55e',
  auth_denied: '#f59e0b',
  error: '#ef4444',
};

export default function McpPage() {
  const [data, setData] = useState<McpData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/mcp?days=${days}`);
      if (!res.ok) throw new Error('Failed to fetch MCP data');
      setData(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [days]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
  };

  const dailyChartData = data?.dailyData.map(d => ({
    ...d,
    date: formatDate(d.date),
  })) || [];

  return (
    <div className="flex min-h-screen bg-[#0a0a0f]">
      <Sidebar />
      <main className="ml-60 flex-1 p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Server MCP</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Metriche richieste CyberMCP · /api/mcp endpoint
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Time Range */}
            <div className="flex items-center gap-1 bg-[#111118] border border-[#1e1e2e] rounded-xl p-1">
              {[7, 14, 30].map(d => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    days === d
                      ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-500 hover:text-white'
                  }`}
                >
                  {d}gg
                </button>
              ))}
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
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 text-sm text-red-400 bg-red-900/20 border border-red-800/30 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {data && !data.tableExists && (
          <div className="mb-6 bg-amber-900/20 border border-amber-700/30 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-300 mb-1">Tabella di logging non ancora creata</p>
                <p className="text-xs text-slate-400 mb-3">{data.message}</p>
                <div className="bg-[#0a0a0f] rounded-xl p-4 font-mono text-xs text-emerald-300 overflow-x-auto">
                  <pre>{`-- Esegui questa query su Supabase > SQL Editor:

CREATE TABLE IF NOT EXISTS mcp_request_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  user_email TEXT,
  plan TEXT DEFAULT 'unauthenticated',
  tool_name TEXT,
  method TEXT,
  status TEXT DEFAULT 'success',
  latency_ms INT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_mcp_logs_created ON mcp_request_logs(created_at DESC);
CREATE INDEX idx_mcp_logs_user ON mcp_request_logs(user_email);
CREATE INDEX idx_mcp_logs_status ON mcp_request_logs(status);
CREATE INDEX idx_mcp_logs_tool ON mcp_request_logs(tool_name);

ALTER TABLE mcp_request_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON mcp_request_logs 
  FOR ALL USING (auth.role() = 'service_role');`}</pre>
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  Dopo aver creato la tabella, il sito principale (route.ts) loggerà automaticamente ogni richiesta MCP.
                </p>
              </div>
            </div>
          </div>
        )}

        {loading && !data ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-500">Caricamento metriche MCP...</p>
            </div>
          </div>
        ) : data ? (
          <div className="space-y-8">
            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="Richieste Totali"
                value={data.totalRequests.toLocaleString()}
                subtitle={`Negli ultimi ${days} giorni`}
                icon={<Zap className="w-4 h-4" />}
                color="indigo"
                size="large"
              />
              <KPICard
                title="Success Rate"
                value={`${data.successRate ?? 100}%`}
                subtitle={`${data.successRequests || 0} riuscite`}
                icon={<CheckCircle className="w-4 h-4" />}
                color={(data.successRate ?? 100) > 90 ? 'green' : (data.successRate ?? 100) > 70 ? 'amber' : 'red'}
              />
              <KPICard
                title="Auth Denied"
                value={(data.deniedRequests || 0).toLocaleString()}
                subtitle="Token mancante/non Pro"
                icon={<AlertTriangle className="w-4 h-4" />}
                color="amber"
              />
              <KPICard
                title="Latenza Media"
                value={(data.avgLatencyMs || 0) > 0 ? `${data.avgLatencyMs}ms` : '—'}
                subtitle="Tempo di risposta medio"
                icon={<Clock className="w-4 h-4" />}
                color={(data.avgLatencyMs || 0) < 500 ? 'green' : 'amber'}
              />
            </div>

            {/* Secondary KPI */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <KPICard
                title="Errori Server"
                value={(data.errorRequests || 0).toLocaleString()}
                subtitle="Status: error (5xx)"
                icon={<XCircle className="w-4 h-4" />}
                color={(data.errorRequests || 0) === 0 ? 'green' : 'red'}
              />
              <KPICard
                title="Costo Stimato"
                value={`$${(data.costEstimate ?? 0).toFixed(4)}`}
                subtitle={`@ $${process.env.NEXT_PUBLIC_MCP_COST || '0.002'}/req`}
                icon={<Database className="w-4 h-4" />}
                color="blue"
              />
              <KPICard
                title="Media Giornaliera"
                value={data.totalRequests > 0 ? (data.totalRequests / days).toFixed(1) : '0'}
                subtitle="Richieste/giorno"
                icon={<Cpu className="w-4 h-4" />}
                color="purple"
              />
            </div>

            {/* Daily Chart */}
            <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-slate-300 mb-4">
                Richieste Giornaliere (ultimi {days} giorni)
              </h3>
              {dailyChartData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-slate-600 text-sm">
                  {data.tableExists ? 'Nessuna richiesta in questo periodo' : 'Tabella di logging non ancora creata'}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dailyChartData} barSize={8} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                    <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="success" name="Success" fill="#6366f1" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="denied" name="Denied" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="errors" name="Errori" fill="#ef4444" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <div className="flex items-center gap-4 mt-3">
                {[
                  { color: '#6366f1', label: 'Success' },
                  { color: '#f59e0b', label: 'Auth Denied' },
                  { color: '#ef4444', label: 'Errori' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ background: item.color }} />
                    <span className="text-[10px] text-slate-500">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Two columns: Top Tools + Top Users */}
            <div className="grid grid-cols-2 gap-6">
              {/* Top Tools */}
              <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#1e1e2e]">
                  <h3 className="text-sm font-semibold text-slate-300">Top Tool MCP</h3>
                  <p className="text-xs text-slate-600 mt-0.5">Strumenti più chiamati</p>
                </div>
                <div className="p-4 space-y-2.5">
                  {data.topTools.length === 0 ? (
                    <p className="text-xs text-slate-600 text-center py-6">Nessun dato disponibile</p>
                  ) : (
                    data.topTools.map((tool, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-slate-300 font-mono truncate max-w-[60%]">{tool.tool}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-medium ${tool.successRate > 90 ? 'text-emerald-400' : tool.successRate > 70 ? 'text-amber-400' : 'text-red-400'}`}>
                              {tool.successRate}%
                            </span>
                            <span className="text-xs font-bold text-white">{tool.count}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-[#1e1e2e] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{
                              width: data.topTools.length > 0 && data.topTools[0].count > 0
                                ? `${(tool.count / data.topTools[0].count) * 100}%`
                                : '0%'
                            }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Top Users */}
              <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#1e1e2e]">
                  <h3 className="text-sm font-semibold text-slate-300">Top Utilizzatori</h3>
                  <p className="text-xs text-slate-600 mt-0.5">Per numero di richieste</p>
                </div>
                <div className="p-4 space-y-2.5">
                  {data.topUsers.length === 0 ? (
                    <p className="text-xs text-slate-600 text-center py-6">Nessun dato disponibile</p>
                  ) : (
                    data.topUsers.map((user, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-[#1a1a24] last:border-none">
                        <div className="flex items-center gap-2.5">
                          <span className="text-[10px] text-slate-600 font-mono w-5">#{i + 1}</span>
                          <div>
                            <p className="text-xs text-slate-300 truncate max-w-[160px]">{user.email}</p>
                            <span className={`text-[9px] font-semibold ${user.plan === 'pro' ? 'text-indigo-400' : 'text-slate-600'}`}>
                              {user.plan.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-white">{user.count.toLocaleString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Recent Logs */}
            {data.recentLogs.length > 0 && (
              <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#1e1e2e]">
                  <h3 className="text-sm font-semibold text-slate-300">Log Recenti</h3>
                  <p className="text-xs text-slate-600 mt-0.5">Ultime 20 richieste MCP</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#1a1a24]">
                        <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-5 py-2.5">Timestamp</th>
                        <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Tool</th>
                        <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Status</th>
                        <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Piano</th>
                        <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Latenza</th>
                        <th className="text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-4 py-2.5">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentLogs.map((log, i) => (
                        <tr key={log.id || i} className="border-b border-[#1a1a24] hover:bg-white/[0.02] last:border-none">
                          <td className="px-5 py-2.5 text-xs text-slate-500 font-mono whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString('it-IT', {
                              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                            })}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-300 font-mono">{log.tool_name || log.method || '—'}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              log.status === 'success'
                                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                                : log.status === 'auth_denied'
                                ? 'bg-amber-600/20 text-amber-300 border border-amber-500/30'
                                : 'bg-red-600/20 text-red-300 border border-red-500/30'
                            }`}>
                              {log.status?.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`text-[10px] font-medium ${log.plan === 'pro' ? 'text-indigo-400' : 'text-slate-600'}`}>
                              {log.plan?.toUpperCase() || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-400">
                            {log.latency_ms ? `${log.latency_ms}ms` : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-500 truncate max-w-[180px]">
                            {log.user_email || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
