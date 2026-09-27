import { NextRequest, NextResponse } from "next/server";
import {
  deleteVaultSecret,
  isVaultProvider,
  setVaultSecret,
  vaultStatus,
} from "@/lib/vault-store";
import { requireAuth } from "@/lib/server-auth";

/**
 * POST /api/vault/keys { provider, apiKey }
 * Saves one provider secret AES-256-GCM encrypted. Never echoes the value.
 * Requires authenticated session.
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult && authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const body = await req.json();
    const { provider, apiKey } = body ?? {};
    if (!isVaultProvider(String(provider || ""))) {
      return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
    }
    if (typeof apiKey !== "string" || apiKey.trim().length < 8) {
      return NextResponse.json({ error: "API key too short (min 8 characters)" }, { status: 400 });
    }
    setVaultSecret(provider, apiKey);
    return NextResponse.json({ ok: true, provider, providers: vaultStatus() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Vault write failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE /api/vault/keys?provider=anthropic → removes the vault copy (env fallback stays). */
export async function DELETE(req: NextRequest) {
  const authResult = await requireAuth(req);
  if ("errorResponse" in authResult && authResult.errorResponse) {
    return authResult.errorResponse;
  }

  const provider = new URL(req.url).searchParams.get("provider") || "";
  if (!isVaultProvider(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }
  try {
    deleteVaultSecret(provider);
    return NextResponse.json({ ok: true, provider, providers: vaultStatus() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Vault delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
