import { NextRequest, NextResponse } from "next/server";
import { getStripeServer, STRIPE_PLANS, PlanId } from "@/lib/stripe";
import { getAuthenticatedUser } from "@/lib/server-auth";

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    const { searchParams } = new URL(req.url);
    const emailCandidate = searchParams.get("email");

    // Only allow querying if authenticated and querying own email
    let email: string | null = null;
    if (authUser?.email) {
      email = authUser.email.toLowerCase();
    } else if (authUser?.userId) {
      // Find email for user
      try {
        const { findUserByEmail } = await import("@/lib/auth-store");
        const fs = await import("fs");
        const path = await import("path");
        const usersFile = path.join(process.cwd(), "src", "data", "users.json");
        if (fs.existsSync(usersFile)) {
          const list = JSON.parse(fs.readFileSync(usersFile, "utf-8"));
          const found = list.find((u: any) => u.id === authUser.userId);
          if (found?.email) email = found.email.toLowerCase();
        }
      } catch {}
    }

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
