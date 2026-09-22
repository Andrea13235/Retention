import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { rateLimit } from '@/lib/rateLimit';

/**
 * PATCH /api/account/profile — update display name + email.
 * Email change uses Supabase confirmation flow (both addresses) — never
 * silent. `plan` and other billing fields are rejected here.
 */
export async function PATCH(req: NextRequest) {
  const limited = rateLimit(req, { limit: 15, windowMs: 60_000 });
  if (limited) return limited;
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Auth service unavailable' }, { status: 500 });
  }

  const auth = req.headers.get('authorization') || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let userId: string;
  let currentEmail: string | undefined;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    userId = data.user.id;
    currentEmail = data.user.email;
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : null;
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : null;

  const metadataPatch: Record<string, unknown> = {};
  if (name) {
    metadataPatch.name = name;
    metadataPatch.full_name = name;
  }

  try {
    const { data: current } = await supabaseAdmin.auth.admin.getUserById(userId);
    const meta = (current?.user?.user_metadata || {}) as Record<string, unknown>;
    if (Object.keys(metadataPatch).length > 0) {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { ...meta, ...metadataPatch, updated_at: new Date().toISOString() },
      });
    }

    let emailChangePending = false;
    if (email && email !== (currentEmail || '').toLowerCase()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
      }
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseAnonKey) {
        const { createClient } = await import('@supabase/supabase-js');
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { error: emailErr } = await userClient.auth.updateUser({ email });
        if (emailErr) {
          return NextResponse.json({ error: emailErr.message }, { status: 400 });
        }
        emailChangePending = true;
      }
    }

    return NextResponse.json({ ok: true, emailChangePending });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
