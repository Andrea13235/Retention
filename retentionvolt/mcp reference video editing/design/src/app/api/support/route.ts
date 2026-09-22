import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { rateLimit } from '@/lib/rateLimit';

const VALID_CATEGORIES = ['mcp', 'billing', 'bug', 'feature'];

/**
 * POST /api/support — store a support ticket in Supabase (support_tickets).
 * If the table is missing, returns 503 with a mailto fallback so the user is
 * never left thinking the message was sent.
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { limit: 5, windowMs: 60_000 });
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));
  const subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, 200) : '';
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 5000) : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const category = VALID_CATEGORIES.includes(body.category) ? body.category : 'mcp';

  if (!subject || !message) {
    return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email is required for the reply' }, { status: 400 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Ticket system unavailable — email support@retentionvolt.com directly' },
      { status: 503 }
    );
  }

  // Attach user id when the sender is logged in (optional, best-effort)
  let userId: string | null = null;
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
    if (token) {
      const { data } = await supabaseAdmin.auth.getUser(token);
      userId = data?.user?.id || null;
    }
  } catch {
    userId = null;
  }

  try {
    // Primary: migration 001 schema uses user_email
    let { error: insertErr } = await supabaseAdmin.from('support_tickets').insert({
      user_id: userId,
      user_email: email,
      subject,
      category,
      message,
      status: 'open',
    });

    // Fallback if table was provisioned with 'email' column instead of 'user_email'
    if (insertErr && /user_email/i.test(insertErr.message)) {
      const res2 = await supabaseAdmin.from('support_tickets').insert({
        user_id: userId,
        email,
        subject,
        category,
        message,
        status: 'open',
      });
      insertErr = res2.error;
    }

    if (insertErr) throw insertErr;
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error('[Support Route] Insert failed:', err);
    const message_text = err instanceof Error ? err.message : '';
    const missing = /relation|does not exist|table/i.test(message_text);
    return NextResponse.json(
      {
        error: missing
          ? 'Ticket system is being provisioned — email support@retentionvolt.com directly'
          : 'Unable to submit ticket. Please try again or email support@retentionvolt.com.',
      },
      { status: 503 }
    );
  }
}
