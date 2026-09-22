import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { rateLimit } from '@/lib/rateLimit';
import {
  getStripe,
  stripeNotConfigured,
  resolveBillingUser,
  findStripeCustomer,
  findActiveSubscription,
  persistStripeCustomerId,
} from '@/lib/stripeServer';

/** Resolve userId from a Supabase JWT (Authorization: Bearer <jwt>). */
async function userIdFromRequest(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization') || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token || !supabaseAdmin) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

/** stripe v22: period end lives on the subscription item, not the subscription. */
function periodEndMs(sub: {
  items: { data: Array<{ current_period_end?: number }> };
  trial_end?: number | null;
}): number | null {
  const itemEnd = sub.items.data[0]?.current_period_end;
  if (typeof itemEnd === 'number') return itemEnd * 1000;
  return null;
}

/**
 * GET /api/stripe/subscription — real subscription state for the logged-in user.
 * Returns status, trial info, cancel-at-period-end, card brand/last4, invoices.
 */
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { limit: 30, windowMs: 60_000 });
  if (limited) return limited;
  const stripe = getStripe();
  if (!stripe) return NextResponse.json(stripeNotConfigured(), { status: 500 });

  const userId = await userIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const user = await resolveBillingUser(userId);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const customerId = await findStripeCustomer(stripe, user);
  if (!customerId) {
    return NextResponse.json({ hasSubscription: false });
  }

  const sub = await findActiveSubscription(stripe, customerId);
  if (!sub || !['active', 'trialing', 'past_due'].includes(sub.status)) {
    return NextResponse.json({ hasSubscription: false, customerId });
  }

  const item = sub.items.data[0];
  const price = item?.price;
  const trialEnd = sub.trial_end ? sub.trial_end * 1000 : null;

  // Card: default payment method on subscription, else customer's default
  let card: { brand: string; last4: string; expMonth: number; expYear: number } | null = null;
  try {
    let pmIdResolved: string | null =
      typeof sub.default_payment_method === 'string' ? sub.default_payment_method : null;
    if (!pmIdResolved) {
      const customer = await stripe.customers.retrieve(customerId);
      if (customer && !customer.deleted) {
        const invoiceSettings = (customer as unknown as {
          invoice_settings?: { default_payment_method?: unknown };
        }).invoice_settings;
        pmIdResolved =
          typeof invoiceSettings?.default_payment_method === 'string'
            ? (invoiceSettings.default_payment_method as string)
            : null;
      }
    }
    if (pmIdResolved) {
      const pm = await stripe.paymentMethods.retrieve(pmIdResolved);
      if (pm.card) {
        card = {
          brand: pm.card.brand,
          last4: pm.card.last4 || '••••',
          expMonth: pm.card.exp_month || 0,
          expYear: pm.card.exp_year || 0,
        };
      }
    }
  } catch {
    // card stays null — UI shows "add via portal"
  }

  // Invoices (last 10)
  let invoices: Array<{ id: string; amount: number; currency: string; status: string; date: number; pdfUrl: string | null }> = [];
  try {
    const inv = await stripe.invoices.list({ customer: customerId, limit: 10 });
    invoices = inv.data.map(i => ({
      id: i.id,
      amount: i.amount_paid || i.amount_due || 0,
      currency: i.currency || 'usd',
      status: i.status || 'unknown',
      date: (i.created || 0) * 1000,
      pdfUrl: i.invoice_pdf || null,
    }));
  } catch {
    // invoices stay empty
  }

  return NextResponse.json({
    hasSubscription: true,
    customerId,
    subscriptionId: sub.id,
    status: sub.status,
    plan: {
      amount: price?.unit_amount || 0,
      currency: price?.currency || 'usd',
      interval: price?.recurring?.interval || 'month',
    },
    currentPeriodEnd: periodEndMs(sub),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    cancelAt: sub.cancel_at ? sub.cancel_at * 1000 : null,
    trialEnd,
    isTrialing: sub.status === 'trialing',
    card,
    invoices,
  });
}

/**
 * POST /api/stripe/subscription — cancel flows.
 * Body: { action: 'cancel_at_period_end' | 'cancel_trial' | 'cancel_immediate' }
 * - cancel_at_period_end: access until period end (standard cancel)
 * - cancel_trial: immediate cancel while trialing (no charge, per Terms 11.4)
 * - cancel_immediate: immediate cancel, access ends now (requires confirm:true)
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { limit: 10, windowMs: 60_000 });
  if (limited) return limited;
  const stripe = getStripe();
  if (!stripe) return NextResponse.json(stripeNotConfigured(), { status: 500 });

  const userId = await userIdFromRequest(req);
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = body.action as string;
  if (!['cancel_at_period_end', 'cancel_trial', 'cancel_immediate'].includes(action)) {
    return NextResponse.json(
      { error: "Invalid action. Use 'cancel_at_period_end', 'cancel_trial' or 'cancel_immediate'." },
      { status: 400 }
    );
  }

  const user = await resolveBillingUser(userId);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  const customerId = await findStripeCustomer(stripe, user);
  if (!customerId) return NextResponse.json({ error: 'No Stripe customer found' }, { status: 404 });
  const sub = await findActiveSubscription(stripe, customerId);
  if (!sub) return NextResponse.json({ error: 'No active subscription' }, { status: 404 });

  try {
    if (action === 'cancel_at_period_end') {
      const updated = await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
      return NextResponse.json({
        ok: true,
        cancelAtPeriodEnd: updated.cancel_at_period_end,
        currentPeriodEnd: periodEndMs(updated),
      });
    }
    if (action === 'cancel_trial') {
      if (sub.status !== 'trialing') {
        return NextResponse.json(
          { error: 'Subscription is not in trial — use standard cancel instead.' },
          { status: 400 }
        );
      }
      await stripe.subscriptions.cancel(sub.id);
      return NextResponse.json({ ok: true, canceled: true, wasTrial: true });
    }
    // cancel_immediate
    if (body.confirm !== true) {
      return NextResponse.json(
        { error: 'Immediate cancel requires { confirm: true }.' },
        { status: 400 }
      );
    }
    await stripe.subscriptions.cancel(sub.id);
    return NextResponse.json({ ok: true, canceled: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Cancel failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}