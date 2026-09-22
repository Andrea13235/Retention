import Stripe from 'stripe';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim().replace(/^["']|["']$/g, '');
  if (!key) return null;
  if (!_stripe) {
    _stripe = new Stripe(key);
  }
  return _stripe;
}

export function stripeNotConfigured() {
  return !process.env.STRIPE_SECRET_KEY;
}

export interface BillingUser {
  id: string;
  email: string;
  stripeCustomerId: string | null;
}

export async function resolveBillingUser(userId: string): Promise<BillingUser | null> {
  if (!isSupabaseConfigured || !supabaseAdmin) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error || !data?.user) return null;
    const appMeta = (data.user.app_metadata || {}) as Record<string, unknown>;
    const userMeta = (data.user.user_metadata || {}) as Record<string, unknown>;
    return {
      id: data.user.id,
      email: data.user.email || '',
      stripeCustomerId:
        typeof appMeta.stripe_customer_id === 'string'
          ? appMeta.stripe_customer_id
          : typeof userMeta.stripe_customer_id === 'string'
          ? userMeta.stripe_customer_id
          : null,
    };
  } catch {
    return null;
  }
}

export async function persistStripeCustomerId(userId: string, customerId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabaseAdmin) return;
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    const userMeta = (data?.user?.user_metadata || {}) as Record<string, unknown>;
    const appMeta = (data?.user?.app_metadata || {}) as Record<string, unknown>;
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: { ...appMeta, stripe_customer_id: customerId },
      user_metadata: { ...userMeta, stripe_customer_id: customerId },
    });
  } catch (err) {
    console.warn('Could not persist stripe_customer_id:', err);
  }
}

export async function findStripeCustomer(
  stripe: Stripe,
  user: BillingUser
): Promise<string | null> {
  if (user.stripeCustomerId) {
    try {
      const cust = await stripe.customers.retrieve(user.stripeCustomerId);
      if (cust && !cust.deleted) {
        return user.stripeCustomerId;
      }
    } catch {
      // stale id — continue with fallbacks
    }
  }
  if (user.email) {
    try {
      const found = await stripe.customers.list({ email: user.email, limit: 5 });
      const match = found.data.find(c => !c.deleted && c.email?.toLowerCase() === user.email.toLowerCase());
      if (match) {
        await persistStripeCustomerId(user.id, match.id);
        return match.id;
      }
    } catch {
      return null;
    }
  }
  return null;
}

/** Active (or trialing/past_due) subscription for a Stripe customer, newest first. Excludes canceled. */
export async function findActiveSubscription(
  stripe: Stripe,
  customerId: string
): Promise<Stripe.Subscription | null> {
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 10,
  });
  const validSubs = subs.data.filter(s => ['active', 'trialing', 'past_due'].includes(s.status));
  if (validSubs.length === 0) return null;
  const rank = (s: Stripe.Subscription) =>
    s.status === 'trialing' ? 0 : s.status === 'active' ? 1 : 2;
  const sorted = [...validSubs].sort((a, b) => rank(a) - rank(b));
  return sorted[0] || null;
}
