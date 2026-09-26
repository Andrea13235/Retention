import { NextRequest, NextResponse } from "next/server";
import { getStripeServer, STRIPE_PLANS, PlanId } from "@/lib/stripe";
import { findUserByEmail } from "@/lib/auth-store";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const emailCandidate = searchParams.get("email") || req.headers.get("x-user-email");
    const email = typeof emailCandidate === "string" && emailCandidate.includes("@")
      ? emailCandidate.trim().toLowerCase()
      : null;

    if (!email) {
      return NextResponse.json({
        plan: "free",
        planConfig: STRIPE_PLANS.free,
        isSubscribed: false,
        credits: 25,
      });
    }

    const stripe = getStripeServer();
    const customers = await stripe.customers.list({ email, limit: 1 });

    if (customers.data.length === 0) {
      return NextResponse.json({
        plan: "free",
        planConfig: STRIPE_PLANS.free,
        isSubscribed: false,
        customerId: null,
        credits: 25,
      });
    }

    const customer = customers.data[0];
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return NextResponse.json({
        plan: "free",
        planConfig: STRIPE_PLANS.free,
        isSubscribed: false,
        customerId: customer.id,
        credits: 25,
      });
    }

    const sub = subscriptions.data[0];
    const planId: PlanId = (sub.metadata?.planId || "pro") as PlanId;
    const planConfig = STRIPE_PLANS[planId] || STRIPE_PLANS.pro;

    return NextResponse.json({
      plan: planId,
      planConfig,
      isSubscribed: true,
      customerId: customer.id,
      subscriptionId: sub.id,
      currentPeriodEnd: sub.items.data[0]?.price?.created,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      credits: planConfig.creditsMonthly,
    });
  } catch (err: any) {
    console.error("[api/stripe/status] Error fetching status:", err);
    return NextResponse.json({
      plan: "free",
      planConfig: STRIPE_PLANS.free,
      isSubscribed: false,
      error: err?.message,
    });
  }
}
