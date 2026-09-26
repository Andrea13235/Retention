import { NextResponse } from "next/server";

/** POST /api/auth/logout — clears the local session flag (Supabase clears its own cookies). */
export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set("retentionedit_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return res;
}
