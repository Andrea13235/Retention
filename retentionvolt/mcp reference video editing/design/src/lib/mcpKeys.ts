import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';

export const MCP_KEY_PREFIX = 'rv_live_';
/** Legacy pre-rebrand prefix — keys issued before the rename keep working. */
export const MCP_KEY_PREFIX_LEGACY = 'rb_live_';
const HASH_ALGO = 'sha256';

/** SHA-256 hex of the full key — what we store. Plaintext is never persisted. */
export function hashMcpKey(fullKey: string): string {
  return createHash(HASH_ALGO).update(fullKey, 'utf8').digest('hex');
}

/** Generate a new random key: rv_live_<32 hex chars>. */
export function generateMcpKey(): string {
  return `${MCP_KEY_PREFIX}${randomBytes(16).toString('hex')}`;
}

function safeEqual(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

export interface McpKeyRecord {
  id: string;
  user_id: string;
  key_prefix: string;
  name: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

interface VerifyKeyResult {
  valid: boolean;
  userId?: string;
  keyId?: string;
}

/**
 * Verify a presented rv_live_ key (or legacy pre-rebrand rb_live_ key) against the DB hash.
 * Returns the owning userId only for active keys. Never throws — fail closed.
 */
export async function verifyMcpKeyHash(presentedKey: string): Promise<VerifyKeyResult> {
  if (!supabaseAdmin) return { valid: false };
  const isCurrent = (presentedKey.startsWith('rv_live_') || presentedKey.startsWith('rv_pro_')) && presentedKey.length >= 16;
  const isLegacy = (presentedKey.startsWith('rb_live_') || presentedKey.startsWith('rb_pro_')) && presentedKey.length >= 16;
  if (!isCurrent && !isLegacy) {
    return { valid: false };
  }
  const keyHash = hashMcpKey(presentedKey);
  try {
    const { data, error } = await supabaseAdmin
      .from('mcp_api_keys')
      .select('id, user_id, is_active, key_hash')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .maybeSingle();
    if (error || !data || !safeEqual(data.key_hash, keyHash)) return { valid: false };
    // Touch last_used_at best-effort (don't block auth on it)
    void (async () => {
      try {
        await supabaseAdmin!
          .from('mcp_api_keys')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', data.id);
      } catch {
        /* best-effort only */
      }
    })();
    return { valid: true, userId: data.user_id, keyId: data.id };
  } catch {
    return { valid: false };
  }
}

/** Get the live plan for a user. Prioritizes server-controlled app_metadata and user_metadata/Stripe sync. Defaults to 'free'. */
export async function getLiveUserPlan(
  userId: string
): Promise<{ plan: 'free' | 'pro'; email?: string; status?: string }> {
  if (!supabaseAdmin) return { plan: 'free' };
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error || !data?.user) return { plan: 'free' };
    const appMeta = (data.user.app_metadata || {}) as Record<string, unknown>;
    const userMeta = (data.user.user_metadata || {}) as Record<string, unknown>;

    const isAdmin = appMeta.role === 'admin' || userMeta.role === 'admin';
    const status = (appMeta.subscription_status as string) || (userMeta.subscription_status as string) || 'active';

    // 1. Check Pro status from server app_metadata, user_metadata, or admin role
    const isMarkedPro = appMeta.plan === 'pro' || userMeta.plan === 'pro' || userMeta.is_pro === true || isAdmin;

    if (isMarkedPro) {
      // Check if subscription was explicitly cancelled (unless admin)
      if (!isAdmin && ['canceled', 'incomplete_expired', 'incomplete', 'unpaid'].includes(status)) {
        return { plan: 'free', email: data.user.email, status };
      }

      // Auto-heal / promote into app_metadata so both metadata remain consistently synced
      if (appMeta.plan !== 'pro') {
        try {
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            app_metadata: { ...appMeta, plan: 'pro', subscription_status: status },
          });
        } catch {
          /* best-effort heal */
        }
      }

      return {
        plan: 'pro',
        email: data.user.email,
        status,
      };
    }

    // 2. Cross-check Stripe live subscriptions if customer exists or by email
    try {
      const { getStripe, findActiveSubscription, findStripeCustomer, resolveBillingUser } = await import('@/lib/stripeServer');
      const stripe = getStripe();
      if (stripe) {
        let customerId = (appMeta.stripe_customer_id || userMeta.stripe_customer_id) as string | undefined;
        if (!customerId) {
          const billingUser = await resolveBillingUser(userId);
          if (billingUser) {
            customerId = (await findStripeCustomer(stripe, billingUser)) || undefined;
          }
        }

        if (customerId) {
          const sub = await findActiveSubscription(stripe, customerId);
          if (sub && (sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due')) {
            // Auto-heal / promote into app_metadata and user_metadata
            await supabaseAdmin.auth.admin.updateUserById(userId, {
              app_metadata: { ...appMeta, plan: 'pro', subscription_status: sub.status, stripe_customer_id: customerId },
              user_metadata: { ...userMeta, plan: 'pro', subscription_status: sub.status, stripe_customer_id: customerId },
            });
            return {
              plan: 'pro',
              email: data.user.email,
              status: sub.status,
            };
          }
        }
      }
    } catch {
      /* Stripe check failed — fallback to free */
    }

    return {
      plan: 'free',
      email: data.user.email,
      status: (appMeta.subscription_status as string) || (userMeta.subscription_status as string) || 'none',
    };
  } catch {
    return { plan: 'free' };
  }
}

/** Legacy helper kept for compatibility: constant-time master key check. */
export function matchesMasterKey(presented: string): boolean {
  const masterKey = process.env.MCP_API_KEY?.trim();
  if (!masterKey || !presented) return false;
  if (presented.length !== masterKey.length) return false;
  return safeEqual(presented, masterKey);
}
