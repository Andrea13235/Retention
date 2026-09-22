import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateMcpKey, hashMcpKey, getLiveUserPlan } from '@/lib/mcpKeys';
import { rateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_KEYS_PER_USER = 5;

/** Authenticate via Supabase JWT (Authorization: Bearer eyJ...). Returns user or null. */
async function getAuthUser(req: NextRequest) {
  if (!supabaseAdmin) return null;
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.replace(/^bearer\s+/i, '').trim()
    : '';
  if (!token || !token.startsWith('eyJ')) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

function sanitizeKeyRow(row: any) {
  return {
    id: row.id,
    prefix: row.key_prefix,
    name: row.name,
    isActive: row.is_active,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
  };
}

/** GET /api/mcp/keys — list own keys (prefixes only, never hashes). */
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { limit: 30, windowMs: 60_000 });
  if (limited) return limited;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('mcp_api_keys')
    .select('id, key_prefix, name, is_active, last_used_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    // Table missing (migration not run yet) -> empty list with hint
    if (error.code === '42P01') {
      return NextResponse.json({ keys: [], migrationMissing: true });
    }
    console.error('[MCP Keys] List error:', error.message);
    return NextResponse.json({ error: 'Failed to list keys' }, { status: 500 });
  }
  return NextResponse.json({ keys: (data || []).map(sanitizeKeyRow) });
}

/** POST /api/mcp/keys — create a new key (Pro only). Returns full key ONCE. */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { limit: 10, windowMs: 60_000 });
  if (limited) return limited;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const live = await getLiveUserPlan(user.id);
  if (live.plan !== 'pro') {
    return NextResponse.json(
      { error: 'MCP API keys require an active Pro subscription.' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' && body.name.trim()
    ? body.name.trim().slice(0, 60)
    : 'Default key';

  // Enforce key cap with optional auto-rotation for seamless agent connections
  const { count } = await supabaseAdmin
    .from('mcp_api_keys')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_active', true);
  if ((count || 0) >= MAX_KEYS_PER_USER) {
    if (body.autoRotate) {
      const { data: oldest } = await supabaseAdmin
        .from('mcp_api_keys')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (oldest?.id) {
        await supabaseAdmin
          .from('mcp_api_keys')
          .update({ is_active: false })
          .eq('id', oldest.id);
      }
    } else {
      return NextResponse.json(
        { error: `Key limit reached (${MAX_KEYS_PER_USER} active keys). Revoke one first.` },
        { status: 400 }
      );
    }
  }

  const fullKey = generateMcpKey();
  const { data, error } = await supabaseAdmin
    .from('mcp_api_keys')
    .insert({
      user_id: user.id,
      key_prefix: fullKey.slice(0, 12),
      key_hash: hashMcpKey(fullKey),
      name,
      is_active: true,
    })
    .select('id, key_prefix, name, is_active, last_used_at, created_at')
    .single();

  if (error) {
    if (error.code === '42P01') {
      return NextResponse.json(
        { error: 'Server tables not ready yet. Please contact support.', migrationMissing: true },
        { status: 500 }
      );
    }
    console.error('[MCP Keys] Create error:', error.message);
    return NextResponse.json({ error: 'Failed to create key' }, { status: 500 });
  }

  // Full key returned ONCE — never stored, never retrievable again
  return NextResponse.json({ key: fullKey, record: sanitizeKeyRow(data) }, { status: 201 });
}

/** DELETE /api/mcp/keys — revoke own key (id in body). */
export async function DELETE(req: NextRequest) {
  const limited = rateLimit(req, { limit: 20, windowMs: 60_000 });
  if (limited) return limited;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
  }
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const keyId = body.id;
  if (!keyId || typeof keyId !== 'string') {
    return NextResponse.json({ error: 'Missing key id' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('mcp_api_keys')
    .update({ is_active: false })
    .eq('id', keyId)
    .eq('user_id', user.id)
    .select('id');

  if (error) {
    console.error('[MCP Keys] Revoke error:', error.message);
    return NextResponse.json({ error: 'Failed to revoke key' }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  }
  return NextResponse.json({ revoked: true });
}
