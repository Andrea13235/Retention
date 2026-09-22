import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getStripe } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || 'all'; // all, free, pro, trialing
    const rawPage = parseInt(searchParams.get('page') || '1', 10);
    const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1;
    const perPage = 50;

    // Fetch all users safely across auth pages
    let allUsers: any[] = [];
    let authPage = 1;
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page: authPage,
        perPage: 1000,
      });
      if (error) throw error;
      const batch = data?.users ?? [];
      allUsers.push(...batch);
      if (batch.length < 1000) break;
      authPage++;
    }

    // Fetch active/trialing Stripe subscriptions to enrich status
    const stripeSubsByEmail: Record<string, { status: string; isPro: boolean }> = {};
    try {
      const stripe = getStripe();
      const allSubs = await stripe.subscriptions.list({
        status: 'all',
        limit: 100,
        expand: ['data.customer'],
      });
      for (const sub of allSubs.data) {
        const cust = sub.customer as any;
        const email = (cust?.email || '').toLowerCase().trim();
        if (email) {
          const isPro = sub.status === 'active' || sub.status === 'trialing';
          stripeSubsByEmail[email] = {
            status: sub.status,
            isPro,
          };
        }
      }
    } catch {
      // Stripe list fallback
    }

    // Map users to admin format
    const mapped = allUsers.map(u => {
      const meta = u.user_metadata || {};
      const appMeta = u.app_metadata || {};
      const email = (u.email || '').toLowerCase().trim();
      const stripeInfo = email ? stripeSubsByEmail[email] : null;

      const isPro = appMeta.plan === 'pro' || meta.plan === 'pro' || Boolean(stripeInfo?.isPro);
      const plan = isPro ? 'pro' : 'free';
      const subscriptionStatus = stripeInfo?.status || appMeta.subscription_status || meta.subscription_status || null;
      return {
        id: u.id,
        email: u.email || null,
        name: meta.name || meta.full_name || u.email?.split('@')[0] || '—',
        plan,
        subscriptionStatus,
        role: meta.role || '—',
        hearSource: meta.hearSource || '—',
        useCase: meta.useCase || '—',
        onboardingCompleted: Boolean(meta.onboarding_completed || meta.onboardingCompleted),
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at || null,
        provider: u.app_metadata?.provider || 'email',
        emailConfirmed: Boolean(u.email_confirmed_at),
        mcpApiKey: null,
      };
    });

    // Filter
    let filtered = mapped;
    if (filter === 'free') filtered = mapped.filter(u => u.plan === 'free');
    if (filter === 'pro') filtered = mapped.filter(u => u.plan === 'pro');
    if (filter === 'trialing') filtered = mapped.filter(u => u.subscriptionStatus === 'trialing');

    // Sort by createdAt desc
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Paginate
    const start = (page - 1) * perPage;
    const paginated = filtered.slice(start, start + perPage);

    return NextResponse.json({
      users: paginated,
      total: filtered.length,
      page,
      perPage,
      totalPages: Math.ceil(filtered.length / perPage) || 1,
    });
  } catch (error: unknown) {
    console.error('[Admin Users] Error:', error);
    const message = error instanceof Error ? error.message : 'Errore interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
