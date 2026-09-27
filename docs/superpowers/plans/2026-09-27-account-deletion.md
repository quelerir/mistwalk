# Account Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in Mistwalk user permanently delete their account and all their data from inside the app, satisfying Apple's in-app account-deletion requirement.

**Architecture:** A new Supabase Edge Function (`delete-account`, service-role) deletes the `auth.users` row (Postgres cascades the rest) and cleans up the user's avatar storage file. The client gets a small testable orchestration function (`performAccountDeletion`, mirroring the existing `performSignOut`) that calls the Edge Function, then does local cleanup and hands off to the same "signed out" path the app already uses. A new "Delete account" item on `AppMenu`'s account page triggers it behind a confirm `Alert`.

**Tech Stack:** React Native (Expo), TypeScript, `@supabase/supabase-js`, Supabase Edge Functions (Deno), Jest.

**Spec:** [docs/superpowers/specs/2026-09-27-account-deletion-design.md](../specs/2026-09-27-account-deletion-design.md)

## Global Constraints

- Deletion is immediate and irreversible — no grace period, no "pending deletion" state.
- No re-authentication step before deletion — a destructive-styled `Alert.alert` confirm is enough (matches the existing report-flow in `PlayerScreen.tsx`).
- Feedback rows are deleted along with the account (no anonymized retention).
- No new screen — the entry point lives on the existing `AppMenu` account page.
- No database migration — every `user_id` FK to `auth.users` already has `on delete cascade`; only the Edge Function and client code are new.

## Review Focus

- **Delete succeeds but avatar cleanup fails** — the app must still treat this as a successful deletion (the user is gone either way); only a leftover storage object is at stake, never surfaced to the client. Covered by Task 1's manual verification notes and Task 1's step ordering (delete the user first, clean up storage after, swallow storage errors).
- **Edge Function called with no/expired token** — must return 401 and touch nothing. Covered by Task 1's implementation (checks `auth.getUser()` before doing anything privileged).
- **Network failure calling the Edge Function** — the app must show an error and leave the user still signed in on the account page, not silently sign them out. Covered by Task 4's `performAccountDeletion` test ("does not run cleanup or call onDeleted when the remote delete fails") and Task 6's `runDeleteAccount` (catches, sets `note`, never calls `onDeleteAccount`'s cleanup path itself since that only happens inside a successful `performAccountDeletion`).
- **User double-taps "Delete account" while a delete is already in flight** — must not fire two deletes. Covered by Task 6's `deleting` guard.
- **RU/EN copy drifts out of sync** — the repo already enforces this: `src/i18n/dictionaries.test.ts` fails if `en.ts` doesn't have exactly the same keys (and `{placeholders}`) as `ru.ts`. Task 3 adds the same keys to both files and step 3 of that task runs the existing test to confirm parity.

---

## Task 1: `delete-account` Edge Function

**Files:**
- Create: `supabase/functions/delete-account/index.ts`

**Interfaces:**
- Consumes: nothing from other tasks (standalone backend deployable independently).
- Produces: an HTTP endpoint the client invokes as `client.functions.invoke('delete-account')` (used by Task 2). Returns `200` with `{ ok: true }` on success; `401` with a plain-text body when the caller isn't authenticated; `500` with a plain-text body if the deletion itself fails.

There is no existing Deno-test setup for Edge Functions in this repo (`feedback-email` and `pois` have none) — this task is verified manually, matching how those two are validated. This is a backend-only task; there's no separate "write a failing test" step for it.

- [ ] **Step 1: Write the Edge Function**

```ts
// supabase/functions/delete-account/index.ts
//
// Called by the client (with the signed-in user's JWT) when they choose "Delete account" in
// the app. Deletes the auth user, which Postgres cascades through player_profiles,
// visited_points, discovered_places, follows and feedback (all `on delete cascade`), then
// best-effort removes the user's avatar file from the `avatars` storage bucket, which is not
// covered by any foreign key.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS });

  const authHeader = req.headers.get("Authorization") ?? "";
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser();
  if (userError || !user) {
    return new Response("Unauthorized", { status: 401, headers: CORS });
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("delete-account: failed to delete user", user.id, deleteError);
    return new Response("Could not delete account", { status: 500, headers: CORS });
  }

  const { data: avatarFiles } = await adminClient.storage.from("avatars").list(user.id);
  if (avatarFiles && avatarFiles.length > 0) {
    const paths = avatarFiles.map((f) => `${user.id}/${f.name}`);
    const { error: storageError } = await adminClient.storage.from("avatars").remove(paths);
    if (storageError) {
      // The account is already gone; a leftover avatar file is not worth failing the request over.
      console.error("delete-account: failed to remove avatar files for", user.id, storageError);
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
```

- [ ] **Step 2: Deploy and verify manually**

Deploy with the Supabase CLI:

```bash
supabase functions deploy delete-account
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically to every Edge Function by the Supabase platform — no secret to set for this one.

Manual verification (do this once Task 6 is also done and you can trigger it from the app, or earlier with `curl` and a real access token from a throwaway test account):

1. Create a throwaway test account in the app, upload an avatar photo, walk around enough to visit at least one point, and follow another test account.
2. Trigger deletion (via the app once Task 6 lands, or `curl -X POST <function-url> -H "Authorization: Bearer <access token>"` beforehand).
3. In Supabase Studio, confirm the `auth.users` row is gone, and that `player_profiles`, `visited_points`, `discovered_places`, `follows` (both as follower and followee) and `feedback` rows for that user are all gone.
4. Confirm the `avatars` bucket no longer has a folder for that user's id.
5. Confirm the same email can sign up again afterward.
6. Call the function with no `Authorization` header (or a garbage one) and confirm it returns `401` and touches nothing.

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/delete-account/index.ts
git commit -m "feat: add delete-account edge function"
```

---

## Task 2: `deleteAccount` client wrapper

**Files:**
- Modify: `src/lib/supabase/auth.ts`
- Test: `src/lib/supabase/auth.test.ts`

**Interfaces:**
- Consumes: nothing new (same `SupabaseClient` type already imported in this file).
- Produces: `deleteAccount(client: SupabaseClient): Promise<void>` — resolves on success, throws on any error. Used by Task 4.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/supabase/auth.test.ts`, importing `deleteAccount` alongside the existing imports:

```ts
import { signUp, signIn, signOut, signOutLocal, getSession, checkLoginAvailable, deleteAccount } from './auth';
```

Add a fake `functions.invoke` to `makeFakeClient`'s returned object (alongside the existing `rpc` and `auth` keys):

```ts
function makeFakeClient(
  overrides: Partial<SupabaseClient['auth']> = {},
  rpc = jest.fn().mockResolvedValue({ data: true, error: null }),
  functionsInvoke = jest.fn().mockResolvedValue({ data: { ok: true }, error: null })
) {
  return {
    rpc,
    functions: { invoke: functionsInvoke },
    auth: {
      signUp: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
      signInWithPassword: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null }),
      ...overrides,
    },
  } as unknown as SupabaseClient;
}
```

(This changes `makeFakeClient`'s signature to take a third optional arg; existing call sites that only pass zero, one or two args keep working unchanged.)

Add new test cases at the end of the `describe('auth wrappers', ...)` block:

```ts
  it('deleteAccount invokes the delete-account function and resolves on success', async () => {
    const functionsInvoke = jest.fn().mockResolvedValue({ data: { ok: true }, error: null });
    const client = makeFakeClient({}, undefined, functionsInvoke);
    await expect(deleteAccount(client)).resolves.toBeUndefined();
    expect(functionsInvoke).toHaveBeenCalledWith('delete-account');
  });

  it('deleteAccount throws when the function call fails', async () => {
    const functionsInvoke = jest.fn().mockResolvedValue({ data: null, error: new Error('unreachable') });
    const client = makeFakeClient({}, undefined, functionsInvoke);
    await expect(deleteAccount(client)).rejects.toThrow('unreachable');
  });
```

Note the second argument to `makeFakeClient` is `rpc`, which the two new tests pass as `undefined` so the default `rpc` mock is used — matches how the file already calls `makeFakeClient({}, rpc)` elsewhere with a real `rpc` when needed.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/lib/supabase/auth.test.ts`
Expected: FAIL — `deleteAccount` is not exported from `./auth`.

- [ ] **Step 3: Implement `deleteAccount`**

Add to `src/lib/supabase/auth.ts`, after `signOutLocal`:

```ts
export async function deleteAccount(client: SupabaseClient): Promise<void> {
  const { error } = await client.functions.invoke('delete-account');
  if (error) throw error;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/lib/supabase/auth.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/auth.ts src/lib/supabase/auth.test.ts
git commit -m "feat: add deleteAccount client wrapper"
```

---

## Task 3: i18n strings

**Files:**
- Modify: `src/i18n/ru.ts`
- Modify: `src/i18n/en.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: four new translation keys — `menu.deleteAccount`, `menu.deleteAccountTitle`, `menu.deleteAccountConfirm`, `menu.deleteAccountFailed` — used by Task 6.

`ru.ts` is the source of truth for the `Key` type; `src/i18n/dictionaries.test.ts` already fails if `en.ts` doesn't have exactly the same keys. No new test file needed — running the existing one is this task's verification.

- [ ] **Step 1: Add the Russian strings**

In `src/i18n/ru.ts`, add after the `'menu.signOut': 'Выйти',` line:

```ts
  'menu.deleteAccount': 'Удалить аккаунт',
  'menu.deleteAccountTitle': 'Удалить аккаунт?',
  'menu.deleteAccountConfirm': 'Это навсегда удалит ваш аккаунт и все данные — пройденный путь, открытые места, подписки. Отменить это будет нельзя.',
  'menu.deleteAccountFailed': 'Не удалось удалить аккаунт. Проверьте интернет и попробуйте ещё раз.',
```

- [ ] **Step 2: Add the English strings**

In `src/i18n/en.ts`, add after the `'menu.signOut': 'Sign out',` line:

```ts
  'menu.deleteAccount': 'Delete account',
  'menu.deleteAccountTitle': 'Delete account?',
  'menu.deleteAccountConfirm': 'This permanently deletes your account and all your data — your explored path, discovered places, and follows. This cannot be undone.',
  'menu.deleteAccountFailed': 'Could not delete your account. Check your internet and try again.',
```

- [ ] **Step 3: Run the dictionary test to confirm parity**

Run: `npx jest src/i18n/dictionaries.test.ts`
Expected: PASS — same keys in both files, no empty texts, no placeholder mismatches (these four keys have no `{name}` placeholders).

- [ ] **Step 4: Commit**

```bash
git add src/i18n/ru.ts src/i18n/en.ts
git commit -m "feat: add delete-account i18n strings"
```

---

## Task 4: `performAccountDeletion` orchestration

**Files:**
- Create: `src/lib/session/deleteAccountFlow.ts`
- Test: `src/lib/session/deleteAccountFlow.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks directly (steps are injected by the caller in Task 5, the same way `performSignOut` in `src/lib/session/signOutFlow.ts` already works).
- Produces:
  ```ts
  export interface AccountDeletionSteps {
    deleteRemote: () => Promise<void>;
    stopForeground: () => void;
    stopBackground: () => Promise<void>;
    clearLocalSession: () => Promise<void>;
    onDeleted: () => void;
    onWarn?: (message: string, error: unknown) => void;
  }
  export async function performAccountDeletion(steps: AccountDeletionSteps): Promise<void>;
  ```
  Used by Task 5. Unlike `performSignOut`, this **rethrows** if `deleteRemote` fails and does **not** run any of the other steps or call `onDeleted` in that case — deletion failing must leave the user signed in and untouched, not partway through a sign-out.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/session/deleteAccountFlow.test.ts`:

```ts
import { performAccountDeletion, type AccountDeletionSteps } from './deleteAccountFlow';

function steps(overrides: Partial<AccountDeletionSteps> = {}): AccountDeletionSteps & { order: string[] } {
  const order: string[] = [];
  return {
    order,
    deleteRemote: async () => void order.push('deleteRemote'),
    stopForeground: () => void order.push('stopForeground'),
    stopBackground: async () => void order.push('stopBackground'),
    clearLocalSession: async () => void order.push('clearLocalSession'),
    onDeleted: () => void order.push('onDeleted'),
    ...overrides,
  };
}

describe('performAccountDeletion', () => {
  it('deletes remotely, cleans up locally, then reports deletion, in that order', async () => {
    const s = steps();
    await performAccountDeletion(s);
    expect(s.order).toEqual(['deleteRemote', 'stopForeground', 'stopBackground', 'clearLocalSession', 'onDeleted']);
  });

  it('rethrows and does nothing else when the remote delete fails', async () => {
    const s = steps({ deleteRemote: async () => { throw new Error('offline'); } });
    await expect(performAccountDeletion(s)).rejects.toThrow('offline');
    expect(s.order).toEqual([]);
  });

  it('keeps going and still reports deletion when stopping tracking fails', async () => {
    const warn = jest.fn();
    const s = steps({
      stopForeground: () => { throw new Error('boom'); },
      stopBackground: async () => { throw new Error('boom'); },
      onWarn: warn,
    });
    await performAccountDeletion(s);
    expect(s.order).toEqual(['deleteRemote', 'clearLocalSession', 'onDeleted']);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('still reports deletion when clearing the local session fails', async () => {
    const warn = jest.fn();
    const s = steps({ clearLocalSession: async () => { throw new Error('nope'); }, onWarn: warn });
    await performAccountDeletion(s);
    expect(s.order).toEqual(['deleteRemote', 'stopForeground', 'stopBackground', 'onDeleted']);
    expect(warn).toHaveBeenCalledWith(expect.any(String), expect.any(Error));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/lib/session/deleteAccountFlow.test.ts`
Expected: FAIL — `./deleteAccountFlow` does not exist yet.

- [ ] **Step 3: Implement `performAccountDeletion`**

Create `src/lib/session/deleteAccountFlow.ts`:

```ts
export interface AccountDeletionSteps {
  // Must throw on failure — a failed remote delete must not run any of the steps below or
  // call onDeleted, unlike sign-out this has no "fall back to local" mode: if this failed,
  // the account still exists and the user is still signed in.
  deleteRemote: () => Promise<void>;
  stopForeground: () => void;
  stopBackground: () => Promise<void>;
  clearLocalSession: () => Promise<void>;
  onDeleted: () => void;
  onWarn?: (message: string, error: unknown) => void;
}

export async function performAccountDeletion(steps: AccountDeletionSteps): Promise<void> {
  await steps.deleteRemote();

  const warn = steps.onWarn ?? (() => {});

  try {
    steps.stopForeground();
  } catch (err) {
    warn('stopping foreground tracking failed', err);
  }

  try {
    await steps.stopBackground();
  } catch (err) {
    warn('stopping background tracking failed', err);
  }

  try {
    await steps.clearLocalSession();
  } catch (err) {
    warn('clearing the local session failed', err);
  }

  steps.onDeleted();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/lib/session/deleteAccountFlow.test.ts`
Expected: PASS, all four tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/session/deleteAccountFlow.ts src/lib/session/deleteAccountFlow.test.ts
git commit -m "feat: add performAccountDeletion orchestration"
```

---

## Task 5: `AppMenu` UI

**Files:**
- Modify: `src/components/AppMenu.tsx`

**Interfaces:**
- Consumes: `t('menu.deleteAccount')`, `t('menu.deleteAccountTitle')`, `t('menu.deleteAccountConfirm')`, `t('menu.deleteAccountFailed')` (Task 3); `t('common.cancel')` (already exists, used elsewhere in the codebase, e.g. `PlayerScreen.tsx`'s report flow).
- Produces: a new required prop `onDeleteAccount: () => Promise<void>` on `AppMenuProps`, which Task 6 will wire up in `MainScreen.tsx`. This prop must reject if deletion failed and must not have run any local cleanup in that case (that contract is guaranteed by Task 4's `performAccountDeletion`) — `AppMenu` only needs to catch and show an error.

There's no existing component-test setup for any file under `src/components` (no `.test.tsx` files there at all) — this codebase tests business logic (`src/lib/**`, `src/screens/**` orchestration functions) rather than component rendering. This task follows that same pattern: the untestable-by-convention UI wiring goes here with no new test file, same as the rest of `AppMenu.tsx`'s existing menu items.

- [ ] **Step 1: Add the prop**

In `src/components/AppMenu.tsx`, add to `AppMenuProps` (after `onSignOut: () => Promise<void>;`):

```ts
  onDeleteAccount: () => Promise<void>;
```

And destructure it in the component's parameter list (after `onSignOut,`):

```ts
  onDeleteAccount,
```

- [ ] **Step 2: Add local state and the confirm/run functions**

Add a new `useState` next to the existing `note` state (after `const [note, setNote] = useState<string | null>(null);`):

```ts
  const [deletingAccount, setDeletingAccount] = useState(false);
```

Add these two functions near `submitFeedback` (after it):

```ts
  function confirmDeleteAccount() {
    Alert.alert(t('menu.deleteAccountTitle'), t('menu.deleteAccountConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('menu.deleteAccount'), style: 'destructive', onPress: () => void runDeleteAccount() },
    ]);
  }

  async function runDeleteAccount() {
    if (deletingAccount) return;
    setNote(null);
    setDeletingAccount(true);
    try {
      await onDeleteAccount();
    } catch (err) {
      console.warn('[account] delete failed', err);
      setNote(t('menu.deleteAccountFailed'));
      setDeletingAccount(false);
    }
  }
```

`Alert` must be imported from `react-native` in this file — check the existing import on line 4 and add `Alert` to it if it's not already there:

```ts
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
```

(No `setDeletingAccount(false)` on the success path: once `onDeleteAccount()` resolves, `onSignedOut` has already fired in `App.tsx`, which unmounts `MainScreen` and `AppMenu` along with it — there is nothing left to reset state on.)

- [ ] **Step 3: Add the menu item**

In the `accountItems` array, add a new item after the `signout` item (after the closing `},` of the `signout` item, before the array's closing `];`):

```ts
    {
      key: 'deleteAccount',
      icon: 'logout',
      label: t('menu.deleteAccount'),
      value: deletingAccount ? '…' : undefined,
      destructive: true,
      onPress: confirmDeleteAccount,
    },
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors. (`AppMenuProps` now requires `onDeleteAccount`; Task 6 supplies it in `MainScreen.tsx` — until Task 6 lands, `MainScreen.tsx`'s `<AppMenu ... />` call will fail to type-check, which is expected and resolved by the next task.)

- [ ] **Step 5: Commit**

```bash
git add src/components/AppMenu.tsx
git commit -m "feat: add delete-account UI to AppMenu"
```

---

## Task 6: Wire it up in `MainScreen`

**Files:**
- Modify: `src/screens/MainScreen.tsx`

**Interfaces:**
- Consumes: `deleteAccount(client)` (Task 2), `performAccountDeletion(steps)` (Task 4), `AppMenuProps.onDeleteAccount` (Task 5). Also reuses `stopForegroundTracking`, `stopBackgroundTracking`, `signOutLocal`, `subscription`, `client`, `onSignedOut`, `setWeeklySummary`, `cancelWeeklySummary`, `setPlaceNotifications`, `AsyncStorage` — all already imported/available in this file (see `handleSignOut`, lines 332-343).
- Produces: `<AppMenu onDeleteAccount={handleDeleteAccount} ... />`, completing the flow end to end.

- [ ] **Step 1: Import `deleteAccount` and `performAccountDeletion`**

Change this existing import line:

```ts
import { signOut, signOutLocal } from '../lib/supabase/auth';
```

to:

```ts
import { deleteAccount, signOut, signOutLocal } from '../lib/supabase/auth';
```

Add a new import after `import { performSignOut } from '../lib/session/signOutFlow';`:

```ts
import { performAccountDeletion } from '../lib/session/deleteAccountFlow';
```

- [ ] **Step 2: Add `handleDeleteAccount`**

Add this function right after `handleSignOut` (after its closing `}`, around line 343):

```ts
  function handleDeleteAccount() {
    return performAccountDeletion({
      deleteRemote: () => deleteAccount(client),
      stopForeground: () => stopForegroundTracking(subscription),
      stopBackground: stopBackgroundTracking,
      clearLocalSession: async () => {
        void setWeeklySummary(AsyncStorage, false);
        void cancelWeeklySummary();
        void setPlaceNotifications(AsyncStorage, { enabled: false, userId: null });
        await signOutLocal(client);
      },
      onDeleted: onSignedOut,
      onWarn: (message, err) => console.warn('[delete-account]', message, err),
    });
  }
```

(The three `setWeeklySummary`/`cancelWeeklySummary`/`setPlaceNotifications` calls run as part of `clearLocalSession` here, rather than before calling `performAccountDeletion` the way `handleSignOut` runs them upfront — because for deletion these must NOT run if `deleteRemote` fails, whereas `handleSignOut` always wants local prefs cleared regardless of what the server says.)

- [ ] **Step 3: Pass the new prop to `AppMenu`**

Find the `<AppMenu ... onSignOut={handleSignOut} ... />` call and add, right after `onSignOut={handleSignOut}`:

```tsx
        onDeleteAccount={handleDeleteAccount}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors — `AppMenuProps.onDeleteAccount` is now satisfied.

- [ ] **Step 5: Run the full test suite**

Run: `npx jest`
Expected: PASS, including the new tests from Tasks 2, 3 and 4.

- [ ] **Step 6: Manual verification in the simulator**

Follow Task 1 Step 2's manual verification checklist end to end through the actual UI: sign in as a throwaway test account with an avatar and some visited points, open the account menu, tap "Delete account", confirm the destructive Alert, and confirm the app returns to the sign-in screen. Then re-check in Supabase Studio as described in Task 1.

Also verify the failure path: turn off the simulator's network, repeat the delete attempt, confirm the app shows the "could not delete" message and stays on the account page, still signed in. Turn the network back on and confirm deleting now works.

- [ ] **Step 7: Commit**

```bash
git add src/screens/MainScreen.tsx
git commit -m "feat: wire up account deletion in MainScreen"
```
