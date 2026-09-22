import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { rateLimit } from '@/lib/rateLimit';

/**
 * POST /api/track/visit — first-party site-visit counter (privacy-first).
 *
 * Body: { vid: string (anonymous visitor id, 32 hex chars), path?: string }
 *
 * Rules (un concetto = un nome solo):
 *  - "visita sito" = UNA riga per visitatore per giorno (unique guard).
 *  - MAI salvati in chiaro: né il vid, né l'IP. Salvato solo
 *    visitor_hash = sha256(vid + ':' + YYYY-MM-DD) — non reversibile,
 *    non collegabile tra giorni diversi.
 *  - Consenso analytics ON è verificato DAL CLIENT prima di chiamare
 *    (cookie rv_consent). Questa route NON imposta cookie di tracking:
 *    il vid vive in localStorage e lo genera il client.
 *  - Bot esclusi via user-agent. Rate limit 10/min per IP.
 *  - Fail-loud: se la tabella manca (migration 002 non lanciata) → 503
 *    con messaggio esatto, mai silent success.
 */

const VID_RE = /^[0-9a-f]{32}$/i;

// Bot/crawler: mai contarli come "visite sito" (gonfierebbero il funnel).
const BOT_RE =
  /bot|crawl|spider|slurp|mediapartners|baidu|yandex|sogou|exabot|facebot|ia_archiver|semrush|ahrefs|mj12bot|dotbot|petalbot|bytespider|gptbot|ccbot|anthropic-ai|claudebot|perplexitybot|googleother/i;

function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  const ua = req.headers.get('user-agent') || '';
  if (BOT_RE.test(ua)) {
    return NextResponse.json({ ok: true, skipped: 'bot' });
  }

  const body = await req.json().catch(() => ({}));
  const vid = typeof body.vid === 'string' ? body.vid.trim() : '';
  if (!VID_RE.test(vid)) {
    return NextResponse.json(
      { error: 'Invalid visitor id: expected 32 hex chars' },
      { status: 400 }
    );
  }
  const path =
    typeof body.path === 'string' ? body.path.trim().slice(0, 200) || '/' : '/';

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Visit tracking unavailable: SUPABASE_SERVICE_ROLE_KEY missing' },
      { status: 503 }
    );
  }

  const day = todayKey();
  const visitor_hash = createHash('sha256')
    .update(`${vid.toLowerCase()}:${day}`)
    .digest('hex');

  try {
    // Upsert: stessa coppia (hash, giorno) = nessuna doppia riga.
    const { error } = await supabaseAdmin.from('site_visits').upsert(
      { visitor_hash, visited_on: day, path },
      { onConflict: 'visitor_hash,visited_on', ignoreDuplicates: true }
    );
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error('[Track Visit] Error recording visit:', err);
    const msg = err instanceof Error ? err.message : '';
    const missing = /relation|does not exist|table|column/i.test(msg);
    return NextResponse.json(
      {
        error: missing
          ? 'Visit tracking is being provisioned — run supabase/migrations/002_site_visits.sql in Supabase SQL Editor'
          : 'Unable to record visit.',
      },
      { status: 503 }
    );
  }
}
