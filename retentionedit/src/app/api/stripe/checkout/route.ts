import { NextRequest, NextResponse } from "next/server";
import { getStripeServer, STRIPE_PLANS, PlanId, BillingInterval } from "@/lib/stripe";
import { findUserByEmail } from "@/lib/auth-store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    let { planId, interval = "month" } = body as { planId?: string; interval?: BillingInterval };

    // Normalize planId
    if (planId?.startsWith("plan_")) {
      planId = planId.replace("plan_", "");
    }
    const validPlanId: PlanId = (["starter", "pro", "agency"].includes(planId || "") ? planId : "pro") as PlanId;
    const planConfig = STRIPE_PLANS[validPlanId];

    if (!planConfig) {
      return NextResponse.json({ error: "Piano non valido specificato" }, { status: 400 });
    }

    const priceId = interval === "year" ? planConfig.annualPriceId : planConfig.monthlyPriceId;
    if (!priceId) {
      return NextResponse.json({ error: "Identificatore di prezzo Stripe non configurato" }, { status: 500 });
    }

    const { requireAuth } = await import("@/lib/server-auth");
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult && authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const userId = authResult.user.userId;
    let userEmail = authResult.user.email;

    if (!userEmail && userId) {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const usersFile = path.join(process.cwd(), "src", "data", "users.json");
        if (fs.existsSync(usersFile)) {
          const list = JSON.parse(fs.readFileSync(usersFile, "utf-8"));
          const found = list.find((u: any) => u.id === userId);
          if (found?.email) userEmail = found.email.toLowerCase();
        }
      } catch {}
    }

    if (!userEmail) {
      userEmail = "creator@retentionedit.com";
    }

    const stripe = getStripeServer();

    // Check or find existing Stripe customer by email
    let customerId: string | undefined;
    const existingCustomers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id;
    } else {
      const newCustomer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          userId,
          createdFrom: "retentionedit-app",
        },
      });
      customerId = newCustomer.id;
    }

    // Origin resolution
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata: {
        userId,
        userEmail,
        planId: validPlanId,
        interval,
        credits: String(planConfig.creditsMonthly),
      },
      subscription_data: {
        metadata: {
          userId,
          userEmail,
          planId: validPlanId,
          interval,
          credits: String(planConfig.creditsMonthly),
        },
      },
      success_url: `${appUrl}/?stripe=success&plan=${validPlanId}&credits=${planConfig.creditsMonthly}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?stripe=canceled`,
    });

    return NextResponse.json({
      success: true,
      url: session.url,
      sessionId: session.id,
      plan: validPlanId,
    });
  } catch (err: any) {
    console.error("[api/stripe/checkout] Error creating checkout session:", err);
    return NextResponse.json(
      { error: err?.message || "Impossibile creare la sessione di checkout Stripe" },
      { status: 500 }
    );
  }
}
