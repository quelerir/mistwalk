// Called by a Database Webhook on insert into public.feedback (see README.md next to this file for the setup
// steps). Sends one email to the developer through Resend; never touches the app's own data path,
// so a Resend outage or a missing key only means a missed notification, not a lost feedback row (it is still in
// the table either way).
//
// Required secrets (Project Settings -> Edge Functions -> Secrets):
//   RESEND_API_KEY        - from resend.com
//   FEEDBACK_WEBHOOK_SECRET - a random string you also set as a header on the Database Webhook (any value; it
//                             just has to match on both sides), so only that webhook can trigger a send.
//   FEEDBACK_TO_EMAIL     - where the notification goes (e.g. quelerir@gmail.com)

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const WEBHOOK_SECRET = Deno.env.get('FEEDBACK_WEBHOOK_SECRET');
const TO_EMAIL = Deno.env.get('FEEDBACK_TO_EMAIL');
const FROM_EMAIL = 'Mistwalk feedback <onboarding@resend.dev>';

interface FeedbackRow {
  id: string;
  user_id: string;
  email: string | null;
  message: string;
  created_at: string;
}

interface WebhookPayload {
  type: 'INSERT';
  table: string;
  record: FeedbackRow;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  if (!WEBHOOK_SECRET || req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!RESEND_API_KEY || !TO_EMAIL) {
    console.error('feedback-email: missing RESEND_API_KEY or FEEDBACK_TO_EMAIL secret');
    return new Response('Not configured', { status: 500 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }
  const row = payload.record;
  if (!row?.message) return new Response('No feedback row in payload', { status: 400 });

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      subject: 'Mistwalk: new feedback',
      html: `<p><b>From:</b> ${escapeHtml(row.email ?? row.user_id)}</p><p>${escapeHtml(row.message).replace(/\n/g, '<br>')}</p>`,
    }),
  });

  if (!res.ok) {
    console.error('feedback-email: Resend error', res.status, await res.text());
    return new Response('Resend error', { status: 502 });
  }
  return new Response('ok', { status: 200 });
});
