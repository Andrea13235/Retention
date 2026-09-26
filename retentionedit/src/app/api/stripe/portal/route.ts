import { NextRequest, NextResponse } from "next/server";
import { getStripeServer } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userEmailCandidate = body?.userEmail || req.headers.get("x-user-email");
    const sessionCookie = req.cookies.get("retentionedit_session")?.value;
    const sessionHeader = req.headers.get("x-retentionedit-session");

    const email = typeof userEmailCandidate === "string" && userEmailCandidate.includes("@")
      ? userEmailCandidate.trim().toLowerCase()
      : undefined;

    const stripe = getStripeServer();

    let customerId = body?.customerId;

    if (!customerId && email) {
      const customers = await stripe.customers.list({ email, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }

    if (!customerId) {
      return NextResponse.json(
        { error: "Nessun cliente Stripe trovato per questo account. Effettua prima un abbonamento." },
        { status: 404 }
      );
    }

    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl}/?tab=subscription`,
    });

    return NextResponse.json({
      success: true,
      url: portalSession.url,
    });
  } catch (err: any) {
    console.error("[api/stripe/portal] Error creating portal session:", err);
    return NextResponse.json(
      { error: err?.message || "Impossibile aprire il portale clienti Stripe" },
      { status: 500 }
    );
  }
}
