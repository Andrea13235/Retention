import { NextRequest, NextResponse } from 'next/server';
import {
  verifyPasswordConstantTime,
  createAdminSessionToken,
  checkLoginRateLimit,
} from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || '127.0.0.1';
    const rateCheck = checkLoginRateLimit(ip, 5, 60_000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Troppi tentativi errati. Riprova tra ${rateCheck.retryAfterSec || 60} secondi.` },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfterSec || 60) } }
      );
    }

    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
      console.error('[Admin Login] ADMIN_SECRET not configured');
      return NextResponse.json({ error: 'Admin non configurato. Imposta ADMIN_SECRET su Vercel.' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!password || password.length > 512) {
      return NextResponse.json({ error: 'Password errata' }, { status: 401 });
    }
    const isValid = await verifyPasswordConstantTime(password, adminSecret);

    if (!isValid) {
      // Artificial delay to mitigate timing & brute force
      await new Promise(r => setTimeout(r, 800));
      return NextResponse.json({ error: 'Password errata' }, { status: 401 });
    }

    const isProd = process.env.NODE_ENV === 'production';
    const sessionToken = await createAdminSessionToken(adminSecret);
    const response = NextResponse.json({ ok: true });
    response.cookies.set('admin_token', sessionToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
