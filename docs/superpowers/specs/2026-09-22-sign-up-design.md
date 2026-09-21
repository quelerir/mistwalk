# Sign-in and sign-up screen, with first name, last name and a login

## Goal

Replace the bare sign-in form (two inputs and two system buttons) with a designed screen, and make sign-up collect a
first name, a last name and a public login (`@login`).

## Decisions (agreed with the user)

- **Login is a public nickname.** It is the existing `player_profiles.display_name`: unique, case-insensitive, already
  what friends, the feed and the leaderboard show. Signing in still uses email and password.
- **First and last name are private.** Only the owner can read them (the existing "read own profile" policy). No public
  function returns them.
- **One screen with two tabs**, "Sign in" and "Sign up", over the same fog look as the map.
- **Email confirmation is off** in this Supabase project (`mailer_autoconfirm: true`, checked from the public auth
  settings), so sign-up returns a session at once. There is no "check your email" screen.

## Data (migration `0014_sign_up_profile.sql`)

- `player_profiles` gets `first_name text` and `last_name text`. Both nullable: `saveMyProfile` upserts a row and must
  keep working for existing users who have no names. When set, each must be 1 to 40 characters after trimming.
- The login format for **new** sign-ups (not enforced on old rows): Latin letters, digits and `_`, 3 to 20 characters
  (`^[A-Za-z0-9_]{3,20}$`). No dot and no `@`: the existing `sanitize_profile` trigger rejects names with `@`, `www.` or
  a `.com`/`.ru`/... ending. Checked in the client, in `login_available` and in the sign-up trigger; the existing table
  check (2 to 24) and the unique index on `lower(display_name)` stay.
- **Trigger `handle_new_user` on `auth.users` (after insert).** Reads `first_name`, `last_name` and `login` from
  `raw_user_meta_data` and inserts the `player_profiles` row with `is_public = true`, like `createDefaultProfile` does
  ("everyone takes part by default"). It works with or without a session, so it is correct whether or not email
  confirmation is on. If any of the three is missing or malformed (an old app version signing up without them) it does
  nothing and the sign-up goes through as before; the app then creates its usual default profile. A taken login raises a
  unique violation, which aborts the sign-up; Supabase reports that as a generic "Database error saving new user", and
  the client reads that message as "login taken".
- **Function `login_available(candidate text) returns boolean`** (security definer, granted to `anon` and
  `authenticated`). Returns whether `lower(candidate)` is free and well formed. Returns nothing else, so it exposes no
  profile data. Used for the live check while typing.

## Client

- `src/lib/supabase/auth.ts`: `signUp(client, { email, password, firstName, lastName, login })` sends the three fields as
  `options.data`. Adds `checkLoginAvailable(client, login)` calling the function.
- `src/lib/auth/validation.ts` (new, pure): `validateLogin`, `validateName`, `validateEmail`, `validatePassword`,
  `validateSignUp`, and `mapAuthError` (Supabase error to a field and a translated message: wrong password, email
  already used, weak password, login taken, network). Fully unit-tested.
- `src/screens/SignInScreen.tsx`: rebuilt. Fog background with the app mark on top and a card holding the tabs.
  - Sign in: email, password, submit.
  - Sign up: first name and last name in one row, login with an `@` prefix and a live status (checking, free, taken,
    invalid), email, password with a show/hide toggle. The submit button is disabled until the form is valid.
  - Errors appear under the field they belong to. Keyboard: the card scrolls above it, Enter moves to the next field.
- The live login check is debounced (about 400 ms) and ignores a response that arrives after the text has changed.
- Strings in `src/i18n/en.ts` and `ru.ts` (both, the dictionary test enforces parity). Colours and fonts from the theme.

## Out of scope

- Asking existing users for a first and last name (a later menu item).
- Signing in with the login instead of the email, password reset, social sign-in.
- Showing the private name anywhere yet (it is stored for the owner; a greeting in the menu can follow).

## Rollout and risk

- The migration is applied by hand (SQL editor or `supabase db push`, as before) and must be applied **before** an app
  build that sends the new fields. The trigger tolerates old clients, so applying it early is safe.
- The trigger is on `auth.users`: a bug in it can block every sign-up, so it is written to never raise except for the
  duplicate login (malformed details are skipped, not rejected), and is tested against the SQL by hand (a sign-up with and without the metadata) before the app
  release.

## Testing

- Unit tests for `validation.ts` (formats, error mapping, `validateSignUp`) and for `auth.ts` (the payload sent, the
  availability call).
- By hand in the simulator: sign-up with a free login, a taken login, an invalid login, wrong password on sign-in, both
  languages, small screen with the keyboard open.
