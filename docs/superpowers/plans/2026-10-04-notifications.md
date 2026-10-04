# Notification centre — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An in-app notification centre; the first event is "X started following you", shown behind a bell in the Profile header with an unread count and a dot on the Profile tab.

**Architecture:** A generic `notifications` table (type + actor) filled by a trigger on `follows`; three RPCs read/mark it; Realtime delivers my own inserts. Client: `notifications.ts` (API), `useNotifications` (count), `NotificationsScreen` (list), bell in `ProfileScreen`, dot in `TabBar`, wiring in `MainScreen`.

**Tech Stack:** Supabase (Postgres, RLS, Realtime), React Native 0.83 / Expo 55, Jest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-04-notifications-design.md`

## Global Constraints

- Migration number `0021`; functions are `security definer`, `set search_path = public`, `revoke all ... from public, anon`, `grant execute ... to authenticated` (anon is granted separately by Supabase, see 0017).
- Types: only `'follow'` for now (`check (type in ('follow'))`); unique `(user_id, type, actor_id)`.
- Lists and counts hide actors whose profile is not public, who are `blocked`, or who are `blocked_between` the reader.
- Clients never write to `notifications`; RLS allows only `select` of own rows.
- Strings in both `src/i18n/ru.ts` and `src/i18n/en.ts` (`dictionaries.test.ts` enforces parity). Count badge shows `99+` above 99.
- Run Jest as `npx jest --testPathIgnorePatterns .worktrees`. Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- The migration is applied to production by the user's approval through the Supabase SQL editor (project `kzjqqdijtsbayalpwrmk`); never run it unasked.

## Review Focus

- A follow, unfollow, follow again must leave one notification (not two) and the count must not double. Task 1 (SQL check) and Task 3.
- An actor who is blocked, private, or later blocks me: not listed and not counted. Task 1 (SQL check).
- Realtime insert arrives for a notification the server filters out (blocked actor): the count must come from the server re-fetch, not a blind `+1`. Task 3.
- The list opened with unread rows: they show as unread once, then the count is 0 and marking read must not flicker them to read before the user sees them. Task 4.
- Network failure on count or list: last count kept, error state on the screen, no crash. Tasks 3 and 4.
- Count above 99 and exactly 0 render correctly on the bell and the tab. Task 5.

---

### Task 1: Migration `0021_notifications.sql`

**Files:**
- Create: `supabase/migrations/0021_notifications.sql`

**Interfaces:**
- Produces (SQL): table `public.notifications(id uuid, user_id uuid, type text, actor_id uuid, created_at timestamptz, read_at timestamptz)`; RPCs `my_notifications(max_rows integer default 50)` → `(id uuid, type text, actor_id uuid, display_name text, avatar_path text, i_follow boolean, created_at timestamptz, read_at timestamptz)`, `unread_notification_count()` → `integer`, `mark_notifications_read()` → `void`.

- [ ] **Step 1: Write the migration** per the spec's Server section: table, unique constraint, index, RLS on with a single `select` policy `user_id = auth.uid()` for `authenticated`, `after insert on public.follows` trigger function (security definer) inserting `(followee_id, 'follow', follower_id)` with `on conflict do nothing`, the three RPCs with the Global Constraints filters (join `player_profiles p on p.user_id = n.actor_id and p.is_public and not p.blocked`, `and not public.blocked_between(auth.uid(), n.actor_id)`, ordered by `created_at desc`, limit `least(max_rows, 100)`), grants, and `alter publication supabase_realtime add table public.notifications`.
- [ ] **Step 2: Prepare the checks** as a second SQL block in the same file's trailing comment (not executed): duplicate follow gives one row; `has_function_privilege('anon', ...)` false for all three RPCs; a blocked actor absent from `my_notifications`.
- [ ] **Step 3: Commit** (`git add supabase/migrations/0021_notifications.sql`; message `feat: notifications table, trigger and RPCs`). Applying it is Task 6.

### Task 2: Client API `notifications.ts`

**Files:**
- Create: `src/lib/social/notifications.ts`
- Test: `src/lib/social/notifications.test.ts`

**Interfaces:**
- Produces:
  - `interface AppNotification { id: string; type: 'follow'; actorId: string; displayName: string; avatarPath: string | null; iFollow: boolean; createdAt: number; readAt: number | null }`
  - `fetchNotifications(client: SupabaseClient): Promise<AppNotification[]>` (rpc `my_notifications`, `{ max_rows: 50 }`; dates via `Date.parse`; unknown `type` rows dropped)
  - `fetchUnreadNotificationCount(client: SupabaseClient): Promise<number>` (rpc `unread_notification_count`; `Number(data ?? 0)`)
  - `markNotificationsRead(client: SupabaseClient): Promise<void>` (rpc `mark_notifications_read`)
  - `subscribeToNotifications(client: SupabaseClient, myId: string, onInsert: () => void): RealtimeChannel` (channel `notifications-${myId}`, postgres_changes INSERT on `public.notifications`, filter `user_id=eq.${myId}`)

- [ ] **Step 1: Write the failing tests** with a fake client like `profiles.test.ts`: mapping of a row incl. `read_at: null`; a row with `type: 'unknown'` is dropped; each function throws the rpc `error`; count converts a string `'3'` to `3`; `subscribeToNotifications` builds the exact channel name and filter and calls `onInsert` for an insert event.
- [ ] **Step 2: Run** `npx jest src/lib/social/notifications.test.ts --testPathIgnorePatterns .worktrees`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** the signatures above, following `messages.ts` (`fromRow` style and `subscribeToIncomingMessages`).
- [ ] **Step 4: Run** the same command. Expected: PASS; then `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** (`feat: notifications client API`).

### Task 3: Hook `useNotifications`

**Files:**
- Create: `src/hooks/useNotifications.ts`
- Test: `src/hooks/useNotifications.test.ts`

**Interfaces:**
- Consumes: `fetchUnreadNotificationCount`, `subscribeToNotifications` (Task 2).
- Produces: `useNotifications(client: SupabaseClient, myId: string): { unread: number; refresh: () => Promise<void>; clearUnread: () => void }`.

- [ ] **Step 1: Write the failing tests** (mock `../lib/social/notifications`, `react-native` `AppState` listener captured): initial `unread` is 0 then the fetched value; a Realtime `onInsert` triggers a re-fetch and shows the server's number (server returns 2 after an insert while local was 1 → shows 2, and when the server still returns 1 because the actor is filtered, stays 1: no blind `+1`); an `AppState` change to `'active'` re-fetches; `clearUnread()` sets 0 without a fetch; a failing fetch keeps the last value and does not throw; the channel is removed on unmount (`client.removeChannel`).
- [ ] **Step 2: Run** `npx jest src/hooks/useNotifications.test.ts --testPathIgnorePatterns .worktrees`. Expected: FAIL.
- [ ] **Step 3: Implement** `useNotifications`: state `unread`; `refresh` calls the fetch and sets state (warn on failure); effect subscribes with `onInsert = refresh`, listens to `AppState`, runs `refresh` once, cleans up both.
- [ ] **Step 4: Run** the command. Expected: PASS.
- [ ] **Step 5: Commit** (`feat: useNotifications hook`).

### Task 4: `NotificationsScreen` and the bell icon

**Files:**
- Create: `src/screens/NotificationsScreen.tsx`
- Modify: `src/components/icons/svgIcons.ts` (add `'bell'` to the icon name union and a `bell` path in the same `line(...)` style as `menu`), `src/i18n/ru.ts`, `src/i18n/en.ts` (keys `notifications.title`, `notifications.follow` with `{name}` ("{name} подписался на вас" / "{name} started following you"), `notifications.empty`, `notifications.loadFailed`, `profile.notifications` for the bell's accessibility label)
- Test: `src/screens/NotificationsScreen.test.tsx`

**Interfaces:**
- Consumes: `fetchNotifications`, `markNotificationsRead`, `AppNotification` (Task 2); `timeAgo` from `src/lib/social/feed.ts`; `Avatar`, `avatarUrl` as `FollowsScreen` uses them.
- Produces: `default function NotificationsScreen(props: { client: SupabaseClient; onBack: () => void; onOpenPlayer: (player: { userId: string; displayName: string }) => void; onRead: () => void })`; `onRead` is called once after the list has loaded and `markNotificationsRead` succeeded.

- [ ] **Step 1: Write the failing tests** (mock the lib and fonts like `LeaderboardScreen.test.tsx`): renders a row "Аня подписался на вас" text for a follow (use regex ru|en) with the actor name; unread rows (readAt null) have the emphasised style testID `notification-unread-<id>` while read ones do not; `markNotificationsRead` and `onRead` are called once after load, and the rows keep their unread look after marking (they were unread when shown); pressing a row calls `onOpenPlayer({ userId, displayName })`; empty list shows `notifications.empty`; failing fetch shows `notifications.loadFailed` and does not call `markNotificationsRead`.
- [ ] **Step 2: Run** `npx jest src/screens/NotificationsScreen.test.tsx --testPathIgnorePatterns .worktrees`. Expected: FAIL.
- [ ] **Step 3: Implement** the screen like `FollowsScreen` (header with back, `FlatList`, loading/error/empty states). Keep the loaded `AppNotification[]` in state as fetched; compute "unread" from that snapshot so marking read does not change the display.
- [ ] **Step 4: Run** the test file, the i18n tests (`npx jest src/i18n --testPathIgnorePatterns .worktrees`) and `npx tsc --noEmit`. Expected: all PASS.
- [ ] **Step 5: Commit** (`feat: NotificationsScreen and bell icon`).

### Task 5: Bell in `ProfileScreen`, dot in `TabBar`, wiring in `MainScreen`

**Files:**
- Modify: `src/screens/ProfileScreen.tsx` (props `unreadNotifications: number`, `onOpenNotifications: () => void`; bell `Pressable` testID `profile-bell` left of the burger in `topBar`, badge text with `99+` above 99, hidden at 0)
- Modify: `src/components/TabBar.tsx` (`TabItem.dot?: boolean`, a small circle in the corner when true and no `badge`)
- Modify: `src/screens/MainScreen.tsx` (`useNotifications(client, userId)`; state `showNotifications`; `profile` tab item gets `dot: unread > 0`; `ProfileScreen` gets the two props; the overlay `Modal` shows `NotificationsScreen` with `onOpenPlayer={setOpenPlayer}`, `onRead={clearUnread}`, and when `openPlayer` is set shows `PlayerScreen` like the follows overlay; `closeProfileOverlays` also closes it)
- Test: `src/screens/ProfileScreen.test.tsx` (extend), `src/components/TabBar.test.tsx` (create)

**Interfaces:**
- Consumes: `useNotifications` (Task 3), `NotificationsScreen` (Task 4).

- [ ] **Step 1: Write the failing tests:** in `ProfileScreen.test.tsx` — bell shows the count `3`; shows `99+` for 150; shows no badge text for 0; pressing `profile-bell` calls `onOpenNotifications` (the existing `setup()` gets default props `unreadNotifications: 0`, `onOpenNotifications: jest.fn()`); in `TabBar.test.tsx` — a tab with `dot: true` renders `tab-dot-<key>`, none without, and a tab with both `badge` and `dot` shows only the badge.
- [ ] **Step 2: Run** `npx jest src/screens/ProfileScreen.test.tsx src/components/TabBar.test.tsx --testPathIgnorePatterns .worktrees`. Expected: FAIL.
- [ ] **Step 3: Implement** the three file changes above.
- [ ] **Step 4: Run** the new tests, the whole suite and `npx tsc --noEmit`. Expected: all PASS, no type errors.
- [ ] **Step 5: Commit** (`feat: notification bell in the profile and a dot on the tab`).

### Task 6: Apply the migration and verify live

**Files:** none.

- [ ] **Step 1:** Load `0021_notifications.sql` into the SQL editor and ask the user's approval to run it. Run it only after a yes. Expected: "Success".
- [ ] **Step 2:** Run the Task 1 check queries (read-only, plus one insert/rollback pair for the duplicate-follow check inside a transaction that is rolled back). Expected: anon cannot execute the RPCs; duplicate follow leaves one row; blocked actor not listed.
- [ ] **Step 3:** In the simulator, with the user's approval insert a follow from a second account into `follows` (service role in the SQL editor): the bell shows `1`, the Profile tab shows a dot, opening the list shows the row, the count clears. Then delete the test follow and notification rows.
- [ ] **Step 4:** Report results to the user. Push and PR only when asked.
