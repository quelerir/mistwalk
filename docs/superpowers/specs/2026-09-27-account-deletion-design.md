# Account deletion — design spec

**Date:** 2026-09-27
**Status:** approved (design), pending implementation plan

## Why

Mistwalk has email/password sign-up via Supabase Auth (`src/lib/supabase/auth.ts`) but no way
for a user to delete their account. Apple App Store review requires that any app offering
account creation also offer in-app account deletion, not just a support-email flow. This is a
hard blocker on the store submission checklist. Google Play's Data Safety form also expects an
answer here.

## Scope

Add a self-service "Delete account" action reachable from the existing `AppMenu` account page.
No new screen. Deletion is immediate and irreversible — no grace period, no soft-delete state.

## Data model (no migration needed)

Checked all tables with a `user_id` FK to `auth.users`:

| table | FK behavior |
|---|---|
| `visited_points` | `on delete cascade` |
| `discovered_places` | `on delete cascade` |
| `player_profiles` | `on delete cascade` (PK is `user_id`) |
| `follows` (`follower_id`, `followee_id`) | `on delete cascade` both sides |
| `feedback` | `on delete cascade` |

Deleting the `auth.users` row cascades through all of the above automatically. Feedback rows are
deleted along with the account (decided: no anonymized retention — simpler, fewer privacy-label
questions).

The one thing *not* covered by a FK: avatar files in the `avatars` storage bucket
(`{user_id}/...` path, see `supabase/migrations/0005_avatars.sql`). Storage objects are not
cascade-deleted by a Postgres FK and must be removed explicitly.

## Backend: new Edge Function `delete-account`

New function at `supabase/functions/delete-account/index.ts`, alongside the existing
`feedback-email` and `pois` functions.

Request: `POST`, no body, `Authorization: Bearer <user JWT>` header (the Supabase JS client sets
this automatically on `functions.invoke`).

Steps:
1. Build a Supabase client with the **anon key** and the caller's JWT; call `auth.getUser()` to
   resolve the caller's `user.id`. Missing/invalid token → `401`.
2. Build a second Supabase client with the **service-role key** (required for
   `auth.admin.deleteUser`, which cannot run as the end user).
3. `auth.admin.deleteUser(userId)` — deletes the auth user; Postgres cascades the tables above.
4. `storage.from('avatars').list(userId)` → `storage.from('avatars').remove([...paths])` —
   best-effort cleanup of the user's avatar file(s), run *after* step 3. If this fails, log and
   still return success to the client: a leftover file in a bucket the (deleted) user can no
   longer reach is not worth failing the whole deletion over.
5. Return `{ ok: true }` (200) on success, or an error response with a status code.

Required secret: `SUPABASE_SERVICE_ROLE_KEY` (standard Supabase project secret, likely already
available to Edge Functions by default — confirm during implementation).

No changes to any existing table, policy, or the `feedback-email`/`pois` functions.

## Client: `AppMenu.tsx`

- New item appended to `accountItems`, after `signout`:
  ```ts
  {
    key: 'deleteAccount',
    icon: 'logout',
    label: t('menu.deleteAccount'),
    destructive: true,
    onPress: confirmDeleteAccount,
  }
  ```
- `confirmDeleteAccount()` shows `Alert.alert(t('menu.deleteAccountTitle'),
  t('menu.deleteAccountConfirm'), [cancel, { text: delete, style: 'destructive', onPress:
  runDeleteAccount }])` — same shape as the existing report-confirmation Alert in
  `PlayerScreen.tsx`.
- `runDeleteAccount()`:
  1. Local `deleting` state (boolean) disables the menu item and shows a spinner/inline state
     while in flight, to prevent double-submits.
  2. `await supabase.functions.invoke('delete-account')`.
  3. On success: call the existing `onSignOut()` prop (clears local session/state — the server
     side user is already gone) and close the menu, same as a normal sign-out.
  4. On error: `setNote(t('menu.deleteAccountFailed'))`, reset `deleting` to `false`, stay in the
     menu so the user can retry.

New i18n keys (`menu.deleteAccount`, `menu.deleteAccountTitle`, `menu.deleteAccountConfirm`,
`menu.deleteAccountFailed`) added to both locale files, following the existing `menu.*`
convention.

## Error handling / edge cases

- **No network / function unreachable**: `functions.invoke` throws → show
  `deleteAccountFailed`, nothing was touched server-side (nothing runs until the function
  receives the authenticated request).
- **No avatar uploaded**: `storage.list(userId)` returns empty, `remove([])` is a no-op.
- **Avatar cleanup fails after user is deleted**: logged server-side, not surfaced to the
  client — the deletion itself already succeeded by that point.
- **Double-tap on delete**: prevented by the local `deleting` state disabling the menu item.
- **Expired token at call time**: Edge Function returns `401`, client shows the generic
  `deleteAccountFailed` message; nothing deleted.

## Testing

- Unit test for `AppMenu`: the account page renders a "Delete account" item; pressing it opens
  the confirm Alert; confirming calls `supabase.functions.invoke('delete-account')` and, on a
  mocked success, calls `onSignOut`; on a mocked failure, sets the error note and re-enables the
  item.
- No existing Deno-test convention for Edge Functions in this repo (`feedback-email` and `pois`
  have none) — not introducing one here either. `delete-account` is verified manually instead
  (see below), matching how the other two functions are validated.
- Manual verification in the simulator: create a throwaway Supabase test account, upload an
  avatar, add a few visited points, follow another test account, then delete it from the app.
  Confirm in Supabase Studio that the `auth.users` row, `player_profiles`, `visited_points`,
  `discovered_places`, `follows` rows (both directions), `feedback` rows, and the avatar storage
  object are all gone, and that the same email can sign up again afterward.

## Out of scope

- Grace period / scheduled deletion (decided against — adds a cron job and a "pending deletion"
  state for no clear benefit at this app's stage).
- Re-authentication before deletion (decided against — a destructive-styled Alert matches the
  existing report-flow pattern and Apple does not require re-auth for this).
- Anonymized retention of feedback rows (decided against — deleting them is simpler and reduces
  what has to be disclosed in the privacy label / Data Safety form).
