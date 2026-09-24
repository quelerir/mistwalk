# Feedback email notification

A new row in `public.feedback` (the in-app "Обратная связь" form) triggers this function through a
**Database Webhook**, which emails it to the developer via Resend. The feedback is saved to the table either way;
this is a notification only, so a Resend outage or a missing key never blocks a person's message from being saved.

## One-time setup (done by hand in the Supabase dashboard, not by the assistant)

1. **Resend API key.** On [resend.com](https://resend.com), Add API Key (already done for `quelerir`'s account as
   of 2026-09-24). Copy it.
2. **Secrets** (Project Settings → Edge Functions → Secrets, or `Manage → Secrets` under Edge Functions):
   - `RESEND_API_KEY` — the key from step 1.
   - `FEEDBACK_TO_EMAIL` — `quelerir@gmail.com`.
   - `FEEDBACK_WEBHOOK_SECRET` — a random string (any value works, it only has to match step 4). One was generated
     for this setup: ask the assistant's session notes, or make a new one (`openssl rand -base64 32`) and reuse it
     in step 4.
3. **Deploy the function.** Edge Functions → Deploy a new function → paste `index.ts` → name it `feedback-email`.
   Turn **off** "Enforce JWT Verification" for this function: the Database Webhook does not send a Supabase JWT,
   and the function checks the `x-webhook-secret` header itself instead.
4. **Database Webhook** (Database → Webhooks → Create a new hook):
   - Table: `public.feedback`, event: `Insert`.
   - Type: "Supabase Edge Functions", pick `feedback-email`.
   - HTTP headers: add `x-webhook-secret: <the value from step 2>`.

## Sending domain

Mail goes out as `onboarding@resend.dev` (Resend's shared test domain: no DNS setup, but it can land in spam and
isn't meant for real users — fine for a one-recipient developer notification). Move to a verified domain later by
adding it under Domains in Resend and changing `FROM_EMAIL` in `index.ts`.
