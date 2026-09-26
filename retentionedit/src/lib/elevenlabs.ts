import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getSecret } from "./vault-store";

/**
 * ElevenLabs text-to-speech client — SERVER ONLY (chiave dal vault).
 *
 * Uso in pipeline: genera il voiceover dell'hook (primi secondi) quando
 * l'utente attiva l'opzione "Voiceover hook". L'MP3 viene salvato in
 * `public/voiceovers/<jobId>.mp3` così è servito come asset statico.
 *
 * Senza chiave configurata → `synthesize()` restituisce `null`
 * (stage skippato, mai errore bloccante).
 */
export class ElevenLabsClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || getSecret("elevenlabs") || "";
  }

  public isConfigured(): boolean {
    return this.apiKey.length >= 8;
  }

  /**
   * Sintetizza il testo in MP3. Ritorna l'URL pubblico (`/voiceovers/…`)
   * oppure `null` se non configurato / errore (fail-soft).
   */
  public async synthesize(params: {
    jobId: string;
    text: string;
    voiceId?: string;
    modelId?: string;
  }): Promise<{ audioUrl: string; voiceId: string } | null> {
    if (!this.isConfigured()) return null;
    const text = params.text.trim().slice(0, 900);
    if (!text) return null;

    const voiceId = params.voiceId || process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
    const modelId = params.modelId || "eleven_multilingual_v2";

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 60000);
      let res: Response;
      try {
        res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: "POST",
          headers: {
            "xi-api-key": this.apiKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text,
            model_id: modelId,
            voice_settings: { stability: 0.55, similarity_boost: 0.75 },
          }),
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!res.ok) {
        console.warn(`ElevenLabs TTS failed (HTTP ${res.status}), skipping voiceover.`);
        return null;
      }
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length < 1024) {
        console.warn("ElevenLabs TTS returned an empty payload, skipping voiceover.");
        return null;
      }
      const outDir = path.join(process.cwd(), "public", "voiceovers");
      mkdirSync(outDir, { recursive: true });
      const filename = `${params.jobId}.mp3`;
      writeFileSync(path.join(outDir, filename), bytes);
      return { audioUrl: `/voiceovers/${filename}`, voiceId };
    } catch (err) {
      console.warn("ElevenLabs TTS unreachable, skipping voiceover:", err);
      return null;
    }
  }
}
