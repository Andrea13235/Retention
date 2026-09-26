import { NextResponse } from "next/server";
import { vaultStatus } from "@/lib/vault-store";

/** GET /api/vault/status → which providers are configured (booleans only). */
export async function GET() {
  return NextResponse.json({ providers: vaultStatus() });
}
