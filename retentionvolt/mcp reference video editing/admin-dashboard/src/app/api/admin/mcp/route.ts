import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const days = parseInt(searchParams.get('days') || '30');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Daily request counts
    let dailyData: Array<{ date: string; total: number; success: number; denied: number; errors: number }> = [];
    let topTools: Array<{ tool: string; count: number; successRate: number }> = [];
    let topUsers: Array<{ email: string; plan: string; count: number }> = [];
    let recentLogs: Array<any> = [];
    let totalRequests = 0;
    let successRequests = 0;
    let deniedRequests = 0;
    let errorRequests = 0;
    let avgLatencyMs = 0;

    try {
      // Check if table exists
      const { error: tableCheckError } = await supabase
        .from('mcp_request_logs')
        .select('id')
        .limit(1);

      if (tableCheckError) throw tableCheckError;

      // Total aggregates
      const { count: total } = await supabase
        .from('mcp_request_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startDate.toISOString());

      const { count: success } = await supabase
        .from('mcp_request_logs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'success')
        .gte('created_at', startDate.toISOString());

      const { count: denied } = await supabase
        .from('mcp_request_logs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'auth_denied')
        .gte('created_at', startDate.toISOString());

      const { count: errors } = await supabase
        .from('mcp_request_logs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'error')
        .gte('created_at', startDate.toISOString());

      totalRequests = total || 0;
      successRequests = success || 0;
      deniedRequests = denied || 0;
      errorRequests = errors || 0;

      // Avg latency
      const { data: latencyData } = await supabase
        .from('mcp_request_logs')
        .select('latency_ms')
        .eq('status', 'success')
        .gte('created_at', startDate.toISOString())
        .limit(500);

      if (latencyData && latencyData.length > 0) {
        const validLatencies = latencyData.map(r => r.latency_ms).filter(Boolean);
        avgLatencyMs = validLatencies.length > 0
          ? Math.round(validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length)
          : 0;
      }

      // Daily breakdown (capped at 5,000 logs to prevent memory exhaustion)
      const { data: allLogs } = await supabase
        .from('mcp_request_logs')
        .select('created_at, status, tool_name, user_email, plan, latency_ms')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })
        .limit(5000);

      if (allLogs) {
        // Group by day
        const byDay: Record<string, { total: number; success: number; denied: number; errors: number }> = {};
        const toolStats: Record<string, { count: number; success: number }> = {};
        const userStats: Record<string, { count: number; plan: string }> = {};

        for (const log of allLogs) {
          const day = log.created_at.slice(0, 10);
          if (!byDay[day]) byDay[day] = { total: 0, success: 0, denied: 0, errors: 0 };
          byDay[day].total++;
          if (log.status === 'success') byDay[day].success++;
          else if (log.status === 'auth_denied') byDay[day].denied++;
          else if (log.status === 'error') byDay[day].errors++;

          // Tool stats
          if (log.tool_name) {
            if (!toolStats[log.tool_name]) toolStats[log.tool_name] = { count: 0, success: 0 };
            toolStats[log.tool_name].count++;
            if (log.status === 'success') toolStats[log.tool_name].success++;
          }

          // User stats
          if (log.user_email) {
            if (!userStats[log.user_email]) userStats[log.user_email] = { count: 0, plan: log.plan || 'unknown' };
            userStats[log.user_email].count++;
          }
        }

        dailyData = Object.entries(byDay).map(([date, counts]) => ({ date, ...counts }));

        topTools = Object.entries(toolStats)
          .map(([tool, stats]) => ({
            tool,
            count: stats.count,
            successRate: parseFloat(((stats.success / stats.count) * 100).toFixed(1)),
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);

        topUsers = Object.entries(userStats)
          .map(([email, stats]) => ({ email, count: stats.count, plan: stats.plan }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10);
      }

      // Recent logs
      const { data: recent } = await supabase
        .from('mcp_request_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      recentLogs = recent || [];
    } catch {
      // Table may not exist — return empty data with instructions
      return NextResponse.json({
        tableExists: false,
        message: 'La tabella mcp_request_logs non esiste ancora. Esegui la migration SQL su Supabase.',
        totalRequests: 0,
        successRequests: 0,
        deniedRequests: 0,
        errorRequests: 0,
        successRate: 100,
        avgLatencyMs: 0,
        costEstimate: 0,
        dailyData: [],
        topTools: [],
        topUsers: [],
        recentLogs: [],
      });
    }

    return NextResponse.json({
      tableExists: true,
      totalRequests,
      successRequests,
      deniedRequests,
      errorRequests,
      successRate: totalRequests > 0
        ? parseFloat(((successRequests / totalRequests) * 100).toFixed(1))
        : 100,
      avgLatencyMs,
      costEstimate: parseFloat((totalRequests * parseFloat(process.env.MCP_COST_PER_REQUEST || '0.002')).toFixed(4)),
      dailyData,
      topTools,
      topUsers,
      recentLogs,
    });
  } catch (error: any) {
    console.error('[Admin MCP] Error:', error);
    return NextResponse.json({ error: error?.message || 'Errore interno' }, { status: 500 });
  }
}
