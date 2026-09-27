import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { VideoFormat } from "./types";
import { getSecret } from "./vault-store";
import { generateYouTubeCover } from "./thumbnail-generator";

/**
 * Copertina ad-hoc Higgsfield — SERVER ONLY (chiave dal vault).
 *
 * Regole RetentionVolt applicate al prompt SOUL text-to-image:
 *  1. Headline brevissima (max ~4 parole, dal concept Claude) — testo minimo,
 *     alto contrasto, mai più di una riga.
 *  2. Soggetto umano espressivo in primo piano che guarda in camera
 *     (magnetismo CTR: volto > oggetti).
 *  3. Badge concettuale (colore neon smeraldo su fondo scuro luxury).
 *  4. Formato nativo: 9:16 per short (1080x1920), 16:9 per long (1928x1080).
 *  5. Stile dallo blueprint matchato (es. high_contrast_yellow_glow).
 *
 * Flusso API Higgsfield (docs ufficiali): POST modello → { request_id,
 * status_url } → poll rapido con timeout safe → download output → salva in
 * `public/thumbnails/<jobId>.png`. Senza chiave o timeout → fallback immediato
 * su generateYouTubeCover con Sharp per garantire cover pronta e zero blocchi.
 */

const SOUL_ENDPOINT = "https://api.higgsfield.ai/higgsfield/soul/text-to-image/v1.0";

export interface CoverSpec {
  jobId: string;
  userId?: string;
  format: VideoFormat;
  title: string;
  headline: string;
  badge: string;
  niche: string;
  style: string;
  hookText?: string;
}

function buildPrompt(spec: CoverSpec): string {
  const orientation = spec.format === "short" ? "vertical 9:16 portrait" : "horizontal 16:9 wide";
  const hook = (spec.hookText || "").trim().slice(0, 140);
  return [
    `High-CTR ${orientation} video cover thumbnail, ${spec.style.replace(/_/g, " ")} aesthetic`,
    `expressive creator face in close-up looking straight at camera, strong emotion, neon emerald rim light, dark luxury background with subtle depth of field`,
    `minimal bold headline text "${spec.headline.toUpperCase().slice(0, 28)}" in heavy condensed sans-serif, huge, high contrast white with yellow glow accent, single line, top-safe placement`,
    `small badge pill "${spec.badge.toUpperCase().slice(0, 20)}"`,
    `${spec.niche} niche, photorealistic 85mm, cinematic studio lighting, 8k, no watermark, no extra text`,
    hook ? `context: ${hook}` : "",
  ]
    .filter(Boolean)
    .join(". ");
}

async function pollRequest(statusUrl: string, apiKey: string, timeoutMs = 5000): Promise<string | null> {
  const started = Date.now();
  let wait = 1500;
  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, wait));
    const res = await fetch(statusUrl, {
      headers: { Authorization: `Key ${apiKey}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const status = String(data?.status || "").toLowerCase();
    if (status === "completed") {
      const out = data?.output ?? data?.result ?? data;
      if (typeof out === "string" && out.startsWith("http")) return out;
      if (Array.isArray(out)) {
        const first = out[0];
        if (typeof first === "string" && first.startsWith("http")) return first;
        if (first && typeof first.url === "string") return first.url;
      }
      if (out && typeof out.url === "string") return out.url;
      if (Array.isArray(data?.outputs) && typeof data.outputs[0] === "string") return data.outputs[0];
      return null;
    }
    if (status === "failed" || status === "cancelled") return null;
    wait = Math.min(wait * 1.4, 10000);
  }
  return null;
}

export class HiggsfieldCover {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || getSecret("higgsfield") || "";
  }

  public isConfigured(): boolean {
    return this.apiKey.length >= 8;
  }

  /**
   * Genera la cover ad-hoc e la salva in public/thumbnails.
   * Ritorna l'URL pubblico o null (chiave assente / errore → fallback).
   */
  public async generateCover(spec: CoverSpec): Promise<{ coverUrl: string; prompt: string } | null> {
    if (!this.isConfigured()) {
      const coverUrl = await generateYouTubeCover({
        jobId: spec.jobId,
        userId: spec.userId,
        title: spec.headline || spec.title,
        badge: spec.badge,
        format: spec.format,
      });
      return { coverUrl, prompt: buildPrompt(spec) };
    }
    const prompt = buildPrompt(spec);
    const isShort = spec.format === "short";

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      let submit: Response;
      try {
        submit = await fetch(SOUL_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Key ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            width: isShort ? 1080 : 1920,
            height: isShort ? 1920 : 1080,
          }),
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!submit.ok) {
        throw new Error(`submit status ${submit.status}`);
      }
      const data = await submit.json();
      const statusUrl: string | undefined = data?.status_url;
      const directUrl: string | undefined =
        typeof data?.output === "string"
          ? data.output
          : typeof data?.url === "string"
            ? data.url
            : undefined;
      const imageUrl = directUrl || (statusUrl ? await pollRequest(statusUrl, this.apiKey) : null);
      if (!imageUrl) {
        throw new Error("timed out waiting for Higgsfield image");
      }

      const img = await fetch(imageUrl);
      if (!img.ok) throw new Error("image download failed");
      const bytes = Buffer.from(await img.arrayBuffer());
      if (bytes.length < 2048) throw new Error("image byte length too small");

      const isServerless = Boolean(
        process.env.VERCEL ||
        process.env.AWS_LAMBDA_FUNCTION_NAME ||
        process.env.LAMBDA_TASK_ROOT ||
        process.env.NODE_ENV === "production"
      );
      const safeUser = (spec.userId || "default").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
      const outDir = isServerless
        ? path.join(process.env.TMPDIR || "/tmp", "thumbnails", safeUser)
        : path.join(process.cwd(), ".vault", "thumbnails", safeUser);
      mkdirSync(outDir, { recursive: true });
      const filename = `${spec.jobId}.png`;
      writeFileSync(path.join(outDir, filename), bytes);
      return { coverUrl: `/thumbnails/${filename}`, prompt };
    } catch {
      // Guaranteed fast fallback to Sharp-generated YouTube cover
      const coverUrl = await generateYouTubeCover({
        jobId: spec.jobId,
        userId: spec.userId,
        title: spec.headline || spec.title,
        badge: spec.badge,
        format: spec.format,
      });
      return { coverUrl, prompt };
    }
  }
}
