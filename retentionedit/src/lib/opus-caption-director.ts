import { getSecret } from "./vault-store";
import type { VoltMatch } from "./retentionvolt-client";

/**
 * Opus 5.5 — Caption Director (SERVER ONLY).
 *
 * Opus decide la caption policy guardando il Vault come riferimento:
 * cerca il video più simile, ne prende spunto (caption on/off, stile,
 * densità, enfasi), ma la parola finale è SEMPRE sua.
 *
 * Fail-soft: ritorna SEMPRE una policy valida, mai un errore — non deve
 * mai bloccare la consegna del video finito.
 */

export interface CaptionPolicy {
  /** Caption accese o spente per questo video. */
  enabled: boolean;
  /** Parole max per cue: 5 short / 8 long (skill parity). */
  maxWords: number;
  /** Keyword che scoppiano in giallo (lowercase, senza punteggiatura). */
  keywords: string[];
  /** Perché questa scelta (log + debug, una riga). */
  reason: string;
  /** Titolo del video Vault usato come riferimento (null = nessuno). */
  vaultReference: string | null;
}

const STOP = new Set(
  "this,that,with,from,have,has,are,was,were,very,just,like,know,cosa,come,della,nella,sono,molto,molti,anche,quando,questo,questa,nella,perch,quindi,che,non,una,uno,con,per,una,del,al,della,nella,sul,sulla,nel,dei,delle,degli,della,and,the,for,you,your,with,are,was,our,out,all,can,had,her,was,one,our,this,that,them,then,than,into,over,after,before,while,when,what,where,which,who,whom,whose,will,would,there,their,they,them,been,being,have,has,had,having,does,did,doing".split(",")
);

/** Euristica locale: keyword = parole lunghe di contenuto (skill parity). */
export function heuristicKeywords(text: string, max = 12): string[] {
  const counts = new Map<string, number>();
  for (const raw of (text || "").toLowerCase().split(/\s+/)) {
    const w = raw.replace(/[^a-zà-ÿ0-9']/g, "");
    if (w.length < 6 || STOP.has(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, max)
    .map(([w]) => w);
}

function heuristicPolicy(transcriptText: string, format: "short" | "long", volt: VoltMatch | null): CaptionPolicy {
  const words = (transcriptText || "").trim().split(/\s+/).filter(Boolean).length;
  return {
    enabled: words >= 8,
    maxWords: format === "short" ? 5 : 8,
    keywords: heuristicKeywords(transcriptText),
    reason: words < 8 ? "troppo poche parole — caption off" : "euristica locale (Opus non raggiungibile)",
    vaultReference: volt ? volt.title : null,
  };
}

/**
 * Opus decide. Input: transcript reale + match Vault (riferimento).
 * Output: policy caption. Fallback euristico su qualsiasi fallimento.
 */
export async function decideCaptionPolicy(params: {
  transcriptText: string;
  format: "short" | "long";
  niche?: string | null;
  volt?: VoltMatch | null;
}): Promise<CaptionPolicy> {
  const { transcriptText, format } = params;
  const volt = params.volt ?? null;
  const fallback = () => heuristicPolicy(transcriptText, format, volt);
  const apiKey = getSecret("anthropic");
  const text = (transcriptText || "").trim();
  if (!apiKey || text.length < 20) return fallback();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
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
          model: process.env.ANTHROPIC_MODEL || "claude-opus-4-20250514",
          max_tokens: 400,
          system:
            "You are Claude Opus 5.5, Chief Video Editor. You decide the caption policy for a retention-edited video. " +
            "A reference video from RetentionVault (top-performer database) is provided — take inspiration from it, but YOUR word is final law. " +
            "Reply with ONE JSON object only, no prose: {\"enabled\": boolean, \"maxWords\": 5|8, \"keywords\": [max 12 lowercase content words from the transcript], \"reason\": \"one short line\"}. " +
            "Rules: talking-head dense speech → enabled true. Music/montage/no-speech → enabled false. Short → maxWords 5, long → 8.",
          messages: [
            {
              role: "user",
              content:
                `VIDEO: format=${format}, niche=${params.niche || "unknown"}\n` +
                (volt
                  ? `VAULT REFERENCE (inspiration, not law): "${volt.title}" by ${volt.creator} (retention ★${volt.retentionScore}, hook: ${volt.hookTactic || "n/a"}, pacing: ${volt.bodyPacing || "n/a"}, stimulus every ${volt.params.stimulusEverySec ?? "?"}s)\n`
                  : "VAULT REFERENCE: none available — decide from the transcript alone.\n") +
                `TRANSCRIPT (real words): "${text.slice(0, 3000)}"\nDecide the caption policy:`,
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
    const m = out.match(/\{[\s\S]*\}/);
    if (m) {
      const p = JSON.parse(m[0]) as Partial<CaptionPolicy>;
      const kws = Array.isArray(p.keywords)
        ? p.keywords
            .map((k) => String(k).toLowerCase().replace(/[^a-zà-ÿ0-9']/g, ""))
            .filter((k) => k.length >= 3 && !STOP.has(k))
            .slice(0, 12)
        : [];
      return {
        enabled: p.enabled !== false,
        maxWords: p.maxWords === 5 || p.maxWords === 8 ? p.maxWords : format === "short" ? 5 : 8,
        keywords: kws.length > 0 ? kws : heuristicKeywords(text),
        reason: typeof p.reason === "string" && p.reason.length > 0 ? p.reason.slice(0, 140) : "deciso da Opus",
        vaultReference: volt ? volt.title : null,
      };
    }
  } catch {
    // fallback sotto — mai bloccare la consegna
  }
  return fallback();
}
