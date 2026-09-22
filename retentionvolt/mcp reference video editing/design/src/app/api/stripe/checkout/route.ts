import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { rateLimit } from '@/lib/rateLimit';

export async function POST(req: NextRequest) {
  try {
    const limited = rateLimit(req, { limit: 10, windowMs: 60_000 });
    if (limited) return limited;
    const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim().replace(/^["']|["']$/g, '');
    if (!stripeSecret) {
      console.error('[Stripe Checkout] STRIPE_SECRET_KEY not configured');
      return NextResponse.json(
        { error: 'Stripe not configured. Set STRIPE_SECRET_KEY in environment.' },
        { status: 500 }
      );
    }

    const stripe = new Stripe(stripeSecret);

    const body = await req.json().catch(() => ({}));
    const rawCycle = body.billingCycle || body.billingInterval || body.planId || 'annual';

    if (rawCycle !== 'monthly' && rawCycle !== 'annual' && rawCycle !== 'yearly') {
      return NextResponse.json(
        { error: `Invalid billing plan: '${rawCycle}'. Supported plans are 'monthly' ($12/mo) and 'annual' ($72/yr with 7-day trial).` },
        { status: 400 }
      );
    }

    // Origin allowlist check to prevent Open Redirect
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

    // Server-side user authentication if Bearer token present
    const authHeader = req.headers.get('authorization') || '';
    let authenticatedUserId: string | null = null;
    let authenticatedUserEmail: string | null = null;

    if (authHeader.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token) {
        try {
          const { supabaseAdmin } = await import('@/lib/supabase');
          if (supabaseAdmin) {
            const { data } = await supabaseAdmin.auth.getUser(token);
            if (data?.user) {
              authenticatedUserId = data.user.id;
              authenticatedUserEmail = data.user.email || null;
            }
          }
        } catch {
          /* continue with fallback */
        }
      }
    }

    const userId = authenticatedUserId || body.userId || 'usr_guest';
    const userEmail = authenticatedUserEmail || body.userEmail || body.email;

    const isMonthly = rawCycle === 'monthly';
    const billingCycle = isMonthly ? 'monthly' : 'annual';
    // Monthly: $12/month (1200 cents)
    // Annual: 50% discount ($6/mo = $72/year, 7200 cents) with 7-day free trial
    const unitAmount = isMonthly ? 1200 : 7200;
    const interval = isMonthly ? 'month' : 'year';

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: isMonthly 
                ? 'RETENTIONVOLT Pro (Monthly)' 
                : 'RETENTIONVOLT Pro (Annual — 50% OFF)',
              description: isMonthly
                ? 'Complete access to all 500k+ retention curves, Premiere/DaVinci EDL exports & CyberMCP AI agent server ($12/mo).'
                : 'Complete access to all 500k+ retention curves, Premiere/DaVinci EDL exports & CyberMCP AI agent server ($6/mo billed annually with 7-day free trial).',
            },
            unit_amount: unitAmount,
            recurring: {
              interval: interval as Stripe.Checkout.SessionCreateParams.LineItem.PriceData.Recurring.Interval,
            },
          },
          quantity: 1,
        },
      ],
      customer_email: userEmail || undefined,
      metadata: {
        userId,
        plan: 'pro',
        billingCycle,
      },
      subscription_data: {
        ...(isMonthly ? {} : { trial_period_days: 7 }),
        metadata: {
          userId,
          plan: 'pro',
          billingCycle,
        },
      },
      success_url: (() => {
        if (typeof body.successUrl === 'string') {
          const trimmed = body.successUrl.trim();
          if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return `${origin}${trimmed}`;
          if (allowedOrigins.some(o => trimmed.startsWith(o))) return trimmed;
        }
        return `${origin}/?session_id={CHECKOUT_SESSION_ID}&upgrade=success`;
      })(),
      cancel_url: (() => {
        if (typeof body.cancelUrl === 'string') {
          const trimmed = body.cancelUrl.trim();
          if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return `${origin}${trimmed}`;
          if (allowedOrigins.some(o => trimmed.startsWith(o))) return trimmed;
        }
        return `${origin}/?upgrade=cancel`;
      })(),
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (error: unknown) {
    console.error('[Stripe Checkout] Error:', error);
    const message = error instanceof Error ? error.message : 'Stripe checkout error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
