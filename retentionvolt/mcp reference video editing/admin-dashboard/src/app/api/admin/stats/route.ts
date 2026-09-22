import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getStripe } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const stripe = getStripe();

    // === UTENTI DA SUPABASE (paginazione completa) ===
    let allUsers: any[] = [];
    let authPage = 1;
    while (true) {
      const { data, error: usersError } = await supabase.auth.admin.listUsers({
        page: authPage,
        perPage: 1000,
      });
      if (usersError) throw usersError;
      const batch = data?.users ?? [];
      allUsers.push(...batch);
      if (batch.length < 1000) break;
      authPage++;
    }

    const totalUsers = allUsers.length;
    const isProUser = (u: any) => u.app_metadata?.plan === 'pro' || u.user_metadata?.plan === 'pro';
    const proUsers = allUsers.filter(isProUser).length;
    const freeUsers = allUsers.filter(u => !isProUser(u)).length;

    // Nuovi utenti oggi
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newUsersToday = allUsers.filter(u => new Date(u.created_at) >= today).length;

    // Nuovi utenti ultimi 7 giorni
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const newUsersWeek = allUsers.filter(u => new Date(u.created_at) >= sevenDaysAgo).length;

    // Nuovi utenti ultimi 30 giorni
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newUsersMonth = allUsers.filter(u => new Date(u.created_at) >= thirtyDaysAgo).length;

    // Conversion rate
    const conversionRate = totalUsers > 0 ? ((proUsers / totalUsers) * 100).toFixed(1) : '0';

    // === STRIPE REVENUE ===
    let mrr = 0;
    let activeSubscriptions = 0;
    let trialingSubscriptions = 0;
    let canceledThisMonth = 0;
    let monthlyPlanCount = 0;
    let annualPlanCount = 0;
    let totalRevenue = 0;

    try {
      // Get all active subscriptions
      const subscriptions = await stripe.subscriptions.list({
        status: 'all',
        limit: 100,
        expand: ['data.items.data.price'],
      });

      for (const sub of subscriptions.data) {
        if (sub.status === 'active' || sub.status === 'trialing') {
          activeSubscriptions++;
          if (sub.status === 'trialing') trialingSubscriptions++;

          for (const item of sub.items.data) {
            const price = item.price;
            const unitAmount = price.unit_amount || 0;
            const interval = price.recurring?.interval;

            if (interval === 'month') {
              mrr += unitAmount / 100;
              monthlyPlanCount++;
            } else if (interval === 'year') {
              mrr += (unitAmount / 100) / 12;
              annualPlanCount++;
            }
          }
        }

        // Canceled this month
        if (sub.status === 'canceled') {
          const canceledAt = sub.canceled_at ? new Date(sub.canceled_at * 1000) : null;
          if (canceledAt && canceledAt >= thirtyDaysAgo) {
            canceledThisMonth++;
          }
        }
      }

      // Charges totali (entrate cumulative)
      const charges = await stripe.charges.list({ limit: 100 });
      for (const charge of charges.data) {
        if (charge.paid && !charge.refunded) {
          totalRevenue += charge.amount / 100;
        }
      }
    } catch (stripeErr: any) {
      console.warn('[Admin Stats] Stripe error (possibly test mode):', stripeErr?.message);
    }

    // Fallback: se Stripe non ha restituito abbonamenti ma ci sono utenti Pro in Supabase
    if (activeSubscriptions === 0 && proUsers > 0) {
      activeSubscriptions = proUsers;
      // Stima conservativa: $12/mese (piano monthly)
      mrr = proUsers * 12;
      monthlyPlanCount = proUsers;
    }

    // === FUNNEL: visite → account → trial → paid ===
    // Un concetto = un nome solo:
    //  - siteVisits30d  = "visita sito": righe site_visits ultimi 30gg (richiede migration 002).
    //  - trialsStarted  = "trial startate": subscription Stripe in trialing (contate sopra).
    //  - conversionRatePct   = "conversione": paganti (proUsers) / account totali.
    //  - trialConversionPct  = "conversione trial": trial startate / account totali.
    // Fail-loud: se site_visits manca, siteVisitsAvailable=false e il frontend
    // mostra "migration 002 da lanciare" invece di uno 0 ambiguo.
    const trialsStarted = trialingSubscriptions;
    const conversionRatePct = totalUsers > 0
      ? parseFloat(((proUsers / totalUsers) * 100).toFixed(1))
      : 0;
    const trialConversionPct = totalUsers > 0
      ? parseFloat(((trialsStarted / totalUsers) * 100).toFixed(1))
      : 0;

    let siteVisits30d = 0;
    let siteVisitsAvailable = true;
    try {
      const { count, error: visitsError } = await supabase
        .from('site_visits')
        .select('*', { count: 'exact', head: true })
        .gte('visited_on', thirtyDaysAgo.toISOString().slice(0, 10));
      if (visitsError) throw visitsError;
      siteVisits30d = count || 0;
    } catch {
      // Tabella 002 non ancora migrata → flag esplicito, mai silent zero.
      siteVisitsAvailable = false;
    }

    const arr = mrr * 12;
    const churnRate = activeSubscriptions > 0
      ? ((canceledThisMonth / (activeSubscriptions + canceledThisMonth)) * 100).toFixed(1)
      : '0';

    // LTV medio (MRR / churn rate %)
    const ltv = parseFloat(churnRate) > 0
      ? (mrr / activeSubscriptions / (parseFloat(churnRate) / 100)).toFixed(0)
      : (mrr * 24).toFixed(0); // Default 24 mesi se churn = 0

    // Costo infrastruttura stimato (Vercel + Supabase + ElevenLabs base)
    const infraCostMonthly = 25; // USD stima
    const costPerCustomer = proUsers > 0 ? (infraCostMonthly / proUsers).toFixed(2) : '0';
    const estimatedMargin = mrr > 0 ? (((mrr - infraCostMonthly) / mrr) * 100).toFixed(1) : '0';

    // === MCP REQUEST LOGS ===
    let mcpTotal = 0;
    let mcpToday = 0;
    let mcpWeek = 0;
    let mcpMonth = 0;
    let mcpSuccessRate = 100;

    try {
      const { count: totalCount, error: err1 } = await supabase
        .from('mcp_request_logs')
        .select('*', { count: 'exact', head: true });

      const { count: todayCount, error: err2 } = await supabase
        .from('mcp_request_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());

      const { count: weekCount, error: err3 } = await supabase
        .from('mcp_request_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo.toISOString());

      const { count: monthCount, error: err4 } = await supabase
        .from('mcp_request_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo.toISOString());

      const { count: successCount, error: err5 } = await supabase
        .from('mcp_request_logs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'success')
        .gte('created_at', thirtyDaysAgo.toISOString());

      mcpTotal = totalCount || 0;
      mcpToday = todayCount || 0;
      mcpWeek = weekCount || 0;
      mcpMonth = monthCount || 0;
      mcpSuccessRate = (monthCount || 0) > 0
        ? parseFloat((((successCount || 0) / (monthCount || 1)) * 100).toFixed(1))
        : 100;
    } catch {
      // Table may not exist yet
    }

    const mcpCostPerRequest = parseFloat(process.env.MCP_COST_PER_REQUEST || '0.002');
    const mcpCostMonth = (mcpMonth * mcpCostPerRequest).toFixed(2);
    const mcpRequestsPerProUser = proUsers > 0 ? (mcpMonth / proUsers).toFixed(1) : '0';

    // Average daily requests
    const avgDailyRequests = (mcpMonth / 30).toFixed(1);

    return NextResponse.json({
      // Utenti
      totalUsers,
      freeUsers,
      proUsers,
      trialingSubscriptions,
      newUsersToday,
      newUsersWeek,
      newUsersMonth,
      conversionRate: parseFloat(conversionRate),

      // Funnel visite → account → trial → paid (un concetto = un nome solo)
      siteVisits30d,
      siteVisitsAvailable,
      trialsStarted,
      trialConversionRate: trialConversionPct,
      paidConversionRate: conversionRatePct,

      // Revenue
      mrr: parseFloat(mrr.toFixed(2)),
      arr: parseFloat(arr.toFixed(2)),
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      activeSubscriptions,
      trialingCount: trialingSubscriptions,
      canceledThisMonth,
      monthlyPlanCount,
      annualPlanCount,
      churnRate: parseFloat(churnRate),
      ltv: parseFloat(ltv),
      infraCostMonthly,
      costPerCustomer: parseFloat(costPerCustomer),
      estimatedMargin: parseFloat(estimatedMargin),

      // MCP
      mcpTotal,
      mcpToday,
      mcpWeek,
      mcpMonth,
      mcpSuccessRate,
      mcpCostMonth: parseFloat(mcpCostMonth),
      mcpCostPerRequest,
      mcpRequestsPerProUser: parseFloat(mcpRequestsPerProUser),
      avgDailyRequests: parseFloat(avgDailyRequests),

      // Meta
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Admin Stats] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Errore interno' },
      { status: 500 }
    );
  }
}
