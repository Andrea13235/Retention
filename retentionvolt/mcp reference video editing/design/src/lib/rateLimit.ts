// Simple in-memory rate limiter (per-instance, resets on cold start)
// For production with multiple instances, replace with Upstash Redis.
// No external dependency needed — zero-config, good for Vercel serverless.

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function keyFor(req: Request): string {
  const cfIp = req.headers.get('cf-connecting-ip');
  const realIp = req.headers.get('x-real-ip');
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = cfIp || realIp || (forwarded ? forwarded.split(',')[0]?.trim() : null) || 'unknown';
  return ip;
}

/**
 * @param limit max requests per window
 * @param windowMs window in milliseconds
 * @returns null if allowed, or Response with 429 if throttled
 */
export function rateLimit(req: Request, opts: { limit: number; windowMs: number }): Response | null {
  const key = `${opts.limit}:${opts.windowMs}:${keyFor(req)}`;
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + opts.windowMs };
    buckets.set(key, bucket);
  }
  bucket.count++;
  if (bucket.count > opts.limit) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(opts.limit),
        'X-RateLimit-Remaining': '0',
      },
    });
  }
  // Periodic cleanup (avoid unbounded growth)
  if (buckets.size > 5000) {
    buckets.forEach((v, k) => {
      if (now > v.resetAt) buckets.delete(k);
    });
  }
  return null;
}
