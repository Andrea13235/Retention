import { NextRequest, NextResponse } from "next/server";
import { getSecret, isVaultProvider, secretSource } from "@/lib/vault-store";
import { requireAuth } from "@/lib/server-auth";

/**
 * POST /api/vault/test { provider }
 * Server-side live auth check. Returns { ok, latencyMs, source }
 * — never secret values. Providers without a safe test endpoint
 * return { testable: false } (key still stored securely).
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if ("errorResponse" in authResult && authResult.errorResponse) {
      return authResult.errorResponse;
    }

    const body = await req.json();
    const provider = String(body?.provider || "");
    if (!isVaultProvider(provider)) {
      return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
    }
    const secret = getSecret(provider);
    if (!secret) {
      return NextResponse.json(
        { provider, ok: false, testable: true, error: "No key stored for this provider" },
        { status: 404 }
      );
    }
    const source = secretSource(provider);

    if (provider === "anthropic") {
      const started = Date.now();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      try {
        const res = await fetch("https://api.anthropic.com/v1/models", {
          headers: {
            "x-api-key": secret,
            "anthropic-version": "2023-06-01",
          },
          signal: ctrl.signal,
        });
        return NextResponse.json({
          provider,
          ok: res.ok,
          testable: true,
          latencyMs: Date.now() - started,
          source,
          ...(res.ok ? {} : { error: `Anthropic rejected the key (HTTP ${res.status})` }),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Network error";
        return NextResponse.json({ provider, ok: false, testable: true, source, error: message });
      } finally {
        clearTimeout(timer);
      }
    }

    if (provider === "meta_mms") {
      const started = Date.now();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      try {
        const res = await fetch("https://api-inference.huggingface.co/models/facebook/mms-1b-all", {
          headers: { Authorization: `Bearer ${secret}` },
          signal: ctrl.signal,
        });
        return NextResponse.json({
          provider,
          ok: res.status !== 401 && res.status !== 403,
          testable: true,
          latencyMs: Date.now() - started,
          source,
          ...(res.status === 401 || res.status === 403 ? { error: `Meta MMS rejected the key (HTTP ${res.status})` } : {}),
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Network error";
        return NextResponse.json({ provider, ok: false, testable: true, source, error: message });
      } finally {
        clearTimeout(timer);
      }
    }

    // higgsfield / modal / meta_muse: no safe side-effect-free auth probe
    // documented — the key is stored encrypted; validity is confirmed
    // on first real render/transcribe call.
    return NextResponse.json({
      provider,
      ok: true,
      testable: false,
      source,
      note: "Key stored securely. Validity is confirmed on first real API call.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Test failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
