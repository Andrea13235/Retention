import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';
import { persistStripeCustomerId } from '@/lib/stripeServer';

/** Best-effort: find app userId from a Stripe customer (metadata or email). */
async function resolveUserId(
  stripe: Stripe,
  customerId: string | null,
  metadataUserId?: string
): Promise<string | null> {
  if (metadataUserId && metadataUserId !== 'usr_guest') {
    if (supabaseAdmin) {
      try {
        const { data: userCheck } = await supabaseAdmin.auth.admin.getUserById(metadataUserId);
        if (userCheck?.user?.id) return userCheck.user.id;
      } catch {
        /* invalid user id in metadata, continue to verified customer match */
      }
    } else {
      return metadataUserId;
    }
  }
  if (!customerId || !supabaseAdmin) return null;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    const email = customer && !customer.deleted ? customer.email : null;
    if (!email) return null;

    let allUsers: any[] = [];
    let page = 1;
    while (true) {
      const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      const batch = data?.users ?? [];
      allUsers.push(...batch);
      if (batch.length < 1000) break;
      page++;
    }
    const match = allUsers.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (match?.id) return match.id;

    // Fallback: If customer doesn't exist in Supabase yet, auto-provision user so Pro plan is pre-assigned when they log in
    try {
      const { data: newUser } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          email,
          full_name: (customer && !customer.deleted && customer.name) || '',
        },
      });
      if (newUser?.user?.id) {
        console.log(`[Stripe Webhook] Auto-provisioned Supabase user for paying customer: ${email} (${newUser.user.id})`);
        return newUser.user.id;
      }
    } catch (createErr) {
      console.warn('[Stripe Webhook] Could not auto-create user in Supabase:', createErr);
    }
    return null;
  } catch {
    return null;
  }
}

async function setPlan(
  userId: string,
  patch: Record<string, unknown>,
  log: string
): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    const meta = (data?.user?.user_metadata || {}) as Record<string, unknown>;
    const appMeta = (data?.user?.app_metadata || {}) as Record<string, unknown>;
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...appMeta,
        ...patch,
      },
      user_metadata: {
        ...meta,
        ...patch,
        updated_at: new Date().toISOString(),
      },
    });
    console.log(`[Stripe Webhook] ${log}`);
  } catch (updateErr) {
    console.error('[Stripe Webhook] Failed to update user in Supabase:', updateErr);
  }
}

export async function POST(req: NextRequest) {
  try {
    const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim().replace(/^["']|["']$/g, '');
    if (!stripeSecret) {
      console.error('[Stripe Webhook] STRIPE_SECRET_KEY not configured');
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const stripe = new Stripe(stripeSecret);
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

    const bodyText = await req.text();
    const signature = req.headers.get('stripe-signature');

    let event: Stripe.Event;

    // SECURITY: Webhook signature is MANDATORY — never accept unsigned payloads
    // In Stripe Dashboard > Developers > Webhooks, copy the Signing Secret (whsec_...)
    // and set STRIPE_WEBHOOK_SECRET in Vercel env (both Preview and Production).
    if (!webhookSecret) {
      console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured — rejecting unsigned webhook');
      return NextResponse.json(
        { error: 'Webhook not configured: STRIPE_WEBHOOK_SECRET missing. Add it in Vercel env.' },
        { status: 500 }
      );
    }
    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }
    try {
      event = stripe.webhooks.constructEvent(bodyText, signature, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = typeof session.customer === 'string' ? session.customer : null;
        const userId = await resolveUserId(stripe, customerId, session.metadata?.userId);
        const customerEmail = session.customer_email || session.customer_details?.email;

        console.log(`[Stripe Webhook] Checkout completed for user ${userId || customerEmail}`);

        if (userId) {
          if (customerId) await persistStripeCustomerId(userId, customerId);
          await setPlan(
            userId,
            { plan: 'pro', subscription_status: 'active' },
            `User ${userId} upgraded to Pro in Supabase`
          );
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : null;
        const userId = await resolveUserId(stripe, customerId, subscription.metadata?.userId);
        const status = subscription.status;
        const isProActive = status === 'active' || status === 'trialing';

        console.log(`[Stripe Webhook] Subscription status: ${status} for user ${userId}`);

        if (userId) {
          if (customerId) await persistStripeCustomerId(userId, customerId);
          await setPlan(
            userId,
            {
              plan: isProActive ? 'pro' : 'free',
              subscription_status: status,
              trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
            },
            `User ${userId} status set to ${isProActive ? 'pro' : 'free'}`
          );
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : null;
        const userId = await resolveUserId(stripe, customerId, subscription.metadata?.userId);

        if (userId) {
          await setPlan(
            userId,
            { plan: 'free', subscription_status: 'canceled' },
            `User ${userId} downgraded to Free in Supabase`
          );
        }
        break;
      }

      case 'invoice.payment_failed': {
        // Card declined / payment issue: keep current plan but flag past_due so
        // the UI can warn. Final downgrade happens on subscription.updated/deleted.
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;
        const userId = await resolveUserId(stripe, customerId);
        if (userId && supabaseAdmin) {
          await setPlan(
            userId,
            { subscription_status: 'past_due', last_payment_failed_at: new Date().toISOString() },
            `User ${userId} flagged past_due (payment failed)`
          );
        }
        console.log(`[Stripe Webhook] Payment failed for user ${userId || customerId}`);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = (invoice as unknown as { subscription?: string | null }).subscription;
        // Only grant Pro if this invoice is for a subscription and is paid
        if (subId && invoice.status === 'paid') {
          const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;
          const userId = await resolveUserId(stripe, customerId);
          if (userId) {
            if (customerId) await persistStripeCustomerId(userId, customerId);
            await setPlan(
              userId,
              { plan: 'pro', subscription_status: 'active', last_payment_failed_at: null },
              `User ${userId} confirmed Pro (subscription invoice payment succeeded)`
            );
          }
        }
        break;
      }

      case 'customer.subscription.trial_will_end': {
        // Fires ~3 days before trial converts. Log for now; wire an email
        // provider here (Resend/Postmark) before launch for the EU reminder.
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : null;
        const userId = await resolveUserId(stripe, customerId, subscription.metadata?.userId);
        console.log(
          `[Stripe Webhook] Trial ending soon for user ${userId || customerId} — send reminder email (TODO: wire provider)`
        );
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Stripe Webhook] Internal server error:', error);
    return NextResponse.json(
      { error: error?.message || 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
