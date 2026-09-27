import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/server-auth";

/** POST /api/auth/logout — clears the local session flag (Supabase clears its own cookies). */
export async function POST() {
  const res = NextResponse.json({ success: true });
  clearSessionCookie(res);
  return res;
}
