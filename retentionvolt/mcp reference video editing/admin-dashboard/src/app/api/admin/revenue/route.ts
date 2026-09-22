import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


export async function GET(req: NextRequest) {
  try {
    const stripe = getStripe();
    const { searchParams } = new URL(req.url);
    const months = parseInt(searchParams.get('months') || '6');

    // === SUBSCRIPTIONS ===
    const allSubs = await stripe.subscriptions.list({
      status: 'all',
      limit: 100,
      expand: ['data.items.data.price', 'data.customer'],
    });

    const activeSubs = allSubs.data.filter(s => s.status === 'active' || s.status === 'trialing');
    const canceledSubs = allSubs.data.filter(s => s.status === 'canceled');

    // Revenue breakdown per plan
    let monthlyMRR = 0;
    let annualMRR = 0;
    let monthlyCount = 0;
    let annualCount = 0;

    for (const sub of activeSubs) {
      for (const item of sub.items.data) {
        const price = item.price;
        const amount = price.unit_amount || 0;
        const interval = price.recurring?.interval;

        if (interval === 'month') {
          monthlyMRR += amount / 100;
          monthlyCount++;
        } else if (interval === 'year') {
          annualMRR += (amount / 100) / 12;
          annualCount++;
        }
      }
    }

    const totalMRR = monthlyMRR + annualMRR;
    const totalARR = totalMRR * 12;

    // === MONTHLY REVENUE HISTORY (invoices) ===
    const invoices = await stripe.invoices.list({ limit: 100 });

    // Group by month
    const revenueByMonth: Record<string, number> = {};
    const newSubsByMonth: Record<string, number> = {};
    const cancelsByMonth: Record<string, number> = {};

    // Initialize months
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      revenueByMonth[key] = 0;
      newSubsByMonth[key] = 0;
      cancelsByMonth[key] = 0;
    }

    for (const inv of invoices.data) {
      if (inv.paid && inv.amount_paid > 0) {
        const d = new Date(inv.created * 1000);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (revenueByMonth[key] !== undefined) {
          revenueByMonth[key] += inv.amount_paid / 100;
        }
      }
    }

    for (const sub of allSubs.data) {
      const created = new Date(sub.created * 1000);
      const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
      if (newSubsByMonth[key] !== undefined) newSubsByMonth[key]++;

      if (sub.canceled_at) {
        const canceled = new Date(sub.canceled_at * 1000);
        const cKey = `${canceled.getFullYear()}-${String(canceled.getMonth() + 1).padStart(2, '0')}`;
        if (cancelsByMonth[cKey] !== undefined) cancelsByMonth[cKey]++;
      }
    }

    // Format for chart
    const monthlyData = Object.keys(revenueByMonth).map(month => ({
      month,
      revenue: parseFloat(revenueByMonth[month].toFixed(2)),
      newSubs: newSubsByMonth[month] || 0,
      cancels: cancelsByMonth[month] || 0,
    }));

    // === TOP CUSTOMERS ===
    const topCustomers = activeSubs
      .map(sub => {
        const customer = sub.customer as any;
        const amount = sub.items.data.reduce((acc, item) => {
          const price = item.price;
          const a = price.unit_amount || 0;
          return acc + (price.recurring?.interval === 'year' ? a / 12 : a) / 100;
        }, 0);
        return {
          id: sub.id,
          customerId: typeof customer === 'string' ? customer : customer.id,
          email: typeof customer === 'string' ? '—' : customer.email,
          status: sub.status,
          mrr: parseFloat(amount.toFixed(2)),
          createdAt: new Date(sub.created * 1000).toISOString(),
          cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000).toISOString() : null,
        };
      })
      .sort((a, b) => b.mrr - a.mrr)
      .slice(0, 10);

    // === METRICS ===
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentCancels = canceledSubs.filter(
      s => s.canceled_at && new Date(s.canceled_at * 1000) >= thirtyDaysAgo
    ).length;

    const churnRate = activeSubs.length > 0
      ? parseFloat(((recentCancels / (activeSubs.length + recentCancels)) * 100).toFixed(1))
      : 0;

    return NextResponse.json({
      mrr: parseFloat(totalMRR.toFixed(2)),
      arr: parseFloat(totalARR.toFixed(2)),
      monthlyMRR: parseFloat(monthlyMRR.toFixed(2)),
      annualMRR: parseFloat(annualMRR.toFixed(2)),
      monthlyCount,
      annualCount,
      activeSubscriptions: activeSubs.length,
      canceledSubscriptions: canceledSubs.length,
      churnRate,
      recentCancels,
      monthlyData,
      topCustomers,
    });
  } catch (error: any) {
    console.error('[Admin Revenue] Stripe fetch error, returning fallback:', error.message);
    const months = 6;
    const fallbackMonthlyData = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      fallbackMonthlyData.push({ month: key, revenue: 0, newSubs: 0, cancels: 0 });
    }
    return NextResponse.json({
      mrr: 0,
      arr: 0,
      monthlyMRR: 0,
      annualMRR: 0,
      monthlyCount: 0,
      annualCount: 0,
      activeSubscriptions: 0,
      canceledSubscriptions: 0,
      churnRate: 0,
      recentCancels: 0,
      monthlyData: fallbackMonthlyData,
      topCustomers: [],
      warning: `Stripe API: ${error?.message || 'Errore di connessione'}`
    });
  }
}
