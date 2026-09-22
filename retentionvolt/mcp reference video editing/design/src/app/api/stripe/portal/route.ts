import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { rateLimit } from '@/lib/rateLimit';
import {
  getStripe,
  stripeNotConfigured,
  resolveBillingUser,
  findStripeCustomer,
} from '@/lib/stripeServer';

/**
 * POST /api/stripe/portal — Stripe Customer Portal session.
 * The portal handles: cancel subscription, update/remove card, invoices,
 * payment history. Configure it in Stripe Dashboard > Settings > Billing >
 * Customer portal (cancellation reasons, retention) before launch.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { limit: 10, windowMs: 60_000 });
  if (limited) return limited;
  const stripe = getStripe();
  if (!stripe) return NextResponse.json(stripeNotConfigured(), { status: 500 });

  const auth = req.headers.get('authorization') || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token || !supabaseAdmin) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  let userId: string;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    userId = data.user.id;
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const user = await resolveBillingUser(userId);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  const customerId = await findStripeCustomer(stripe, user);
  if (!customerId) {
    return NextResponse.json(
      { error: 'No billing account found. Subscribe to Pro first.' },
      { status: 404 }
    );
  }

  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    'https://retentionvolt.com',
    'https://www.retentionvolt.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ].filter(Boolean) as string[];

  const reqOrigin = req.headers.get('origin');
  const origin = (reqOrigin && allowedOrigins.includes(reqOrigin))
    ? reqOrigin
    : (process.env.NEXT_PUBLIC_APP_URL || 'https://retentionvolt.com');

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/settings`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Portal session failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
