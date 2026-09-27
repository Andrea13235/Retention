/**
 * RetentionEdit — Real RetentionVolt client M4 (SERVER ONLY).
 *
 * Queries the creator's own RetentionVolt Supabase (`videos`: 85 analyzed
 * top-performers) for the closest reference match by niche + format.
 * NEVER decides cuts — returns QUANTITATIVE pacing parameters (zoom cadence,
 * WPM target, hook duration, max hold) that the local engine anchors to the
 * user's REAL words/timeline.
 *
 * Credentials: RETENTIONVOLT_URL + RETENTIONVOLT_ANON_KEY (env or vault
 * processed separately). No key = graceful null (caller falls back local).
 * Cost per request: ~0 (own Postgres, few KB). Latency: ~100-300ms.
 */
import { getSecret } from "./vault-store";

export interface VoltMatch {
  videoId: string;
  title: string;
  creator: string;
  youtubeUrl: string | null;
  thumbnailUrl: string | null;
  niche: string;
  format: string;
  retentionScore: number;
  views: number | string | null;
  /** Quantitative pacing recipe extracted from the reference analysis. */
  params: {
    wordsPerMinute: number | null;
    deadAirPct: number | null;
    hookSec: number | null;
    cameraSwitches: number | null;
    punchZooms: number | null;
    slowPushIns: number | null;
    stimulusEverySec: number | null;
    maxHoldSec: number | null;
  };
  hookTactic: string | null;
  bodyPacing: string | null;
  motionStyle: string | null;
}

interface VoltVideoRow {
  id: string;
  title: string;
  creator_id: string;
  youtube_url: string | null;
  thumbnail_url: string | null;
  niche: string;
  format: string;
  retention_score: number;
  views: number | null;
  words_per_minute: number | null;
  dead_air_percentage: number | null;
  hook_duration_sec: number | null;
  camera_switches_count: number | null;
  punch_zooms_count: number | null;
  slow_push_ins_count: number | null;
  visual_stimulus_interval_sec: number | null;
  max_static_hold_sec: number | null;
  duration_seconds: number | null;
  editing_advice: Record<string, string> | null;
}

const RV_TIMEOUT_MS = 12_000;

function rvConfig(): { url: string; key: string } | null {
  // Dedicated env first, vault provider `retentionvolt` when configured.
  const url = (process.env.RETENTIONVOLT_URL || "").trim().replace(/\/+$/, "");
  let key = (process.env.RETENTIONVOLT_ANON_KEY || "").trim();
  if (!key) {
    try {
      const v = getSecret("retentionvolt" as never);
      if (v) key = v;
    } catch {}
  }
  if (!url || !key) return null;
  return { url, key };
}

/** Map retentionedit format → RetentionVolt format values. */
function toVoltFormat(format: "short" | "long"): string {
  return format === "short" ? "shorts" : "long_form";
}

/**
 * Infer niche from real transcript text (keyword heuristic, local, free).
 * Returns null when nothing matches (caller uses unfiltered search).
 */
export function inferNiche(text: string): string | null {
  const t = (text || "").toLowerCase();
  if (!t || t.length < 20) return null;
  const rules: Array<[string, RegExp]> = [
    ["tech", /(software|app|phone|computer|ai\b|code|coding|startup|gadget)/],
    ["podcast", /(welcome to|today we have|my guest|episode|podcast)/],
    ["finance", /(money|invest|stock|budget|rich|wealth|debt|crypto)/],
    ["fitness", /(workout|muscle|gym|diet|protein|cardio|training)/],
    ["productivity", /(productivity|habit|routine|focus|notion|planner|goal)/],
    ["science", /(science|study|research|experiment|physics|brain)/],
    ["storytelling", /(story|once upon|journey|adventure|mystery)/],
    ["entertainment", /(challenge|prank|funny|react|vlog|game)/],
    ["education", /(learn|tutorial|how to|step by step|course|lesson)/],
    ["filmmaking", /(camera|cinematic|film|edit|lens|footage|b-roll)/],
    ["motivation", /(motivat|discipline|mindset|success|grind|dream)/],
  ];
  for (const [niche, re] of rules) {
    if (re.test(t)) return niche;
  }
  return null;
}

/**
 * Find the best reference video. Returns null on any failure
 * (no creds, network, empty DB) — caller MUST fall back silently.
 */
export async function findVoltMatch(params: {
  format: "short" | "long";
  transcriptText: string;
  niche?: string | null;
  topK?: number;
}): Promise<VoltMatch | null> {
  const cfg = rvConfig();
  if (!cfg) return null;
  try {
    const voltFormat = toVoltFormat(params.format);
    const niche = params.niche || inferNiche(params.transcriptText);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RV_TIMEOUT_MS);
    try {
      let query =
        `${cfg.url}/rest/v1/videos?` +
        `select=${encodeURIComponent("id,title,creator_id,youtube_url,thumbnail_url,niche,format,retention_score,views,words_per_minute,dead_air_percentage,hook_duration_sec,camera_switches_count,punch_zooms_count,slow_push_ins_count,visual_stimulus_interval_sec,max_static_hold_sec,duration_seconds,editing_advice")}` +
        `&format=eq.${encodeURIComponent(voltFormat)}` +
        `&order=retention_score.desc&limit=${Math.min(10, Math.max(1, params.topK ?? 3))}`;
      if (niche) query += `&niche=eq.${encodeURIComponent(niche)}`;
      let res = await fetch(query, {
        headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
        signal: controller.signal,
      });
      let rows = (res.ok ? await res.json().catch(() => []) : []) as VoltVideoRow[];
      // Fallback: same format, any niche (cross-niche pacing still applies).
      if ((!rows || rows.length === 0) && niche) {
        const q2 =
          `${cfg.url}/rest/v1/videos?` +
          `select=${encodeURIComponent("id,title,creator_id,youtube_url,thumbnail_url,niche,format,retention_score,views,words_per_minute,dead_air_percentage,hook_duration_sec,camera_switches_count,punch_zooms_count,slow_push_ins_count,visual_stimulus_interval_sec,max_static_hold_sec,duration_seconds,editing_advice")}` +
          `&format=eq.${encodeURIComponent(voltFormat)}` +
          `&order=retention_score.desc&limit=3`;
        res = await fetch(q2, {
          headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
          signal: controller.signal,
        });
        rows = (res.ok ? await res.json().catch(() => []) : []) as VoltVideoRow[];
      }
      if (!rows || rows.length === 0) return null;
      const best = rows[0];
      const creator = await resolveCreatorName(cfg, best.creator_id).catch(() => "Top creator");
      const adv = best.editing_advice || {};
      return {
        videoId: best.id,
        title: best.title || "Untitled reference",
        creator,
        youtubeUrl: best.youtube_url,
        thumbnailUrl: best.thumbnail_url,
        niche: best.niche,
        format: best.format,
        retentionScore: Number(best.retention_score ?? 0),
        views: best.views,
        params: {
          wordsPerMinute: best.words_per_minute,
          deadAirPct: best.dead_air_percentage,
          hookSec: best.hook_duration_sec,
          cameraSwitches: best.camera_switches_count,
          punchZooms: best.punch_zooms_count,
          slowPushIns: best.slow_push_ins_count,
          stimulusEverySec: best.visual_stimulus_interval_sec,
          maxHoldSec: best.max_static_hold_sec,
        },
        hookTactic: adv.hookTactic || null,
        bodyPacing: adv.bodyPacing || null,
        motionStyle: adv.motionStyle || null,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

const creatorCache = new Map<string, string>();

async function resolveCreatorName(cfg: { url: string; key: string }, creatorId: string): Promise<string> {
  if (!creatorId) return "Top creator";
  const cached = creatorCache.get(creatorId);
  if (cached) return cached;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6_000);
  try {
    const res = await fetch(
      `${cfg.url}/rest/v1/creators?select=name&id=eq.${encodeURIComponent(creatorId)}&limit=1`,
      { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` }, signal: controller.signal }
    );
    if (!res.ok) return "Top creator";
    const rows = (await res.json().catch(() => [])) as Array<{ name?: string }>;
    const name = rows?.[0]?.name || "Top creator";
    creatorCache.set(creatorId, name);
    return name;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Translate a VoltMatch into EXTRA zoom windows on the final timeline.
 * Rule: only ADDS motion where the local engine found none (single-take
 * stretches) — never overrides real scene zooms, never near our own cuts.
 * Uses punchZooms cadence: stimulusEverySec or zooms/duration ratio.
 */
export function voltZoomsFromMatch(
  match: VoltMatch,
  finalDuration: number,
  existingZooms: Array<{ finalStart: number; finalEnd: number }>,
  keep: Array<{ start: number; end: number }>
): Array<{ finalStart: number; finalEnd: number; peak: number }> {
  if (!match || finalDuration < 6) return [];
  // Cadence: prefer stimulus interval, else derive from punch count.
  let every = match.params.stimulusEverySec;
  if (!every || every <= 0) {
    const pz = match.params.punchZooms ?? 0;
    every = pz > 0 && finalDuration > 0 ? Math.max(4, finalDuration / (pz + 1)) : 8;
  }
  every = Math.min(12, Math.max(5, every));
  const maxHold = match.params.maxHoldSec ?? 2.5;
  void maxHold;
  const out: Array<{ finalStart: number; finalEnd: number; peak: number }> = [];
  // Candidate anchors every `every` seconds, offset by half-step (mid-hold).
  for (let t = every / 2; t < finalDuration - 1.5; t += every) {
    // Skip if within 2.5s of an existing zoom (real scene wins).
    const clash = existingZooms.some((z) => Math.abs(z.finalStart - t) < 3.0);
    if (clash) continue;
    // Skip if within 0.8s before / 2s after a keep boundary (our own cuts).
    let nearCut = false;
    for (const k of keep) {
      if (Math.abs(k.start - t) < 2.0 && k.start > 0.3) {
        nearCut = true;
        break;
      }
    }
    if (nearCut) continue;
    out.push({ finalStart: Number(t.toFixed(2)), finalEnd: Number(Math.min(finalDuration, t + 2.2).toFixed(2)), peak: 1.1 });
    if (out.length >= 4) break; // guard: max 4 volt zooms per video
  }
  return out;
}
