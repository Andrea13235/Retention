import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { rateLimit } from '@/lib/rateLimit';
import {
  getStripe,
  resolveBillingUser,
  findStripeCustomer,
  findActiveSubscription,
} from '@/lib/stripeServer';

/**
 * POST /api/account/delete — permanently delete the account.
 * Order: cancel Stripe subscription (immediate) -> revoke MCP keys ->
 * delete Supabase user. Each step is best-effort-logged; user deletion is
 * the point of no return and always attempted.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { limit: 5, windowMs: 60_000 });
  if (limited) return limited;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Auth service unavailable' }, { status: 500 });
  }

  const auth = req.headers.get('authorization') || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (body?.confirmation !== 'DELETE') {
    return NextResponse.json({ error: 'Explicit DELETE confirmation required' }, { status: 400 });
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

  const warnings: string[] = [];

  // 1. Cancel Stripe subscription so billing stops
  try {
    const stripe = getStripe();
    if (stripe) {
      const user = await resolveBillingUser(userId);
      if (user) {
        const customerId = await findStripeCustomer(stripe, user);
        if (customerId) {
          const sub = await findActiveSubscription(stripe, customerId);
          if (sub && ['active', 'trialing', 'past_due'].includes(sub.status)) {
            await stripe.subscriptions.cancel(sub.id);
            console.log(`[Account Delete] Canceled subscription ${sub.id} for user ${userId}`);
          }
        }
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Stripe cancel failed';
    warnings.push(`Subscription cancel: ${message}`);
  }

  // 2. Revoke MCP API keys
  try {
    const { error: revokeErr } = await supabaseAdmin.from('mcp_api_keys').update({ is_active: false }).eq('user_id', userId);
    if (revokeErr) {
      warnings.push(`Key revocation failed: ${revokeErr.message}`);
    }
  } catch (err: unknown) {
    warnings.push('Key revocation failed');
  }

  // 3. Delete the Supabase user (point of no return)
  try {
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (delErr) {
      return NextResponse.json(
        { error: `Account deletion failed: ${delErr.message}`, warnings },
        { status: 500 }
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    return NextResponse.json({ error: message, warnings }, { status: 500 });
  }

  return NextResponse.json({ ok: true, warnings });
}
