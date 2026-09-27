# Block user — design spec

**Date:** 2026-09-28
**Status:** approved (design), pending implementation plan

## Why

Mistwalk has social features (avatars, display names, a public opt-in leaderboard, follows, a
friend activity feed) and a report-player flow, but no way for a user to block someone abusive.
Apple's guidelines for apps with user-generated content/social features expect a report
mechanism (have it), a way to block abusive users (missing), and published terms (now have it,
see the 2026-09-28 Terms of Use work). This closes the remaining gap before the store submission
checklist's UGC item can be marked done.

## Scope

A blocked relationship is **mutual**: neither player can see the other, anywhere (leaderboard,
friend feed, direct profile lookup, follow lists). Blocking automatically removes any existing
follow relationship in both directions. A new "Заблокированные" (Blocked) screen lists blocked
players and lets you unblock them; the entry point lives on `AppMenu`'s account page. No new
screen for the block *action* itself — it's a button on the existing `PlayerScreen`, next to the
existing report flag.

## Data model

New table `public.blocks`, modeled directly on the existing `public.follows` (same repo,
`supabase/migrations/0012_follows.sql`):

```sql
create table public.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
```

RLS enabled with no policies (same pattern as `follows` and `player_reports`): direct client
access is denied, everything goes through `security definer` RPCs.

## Key simplification

`friend_feed`, `my_followers`, `my_following`, and `follow_state` all read from the `follows`
table, and `block_player` always deletes any follow row between the two players (in both
directions) as part of blocking. So none of those four need to change — a blocked pair simply
never has a follow row between them, and they already correctly stop showing each other.

Only three existing functions need a change, to add a symmetric block check via a new
`blocked_between(a, b)` helper:

- `leaderboard()` — shows every public player regardless of follow state, so a block must be
  checked explicitly.
- `player_profile(target)` — can be reached directly (e.g. tapping a leaderboard row), also
  needs the check.
- `follow_player(target)` — must refuse to create a new follow between blocked players (matters
  after one direction unblocks while a block might still exist the other way, or as a guard
  against a race between block and follow).

## New RPCs

- `block_player(target uuid)` — inserts `(auth.uid(), target)` into `blocks` (`on conflict do
  nothing`), then deletes both possible rows in `follows` between the two users.
- `unblock_player(target uuid)` — deletes the block row owned by the caller.
- `my_blocked(max_rows integer default 200)` — returns `(user_id, display_name, avatar_path)`
  for everyone the caller has blocked, newest first.
- `blocked_between(a uuid, b uuid)` — internal helper, `security definer`, returns whether a
  block exists between two users in either direction. Not intended for direct client use (not
  revoked from PostgREST, same loose convention as most existing helpers in this schema, but its
  only real callers are the three functions above).

## Client

- New file `src/lib/social/blocks.ts`, mirroring `src/lib/social/follows.ts`'s shape:
  `blockPlayer(client, target)`, `unblockPlayer(client, target)`, `fetchBlocked(client)` →
  `BlockedEntry[]` (`{ userId, displayName, avatarPath }`).
- `PlayerScreen.tsx`: a second round icon button in the header, next to the existing report flag
  (`!isMe && status === 'ready'`), opens a confirm `Alert` (title/message/Cancel+Block, Block
  styled destructive). On confirm: call `blockPlayer`, then show a "done" alert and call
  `onBack()` — the profile is no longer viewable anyway once blocked.
- New `src/screens/BlockedScreen.tsx`, structurally a trimmed copy of `FollowsScreen.tsx`: no
  tabs, one list, each row an avatar + name + an "Unblock" button (busy state per row, same
  `busyId` pattern as `FollowsScreen`'s toggle). No navigation to `PlayerScreen` from this list —
  a blocked player's profile isn't viewable, so tapping a row does nothing useful; rows are
  static except for the Unblock button.
- `AppMenu.tsx`: new item "Заблокированные" on the account page, a new required prop
  `onOpenBlocked: () => void`.
- `MainScreen.tsx`: new `showBlocked` boolean state, a `Modal` (`animationType="slide"`, matching
  the existing `Modal` usage in `MenuSheet.tsx`) rendering `BlockedScreen` when `showBlocked` is
  true; `onOpenBlocked` passed to `AppMenu` sets it, `BlockedScreen`'s `onBack` clears it. This is
  a plain top-level modal, not woven into the existing `collection`-tab ternary chain (that chain
  is for tab-local sub-screens; the blocked list is opened from the menu, which can be open from
  any tab).

## i18n

New keys in both `ru.ts` and `en.ts`:

- `player.block`, `player.blockTitle`, `player.blockConfirm`, `player.blockThanksTitle`,
  `player.blockThanks`, `player.blockFailed`
- `menu.blocked`
- `blocked.title`, `blocked.empty`, `blocked.loadFailed`, `blocked.unblock`

## Error handling / edge cases

- **Block fails (network)**: `Alert` shows a generic failure message (`player.blockFailed`),
  `PlayerScreen` stays open, nothing changed.
- **Unblock fails**: same pattern in `BlockedScreen` — row stays in the list, busy state clears,
  a failure alert/inline message (mirroring `FollowsScreen`'s `Alert.alert(t('common.failed'),
  t('common.checkInternet'))` on toggle failure).
- **Blocking someone you don't follow / who doesn't follow you**: `block_player`'s two deletes
  are no-ops for whichever direction has no row — harmless.
- **Double-block (already blocked)**: `on conflict do nothing` in `block_player`, idempotent.
- **Unblocking someone not blocked**: `unblock_player`'s delete matches zero rows, no error.
- **Blocking yourself**: `block_player` returns early (`auth.uid() = target`), same guard as
  `follow_player` and `report_player` already use.

## Out of scope

- No limit on how many players you can block (parallels `follows`' existing 500-follow cap not
  being duplicated here — could be added later if abused, not needed for launch).
- No notification to the blocked user that they were blocked (standard block-feature behavior;
  silent by design).
- No "why did you block me" or appeal flow.
