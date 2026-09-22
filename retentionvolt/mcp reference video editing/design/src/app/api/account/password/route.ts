import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { rateLimit } from '@/lib/rateLimit';

/**
 * POST /api/account/password — change password.
 * Verifies the current password via sign-in first (prevents session-hijack
 * password resets), then updates via admin API.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { limit: 10, windowMs: 60_000 });
  if (limited) return limited;
  if (!supabaseAdmin || !isSupabaseConfigured) {
    return NextResponse.json({ error: 'Auth service unavailable' }, { status: 500 });
  }

  const auth = req.headers.get('authorization') || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (newPassword.length < 8 || newPassword.length > 128) {
    return NextResponse.json({ error: 'New password must be between 8 and 128 characters' }, { status: 400 });
  }
  if (currentPassword.length > 128) {
    return NextResponse.json({ error: 'Current password exceeds maximum length' }, { status: 400 });
  }

  let userId: string;
  let email: string;
  let appMeta: Record<string, unknown> = {};
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user || !data.user.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    userId = data.user.id;
    email = data.user.email;
    appMeta = (data.user.app_metadata || {}) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const provider = (appMeta.provider as string) || 'email';
  const providers: string[] = Array.isArray(appMeta.providers) ? (appMeta.providers as string[]) : [provider];
  const isEmailAccount = providers.includes('email') || provider === 'email';

  // Create isolated client to verify password without mutating global singleton state
  const verifyClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  if (isEmailAccount) {
    if (!currentPassword) {
      return NextResponse.json(
        { error: 'Current password is required to change password' },
        { status: 400 }
      );
    }
    const { error: signInErr } = await verifyClient.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (signInErr) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 403 });
    }
  } else {
    // Pure OAuth account (e.g. Google-only) setting an initial password
    if (currentPassword) {
      const { error: signInErr } = await verifyClient.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (signInErr) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 403 });
      }
    }
  }

  try {
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Password change failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
