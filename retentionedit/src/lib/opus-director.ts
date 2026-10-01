import { getSecret } from "./vault-store";
import type { VoltMatch } from "./retentionvolt-client";

/**
 * Opus 5.5 — REGISTA CENTRALE (SERVER ONLY).
 *
 * Un solo verdetto per job. Opus riceve:
 *  - transcript reale con timestamp parola-per-parola,
 *  - silenzi reali rilevati (tagli candidati),
 *  - match RetentionVault (RIFERIMENTO: ne prende spunto, non legge),
 *  - formato + durata.
 * E decide TUTTO: tagli extra, zoom, caption policy, graphics/banner,
 * B-roll (dove/come/quanti + prompt Higgsfield), cover concept.
 *
 * La parola finale è SEMPRE di Opus. Il Vault ispira, mai comanda.
 * Fail-soft: ritorna SEMPRE un verdetto valido (euristica locale),
 * mai un errore — non deve mai bloccare la consegna.
 */

export interface OpusCut {
  /** Secondi (source clock): inizio disfluenza/false-start da rimuovere. */
  start: number;
  end: number;
  reason: string;
}

export interface OpusZoom {
  /** Secondi (source clock): picco zoom. peak 1.08–1.15. */
  at: number;
  peak: number;
  reason: string;
}

export interface OpusGraphic {
  kind: "act_title" | "number_stat" | "highlight" | "quote";
  /** Testo VERBATIM dal transcript (mai inventato). */
  title: string;
  subtitle?: string;
  tag?: string;
  /** Secondi (source clock): apparizione. */
  at: number;
  /** Durata secondi (1–6). */
  duration: number;
}

export interface OpusBroll {
  /** Testo VERBATIM o topic reale dal transcript per il prompt. */
  topic: string;
  /** Prompt Higgsfield completo deciso da Opus (fotorealistico, no text). */
  prompt: string;
  /** Secondi (source clock): centro finestra. */
  at: number;
  /** Durata secondi (1.5–6). */
  duration: number;
  /** fullscreen | pip (talking-head in angolo) */
  layout: "fullscreen" | "pip";
}

export interface DirectorVerdict {
  editorialVerdict: string;
  hookStrengthScore: number;
  /** Tagli extra oltre i silenzi (false start, balbettii, retorica morta). */
  extraCuts: OpusCut[];
  /** Zoom ritmici (picchi, la pipeline li allarga a finestre). */
  zooms: OpusZoom[];
  /** Caption policy (già decisa in M1 — qui confermata/arricchita). */
  caption: { enabled: boolean; maxWords: number; keywords: string[] };
  /** Banner TOP content-aware (max 3, testo transcript-verbatim). */
  graphics: OpusGraphic[];
  /** B-roll Higgsfield (max 3, prompt pronti). */
  brolls: OpusBroll[];
  /** Concept cover (headline dal titolo, stile dal Vault). */
  cover: { headline: string; style: string };
  reason: string;
  vaultReference: string | null;
  /** true = deciso da Opus live; false = euristica locale (Opus irraggiungibile). */
  opusLive: boolean;
}

const STOP = new Set(
  "this,that,with,from,have,has,are,was,were,very,just,like,know,cosa,come,della,nella,sono,molto,molti,anche,quando,questo,questa,nella,perch,quindi,che,non,una,uno,con,per,una,del,al,della,nella,sul,sulla,nel,dei,delle,degli,della,and,the,for,you,your,with,are,was,our,out,all,can,had,her,was,one,our,this,that,them,then,than,into,over,after,before,while,when,what,where,which,who,whom,whose,will,would,there,their,they,them,been,being,have,has,had,having,does,did,doing".split(",")
);

function keywordsOf(text: string, max = 12): string[] {
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

/** Disfluenze reali dal transcript: ehm/ehh/balbettii/ripetizioni immediate. */
function findDisfluencies(words: Array<{ word: string; start: number; end: number }>): OpusCut[] {
  const out: OpusCut[] = [];
  const norm = words.map((w) => w.word.toLowerCase().replace(/[^a-zà-ÿ]/g, ""));
  for (let i = 0; i < words.length; i++) {
    const n = norm[i];
    // Filler puri: ehm, ehh, mhm, uhm…
    if (/^(eh+m*|uh+m*|mh+m+|eh|uh|em+)$/.test(n) && n.length >= 2) {
      out.push({ start: words[i].start, end: words[i].end, reason: `filler "${words[i].word}"` });
      continue;
    }
    // Parola-tronca con trattino (Posso-possono): tieni la seconda, taglia la prima.
    if (/-$/.test(words[i].word) && i + 1 < words.length) {
      out.push({ start: words[i].start, end: words[i].end, reason: `tronca "${words[i].word}"` });
      continue;
    }
    // Ripetizione immediata (sul tuo, sul tuo / Cloud, Cloud): bigramma
    // identico consecutivo → taglia la prima occorrenza del bigramma.
    if (i + 1 < words.length && n.length > 2 && norm[i + 1] === n) {
      out.push({ start: words[i].start, end: words[i].end, reason: `ripetizione "${words[i].word}"` });
      continue;
    }
    if (i + 3 < words.length && n.length > 2 && norm[i + 1].length > 2 && norm[i + 2] === n && norm[i + 3] === norm[i + 1]) {
      out.push({ start: words[i].start, end: words[i + 1].end, reason: `ripetizione "${words[i].word} ${words[i + 1].word}"` });
    }
  }
  return out.slice(0, 12);
}

/** Verdetto euristico locale (Opus irraggiungibile): prudente, mai inventato. */
export function heuristicVerdict(params: {
  transcriptText: string;
  words: Array<{ word: string; start: number; end: number }>;
  format: "short" | "long";
  duration: number;
  volt?: VoltMatch | null;
}): DirectorVerdict {
  const { transcriptText, words, format, duration, volt } = params;
  const kws = keywordsOf(transcriptText);
  // Zoom ritmici: cadenza dal Vault (stimulus) o 6s, mai sui primi 1.2s.
  let every = volt?.params.stimulusEverySec;
  if (!every || every <= 0) every = 6;
  every = Math.min(12, Math.max(4, every));
  const zooms: OpusZoom[] = [];
  for (let t = every / 2 + 1; t < duration - 1.5 && zooms.length < 5; t += every) {
    zooms.push({ at: Number(t.toFixed(2)), peak: 1.1, reason: `pacing ogni ~${every}s` });
  }
  // Graphic: UNA hook banner dai primi 8s (prime 4 parole di contenuto).
  const hookWords = transcriptText.split(/\s+/).filter((w) => w.replace(/[^a-zà-ÿA-ZÀ-Þ0-9]/g, "").length >= 4).slice(0, 4).join(" ");
  const graphics: OpusGraphic[] = hookWords
    ? [{ kind: "highlight", title: hookWords.slice(0, 60), tag: "HOOK", at: 0.8, duration: 3 }]
    : [];
  // B-roll: UNO al centro (come M1) se video ≥ 8s.
  const mid = Number((duration / 2).toFixed(2));
  const topic = kws.slice(0, 4).join(", ") || "creator talking to camera";
  const brolls: OpusBroll[] =
    duration >= 8
      ? [
          {
            topic,
            prompt: `cinematic photorealistic illustration of ${topic.slice(0, 120)}, warm cinematic light, high detail, no text, no watermark`,
            at: mid,
            duration: 3.5,
            layout: "fullscreen",
          },
        ]
      : [];
  return {
    editorialVerdict: "Euristica locale: ritmo prudente, hook banner, un B-roll centrale.",
    hookStrengthScore: 7,
    extraCuts: findDisfluencies(words),
    zooms,
    caption: { enabled: transcriptText.trim().split(/\s+/).length >= 8, maxWords: format === "short" ? 5 : 8, keywords: kws },
    graphics,
    brolls,
    cover: { headline: (kws[0] || "VIRAL EDIT").toUpperCase().slice(0, 24), style: volt?.niche || "creator" },
    reason: "euristica locale (Opus non raggiungibile)",
    vaultReference: volt ? volt.title : null,
    opusLive: false,
  };
}

function clampVerdict(v: Partial<DirectorVerdict>, fb: DirectorVerdict): DirectorVerdict {
  const num = (x: unknown, d: number) => (typeof x === "number" && Number.isFinite(x) ? x : d);
  const cleanCuts = Array.isArray(v.extraCuts)
    ? v.extraCuts
        .filter((c) => c && num(c.start, -1) >= 0 && num(c.end, -1) > num(c.start, -1) && c.end - c.start <= 4)
        .slice(0, 12)
        .map((c) => ({ start: Number(c.start.toFixed(2)), end: Number(c.end.toFixed(2)), reason: String(c.reason || "Opus cut").slice(0, 80) }))
    : fb.extraCuts;
  const cleanZooms = Array.isArray(v.zooms)
    ? v.zooms
        .filter((z) => z && num(z.at, -1) >= 1 && num(z.peak, 0) > 1.0 && num(z.peak, 0) <= 1.3)
        .slice(0, 8)
        .map((z) => ({ at: Number(z.at.toFixed(2)), peak: Number(Number(z.peak).toFixed(3)), reason: String(z.reason || "Opus zoom").slice(0, 80) }))
    : fb.zooms;
  const cleanGraphics = Array.isArray(v.graphics)
    ? v.graphics
        .filter((g) => g && typeof g.title === "string" && g.title.trim().length >= 2 && num(g.at, -1) >= 0 && num(g.duration, 0) >= 1)
        .slice(0, 3)
        .map((g) => ({
          kind: (["act_title", "number_stat", "highlight", "quote"] as const).includes(g.kind) ? g.kind : ("highlight" as const),
          title: String(g.title).slice(0, 80),
          subtitle: typeof g.subtitle === "string" ? g.subtitle.slice(0, 120) : undefined,
          tag: typeof g.tag === "string" ? g.tag.slice(0, 24).toUpperCase() : undefined,
          at: Number(Number(g.at).toFixed(2)),
          duration: Math.min(6, Math.max(1, Number(g.duration) || 3)),
        }))
    : fb.graphics;
  const cleanBrolls = Array.isArray(v.brolls)
    ? v.brolls
        .filter((b) => b && typeof b.prompt === "string" && b.prompt.trim().length >= 10 && num(b.at, -1) >= 1 && num(b.duration, 0) >= 1)
        .slice(0, 3)
        .map((b) => ({
          topic: String(b.topic || b.prompt).slice(0, 120),
          prompt: String(b.prompt).slice(0, 500),
          at: Number(Number(b.at).toFixed(2)),
          duration: Math.min(6, Math.max(1.5, Number(b.duration) || 3.5)),
          layout: b.layout === "pip" ? ("pip" as const) : ("fullscreen" as const),
        }))
    : fb.brolls;
  return {
    editorialVerdict: typeof v.editorialVerdict === "string" ? v.editorialVerdict.slice(0, 300) : fb.editorialVerdict,
    hookStrengthScore: Math.min(10, Math.max(1, num(v.hookStrengthScore, fb.hookStrengthScore))),
    extraCuts: cleanCuts,
    zooms: cleanZooms,
    caption:
      v.caption && typeof v.caption === "object"
        ? {
            enabled: v.caption.enabled !== false,
            maxWords: v.caption.maxWords === 5 || v.caption.maxWords === 8 ? v.caption.maxWords : fb.caption.maxWords,
            keywords:
              Array.isArray(v.caption.keywords) && v.caption.keywords.length > 0
                ? v.caption.keywords.map((k) => String(k).toLowerCase().replace(/[^a-zà-ÿ0-9']/g, "")).filter((k) => k.length >= 3).slice(0, 12)
                : fb.caption.keywords,
          }
        : fb.caption,
    graphics: cleanGraphics,
    brolls: cleanBrolls,
    cover:
      v.cover && typeof v.cover === "object"
        ? {
            headline: String(v.cover.headline || fb.cover.headline).slice(0, 28).toUpperCase(),
            style: String(v.cover.style || fb.cover.style).slice(0, 40),
          }
        : fb.cover,
    reason: typeof v.reason === "string" ? v.reason.slice(0, 160) : fb.reason,
    vaultReference: fb.vaultReference,
    opusLive: true,
  };
}

/**
 * Opus decide TUTTO. Input reale + Vault come riferimento.
 * Output: verdetto validato (clamp anti-invenzione). Fallback euristico.
 */
export async function directFullEdit(params: {
  transcriptText: string;
  words: Array<{ word: string; start: number; end: number }>;
  silences: Array<{ start: number; end: number }>;
  format: "short" | "long";
  duration: number;
  niche?: string | null;
  volt?: VoltMatch | null;
}): Promise<DirectorVerdict> {
  const { transcriptText, words, silences, format, duration, volt } = params;
  const fb = heuristicVerdict({ transcriptText, words, format, duration, volt });
  const apiKey = getSecret("anthropic");
  const text = (transcriptText || "").trim();
  if (!apiKey || text.length < 20 || words.length === 0) return fb;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45_000);
    let out = "";
    try {
      const timed = words
        .slice(0, 400)
        .map((w) => `[${w.start.toFixed(1)}]${w.word}`)
        .join(" ");
      const sil = silences
        .slice(0, 20)
        .map((s) => `${s.start.toFixed(1)}-${s.end.toFixed(1)}s`)
        .join(", ");
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || "claude-opus-4-20250514",
          max_tokens: 2000,
          system:
            "You are Claude Opus 5.5, Chief Video Editor and Retention Director. You decide the ENTIRE edit. " +
            "A RetentionVault reference (top-performer video) is provided — take inspiration from its hook tactic and pacing, but YOUR word is final law. " +
            "NEVER invent timestamps: use ONLY the timed words and silences provided. Graphic titles must be VERBATIM transcript words. " +
            "Reply with ONE JSON object only, no prose: {\"editorialVerdict\": str, \"hookStrengthScore\": 1-10, " +
            "\"extraCuts\": [{\"start\": s, \"end\": s, \"reason\": str}] (filler/false-starts/stutters ONLY, max 12), " +
            "\"zooms\": [{\"at\": s, \"peak\": 1.08-1.15, \"reason\": str}] (rhythm punches, max 8, never before 1s), " +
            "\"caption\": {\"enabled\": bool, \"maxWords\": 5|8, \"keywords\": [max 12 lowercase transcript words], }, " +
            "\"graphics\": [{\"kind\": \"act_title|number_stat|highlight|quote\", \"title\": verbatim, \"subtitle\"?: str, \"tag\"?: str, \"at\": s, \"duration\": 1-6}] (max 3, TOP banners), " +
            "\"brolls\": [{\"topic\": str, \"prompt\": \"cinematic photorealistic ..., no text, no watermark\", \"at\": s, \"duration\": 1.5-6, \"layout\": \"fullscreen|pip\"}] (max 3), " +
            "\"cover\": {\"headline\": \"max 4 words\", \"style\": str}, \"reason\": \"one short line\"}.",
          messages: [
            {
              role: "user",
              content:
                `VIDEO: format=${format}, duration=${duration.toFixed(1)}s, niche=${params.niche || "unknown"}\n` +
                (volt
                  ? `VAULT REFERENCE (inspiration, not law): "${volt.title}" by ${volt.creator} (retention ★${volt.retentionScore}, niche ${volt.niche}, hook: ${volt.hookTactic || "n/a"}, pacing: ${volt.bodyPacing || "n/a"}, stimulus every ${volt.params.stimulusEverySec ?? "?"}s, punch zooms ${volt.params.punchZooms ?? "?"})\n`
                  : "VAULT REFERENCE: none — decide from the footage alone.\n") +
                `TIMED WORDS (source seconds): ${timed.slice(0, 6000)}\n` +
                `REAL SILENCES: ${sil || "none"}\nDecide the full edit:`,
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
      const parsed = JSON.parse(m[0]) as Partial<DirectorVerdict>;
      return clampVerdict(parsed, fb);
    }
  } catch {
    // fallback sotto — mai bloccare la consegna
  }
  return fb;
}
