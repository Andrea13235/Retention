import { NextRequest, NextResponse } from "next/server";
import { getStripeServer, STRIPE_PLANS, PlanId } from "@/lib/stripe";
import { findUserByEmail } from "@/lib/auth-store";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const stripe = getStripeServer();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[api/stripe/webhook] STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook secret not configured on server" }, { status: 500 });
  }

  let event: any;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error("[api/stripe/webhook] Webhook signature verification failed:", err.message);
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 });
  }

  console.log(`[api/stripe/webhook] Received Stripe event: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        const metadata = session.metadata || {};
        const planId = (metadata.planId || "pro") as PlanId;
        const credits = Number(metadata.credits) || STRIPE_PLANS[planId]?.creditsMonthly || 750;
        const email = metadata.userEmail || session.customer_details?.email;

        console.log(`[api/stripe/webhook] Checkout completed for ${email}: Plan=${planId}, Credits=+${credits}`);

        // Update server-side user record if email is known
        if (email) {
          try {
            const user = findUserByEmail(email);
            if (user) {
              user.plan = planId as any;
              // Add credits and save customer id
              (user as any).stripeCustomerId = customerId;
              (user as any).stripeSubscriptionId = subscriptionId;
              (user as any).credits = ((user as any).credits || 0) + credits;
              console.log(`[api/stripe/webhook] User ${user.email} updated to plan ${planId}`);
            }
          } catch (e) {
            console.warn("[api/stripe/webhook] Could not update local auth-store:", e);
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;
        const status = subscription.status;
        const planId = (subscription.metadata?.planId || "pro") as PlanId;

        console.log(`[api/stripe/webhook] Subscription ${subscription.id} updated: status=${status}, plan=${planId}`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        console.log(`[api/stripe/webhook] Subscription ${subscription.id} canceled/deleted. Reverting to free.`);
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        // Periodic subscription renewal payment
        if (invoice.billing_reason === "subscription_cycle") {
          const subscriptionId = invoice.subscription;
          console.log(`[api/stripe/webhook] Monthly renewal succeeded for subscription ${subscriptionId}`);
        }
        break;
      }

      default:
        // Other events ignored safely
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[api/stripe/webhook] Handler error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
