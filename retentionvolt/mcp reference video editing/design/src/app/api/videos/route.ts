import { NextRequest, NextResponse } from 'next/server';
import { videoDbService } from '@/services/db';
import { createClient } from '@supabase/supabase-js';
import { rateLimit } from '@/lib/rateLimit';
import { getLiveUserPlan } from '@/lib/mcpKeys';

export const dynamic = 'force-dynamic';

// Verify Pro by checking real Supabase session — never trust client headers
async function isProRequest(req: NextRequest): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return false;

  // Try Authorization: Bearer <supabase JWT>
  const authHeader = req.headers.get('authorization') || '';
  let token = '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    token = authHeader.replace(/^bearer\s+/i, '').trim();
  }
  // Also accept x-supabase-token for explicit JWT
  if (!token) token = req.headers.get('x-supabase-token')?.trim() || '';

  if (!token || !token.startsWith('eyJ')) return false;

  try {
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return false;
    const live = await getLiveUserPlan(data.user.id);
    return live.plan === 'pro';
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const limited = rateLimit(req, { limit: 60, windowMs: 60_000 });
    if (limited) return limited;
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || undefined;
    const niche = searchParams.get('niche') || undefined;
    const format = (searchParams.get('format') as any) || undefined;
    const query = searchParams.get('q') || undefined;

    const proCaller = await isProRequest(req);

    const videos = await videoDbService.searchVideos({
      category,
      niche,
      format,
      query
    });

    // Pro: full data
    if (proCaller) {
      return NextResponse.json(videos, {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-cache',
          'Vary': 'Authorization, X-Supabase-Token',
        }
      });
    }

    // Free / public: first 4 unlocked, rest masked (gating preserved without breaking UX)
    const gatedVideos = videos.map((v, idx) => {
      if (idx < 4) {
        return { ...v, isLocked: false };
      }
      return {
        ...v,
        isLocked: true,
        cuts: [],
        shots: [],
        transcriptText: undefined,
        transcriptRaw: undefined,
        editingAdvice: {
          hookTactic: '\uD83D\uDD12 Pro Subscribers Only: Upgrade to view hook tactic formula.',
          bodyPacing: '\uD83D\uDD12 Pro Subscribers Only: Upgrade to view pacing breakdown.',
          soundDesign: '\uD83D\uDD12 Pro Subscribers Only: Upgrade to view sound design register.',
          motionStyle: '\uD83D\uDD12 Pro Subscribers Only: Upgrade to view motion graphic styling.'
        },
        thumbnailAnalysis: v.thumbnailAnalysis ? {
          ...v.thumbnailAnalysis,
          aiPromptBlueprint: '\uD83D\uDD12 Pro Subscribers Only: Upgrade to view Midjourney/Flux generation blueprint.'
        } : undefined
      };
    });

    return NextResponse.json(gatedVideos, {
      status: 200,
      headers: {
        'Cache-Control': 'private, no-store',
        'Vary': 'Authorization, X-Supabase-Token',
      }
    });
  } catch (error: any) {
    console.error('Error fetching videos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch videos from database' },
      { status: 500 }
    );
  }
}
