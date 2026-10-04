# In-app notification centre (new followers first) — design

Date: 2026-10-04. Branch: `notifications` (from `origin/master`).

## Goal

A notification centre inside the app. Today's only event: "X started following you". It must be easy to add reactions, comments, "a year ago you found this place" later as new types, not a rewrite.

Agreed with the user:
- In-app only. No remote push (it needs FCM keys for Android and a paid Apple account with APNs for iOS, neither exists yet). Push is a later step on top of the same table.
- Entry: a bell in the Profile tab header, left of the burger, with the unread count; a dot on the "Профиль" tab in the bottom bar.
- Tapping a notification opens that player's profile (`PlayerScreen`).

## Server: migration `0021_notifications.sql`

- Table `public.notifications`: `id uuid pk default gen_random_uuid()`, `user_id uuid not null references auth.users on delete cascade` (recipient), `type text not null check (type in ('follow'))`, `actor_id uuid not null references auth.users on delete cascade`, `created_at timestamptz not null default now()`, `read_at timestamptz`.
- Unique `(user_id, type, actor_id)`: follow, unfollow, follow again gives one notification, no spam. Index `(user_id, created_at desc)`.
- `AFTER INSERT` trigger on `public.follows` inserts the notification for `followee_id` (`on conflict do nothing`). `follow_player` is not changed: it already checks that the target is public and not blocked.
- RLS on. One `select` policy for `authenticated`: `user_id = auth.uid()` (needed so Realtime delivers my own rows). No insert/update/delete policies: clients cannot write.
- Table added to the `supabase_realtime` publication.
- RPCs, all `security definer`, `set search_path = public`, `revoke ... from public, anon`, `grant ... to authenticated` (the 0017 lesson: Supabase grants EXECUTE to anon separately from PUBLIC):
  - `my_notifications(max_rows integer default 50)` returns `(id, type, actor_id, display_name, avatar_path, i_follow boolean, created_at, read_at)`; hides actors whose profile is not public, who are `blocked`, or `blocked_between` me.
  - `unread_notification_count()` returns integer with the same filters.
  - `mark_notifications_read()` sets `read_at = now()` on all my unread rows.

## Client

- `src/lib/social/notifications.ts`:
  - `interface AppNotification { id: string; type: 'follow'; actorId: string; displayName: string; avatarPath: string | null; iFollow: boolean; createdAt: number; readAt: number | null }`
  - `fetchNotifications(client)`, `fetchUnreadNotificationCount(client)`, `markNotificationsRead(client)`
  - `subscribeToNotifications(client, myId, onInsert): RealtimeChannel` (postgres_changes INSERT, filter `user_id=eq.<myId>`), same pattern as `subscribeToIncomingMessages`.
- Hook `src/hooks/useNotifications.ts`: `useNotifications(client, myId)` returns `{ unread: number; refresh(): Promise<void>; clearUnread(): void }`. Loads the count at start and whenever the app returns to the foreground, increments on a Realtime insert (then re-fetches, to apply the server filters). A failure keeps the last value and logs a warning.
- `src/screens/NotificationsScreen.tsx`: list of rows (avatar, "X подписался на вас" / "X started following you", relative time, unread rows emphasised); empty state; error state. Opening it loads the list, then calls `markNotificationsRead` and `clearUnread`. Press on a row calls `onOpenPlayer({ userId, displayName })`.
- `ProfileScreen`: new optional props `unreadNotifications: number`, `onOpenNotifications: () => void`. Bell icon left of the burger; the badge shows the count (99+ above 99), hidden at 0.
- `MainScreen`: owns `useNotifications`, a `showNotifications` overlay like `showFollows`, passes the count to the tab bar (dot on "Профиль") and to `ProfileScreen`.
- `SvgIcon`: a `bell` icon if there is none.
- Strings in `ru.ts` and `en.ts`.

## Testing

- Jest: `notifications.ts` (mapping, errors), `useNotifications` (initial count, Realtime insert, foreground refresh, failure keeps value), `NotificationsScreen` (rows, empty, error, press, marks read on open), `ProfileScreen` bell (count, 99+, hidden at 0, press).
- SQL checked by hand in the SQL editor: duplicate follow gives one row; a blocked actor is not listed or counted; a private profile is not listed; another user's rows are not readable; anon has no EXECUTE.
- Simulator: create a follow from a second account with a SQL statement (run with the user's approval), see the bell count, open the list, see the count clear; then delete the test rows.

## Out of scope

Remote push, other event types, per-type settings, deleting single notifications, grouping ("3 people followed you").

## Risks

- Realtime delivery of `postgres_changes` depends on the RLS select policy; if it does not arrive, the count still updates on foreground and on opening the profile tab (the hook refreshes then).
- Notifications of a deleted follow stay in the list (the follow row is gone, the notification is history). Intended: it records that someone once followed.
- A notification created while the actor's profile was public stays hidden if the profile is later made private (the filter runs at read time).
