import { NextRequest, NextResponse } from "next/server";
import { vaultStatus } from "@/lib/vault-store";
import { requireAuth } from "@/lib/server-auth";

/** GET /api/vault/status → which providers are configured (booleans only). Requires auth. */
export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult && authResult.errorResponse) {
    return authResult.errorResponse;
  }
  // Non-sensitive env diagnostics: booleans + lengths only, NEVER values.
  // Lets an authenticated user check prod config (R2, session secret) without
  // ever exposing secrets. Values stay server-side.
  const { getR2Config } = await import("@/lib/r2");
  const r2Configured = getR2Config() !== null;
  const sessionSecretSet =
    ((process.env.SESSION_SECRET || process.env.VAULT_MASTER_KEY || "").trim().length >= 16);
  return NextResponse.json({
    providers: vaultStatus(),
    diag: {
      r2Configured,
      sessionSecretSet,
      isVercel: Boolean(process.env.VERCEL),
      nodeEnv: process.env.NODE_ENV || null,
    },
  });
}
