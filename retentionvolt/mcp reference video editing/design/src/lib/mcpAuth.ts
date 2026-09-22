import { NextRequest } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { verifyMcpKeyHash, getLiveUserPlan, matchesMasterKey } from '@/lib/mcpKeys';

export interface McpAuthResult {
  isAuthorized: boolean;
  userId?: string;
  userEmail?: string;
  plan: 'free' | 'pro' | 'unauthenticated';
  errorMessage?: string;
}

/**
 * Validates MCP request — strict, no demo bypass in production.
 * Accepts:
 *  1. Master server key (MCP_API_KEY) — for internal/admin use only
 *  2. Hashed Pro API keys (rv_live_...; legacy rb_live_... still accepted) — verified against mcp_api_keys table by hash,
 *     then the owner's LIVE plan is checked in Supabase (revoked/canceled users denied)
 *  3. Supabase JWT (eyJ...) — verifies session + plan via Supabase
 */
export async function verifyMcpAuth(req: NextRequest): Promise<McpAuthResult> {
  const authHeader = req.headers.get('authorization') || '';
  const xApiKey = req.headers.get('x-mcp-api-key') || '';

  let rawToken = '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    rawToken = authHeader.replace(/^bearer\s+/i, '').trim();
  } else if (authHeader) {
    rawToken = authHeader.trim();
  } else if (xApiKey) {
    rawToken = xApiKey.trim();
  }

  if (!rawToken) {
    return {
      isAuthorized: false,
      plan: 'unauthenticated',
      errorMessage: 'No authentication token provided. Retentionvolt CyberMCP requires an active Pro subscription key.',
    };
  }

  // 1. Master server key — constant-time compare, only if configured
  if (matchesMasterKey(rawToken)) {
    return {
      isAuthorized: true,
      userId: 'admin_master',
      userEmail: 'admin@retentionvolt.com',
      plan: 'pro',
    };
  }

  // 2. Explicit Free tier prefix — always denied (rv_ current, rb_ legacy pre-rebrand)
  if (
    rawToken.startsWith('rv_live_free_') || rawToken.startsWith('rv_free_') ||
    rawToken.startsWith('rb_live_free_') || rawToken.startsWith('rb_free_')
  ) {
    return {
      isAuthorized: false,
      plan: 'free',
      errorMessage: 'Your account is on the Free tier. MCP server access requires an active Pro subscription ($12/mo or $6/mo annual with 7-day free trial).',
    };
  }

  // 3. Pro API key (rv_live_... or legacy rv_live_pro_...; pre-rebrand rb_live_/rb_pro_ keys still accepted): verify hash in DB,
  //    then check the owner's LIVE plan. Never authorize on lookup failure.
  if (
    rawToken.startsWith('rv_live_') || rawToken.startsWith('rv_pro_') ||
    rawToken.startsWith('rb_live_') || rawToken.startsWith('rb_pro_')
  ) {
    if (!isSupabaseConfigured || !supabaseAdmin) {
      return {
        isAuthorized: false,
        plan: 'unauthenticated',
        errorMessage: 'MCP authentication service unavailable. Please contact support.',
      };
    }
    try {
      const keyCheck = await verifyMcpKeyHash(rawToken);
      if (!keyCheck.valid || !keyCheck.userId) {
        return {
          isAuthorized: false,
          plan: 'unauthenticated',
          errorMessage: 'Invalid or revoked API key. Generate a new key from Settings > MCP.',
        };
      }
      const live = await getLiveUserPlan(keyCheck.userId);
      const isPro = live.plan === 'pro';
      return {
        isAuthorized: isPro,
        userId: keyCheck.userId,
        userEmail: live.email,
        plan: isPro ? 'pro' : 'free',
        errorMessage: isPro
          ? undefined
          : 'Your subscription is no longer active. Renew Pro to restore MCP server access.',
      };
    } catch (err) {
      console.warn('[MCP Auth] Error verifying Pro key:', err);
      return {
        isAuthorized: false,
        plan: 'unauthenticated',
        errorMessage: 'Could not verify Pro API key. Please try again or regenerate your key.',
      };
    }
  }

  // 4. Supabase JWT Session Token (eyJ...)
  if (rawToken.startsWith('eyJ') && isSupabaseConfigured) {
    try {
      const client = supabaseAdmin;
      if (client) {
        const { data, error } = await client.auth.getUser(rawToken);
        if (!error && data?.user) {
          const live = await getLiveUserPlan(data.user.id);
          const isPro = live.plan === 'pro';
          return {
            isAuthorized: isPro,
            userId: data.user.id,
            userEmail: data.user.email,
            plan: isPro ? 'pro' : 'free',
            errorMessage: isPro
              ? undefined
              : 'Account is on Free tier. Pro subscription is required to use the CyberMCP server.',
          };
        }
      }
    } catch (err) {
      console.warn('[MCP Auth] JWT verification failed:', err);
    }
    return {
      isAuthorized: false,
      plan: 'unauthenticated',
      errorMessage: 'Invalid or expired session token. Please sign in again.',
    };
  }

  // Unknown / invalid key — always deny
  return {
    isAuthorized: false,
    plan: 'unauthenticated',
    errorMessage: 'Invalid API key or token provided. Please generate a Pro API key from Settings > MCP or upgrade at https://retentionvolt.com/pricing.',
  };
}
