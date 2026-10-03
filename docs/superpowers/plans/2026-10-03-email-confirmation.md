# Email Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After sign-up, a new account is activated by typing a 6-digit code from an email; the client works both with confirmation off (today) and on.

**Architecture:** `signUp` already returns `data`; when `data.session` is null the sign-in screen shows a new `VerifyEmailScreen` for that address. The screen calls `verifyOtp` and `resend`; on success the existing `onSignedIn` runs. No migration, no `App.tsx` change.

**Tech Stack:** Expo (read the versioned docs per AGENTS.md before touching Expo APIs), React Native, `@supabase/supabase-js`, Jest + `@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/2026-10-03-email-confirmation-design.md`

## Global Constraints

- Code is 6 digits, verified with `client.auth.verifyOtp({ email, token, type: 'email' })`; resend with `client.auth.resend({ type: 'signup', email })`.
- Resend countdown: 60 seconds.
- Strings in both `src/i18n/ru.ts` and `src/i18n/en.ts` (the dictionary test enforces parity); colours and fonts from the theme (`useStyles`), as `SignInScreen` does.
- Existing users and the old flow (confirmation off, `signUp` returns a session) must keep working unchanged.
- No new dependencies. One task per commit; the work stays on branch `email-confirmation`.

## Review Focus

- Code field gets spaces or a pasted `123 456`: trimmed and non-digits stripped before the length check (Task 2, Task 3).
- Double tap on submit or resend while a request is in flight: a second call must not start (Task 3).
- `signUp` returns a user whose email is already registered with confirmation on (Supabase returns a fake user without an error): the verify screen opens and a wrong code just fails; no crash (Task 4 test only checks the screen opens; accepted).
- Offline while verifying or resending: the "no connection" message, buttons usable again (Task 3).
- Leaving the verify screen with "Use another email" and signing up again: form values are kept, the countdown starts fresh on the next verify screen (Task 4).

---

### Task 1: `verifyEmail` and `resendCode`

**Files:**
- Modify: `src/lib/supabase/auth.ts`
- Test: `src/lib/supabase/auth.test.ts`

**Interfaces:**
- Produces: `verifyEmail(client: SupabaseClient, email: string, code: string): Promise<VerifyOtpData>` (returns `data`, throws the Supabase error); `resendCode(client: SupabaseClient, email: string): Promise<void>` (throws the Supabase error).

- [ ] **Step 1: Write failing tests** in `auth.test.ts` (extend `makeFakeClient` with `verifyOtp` and `resend` mocks resolving `{ data: {...}, error: null }`):
  - `verifyEmail calls verifyOtp with the email, the token and type "email" and returns data`
  - `verifyEmail throws the error verifyOtp returns`
  - `resendCode calls resend with type "signup" and the email`
  - `resendCode throws the error resend returns`
- [ ] **Step 2: Run** `npx jest src/lib/supabase/auth.test.ts`. Expected: the four new tests FAIL (not exported).
- [ ] **Step 3: Implement** both functions in `auth.ts`, in the style of `signIn` (call, `if (error) throw error`).
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add verifyEmail and resendCode` (end the message with the Co-Authored-By line from the session's attribution reminder).

### Task 2: Error codes, `validateCode`, shared error keys

**Files:**
- Modify: `src/lib/auth/validation.ts`, `src/i18n/ru.ts`, `src/i18n/en.ts`, `src/screens/SignInScreen.tsx` (only the `ERROR_KEYS` move)
- Create: `src/lib/auth/errorKeys.ts`
- Test: `src/lib/auth/validation.test.ts`

**Interfaces:**
- Produces: `ErrorCode` gains `'codeInvalid' | 'tooManyRequests' | 'emailNotConfirmed'`; `normalizeCode(raw: string): string` (digits only, at most 6); `validateCode(value: string): ErrorCode | null` (`'required'` when empty, `'codeInvalid'` when not exactly 6 digits after `normalizeCode`, else `null`); `ERROR_KEYS: Record<ErrorCode, Key>` exported from `src/lib/auth/errorKeys.ts` (moved out of `SignInScreen.tsx`, which now imports it).

- [ ] **Step 1: Write failing tests** in `validation.test.ts`:
  - `normalizeCode('123 456')` → `'123456'`; `normalizeCode('12a3')` → `'123'`; `normalizeCode('1234567')` → `'123456'`.
  - `validateCode('')` → `'required'`; `validateCode('12345')` → `'codeInvalid'`; `validateCode('123456')` → `null`.
  - Add rows to the `mapAuthError` table: `{ message: 'Token has expired or is invalid', code: 'otp_expired' }` → `(null, 'codeInvalid')`; `{ message: 'x', code: 'over_email_send_rate_limit' }` → `(null, 'tooManyRequests')`; `{ message: 'x', code: 'over_request_rate_limit' }` → `(null, 'tooManyRequests')`; `{ message: 'x', status: 429 }` → `(null, 'tooManyRequests')`; `{ message: 'Email not confirmed', code: 'email_not_confirmed' }` → `(null, 'emailNotConfirmed')`.
- [ ] **Step 2: Run** `npx jest src/lib/auth/validation.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** in `validation.ts`; `mapAuthError` also reads a numeric `status` property. Add i18n keys `signin.err.codeInvalid` ("Wrong or expired code. Request a new one." / Russian equivalent), `signin.err.tooManyRequests` ("Too many attempts. Try again in a minute." / Russian), `signin.err.emailNotConfirmed` ("Email is not confirmed yet" / Russian) to both dictionaries. Create `errorKeys.ts` with the existing map plus the three new entries, and replace the local map in `SignInScreen.tsx` with the import.
- [ ] **Step 4: Run** `npx jest src/lib/auth src/i18n src/screens/SignInScreen.test.tsx` and `npx tsc --noEmit`. Expected: PASS, no type errors.
- [ ] **Step 5: Commit** `feat: error codes and validation for the email code`.

### Task 3: `VerifyEmailScreen`

**Files:**
- Create: `src/screens/VerifyEmailScreen.tsx`, `src/screens/VerifyEmailScreen.test.tsx`
- Modify: `src/i18n/ru.ts`, `src/i18n/en.ts`

**Interfaces:**
- Consumes: `verifyEmail`, `resendCode` (Task 1); `normalizeCode`, `validateCode`, `mapAuthError`, `ERROR_KEYS` (Task 2); `AuthField` and the fog-background look from `SignInScreen`.
- Produces: `default function VerifyEmailScreen(props: { client: SupabaseClient; email: string; onVerified: () => void; onBack: () => void; initialCooldown?: number }): JSX.Element`. `initialCooldown` defaults to 60 (seconds) and exists so tests need no 60 s wait; the countdown ticks once a second.
- testIDs: `verify-code` (the field), `verify-submit`, `verify-resend`, `verify-back`.
- i18n keys (both languages): `verify.title`, `verify.body` (takes `{email}`), `verify.code` (field label), `verify.submit`, `verify.resend`, `verify.resendIn` (takes `{n}` seconds), `verify.otherEmail`.

- [ ] **Step 1: Write failing tests** (mocked client with `auth.verifyOtp` and `auth.resend`; fake timers for the countdown):
  - `shows the address the code was sent to`
  - `submit is disabled until the code has 6 digits` and `strips spaces and letters from what is typed` (typing `'123 456'` shows `123456`)
  - `a correct code calls verifyOtp with email, token and type "email", then onVerified`
  - `a wrong or expired code shows the codeInvalid message and does not call onVerified` (mock rejects `{ message: 'Token has expired or is invalid', code: 'otp_expired' }`)
  - `a second press while the request is pending does not call verifyOtp twice`
  - `resend is disabled during the countdown, shows the seconds left, and calls resend after it ends, then restarts the countdown` (use `initialCooldown={2}` and `jest.advanceTimersByTime`)
  - `a rate-limit error from resend shows the tooManyRequests message`
  - `a network error shows the network message and the buttons work again`
  - `"use another email" calls onBack`
- [ ] **Step 2: Run** `npx jest src/screens/VerifyEmailScreen.test.tsx`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the screen: same `ImageBackground` + scrim + card layout and `makeStyles` pattern as `SignInScreen`; the field uses `keyboardType="number-pad"`, `autoComplete="one-time-code"`, `textContentType="oneTimeCode"`, `maxLength` unset (paste is normalised by `normalizeCode`). A `busy` flag guards both submit and resend. Countdown via `setInterval` in an effect, cleared on unmount.
- [ ] **Step 4: Run** `npx jest src/screens/VerifyEmailScreen.test.tsx src/i18n` and `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: add VerifyEmailScreen`.

### Task 4: Wire into `SignInScreen`

**Files:**
- Modify: `src/screens/SignInScreen.tsx`, `src/screens/SignInScreen.test.tsx`

**Interfaces:**
- Consumes: `VerifyEmailScreen` (Task 3), `resendCode` (Task 1), `mapAuthError` code `'emailNotConfirmed'` (Task 2).
- Produces: `SignInScreen` keeps its props (`client`, `onSignedIn`). New internal state `pendingEmail: string | null`; when set, the component renders `<VerifyEmailScreen client email={pendingEmail} onVerified={onSignedIn} onBack={() => setPendingEmail(null)} />` instead of the form, leaving `values` untouched.

- [ ] **Step 1: Update and write tests** in `SignInScreen.test.tsx`: the default `signUp` mock and the two sign-up mocks must now return `{ data: { user: { id: 'u1' }, session: { access_token: 't' } }, error: null }` (a session is what "confirmation off" returns). Add:
  - `sign-up without a session opens the verify screen for that email and does not call onSignedIn`
  - `sign-up with a session signs in at once` (the existing sign-up tests cover it; keep them green)
  - `sign-in with an unconfirmed email opens the verify screen and sends a new code` (mock `signInWithPassword` rejecting `{ message: 'Email not confirmed', code: 'email_not_confirmed' }`; expect `auth.resend` called with `{ type: 'signup', email }`)
  - `"use another email" returns to the form with the typed values kept`
- [ ] **Step 2: Run** `npx jest src/screens/SignInScreen.test.tsx`. Expected: new tests FAIL.
- [ ] **Step 3: Implement** in `submit()`: after `signUp`, `if (!data.session) { setPendingEmail(email); return; }` else `onSignedIn()`. In the sign-in `catch`, when `mapAuthError(err).code === 'emailNotConfirmed'`, call `resendCode` (ignore its failure; the verify screen has its own resend) and set `pendingEmail`. Keep `busy` handling in `finally`.
- [ ] **Step 4: Run** the full suite `npx jest` and `npx tsc --noEmit`. Expected: all PASS.
- [ ] **Step 5: Commit** `feat: show the verify screen when sign-up or sign-in needs a code`.

### Task 5: Check in the simulator, then push

**Files:** none (verification only; follow the memory notes on the 8 GB machine: Debug build, and on test data: sign-ups create real accounts, delete the test one afterwards).

- [ ] **Step 1: Confirmation off (today's setting).** Run the Debug build in the iOS Simulator (`mcp__Claude_Code_iOS_Simulator__control`), sign up with a new test email: expect an immediate sign-in and no verify screen; then sign in with the old test account: unchanged.
- [ ] **Step 2: Confirmation on.** In the Supabase dashboard turn on "Confirm email" and change the "Confirm sign up" template to show `{{ .Token }}` (the user does this; do not touch the dashboard yourself). Sign up with a real address you can read: expect the verify screen, the code arrives, a wrong code shows the message, the resend countdown works, the right code signs in. Check both languages and a small screen with the keyboard open (screenshots).
- [ ] **Step 3: Switch the dashboard back off** (user), repeat Step 1 to confirm the old flow, delete the test accounts.
- [ ] **Step 4: Push** the branch `email-confirmation` and tell the user the remaining manual steps from the spec (domain, SMTP, the final dashboard switch, and doing the switch only after a build with this change is out).
