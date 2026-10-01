import { getSecret } from "./vault-store";
import { generateYouTubeTitle } from "./youtube-title";

/**
 * Titolo YouTube perfetto per il video finito — SERVER ONLY.
 *
 * 1. Claude (API Anthropic, chiave dal vault) legge il transcript reale e
 *    scrive il titolo in funzione di cosa parla il video.
 * 2. Fallback euristico (generateYouTubeTitle) quando la chiave manca,
 *    il transcript è vuoto o l'API fallisce.
 *
 * Fail-soft: ritorna SEMPRE un titolo, mai un errore — non deve mai
 * bloccare la consegna del video finito.
 */
export async function resolveYouTubeTitle(params: {
  rawTitle: string;
  transcriptText: string;
  niche?: string;
}): Promise<string> {
  const { rawTitle, transcriptText } = params;
  const fallback = generateYouTubeTitle({
    rawTitle,
    transcriptText,
    niche: params.niche,
  });
  const apiKey = getSecret("anthropic");
  const text = (transcriptText || "").trim();
  if (!apiKey || text.length < 20) return fallback;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20_000);
    let out = "";
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-20241022",
          max_tokens: 80,
          system:
            "You are a YouTube title expert maximizing CTR and retention. Reply with ONE video title only: no quotes, no numbering, max 70 characters, same language as the transcript (Italian if the transcript is Italian).",
          messages: [
            {
              role: "user",
              content: `Transcript: "${text.slice(0, 2000)}"\nFilename: "${rawTitle.slice(0, 80)}"\nWrite the perfect YouTube title:`,
            },
          ],
        }),
        signal: ctrl.signal,
      });
      if (res.ok) {
        const data = (await res.json().catch(() => null)) as {
          content?: Array<{ text?: string }>;
        } | null;
        const t = data?.content?.[0]?.text;
        if (typeof t === "string") out = t.trim();
      }
    } finally {
      clearTimeout(timer);
    }
    const clean = out
      .replace(/^["'«»“”]+|["'«»“”]+$/g, "")
      .split("\n")[0]
      .trim()
      .slice(0, 100);
    if (clean.length >= 8) return clean;
  } catch {
    // fallback sotto — mai bloccare la consegna
  }
  return fallback;
}
