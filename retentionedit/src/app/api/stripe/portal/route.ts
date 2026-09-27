import { NextRequest, NextResponse } from "next/server";
import { getStripeServer } from "@/lib/stripe";
import { requireAuth } from "@/lib/server-auth";

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult && authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const body = await req.json().catch(() => ({}));
    let email = authResult.user.email;
    if (!email) {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const usersFile = path.join(process.cwd(), "src", "data", "users.json");
        if (fs.existsSync(usersFile)) {
          const list = JSON.parse(fs.readFileSync(usersFile, "utf-8"));
          const found = list.find((u: any) => u.id === authResult.user.userId);
          if (found?.email) email = found.email.toLowerCase();
        }
      } catch {}
    }

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
