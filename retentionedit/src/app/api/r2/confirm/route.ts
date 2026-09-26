import { NextRequest, NextResponse } from "next/server";
import { addStorageRecord } from "@/lib/r2-quota";
import { sanitizeR2KeySegment } from "@/lib/r2";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    const r2Key = String(body.r2Key ?? "").trim().slice(0, 400);
    const userId = sanitizeR2KeySegment(String(body.userId ?? "anon").trim(), 40);
    const bytes = Math.floor(Number(body.bytes));
    const kind = (body.kind as string) === "export" || (body.kind as string) === "thumbnail" ? (body.kind as "export" | "thumbnail") : "raw";

    if (!r2Key || !r2Key.startsWith("raw/") && !r2Key.startsWith("exports/")) {
      return NextResponse.json({ error: "r2Key must start with raw/ or exports/" }, { status: 400 });
    }
    if (!Number.isFinite(bytes) || bytes <= 0 || bytes > 8 * 1024 ** 3) {
      return NextResponse.json({ error: "bytes invalid" }, { status: 400 });
    }
    // Ensure the key belongs to this user prefix (prevent ledger poisoning)
    if (!r2Key.startsWith(`raw/${userId}/`) && !r2Key.startsWith(`exports/${userId}/`)) {
      return NextResponse.json({ error: "r2Key does not match your user prefix" }, { status: 403 });
    }

    addStorageRecord({ r2Key, userId, bytes, createdAt: Date.now(), kind });
    return NextResponse.json({ ok: true, r2Key });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "confirm failed";
    console.error("[r2/confirm] error:", msg);
    return NextResponse.json({ error: "Confirm failed" }, { status: 500 });
  }
}
