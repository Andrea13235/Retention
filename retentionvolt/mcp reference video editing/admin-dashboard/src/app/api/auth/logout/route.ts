import { NextResponse } from 'next/server';

export async function POST() {
  const isProd = process.env.NODE_ENV === 'production';
  const response = NextResponse.json({ ok: true });
  response.cookies.set('admin_token', '', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });
  return response;
}
