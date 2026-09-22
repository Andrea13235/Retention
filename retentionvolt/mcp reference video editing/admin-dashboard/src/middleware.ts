import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSessionToken } from '@/lib/auth';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout'];

async function verifyAdminToken(token: string | undefined, secret: string): Promise<boolean> {
  return verifyAdminSessionToken(token, secret);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    console.error('[Admin Middleware] ADMIN_SECRET not configured — blocking all admin access');
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Admin configuration error' }, { status: 500 });
    }
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  const adminToken = req.cookies.get('admin_token')?.value;
  const isValid = await verifyAdminToken(adminToken, adminSecret);

  if (!isValid) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized: Admin session required' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirect', pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|css|js)$).*)'],
};
