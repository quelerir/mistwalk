# Block User Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a Mistwalk user block an abusive player — mutual invisibility (leaderboard, profile, follows, friend feed), with a "Заблокированные" screen to view and undo.

**Architecture:** A new `blocks` table (modeled on the existing `follows` table) plus three new RPCs (`block_player`, `unblock_player`, `my_blocked`) and a helper (`blocked_between`). Blocking always deletes any existing follow row between the two players, which means `friend_feed`, `my_followers`, `my_following`, and `follow_state` need no code changes — they already stop showing a pair with no follow row between them. Only `leaderboard`, `player_profile`, and `follow_player` need an explicit block check added, since they don't go through `follows`.

**Tech Stack:** React Native (Expo), TypeScript, `@supabase/supabase-js`, PostgreSQL (Supabase), Jest.

**Spec:** [docs/superpowers/specs/2026-09-28-block-user-design.md](../specs/2026-09-28-block-user-design.md)

## Global Constraints

- Blocking is mutual: neither side can see the other anywhere, no exceptions.
- Blocking always removes any existing follow relationship in both directions.
- No new screen for the block *action* — it's a button on the existing `PlayerScreen`.
- The "Заблокированные" list screen has no navigation to blocked players' profiles (they aren't viewable once blocked).
- No block-count cap (unlike `follows`' 500 cap) — out of scope per spec.

## Review Focus

- **Blocking someone you already follow (or who follows you)** — both follow rows must be gone afterward, in both directions, not just one. Covered by Task 1's manual verification and by `block_player`'s two-sided `delete`.
- **Viewing a blocked player's profile directly (not through the feed/follow list)** — e.g. an already-cached leaderboard row or a deep link — must return nothing, not stale data. Covered by `player_profile`'s `blocked_between` check at the top of the function, verified manually in Task 1.
- **Re-following after an unblock** — `follow_player` must work again once no block row remains between the two users. Covered by Task 1's manual verification (block → unblock → follow succeeds).
- **Blocking yourself** — must be a no-op, not an error or a self-block row. Covered by `block_player`'s early return, mirroring `follow_player`'s and `report_player`'s existing self-target guard, verified manually.
- **Network failure on block/unblock** — the UI must show a failure message and leave state unchanged (not optimistically remove/add rows), matching how `FollowsScreen`'s existing toggle failure works. Covered by Task 2 and Task 4's unit tests (mocked RPC failure).

---

## Task 1: `blocks` migration and RPCs (database)

**Files:**
- Create: `supabase/migrations/0016_blocks.sql`

**Interfaces:**
- Consumes: nothing from other tasks (standalone backend deployable independently).
- Produces: RPCs `block_player(target uuid)`, `unblock_player(target uuid)`, `my_blocked(max_rows integer default 200)` returning `(user_id uuid, display_name text, avatar_path text)` — used by Task 2. Also changes the existing `leaderboard()`, `player_profile(target uuid)`, and `follow_player(target uuid)` functions in place (same signatures, no client-visible change to their existing callers).

No automated test setup exists for SQL migrations in this repo (checked: no test harness invokes them) — this task is verified by manual testing against the live database, same as how the `delete-account` edge function was verified. Applying the migration to the live Supabase project is a production database change — get explicit confirmation before running Step 2's `Apply the migration` in the live SQL Editor.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/0016_blocks.sql
--
-- Blocks: mutual visibility control between players. Blocking removes any existing follow in
-- either direction and prevents a new one; it also hides the blocked player from the leaderboard
-- and from being looked up directly. friend_feed, my_followers, my_following and follow_state
-- need no changes here: they are all driven by the follows table, and a block always keeps that
-- table empty between the two players involved.

create table if not exists public.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

-- Row level security with no policies: direct access from clients is denied, same as follows.
alter table public.blocks enable row level security;

create or replace function public.blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

create or replace function public.block_player(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() = target then
    return;
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), target)
  on conflict do nothing;
  delete from public.follows
  where (follower_id = auth.uid() and followee_id = target)
     or (follower_id = target and followee_id = auth.uid());
end;
$$;

create or replace function public.unblock_player(target uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.blocks where blocker_id = auth.uid() and blocked_id = target;
$$;

create or replace function public.my_blocked(max_rows integer default 200)
returns table (user_id uuid, display_name text, avatar_path text)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.display_name, p.avatar_path
  from public.blocks b
  join public.player_profiles p on p.user_id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc
  limit greatest(1, least(max_rows, 200));
$$;

drop function if exists public.leaderboard(integer);

create function public.leaderboard(max_rows integer default 50)
returns table (user_id uuid, display_name text, found_count bigint, rank bigint, avatar_path text)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.display_name, c.n as found_count,
         rank() over (order by c.n desc) as rank, p.avatar_path
  from public.player_profiles p
  left join lateral (select count(*) as n from public.verified_places(p.user_id)) c on true
  where p.is_public and not p.blocked and not public.blocked_between(auth.uid(), p.user_id)
  order by c.n desc, p.display_name
  limit greatest(1, least(max_rows, 100));
$$;

create or replace function public.player_profile(target uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  p public.player_profiles;
begin
  if public.blocked_between(auth.uid(), target) then
    return null;
  end if;
  select * into p from public.player_profiles where user_id = target and is_public and not blocked;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'user_id', p.user_id,
    'display_name', p.display_name,
    'avatar_path', p.avatar_path,
    'distance_km', public.server_distance_km(target),
    'countries', p.countries,
    'cities', p.cities,
    'updated_at', p.updated_at,
    'found_count', (select count(*) from public.verified_places(target)),
    'places', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'name', t.name, 'kind', t.kind, 'discovered_at', t.discovered_at,
               'country', p.place_regions -> t.osm_id ->> 'c',
               'city', nullif(p.place_regions -> t.osm_id ->> 't', '')
             ) order by t.discovered_at desc), '[]'::jsonb)
      from (
        select osm_id, name, kind, discovered_at
        from public.verified_places(target)
        order by discovered_at desc
        limit 1000
      ) t
    )
  );
end;
$$;

create or replace function public.follow_player(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() = target then
    return;
  end if;
  if public.blocked_between(auth.uid(), target) then
    raise exception 'profile not available' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.player_profiles p where p.user_id = target and p.is_public and not p.blocked
  ) then
    raise exception 'profile not available' using errcode = '22023';
  end if;
  if (select count(*) from public.follows where follower_id = auth.uid()) >= 500 then
    raise exception 'too many follows' using errcode = '22023';
  end if;
  insert into public.follows (follower_id, followee_id) values (auth.uid(), target)
  on conflict do nothing;
end;
$$;
```

- [ ] **Step 2: Apply the migration**

Ask for explicit confirmation before running this against the live project (this changes production schema and functions). Once confirmed, apply it the same way `delete-account` was deployed: paste the SQL into the Supabase Studio SQL Editor for the `Mobile` project (`kzjqqdijtsbayalpwrmk`) at
`https://supabase.com/dashboard/project/kzjqqdijtsbayalpwrmk/sql/new` and run it. (If Supabase CLI access is available in this session by the time this task runs, `supabase db push` from the repo root is the alternative — check for that first.)

- [ ] **Step 3: Manual verification**

Using two throwaway test accounts (A and B, not `fogmap.test@example.com`) in Supabase Studio's SQL editor or the app itself:

1. Have A follow B and B follow A (mutual follow).
2. Call `select block_player('<B's user id>')` as A (or trigger it from the app once Task 5 lands).
3. Confirm in Studio that no rows remain in `follows` between A and B in either direction.
4. Confirm `select * from my_blocked()` as A returns B.
5. Confirm `select player_profile('<B's user id>')` as A returns `null`, and `select player_profile('<A's user id>')` as B also returns `null`.
6. Confirm B no longer appears in `select * from leaderboard()` as A, and vice versa.
7. Call `select follow_player('<B's user id>')` as A — confirm it raises (or silently does nothing observable) rather than creating a follow.
8. Call `select unblock_player('<B's user id>')` as A, then repeat step 7 — this time the follow should succeed.
9. Confirm blocking yourself (`select block_player(auth.uid())`, or the equivalent with your own id) does nothing and creates no row.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0016_blocks.sql
git commit -m "feat: add blocks table and RPCs"
```

---

## Task 2: `src/lib/social/blocks.ts` client wrapper

**Files:**
- Create: `src/lib/social/blocks.ts`
- Test: `src/lib/social/blocks.test.ts`

**Interfaces:**
- Consumes: nothing new (same `SupabaseClient` type pattern as `src/lib/social/follows.ts`).
- Produces:
  ```ts
  export interface BlockedEntry {
    userId: string;
    displayName: string;
    avatarPath: string | null;
  }
  export async function blockPlayer(client: SupabaseClient, target: string): Promise<void>;
  export async function unblockPlayer(client: SupabaseClient, target: string): Promise<void>;
  export async function fetchBlocked(client: SupabaseClient): Promise<BlockedEntry[]>;
  ```
  Used by Task 4 (`BlockedScreen`) and Task 5 (`PlayerScreen`).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/social/blocks.test.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { blockPlayer, unblockPlayer, fetchBlocked } from './blocks';

function client(result: { data: unknown; error: unknown }) {
  const rpc = jest.fn().mockResolvedValue(result);
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

const row = { user_id: 'u2', display_name: 'Анна', avatar_path: null };

describe('blocks', () => {
  it('blocks and unblocks through the functions', async () => {
    const a = client({ data: null, error: null });
    await blockPlayer(a.client, 'u2');
    expect(a.rpc).toHaveBeenCalledWith('block_player', { target: 'u2' });
    const b = client({ data: null, error: null });
    await unblockPlayer(b.client, 'u2');
    expect(b.rpc).toHaveBeenCalledWith('unblock_player', { target: 'u2' });
  });

  it('throws when blocking fails', async () => {
    await expect(blockPlayer(client({ data: null, error: new Error('nope') }).client, 'u2')).rejects.toThrow('nope');
  });

  it('throws when unblocking fails', async () => {
    await expect(unblockPlayer(client({ data: null, error: new Error('nope') }).client, 'u2')).rejects.toThrow('nope');
  });

  it('maps the blocked list', async () => {
    const { client: c, rpc } = client({ data: [row], error: null });
    expect(await fetchBlocked(c)).toEqual([{ userId: 'u2', displayName: 'Анна', avatarPath: null }]);
    expect(rpc).toHaveBeenCalledWith('my_blocked', { max_rows: 200 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/lib/social/blocks.test.ts`
Expected: FAIL — `./blocks` does not exist yet.

- [ ] **Step 3: Implement `blocks.ts`**

Create `src/lib/social/blocks.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface BlockedEntry {
  userId: string;
  displayName: string;
  avatarPath: string | null;
}

interface BlockedRow {
  user_id: string;
  display_name: string;
  avatar_path: string | null;
}

const LIST_LIMIT = 200;

export async function blockPlayer(client: SupabaseClient, target: string): Promise<void> {
  const { error } = await client.rpc('block_player', { target });
  if (error) throw error;
}

export async function unblockPlayer(client: SupabaseClient, target: string): Promise<void> {
  const { error } = await client.rpc('unblock_player', { target });
  if (error) throw error;
}

export async function fetchBlocked(client: SupabaseClient): Promise<BlockedEntry[]> {
  const { data, error } = await client.rpc('my_blocked', { max_rows: LIST_LIMIT });
  if (error) throw error;
  return ((data ?? []) as BlockedRow[]).map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    avatarPath: row.avatar_path ?? null,
  }));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/lib/social/blocks.test.ts`
Expected: PASS, all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/social/blocks.ts src/lib/social/blocks.test.ts
git commit -m "feat: add blocks client wrapper"
```

---

## Task 3: i18n strings

**Files:**
- Modify: `src/i18n/ru.ts`
- Modify: `src/i18n/en.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: keys `player.block`, `player.blockTitle`, `player.blockConfirm`,
  `player.blockThanksTitle`, `player.blockThanks`, `player.blockFailed`, `menu.blocked`,
  `blocked.title`, `blocked.empty`, `blocked.loadFailed`, `blocked.unblock` — used by Tasks 4-6.

`src/i18n/dictionaries.test.ts` already fails if `en.ts` doesn't have exactly the same keys as
`ru.ts`; running it is this task's verification, no new test file needed.

- [ ] **Step 1: Add the Russian strings**

In `src/i18n/ru.ts`, add after the existing `'player.reportFailed': 'Не удалось отправить',` line:

```ts
  'player.block': 'Заблокировать',
  'player.blockTitle': 'Заблокировать игрока?',
  'player.blockConfirm': 'Вы перестанете видеть друг друга в рейтинге, ленте и подписках. Отменить можно в разделе «Заблокированные».',
  'player.blockThanksTitle': 'Готово',
  'player.blockThanks': 'Игрок заблокирован.',
  'player.blockFailed': 'Не удалось заблокировать. Проверьте интернет и попробуйте ещё раз.',
```

Add after the existing `'menu.deleteAccountFailed': '...'` line:

```ts
  'menu.blocked': 'Заблокированные',
```

Add after the existing `'follows.mutual': 'Взаимная подписка',` line:

```ts
  'blocked.title': 'Заблокированные',
  'blocked.empty': 'Вы никого не заблокировали.',
  'blocked.loadFailed': 'Не удалось загрузить. Проверьте интернет и попробуйте позже.',
  'blocked.unblock': 'Разблокировать',
```

- [ ] **Step 2: Add the English strings**

In `src/i18n/en.ts`, add after the existing `'player.reportFailed': 'Could not send',` line:

```ts
  'player.block': 'Block',
  'player.blockTitle': 'Block this player?',
  'player.blockConfirm': "You'll stop seeing each other on the leaderboard, in the feed, and in follows. You can undo this from the Blocked screen.",
  'player.blockThanksTitle': 'Done',
  'player.blockThanks': 'Player blocked.',
  'player.blockFailed': 'Could not block. Check your internet and try again.',
```

Add after the existing `'menu.deleteAccountFailed': '...'` line:

```ts
  'menu.blocked': 'Blocked',
```

Add after the existing `'follows.mutual': 'Follows you back',` line:

```ts
  'blocked.title': 'Blocked',
  'blocked.empty': "You haven't blocked anyone.",
  'blocked.loadFailed': 'Could not load. Check your internet and try again later.',
  'blocked.unblock': 'Unblock',
```

- [ ] **Step 3: Run the dictionary test to confirm parity**

Run: `npx jest src/i18n/dictionaries.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/ru.ts src/i18n/en.ts
git commit -m "feat: add block-user i18n strings"
```

---

## Task 4: `BlockedScreen`

**Files:**
- Create: `src/screens/BlockedScreen.tsx`

**Interfaces:**
- Consumes: `fetchBlocked`, `unblockPlayer` (Task 2); `avatarUrl` from `src/lib/social/profiles.ts`
  (already exists, used the same way in `FollowsScreen.tsx`); i18n keys `blocked.*` (Task 3).
- Produces: `BlockedScreenProps { client: SupabaseClient; onBack: () => void }`, default export
  `BlockedScreen`. Used by Task 6.

No component-test convention exists in this repo (checked: zero `.test.tsx` files under
`src/components` or `src/screens` that render a component — see the account-deletion plan's Task
5 for the same finding). This task is verified by the manual check in Task 6, not a new test file.

- [ ] **Step 1: Write `BlockedScreen.tsx`**

Modeled directly on `src/screens/FollowsScreen.tsx`, trimmed to one list with an Unblock button
instead of tabs and a follow toggle:

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import Avatar from '../components/Avatar';
import { fetchBlocked, unblockPlayer, type BlockedEntry } from '../lib/social/blocks';
import { avatarUrl } from '../lib/social/profiles';
import { useStyles } from '../theme/ThemeProvider';
import type { Colors } from '../theme/palettes';
import { FONT } from '../theme/fonts';
import { useT } from '../i18n/I18nProvider';

export interface BlockedScreenProps {
  client: SupabaseClient;
  onBack: () => void;
}

export default function BlockedScreen({ client, onBack }: BlockedScreenProps) {
  const t = useT();
  const styles = useStyles(makeStyles);
  const [entries, setEntries] = useState<BlockedEntry[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    fetchBlocked(client)
      .then((list) => {
        if (cancelled) return;
        setEntries(list);
        setStatus('ready');
      })
      .catch((err) => {
        console.warn('[blocked] load failed', err);
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  const unblock = useCallback(
    async (entry: BlockedEntry) => {
      setBusyId(entry.userId);
      try {
        await unblockPlayer(client, entry.userId);
        setEntries((prev) => prev.filter((e) => e.userId !== entry.userId));
      } catch (err) {
        console.warn('[blocked] unblock failed', err);
        Alert.alert(t('common.failed'), t('common.checkInternet'));
      } finally {
        setBusyId(null);
      }
    },
    [client, t]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{t('blocked.title')}</Text>
      </View>

      {status === 'loading' ? (
        <ActivityIndicator style={styles.loader} />
      ) : status === 'error' ? (
        <Text style={styles.empty}>{t('blocked.loadFailed')}</Text>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.userId}
          ListEmptyComponent={<Text style={styles.empty}>{t('blocked.empty')}</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Avatar uri={avatarUrl(client, item.avatarPath)} name={item.displayName} size={44} />
              <Text style={styles.name} numberOfLines={1}>
                {item.displayName}
              </Text>
              <Pressable
                style={styles.unblockButton}
                onPress={() => void unblock(item)}
                disabled={busyId === item.userId}
                accessibilityRole="button"
              >
                {busyId === item.userId ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Text style={styles.unblockText}>{t('blocked.unblock')}</Text>
                )}
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  back: { fontSize: 36, lineHeight: 36, color: c.text, marginRight: 12, marginTop: -4 },
  title: { fontSize: 26, fontFamily: FONT.display, letterSpacing: -0.8, color: c.text },
  loader: { marginTop: 32 },
  empty: { marginTop: 32, paddingHorizontal: 24, textAlign: 'center', color: c.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16 },
  name: { flex: 1, fontSize: 16, fontWeight: '600', color: c.text },
  unblockButton: { paddingHorizontal: 14, height: 32, borderRadius: 16, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  unblockText: { fontSize: 13, fontWeight: '600', color: c.text },
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (this file isn't imported by anything yet, so it should already
type-check standalone; Task 6 wires it in).

- [ ] **Step 3: Commit**

```bash
git add src/screens/BlockedScreen.tsx
git commit -m "feat: add BlockedScreen"
```

---

## Task 5: Block action on `PlayerScreen`

**Files:**
- Modify: `src/screens/PlayerScreen.tsx`

**Interfaces:**
- Consumes: `blockPlayer` (Task 2); i18n keys `player.block*` (Task 3).
- Produces: no new exports — internal behavior change only.

No test file changes (same no-component-test-convention reasoning as Task 4).

- [ ] **Step 1: Import `blockPlayer`**

Change:

```ts
import { avatarUrl, fetchPlayerProfile, reportPlayer, type PlayerProfile, type ReportReason } from '../lib/social/profiles';
```

to:

```ts
import { avatarUrl, fetchPlayerProfile, reportPlayer, type PlayerProfile, type ReportReason } from '../lib/social/profiles';
import { blockPlayer } from '../lib/social/blocks';
```

- [ ] **Step 2: Add the `block` function**

Add after the existing `report()` function (after its closing `}`):

```ts
  function confirmBlock() {
    Alert.alert(t('player.blockTitle'), t('player.blockConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('player.block'), style: 'destructive', onPress: () => void block() },
    ]);
  }

  async function block() {
    try {
      await blockPlayer(client, playerId);
      Alert.alert(t('player.blockThanksTitle'), t('player.blockThanks'));
      onBack();
    } catch (err) {
      console.warn('[player] block failed', err);
      Alert.alert(t('player.blockFailed'), t('common.checkInternet'));
    }
  }
```

- [ ] **Step 3: Add the header button**

Change the header block:

```tsx
        {!isMe && status === 'ready' && (
          <Pressable onPress={report} hitSlop={8} style={styles.roundButton} accessibilityRole="button" accessibilityLabel={t('player.report')}>
            <SvgIcon name="flag" size={20} color={c.textMuted} />
          </Pressable>
        )}
```

to:

```tsx
        {!isMe && status === 'ready' && (
          <View style={styles.headerActions}>
            <Pressable onPress={report} hitSlop={8} style={styles.roundButton} accessibilityRole="button" accessibilityLabel={t('player.report')}>
              <SvgIcon name="flag" size={20} color={c.textMuted} />
            </Pressable>
            <Pressable onPress={confirmBlock} hitSlop={8} style={styles.roundButton} accessibilityRole="button" accessibilityLabel={t('player.block')}>
              <SvgIcon name="close" size={20} color={c.textMuted} />
            </Pressable>
          </View>
        )}
```

Add `headerActions: { flexDirection: 'row', gap: 8 },` to the stylesheet, next to the existing
`roundButton:` entry (find `roundButton: { width: 40, ...` in `makeStyles` and add the new key
right after it).

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/screens/PlayerScreen.tsx
git commit -m "feat: add block action to PlayerScreen"
```

---

## Task 6: Wire up `AppMenu` and `MainScreen`

**Files:**
- Modify: `src/components/AppMenu.tsx`
- Modify: `src/screens/MainScreen.tsx`

**Interfaces:**
- Consumes: `BlockedScreen` (Task 4); i18n key `menu.blocked` (Task 3).
- Produces: `AppMenuProps.onOpenBlocked: () => void`; completes the feature end to end.

- [ ] **Step 1: Add the prop and menu item to `AppMenu.tsx`**

Add to `AppMenuProps` (after `onDeleteAccount: () => Promise<void>;`):

```ts
  onOpenBlocked: () => void;
```

Destructure it in the component's parameter list (after `onDeleteAccount,`):

```ts
  onOpenBlocked,
```

Add a new item to the `accountItems` array, after the `privacyPolicy` item and before
`termsOfUse` (or anywhere in that same neighborhood — exact position among the informational
items doesn't matter, just keep it out of the destructive-styled items):

```ts
    {
      key: 'blocked',
      icon: 'flag',
      label: t('menu.blocked'),
      onPress: closeThen(onOpenBlocked),
    },
```

- [ ] **Step 2: Wire it up in `MainScreen.tsx`**

Add to the imports:

```ts
import BlockedScreen from './BlockedScreen';
```

And add `Modal` to the existing `react-native` import line (find `import { Linking, StyleSheet,
View } from 'react-native';` and change it to include `Modal`):

```ts
import { Linking, Modal, StyleSheet, View } from 'react-native';
```

Add new state near the other `showX` state declarations (e.g. next to `const [showFollows,
setShowFollows] = useState(false);`):

```ts
  const [showBlocked, setShowBlocked] = useState(false);
```

Find the `<AppMenu ... />` element and add, next to `onDeleteAccount={handleDeleteAccount}`:

```tsx
        onOpenBlocked={() => setShowBlocked(true)}
```

Add a `Modal` rendering `BlockedScreen`, placed as a sibling right after the `<AppMenu ... />`
element closes:

```tsx
      <Modal visible={showBlocked} animationType="slide" onRequestClose={() => setShowBlocked(false)}>
        <BlockedScreen client={client} onBack={() => setShowBlocked(false)} />
      </Modal>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the full test suite**

Run: `npx jest`
Expected: PASS, including the new tests from Tasks 2 and 3.

- [ ] **Step 5: Manual verification in the simulator**

With the migration from Task 1 already applied live:

1. Sign in as one throwaway test account, open another test account's profile (e.g. via the
   leaderboard), tap the new block icon in the header, confirm the Alert, confirm you're
   returned to the previous screen with a "Player blocked" confirmation.
2. Open Menu → Account → "Заблокированные", confirm the blocked player appears.
3. Confirm the blocked player no longer appears in the leaderboard or friend feed.
4. Tap "Разблокировать" in the Blocked screen, confirm the row disappears and the list shows
   empty state if that was the only one.
5. Confirm you can follow that player again after unblocking.

- [ ] **Step 6: Commit**

```bash
git add src/components/AppMenu.tsx src/screens/MainScreen.tsx
git commit -m "feat: wire up block-user in AppMenu and MainScreen"
```
