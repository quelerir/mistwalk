# Email confirmation with a 6-digit code

## Goal

A new account becomes usable only after the person proves they own the email address, by typing a 6-digit code that
arrives in a message. This stops sign-ups on other people's addresses and throwaway accounts.

## Decisions (agreed with the user)

- **A code, not a link.** The message carries a 6-digit code (`{{ .Token }}`); the app verifies it with `verifyOtp`. No
  deep link scheme, no redirect URL, no native rebuild for a URL scheme.
- **New sign-ups only.** Existing users already have `email_confirmed_at` set (confirmation was off, so Supabase
  confirmed them on creation) and keep signing in as before, the test account included.
- **The app ships first, the switch comes later.** The built-in Supabase mailer allows only a few messages per hour, so
  "Confirm email" is turned on in the Supabase dashboard only after a custom SMTP sender exists. That needs a domain
  of our own (the user will buy one later; `github.io` cannot carry SPF/DKIM records) and a sender such as Resend.
  Until then the project keeps `mailer_autoconfirm: true`.
- **The client works in both modes.** With confirmation off, `signUp` returns a session and the new screen never shows.
  With it on, `signUp` returns a user and no session, and the new screen opens. So an app build can go to the stores
  before the dashboard switch, and the switch can be flipped (or reverted) without a release.

## Client

- `src/lib/supabase/auth.ts`
  - `signUp` is unchanged and already returns `data`; the caller reads `data.session`.
  - `verifyEmail(client, email, code)`: `client.auth.verifyOtp({ email, token: code, type: 'email' })`, throws on error,
    returns the data (it contains the session).
  - `resendCode(client, email)`: `client.auth.resend({ type: 'signup', email })`, throws on error.
- `src/lib/auth/validation.ts` (pure)
  - New error codes: `codeInvalid` (wrong code), `codeExpired`, `tooManyRequests`, `emailNotConfirmed`.
  - `mapAuthError` recognises them: `otp_expired` or "expired" gives `codeExpired`; "token ... invalid" gives
    `codeInvalid`; `over_email_send_rate_limit` / `over_request_rate_limit` / HTTP 429 gives `tooManyRequests`;
    `email_not_confirmed` / "Email not confirmed" gives `emailNotConfirmed`.
  - `validateCode(value)`: exactly 6 digits after trimming.
- `src/screens/VerifyEmailScreen.tsx` (new), same fog look and theme as `SignInScreen`
  - Shows the address the code went to, a 6-digit field (numeric keyboard, one-time-code autofill hint), a submit button
    disabled until the code is 6 digits.
  - "Send the code again" with a 60 second countdown; the button is disabled while it runs.
  - "Use another email" returns to the sign-up form (state kept).
  - Errors under the field: wrong code, expired code (suggests sending a new one), too many requests, network.
  - On success it calls `onSignedIn()`, as `SignInScreen` does today.
- `src/screens/SignInScreen.tsx`
  - After `signUp`: if `data.session` exists call `onSignedIn()` as now; otherwise show `VerifyEmailScreen` for that
    email. The component stays a single screen; the verify view is a state of it or a sibling component, whichever the
    plan finds smaller.
  - On sign-in, `emailNotConfirmed` opens the same verify view and sends a fresh code through `resendCode`.
- Strings in `src/i18n/en.ts` and `ru.ts` (the dictionary test enforces parity).
- `App.tsx` needs no change: `onSignedIn` already re-reads the session.

## Server

- No migration. The `handle_new_user` trigger fires on insert into `auth.users`, with or without a session, so the
  profile and login are created at sign-up as before.
- Side effect to accept: an unconfirmed account holds its login until it is confirmed or removed. Cleanup of
  unconfirmed accounts older than 24 hours (a scheduled SQL job or edge function) is **out of scope for the first
  version**; if abuse shows up, it becomes its own task.
- Dashboard changes, made by hand when the switch is flipped (documented in this spec, not in code):
  1. SMTP settings: custom sender (host, port, user, password, sender address).
  2. Confirm email: on.
  3. Email template "Confirm sign up": body shows `{{ .Token }}` instead of the link, in English and Russian text.
  4. Optionally raise the email rate limit, and set the OTP expiry (default 1 hour is fine).

## Out of scope

- Changing the email address, password reset, passwordless sign-in.
- Cleanup of unconfirmed accounts.
- Setting up the domain and SMTP (a separate task for the user, then the dashboard steps above).

## Rollout and risk

- Order: merge and ship the client, buy the domain, set up the sender, send a test message, then flip "Confirm email".
- Flipping it before the SMTP sender works blocks every new sign-up with a rate-limit error; reverting the switch
  restores the old behaviour at once.
- Old app builds (without the verify screen) that sign up while confirmation is on get no session and will look as if
  nothing happened. Mitigation: flip the switch only after a build with this change is the one users have; the store
  review time makes that a deliberate step.

## Testing

- Unit: `verifyEmail` and `resendCode` (payloads, error pass-through), `validateCode`, the new `mapAuthError` cases.
- Screen tests with a mocked client: sign-up without a session shows the verify view; with a session it signs in at
  once; a correct code signs in; a wrong and an expired code show their messages; the resend button is disabled during
  the countdown and calls `resendCode` after it; sign-in with an unconfirmed email opens the verify view.
- By hand in the simulator, with the dashboard switch on against the built-in mailer (one or two messages are within its
  limit): full sign-up with a real message, a wrong code, a resend, both languages, a small screen with the keyboard open.
  Then switch off and confirm the old flow still works.
