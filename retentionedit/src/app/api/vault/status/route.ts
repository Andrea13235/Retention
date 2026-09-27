import { NextRequest, NextResponse } from "next/server";
import { vaultStatus } from "@/lib/vault-store";
import { requireAuth } from "@/lib/server-auth";

/** GET /api/vault/status → which providers are configured (booleans only). Requires auth. */
export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult && authResult.errorResponse) {
    return authResult.errorResponse;
  }
  return NextResponse.json({ providers: vaultStatus() });
}
