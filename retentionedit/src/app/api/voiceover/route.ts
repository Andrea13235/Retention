import { NextRequest, NextResponse } from "next/server";
import { ElevenLabsClient } from "@/lib/elevenlabs";

/**
 * POST /api/voiceover { jobId, text, voiceId? }
 * Server-side ElevenLabs TTS. Returns { audioUrl } or 503 when unconfigured.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawJobId = String(body?.jobId || "").trim().replace(/[^a-zA-Z0-9_\-]/g, "").slice(0, 80);
    const rawText = String(body?.text || "").trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
    const voiceId =
      typeof body?.voiceId === "string" && /^[a-zA-Z0-9_-]{6,40}$/.test(body.voiceId.trim())
        ? body.voiceId.trim()
        : undefined;
    if (!rawJobId || !rawText) {
      return NextResponse.json({ error: "jobId and text are required" }, { status: 400 });
    }
    if (rawText.length > 900) {
      return NextResponse.json({ error: "Text too long (max 900 chars)" }, { status: 413 });
    }
    const client = new ElevenLabsClient();
    if (!client.isConfigured()) {
      return NextResponse.json(
        { error: "ElevenLabs API key not configured (Settings → API Keys)" },
        { status: 503 }
      );
    }
    const out = await client.synthesize({
      jobId: rawJobId,
      text: rawText,
      voiceId,
    });
    if (!out) {
      return NextResponse.json({ error: "Voiceover synthesis failed" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, ...out });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Voiceover failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
