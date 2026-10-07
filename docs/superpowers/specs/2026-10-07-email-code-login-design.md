# Sign in with a code from an email — design

Date: 2026-10-07. Branch: `email-code-login` (from `master`).

## Goal

A second way to sign in without a password: the person types their e-mail, gets a 6-digit code, types it, and is in. The same form signs in an existing person and creates an account for a new one.

Agreed with the user:
- This is part A. Phone/SMS sign-in is a separate later task (needs a paid Russian SMS service).
- Yandex ID and VK ID were dropped for now (spec and plan of the abandoned branch `yandex-vk-login` stay there; Google and Apple are out because of the Russian law of 7 July 2026).
- A new person is created straight from the code and then picks a login on a "choose login" screen, with the same free/taken check as e-mail sign-up. First and last name stay optional.
- E-mails go out through the user's Gmail over SMTP (free, no domain) for now; the user configures it in the Supabase dashboard.
- E-mail and password sign-in and sign-up stay as they are.

## What is already there

- `src/lib/supabase/auth.ts`: `verifyEmail(client, email, code)` (`verifyOtp`, type `'email'`), `resendCode`, `signIn`, `signUp`, `checkLoginAvailable`.
- `VerifyEmailScreen` `{ client, email, onVerified, onBack, initialCooldown }`: code field, submit, 60 s "send again", "use another email". Test ids `verify-code`, `verify-submit`, `verify-resend`, `verify-back`.
- `SignInScreen`: modes `'in' | 'up'`, a `pendingEmail` state that shows `VerifyEmailScreen`, `onSignedIn`.
- Migration `0014_sign_up_profile.sql`: `login_available`, and the trigger `handle_new_user` which creates a profile only when the sign-up metadata carries a login and both names; otherwise nothing, and the app later makes a default profile.
- `useLoginAvailability`, `normalizeLogin`/`validateLogin` for the live login check.

## Design

### Sign-in screen
On the "Вход" tab, under the password field, a link "Войти по коду из письма". It switches the form to a code mode: only the e-mail field and a button "Получить код". Back to the password form is one tap. A valid address sends the code and opens `VerifyEmailScreen` for that address, as the sign-up flow already does.

### Client functions (`src/lib/supabase/auth.ts`)
- `sendLoginCode(client: SupabaseClient, email: string): Promise<void>`: `client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })`, throws the Supabase error.
- The code is checked with the existing `verifyEmail`. Both the login code and the sign-up confirmation code are verified with type `'email'` (confirm against the `@supabase/supabase-js` version in the first plan task).

### `VerifyEmailScreen`
A new optional prop `purpose?: 'signup' | 'login'` (default `'signup'`, so current callers and tests are unchanged). "Send again" calls `resendCode` for `'signup'` and `sendLoginCode` for `'login'`. Everything else is as it is.

### New person: profile and the "choose login" step
- Migration `0022_email_code_login.sql`:
  - `player_profiles.login_chosen boolean not null default true`, so every existing profile is untouched.
  - `handle_new_user` is replaced: when the metadata has a login and both names it works as today (`login_chosen = true`); when it does not, it creates a private profile (`is_public = false`) with a temporary unique login (`p_` + 10 random hex characters, within the 2 to 24 length check) and `login_chosen = false`. A profile problem still never blocks the sign-up (warning, as now).
  - `set_login(candidate text) returns void`, `security definer`, granted to `authenticated`: raises `invalid_login` unless the candidate matches `^[A-Za-z0-9_]{3,20}$`, raises `login_taken` when another profile has it (case-insensitive), otherwise sets `display_name`, `login_chosen = true`, `is_public = true` for `auth.uid()`; raises when the caller has no profile.
- `setLogin(client: SupabaseClient, login: string): Promise<void>` in `auth.ts` calls the RPC.
- `useLoginChosen(client, userId): 'loading' | 'chosen' | 'needed' | 'error'` reads the caller's `login_chosen`; a missing profile row counts as `'chosen'`, so old flows keep working.
- `ChooseLoginScreen` `{ client, onDone, onSignOut }`: login field with `useLoginAvailability`, submit disabled until the login is free, a "Выйти" link; shows "taken" and stays when `set_login` fails with `login_taken`.
- `RootNavigator`: with a session it shows `ChooseLoginScreen` for `'needed'`, nothing while `'loading'`, the app for `'chosen'` and `'error'` (an error must not lock the person out).
- Old app versions that sign up without a login now get the temporary profile; they ignore the flag, and the next version asks for a login.

### Manual setup in Supabase (by the user, guided)
- Turn on 2-step verification on the Gmail account and create an app password (never pasted into chat or the repo), then Auth → SMTP with `smtp.gmail.com`.
- Edit the "Magic Link" and "Confirm signup" templates so the e-mail shows the code (`{{ .Token }}`), not only a link.
- Check the e-mail rate limit and the code lifetime in Auth settings.

### Security
With "Confirm email" off, someone can register another person's address with a password without proving they own it, and the real owner, signing in by code, would land in that account while the other person knows its password. So **before the first public release "Confirm email" must be turned on** (the client already supports it). This is a release requirement, not part of this change.

### Errors and texts
New keys in `ru.ts` and `en.ts`: the link, the code-mode title and button, the choose-login screen. "Too many requests" already maps to `tooManyRequests`; the other failures use the existing generic and network messages.

## Out of scope
Phone/SMS sign-in; Yandex ID, VK ID, Google, Apple; linking sign-in methods in the profile; changing e-mail sign-up; turning on Confirm email.

## Open points (settled in the first plan task)
1. In the installed `@supabase/supabase-js` version, `signInWithOtp` followed by `verifyOtp` with type `'email'` signs in an existing user and a new user; if a different type is needed, `verifyEmail` takes it as a parameter.
2. Whether the default "Magic Link" template can carry the code, and the exact template variables.
3. How `useProfileSync` behaves when a profile already exists (it must never overwrite `display_name`).

## Testing
- Jest: `sendLoginCode` (call shape, error), `VerifyEmailScreen` with `purpose="login"` (resend calls `sendLoginCode`, not `resendCode`), the code mode on `SignInScreen` (link, invalid e-mail, send, cooldown, back), `setLogin`, `useLoginChosen` (needed/chosen/missing row/error), `ChooseLoginScreen` (disabled until free, taken stays, sign out), `RootNavigator` gating; dictionary parity test.
- SQL (SQL editor): the existing e-mail sign-up still creates its profile with `login_chosen = true`; a sign-up without a login gets a private temporary profile with `false`; `set_login` for invalid, taken, free; existing rows are `true`.
- By hand in the simulator on a dev build after the Gmail setup: existing user by code, new user by code then choosing a login, a wrong code, "send again", "use another email", offline; e-mail and password sign-in and sign-up still work. Clean up test accounts (see the simulator test-data note). Follow `dev-workflow`: verify in the simulator, then push.
