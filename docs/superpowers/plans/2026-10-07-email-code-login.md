# Sign-in with a Code from an Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A person types their e-mail, gets a 6-digit code, and is signed in without a password; a first-time person then chooses a login.

**Architecture:** `signInWithOtp` sends the code, the existing `verifyEmail` checks it, and the existing `VerifyEmailScreen` is reused with a `purpose` prop. A migration makes the sign-up trigger create a private temporary profile with `login_chosen = false` for accounts that arrive without a login; `RootNavigator` shows a new `ChooseLoginScreen` until `set_login` runs.

**Tech Stack:** Expo SDK 55 (`~55.0.31`; read the versioned docs per AGENTS.md before touching Expo APIs), React Native 0.83, `@supabase/supabase-js` 2.116.0, Postgres (Supabase migrations), Jest + `@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/2026-10-07-email-code-login-design.md`

## Global Constraints

- Code is 6 digits; it is sent with `client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })` and checked with the existing `verifyEmail` (`verifyOtp`, type `'email'`).
- Resend countdown stays 60 seconds; `VerifyEmailScreen` keeps its current behaviour for `purpose="signup"`.
- Login format `^[A-Za-z0-9_]{3,20}$`, same as `login_available`; temporary login is `p_` plus 10 random hex characters (profile check allows 2 to 24 characters).
- Existing profiles keep `login_chosen = true`; e-mail and password sign-in and sign-up must behave exactly as today.
- Strings in both `src/i18n/ru.ts` and `src/i18n/en.ts` (`dictionaries.test.ts` enforces parity); colours and fonts from the theme (`useStyles`), as `SignInScreen` does.
- No new dependencies. One task per commit; all work stays on branch `email-code-login`. Commit messages end with the Co-Authored-By line from the session's attribution reminder.
- Secrets: the Gmail app password is typed only into the Supabase dashboard by the user; never written to the repo or the chat.

## Review Focus

- A person who already has an e-mail and password account asks for a code with that address: they land in the same account, no second account (Task 6 manual check; Task 2 test pins the call shape `shouldCreateUser: true`).
- A malformed or empty address in code mode is never sent (Task 4).
- Double tap on "Получить код" or on "send again" while a request is in flight: one request only (Task 3, Task 4).
- A wrong, expired or half-typed code: the existing "wrong code" message, buttons usable again, for `purpose="login"` as for sign-up (Task 3).
- The chosen login is taken between the live check and the save, or the person closes the app on the choose-login screen: the screen stays or comes back on the next launch; a failed profile query never locks the person out (Task 5).

---

### Task 1: Migration `0022_email_code_login.sql`

**Files:**
- Create: `supabase/migrations/0022_email_code_login.sql`

**Interfaces:**
- Produces: column `public.player_profiles.login_chosen boolean not null default true`; `public.handle_new_user()` replaced (same trigger `on_auth_user_created`); `public.set_login(candidate text) returns void` (`security definer`, `set search_path = public`, `revoke all ... from public`, `grant execute ... to authenticated`).
- `handle_new_user`: with a login and both names in the metadata it behaves exactly as in `0014` (`login_chosen = true`, public, duplicate login aborts the sign-up). Otherwise it inserts a private profile (`is_public = false`, `login_chosen = false`) with the temporary login; a collision or any other failure on this path is swallowed with a `raise warning` and never blocks the sign-up.
- `set_login`: raises `invalid_login` when the candidate does not match the login format, `login_taken` when another profile has it (case-insensitive), `no_profile` when the caller has no profile row; otherwise sets `display_name`, `login_chosen = true`, `is_public = true` for `auth.uid()`.

- [ ] **Step 1: Write the migration** with the interfaces above (`create or replace function`; the trigger is untouched).
- [ ] **Step 2: Apply it** to the project (Supabase SQL editor or `supabase db push`, as the user prefers).
- [ ] **Step 3: Verify** in the SQL editor. `set_login` inside a transaction that is rolled back, impersonating a user with `set local role authenticated; set local request.jwt.claims = '{"sub":"<user uuid>"}';`: invalid format fails with `invalid_login`, a taken login with `login_taken`, a free one succeeds and `login_chosen` is `true`. Then Authentication → Add user in the dashboard (no metadata): the new user has a profile with a `p_...` login, `is_public = false`, `login_chosen = false`. Expected: all hold; delete the test user afterwards. Also `select count(*) from player_profiles where not login_chosen` is `0` before the test user.
- [ ] **Step 4: Commit** `feat(db): login_chosen, set_login and a temporary profile for sign-ups without a login`.

### Task 2: `sendLoginCode` and `setLogin`

**Files:**
- Modify: `src/lib/supabase/auth.ts`
- Test: `src/lib/supabase/auth.test.ts`

**Interfaces:**
- Produces: `sendLoginCode(client: SupabaseClient, email: string): Promise<void>` (calls `signInWithOtp({ email, options: { shouldCreateUser: true } })`, throws the Supabase error); `setLogin(client: SupabaseClient, login: string): Promise<void>` (calls `rpc('set_login', { candidate: login })`, throws the Supabase error).

- [ ] **Step 1: Check the types.** In `node_modules/@supabase/supabase-js` (and `@supabase/auth-js`) confirm `signInWithOtp` accepts `options.shouldCreateUser` and that `verifyOtp` with `type: 'email'` is the type for a sign-in code. If it is not, add a `type` parameter to `verifyEmail` with the default `'email'` and note the finding in the spec's open points.
- [ ] **Step 2: Write failing tests** (extend `makeFakeClient` with a `signInWithOtp` mock): `sendLoginCode calls signInWithOtp with the email and shouldCreateUser true`, `sendLoginCode throws the error signInWithOtp returns`, `setLogin calls rpc set_login with the candidate`, `setLogin throws the error rpc returns`.
- [ ] **Step 3: Run** `npx jest src/lib/supabase/auth.test.ts`. Expected: the four new tests FAIL.
- [ ] **Step 4: Implement** both in `auth.ts`, in the style of `resendCode`.
- [ ] **Step 5: Run** the same command. Expected: PASS.
- [ ] **Step 6: Commit** `feat: sendLoginCode and setLogin`.

### Task 3: `VerifyEmailScreen` purpose

**Files:**
- Modify: `src/screens/VerifyEmailScreen.tsx`
- Test: `src/screens/VerifyEmailScreen.test.tsx`

**Interfaces:**
- Consumes: `sendLoginCode`, `resendCode`, `verifyEmail` (Task 2 and existing).
- Produces: `VerifyEmailScreenProps` gains `purpose?: 'signup' | 'login'` (default `'signup'`); "send again" calls `sendLoginCode(client, email)` for `'login'` and `resendCode(client, email)` for `'signup'`; verification is the same for both.

- [ ] **Step 1: Write failing tests** (extend the test `makeClient` with `signInWithOtp`): `with purpose "login" send again calls signInWithOtp and not resend`, `with the default purpose send again still calls resend`, `with purpose "login" a wrong code shows the codeInvalid message and the buttons work again`, `a second tap on send again while the first request is pending sends only one`.
- [ ] **Step 2: Run** `npx jest src/screens/VerifyEmailScreen.test.tsx`. Expected: the new tests FAIL, the old ones still pass.
- [ ] **Step 3: Implement** the prop in `VerifyEmailScreen.tsx`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat: VerifyEmailScreen can verify a sign-in code`.

### Task 4: Code mode on the sign-in screen

**Files:**
- Modify: `src/screens/SignInScreen.tsx`, `src/i18n/ru.ts`, `src/i18n/en.ts`
- Test: `src/screens/SignInScreen.test.tsx`

**Interfaces:**
- Consumes: `sendLoginCode` (Task 2), `VerifyEmailScreen` `purpose` (Task 3), `validateEmail`, `mapAuthError`, `ERROR_KEYS`.
- Produces: a separate `codeMode: boolean` state (only reachable from the "in" tab; leaving the tab clears it); testIDs `signin-code-link`, `signin-code-send`, `signin-code-back`; the pending screen is rendered with `purpose="login"` when it came from code mode. i18n keys: `signin.codeLink` ("Войти по коду из письма" / "Sign in with an email code"), `signin.codeSend` ("Получить код" / "Get a code"), `signin.codeBack` ("Войти по паролю" / "Sign in with a password").

- [ ] **Step 1: Write failing tests:** `the sign-in tab shows a link to code mode and the sign-up tab does not`, `code mode shows only the email field and the send button`, `an empty or malformed email is not sent and shows the email error`, `a valid email calls signInWithOtp and opens the code screen for that address`, `a second tap while the request is pending sends only one`, `a failed send shows the mapped error and stays in code mode`, `the back link returns to the password form with the typed email kept`.
- [ ] **Step 2: Run** `npx jest src/screens/SignInScreen.test.tsx`. Expected: new tests FAIL, old ones still pass.
- [ ] **Step 3: Implement** the link, the code-mode form (reusing `AuthField` and the screen's `busy`, `serverError` handling) and the dictionary keys.
- [ ] **Step 4: Run** `npx jest src/screens/SignInScreen.test.tsx src/i18n`. Expected: PASS (including parity).
- [ ] **Step 5: Commit** `feat: sign in with a code from an email (screen)`.

### Task 5: Choose a login

**Files:**
- Create: `src/hooks/useLoginChosen.ts`, `src/screens/ChooseLoginScreen.tsx`
- Modify: `src/navigation/RootNavigator.tsx`, `App.tsx` (pass `onSignedOut`), `src/i18n/ru.ts`, `src/i18n/en.ts`
- Test: `src/hooks/useLoginChosen.test.ts`, `src/screens/ChooseLoginScreen.test.tsx`, `src/navigation/RootNavigator.test.tsx`

**Interfaces:**
- Consumes: `setLogin` (Task 2), `signOut`, `useLoginAvailability`, `normalizeLogin`.
- Produces: `useLoginChosen(client: SupabaseClient, userId: string): 'loading' | 'chosen' | 'needed' | 'error'` (reads `player_profiles.login_chosen` for the user; a missing row counts as `'chosen'`); `ChooseLoginScreen` props `{ client: SupabaseClient; onDone: () => void; onSignOut: () => void }`, testIDs `choose-login`, `choose-submit`, `choose-signout`; `RootNavigatorProps` gains `onSignedOut: () => void`. Keys: `chooseLogin.title` ("Выберите логин" / "Choose a login"), `chooseLogin.body` ("Так вас будут видеть другие игроки." / "This is how other players see you."), `chooseLogin.submit` ("Продолжить" / "Continue"), `chooseLogin.signOut` ("Выйти" / "Sign out").
- `RootNavigator` with a session: `'loading'` shows nothing; `'needed'` shows `ChooseLoginScreen`; `'chosen'` and `'error'` show the children. After `onDone` it remembers the user id locally and shows the children without re-reading. `onSignOut` calls `signOut(client)` and then `onSignedOut`. `useProfileSync` lives in `MainScreen`, a child, so it only runs once the login is chosen and never overwrites the chosen `display_name`.

- [ ] **Step 1: Write failing tests:** `useLoginChosen returns needed when login_chosen is false, chosen when true, chosen when there is no row, error on a failed query`; `ChooseLoginScreen keeps submit disabled until the login is free`, `submit calls setLogin with the normalized login and then onDone`, `a login_taken failure shows the taken message and stays`, `sign out calls onSignOut`; `RootNavigator shows the sign-in screen without a session, nothing while loading, the choose-login screen for needed, the children for chosen and for error, and the children after onDone without a new query`.
- [ ] **Step 2: Run** `npx jest src/hooks/useLoginChosen.test.ts src/screens/ChooseLoginScreen.test.tsx src/navigation`. Expected: FAIL.
- [ ] **Step 3: Implement** the hook, the screen and the gate, and update `App.tsx` (`onSignedOut={() => setSession(null)}`).
- [ ] **Step 4: Run** the same command plus `npx jest src/i18n`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: choose a login after the first sign-in by code`.

### Task 6: Gmail setup and end-to-end check

**Files:**
- None (dashboard and manual checks); update `docs/superpowers/specs/2026-10-07-email-code-login-design.md` open points with what was found.

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: The user sets up Gmail SMTP** in the Supabase dashboard (Auth → SMTP): 2-step verification on the Gmail account, an app password, host `smtp.gmail.com`; guided step by step by the assistant, the password typed only by the user.
- [ ] **Step 2: Edit the e-mail templates** "Magic Link" and "Confirm signup" so the body shows the code (`{{ .Token }}`); check the e-mail rate limit and the code lifetime in the Auth settings.
- [ ] **Step 3: Run** `npx jest` and `npx tsc --noEmit`. Expected: all green.
- [ ] **Step 4: Verify in the simulator** (screenshot each): an existing e-mail and password user asks for a code with their address and lands in the same account (check there is one user row for the address); a new address gets a code, then the choose-login screen, then the map; relaunching before choosing returns to the choose-login screen; a wrong code, "send again" after the countdown, "use another email", and airplane mode each behave; e-mail and password sign-in and sign-up still work. Delete the test accounts afterwards (see the simulator test-data note).
- [ ] **Step 5: Commit** any spec update (`docs: resolve open points for email code login`), then push the branch and open a PR as the dev workflow says. Remind the user that **Confirm email must be turned on before the first public release**.
