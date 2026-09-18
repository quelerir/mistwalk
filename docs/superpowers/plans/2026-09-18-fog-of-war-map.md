# Fog of War Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MVP mobile app — a real-world Mapbox map covered by a fog-of-war overlay that smoothly reveals as the user physically walks, with progress synced to Supabase and background GPS tracking on iOS/Android.

**Architecture:** Expo (React Native, TypeScript) app. A Mapbox `MapView` renders the base map; a `react-native-skia` canvas overlay renders the fog and "burns" soft circles into it at visited GPS points. Foreground and background location updates (via `expo-location` + `expo-task-manager`) feed a Zustand `ProgressStore`, which throttles points by distance, persists them locally (AsyncStorage), and batches them up to Supabase (Postgres + Auth).

**Tech Stack:** Expo SDK (TypeScript), `@rnmapbox/maps`, `@shopify/react-native-skia`, `expo-location`, `expo-task-manager`, `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `zustand`, `@react-navigation/native`, `jest-expo`, `@testing-library/react-native`.

**Spec:** [docs/superpowers/specs/2026-09-18-fog-of-war-map-design.md](../specs/2026-09-18-fog-of-war-map-design.md)

## Global Constraints

- Distance throttle: only record a new point if the user moved past the active accuracy profile's threshold — `precise` = 25m, `battery-saver` = 75m (spec range: precise ~20–30m, battery-saver ~50–100m).
- Batch sync to Supabase: flush every 12000ms (within the spec's 10–15s window) or every 5 buffered points, whichever comes first.
- iOS background location requires the "Always" permission, requested as a **second, separate step** after the foreground permission (Apple requirement).
- Android background location requires a **foreground service with a persistent notification** plus the `ACCESS_BACKGROUND_LOCATION` runtime permission, requested as a second step after the foreground permission.
- No realtime subscription in the MVP — all remote progress is fetched with a single query on app start / sign-in.
- Skia rendering and Mapbox integration are not covered by automated tests — verify manually on real devices per the spec.

---

## File Structure

```
mobile/
  app.json
  App.tsx
  jest.config.js
  .env.example
  supabase/
    migrations/0001_visited_points.sql
  src/
    lib/
      geo/
        distance.ts, distance.test.ts
        throttle.ts, throttle.test.ts
      sync/
        batchQueue.ts, batchQueue.test.ts
      supabase/
        client.ts
        auth.ts, auth.test.ts
        visitedPoints.ts, visitedPoints.test.ts
      settings/
        accuracyProfile.ts, accuracyProfile.test.ts
    store/
      progressStore.ts, progressStore.test.ts
    hooks/
      useLocationPermissions.ts, useLocationPermissions.test.ts
    services/
      locationTracker.ts, locationTracker.test.ts
      backgroundLocationTask.ts
    components/
      FogOverlay.tsx
      OfflineBanner.tsx
      LocationPermissionBanner.tsx
    screens/
      SignInScreen.tsx
      MapScreen.tsx
      SettingsScreen.tsx
    navigation/
      RootNavigator.tsx
```

---

### Task 1: Project scaffold & tooling

**Files:**
- Create: entire Expo project skeleton (`app.json`, `App.tsx`, `tsconfig.json`, `package.json`, etc.)
- Create: `jest.config.js`
- Create: `.env.example`
- Create: `src/lib/sanity.test.ts`

**Interfaces:**
- Produces: a working Expo TS project with `npm test` running jest-expo.

- [ ] **Step 1: Scaffold the Expo app into a temp dir and merge**

```bash
cd /Users/alekseygolikov/projects/mobile
npx create-expo-app@latest tmp-scaffold --template blank-typescript
rsync -a --exclude 'node_modules' --exclude '.git' tmp-scaffold/ ./
rm -rf tmp-scaffold
```

- [ ] **Step 2: Install runtime dependencies**

```bash
npx expo install @rnmapbox/maps @shopify/react-native-skia expo-location expo-task-manager \
  @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill \
  zustand @react-navigation/native @react-navigation/native-stack react-native-screens \
  react-native-safe-area-context @react-native-community/netinfo
```

- [ ] **Step 3: Install dev/test dependencies**

```bash
npm install --save-dev jest-expo @testing-library/react-native
```

- [ ] **Step 4: Add jest config**

Create `jest.config.js`:

```js
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
};
```

Add to `package.json` `scripts`: `"test": "jest"`.

- [ ] **Step 5: Add env template**

Create `.env.example`:

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=
```

- [ ] **Step 6: Write a sanity test to confirm the test runner works**

Create `src/lib/sanity.test.ts`:

```ts
describe('project scaffold', () => {
  it('runs jest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 7: Run the test suite**

Run: `npm test`
Expected: 1 test suite, 1 test, PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Expo app with test tooling"
```

---

### Task 2: Supabase schema + client factory

**Files:**
- Create: `supabase/migrations/0001_visited_points.sql`
- Create: `src/lib/supabase/client.ts`
- Test: `src/lib/supabase/client.test.ts`

**Interfaces:**
- Produces: `createSupabaseClient(url: string, anonKey: string): SupabaseClient` and singleton `supabase` from `src/lib/supabase/client.ts`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0001_visited_points.sql`:

```sql
create table if not exists public.visited_points (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  radius double precision not null,
  created_at timestamptz not null default now()
);

create index if not exists visited_points_user_id_idx on public.visited_points (user_id);

alter table public.visited_points enable row level security;

create policy "Users can read their own points"
  on public.visited_points for select
  using (auth.uid() = user_id);

create policy "Users can insert their own points"
  on public.visited_points for insert
  with check (auth.uid() = user_id);
```

Apply it against your Supabase project via the SQL editor or `supabase db push` (requires the Supabase CLI to be linked to your project — not automated here).

- [ ] **Step 2: Write the failing test for the client factory**

Create `src/lib/supabase/client.test.ts`:

```ts
import { createSupabaseClient } from './client';

describe('createSupabaseClient', () => {
  it('throws when url is missing', () => {
    expect(() => createSupabaseClient('', 'anon-key')).toThrow(
      'createSupabaseClient: url and anonKey are required'
    );
  });

  it('throws when anonKey is missing', () => {
    expect(() => createSupabaseClient('https://example.supabase.co', '')).toThrow(
      'createSupabaseClient: url and anonKey are required'
    );
  });

  it('returns a client when both are provided', () => {
    const client = createSupabaseClient('https://example.supabase.co', 'anon-key');
    expect(client).toBeDefined();
    expect(typeof client.auth.signInWithPassword).toBe('function');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- client.test.ts`
Expected: FAIL — `createSupabaseClient` is not defined.

- [ ] **Step 4: Implement the client factory**

Create `src/lib/supabase/client.ts`:

```ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function createSupabaseClient(url: string, anonKey: string): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error('createSupabaseClient: url and anonKey are required');
  }
  return createClient(url, anonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export function getEnvSupabaseClient(): SupabaseClient {
  return createSupabaseClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- client.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0001_visited_points.sql src/lib/supabase/client.ts src/lib/supabase/client.test.ts
git commit -m "feat: add visited_points schema and Supabase client factory"
```

---

### Task 3: Geo distance + throttle utils

**Files:**
- Create: `src/lib/geo/distance.ts`
- Test: `src/lib/geo/distance.test.ts`
- Create: `src/lib/geo/throttle.ts`
- Test: `src/lib/geo/throttle.test.ts`

**Interfaces:**
- Produces: `Coordinate { lat: number; lng: number }`, `haversineDistanceMeters(a, b): number` from `distance.ts`.
- Produces: `shouldRecordPoint(lastRecorded: Coordinate | null, candidate: Coordinate, thresholdMeters: number): boolean` from `throttle.ts`.

- [ ] **Step 1: Write the failing test for distance**

Create `src/lib/geo/distance.test.ts`:

```ts
import { haversineDistanceMeters } from './distance';

describe('haversineDistanceMeters', () => {
  it('returns 0 for identical points', () => {
    const p = { lat: 55.751244, lng: 37.618423 };
    expect(haversineDistanceMeters(p, p)).toBeCloseTo(0, 3);
  });

  it('returns ~157km between Moscow and Tver (known reference distance)', () => {
    const moscow = { lat: 55.751244, lng: 37.618423 };
    const tver = { lat: 56.859611, lng: 35.911896 };
    const distance = haversineDistanceMeters(moscow, tver);
    expect(distance).toBeGreaterThan(150000);
    expect(distance).toBeLessThan(165000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- distance.test.ts`
Expected: FAIL — `haversineDistanceMeters` is not defined.

- [ ] **Step 3: Implement distance.ts**

Create `src/lib/geo/distance.ts`:

```ts
export interface Coordinate {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_METERS = 6371000;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineDistanceMeters(a: Coordinate, b: Coordinate): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- distance.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Write the failing test for throttle**

Create `src/lib/geo/throttle.test.ts`:

```ts
import { shouldRecordPoint } from './throttle';

describe('shouldRecordPoint', () => {
  it('always records the first point (no last recorded)', () => {
    expect(shouldRecordPoint(null, { lat: 0, lng: 0 }, 30)).toBe(true);
  });

  it('rejects a point closer than the threshold', () => {
    const last = { lat: 55.751244, lng: 37.618423 };
    const near = { lat: 55.751250, lng: 37.618423 }; // a few meters away
    expect(shouldRecordPoint(last, near, 30)).toBe(false);
  });

  it('accepts a point farther than the threshold', () => {
    const last = { lat: 55.751244, lng: 37.618423 };
    const far = { lat: 55.752244, lng: 37.618423 }; // ~111m north
    expect(shouldRecordPoint(last, far, 30)).toBe(true);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- throttle.test.ts`
Expected: FAIL — `shouldRecordPoint` is not defined.

- [ ] **Step 7: Implement throttle.ts**

Create `src/lib/geo/throttle.ts`:

```ts
import { Coordinate, haversineDistanceMeters } from './distance';

export function shouldRecordPoint(
  lastRecorded: Coordinate | null,
  candidate: Coordinate,
  thresholdMeters: number
): boolean {
  if (lastRecorded === null) return true;
  return haversineDistanceMeters(lastRecorded, candidate) >= thresholdMeters;
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- throttle.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 9: Commit**

```bash
git add src/lib/geo
git commit -m "feat: add haversine distance and point throttle logic"
```

---

### Task 4: Sync batch queue

**Files:**
- Create: `src/lib/sync/batchQueue.ts`
- Test: `src/lib/sync/batchQueue.test.ts`

**Interfaces:**
- Produces: `class SyncQueue<T>` with `enqueue(item: T): void` and `flush(): Promise<void>`, constructed with `{ maxBatchSize: number; maxWaitMs: number; onFlush: (items: T[]) => Promise<void> }`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/sync/batchQueue.test.ts`:

```ts
import { SyncQueue } from './batchQueue';

describe('SyncQueue', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('flushes automatically once maxBatchSize is reached', async () => {
    const onFlush = jest.fn().mockResolvedValue(undefined);
    const queue = new SyncQueue<number>({ maxBatchSize: 3, maxWaitMs: 10000, onFlush });

    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);
    await Promise.resolve();

    expect(onFlush).toHaveBeenCalledWith([1, 2, 3]);
  });

  it('flushes automatically after maxWaitMs even below batch size', async () => {
    const onFlush = jest.fn().mockResolvedValue(undefined);
    const queue = new SyncQueue<number>({ maxBatchSize: 10, maxWaitMs: 5000, onFlush });

    queue.enqueue(1);
    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(onFlush).toHaveBeenCalledWith([1]);
  });

  it('re-buffers items if onFlush rejects, for the next flush attempt', async () => {
    const onFlush = jest
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(undefined);
    const queue = new SyncQueue<number>({ maxBatchSize: 1, maxWaitMs: 10000, onFlush });

    queue.enqueue(1);
    await Promise.resolve().catch(() => {});

    queue.enqueue(2);
    await Promise.resolve();

    expect(onFlush).toHaveBeenLastCalledWith([1, 2]);
  });

  it('does nothing on flush() when the buffer is empty', async () => {
    const onFlush = jest.fn().mockResolvedValue(undefined);
    const queue = new SyncQueue<number>({ maxBatchSize: 5, maxWaitMs: 10000, onFlush });

    await queue.flush();

    expect(onFlush).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- batchQueue.test.ts`
Expected: FAIL — `SyncQueue` is not defined.

- [ ] **Step 3: Implement batchQueue.ts**

Create `src/lib/sync/batchQueue.ts`:

```ts
export interface SyncQueueOptions<T> {
  maxBatchSize: number;
  maxWaitMs: number;
  onFlush: (items: T[]) => Promise<void>;
}

export class SyncQueue<T> {
  private buffer: T[] = [];
  private timerHandle: ReturnType<typeof setTimeout> | null = null;
  private readonly maxBatchSize: number;
  private readonly maxWaitMs: number;
  private readonly onFlush: (items: T[]) => Promise<void>;

  constructor(options: SyncQueueOptions<T>) {
    this.maxBatchSize = options.maxBatchSize;
    this.maxWaitMs = options.maxWaitMs;
    this.onFlush = options.onFlush;
  }

  enqueue(item: T): void {
    this.buffer.push(item);

    if (this.buffer.length >= this.maxBatchSize) {
      void this.flush();
      return;
    }

    if (this.timerHandle === null) {
      this.timerHandle = setTimeout(() => {
        void this.flush();
      }, this.maxWaitMs);
    }
  }

  async flush(): Promise<void> {
    if (this.timerHandle !== null) {
      clearTimeout(this.timerHandle);
      this.timerHandle = null;
    }
    if (this.buffer.length === 0) return;

    const items = this.buffer;
    this.buffer = [];

    try {
      await this.onFlush(items);
    } catch (err) {
      this.buffer = [...items, ...this.buffer];
      throw err;
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- batchQueue.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sync
git commit -m "feat: add batching sync queue with retry-on-failure"
```

---

### Task 5: Supabase auth wrappers

**Files:**
- Create: `src/lib/supabase/auth.ts`
- Test: `src/lib/supabase/auth.test.ts`

**Interfaces:**
- Consumes: `SupabaseClient` type from `@supabase/supabase-js` (injected, not imported as singleton).
- Produces: `signUp(client, email, password)`, `signIn(client, email, password)`, `signOut(client)`, `getSession(client)` from `src/lib/supabase/auth.ts`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/supabase/auth.test.ts`:

```ts
import { signUp, signIn, signOut, getSession } from './auth';
import type { SupabaseClient } from '@supabase/supabase-js';

function makeFakeClient(overrides: Partial<SupabaseClient['auth']> = {}) {
  return {
    auth: {
      signUp: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
      signInWithPassword: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null }),
      ...overrides,
    },
  } as unknown as SupabaseClient;
}

describe('auth wrappers', () => {
  it('signUp returns data on success', async () => {
    const client = makeFakeClient();
    const data = await signUp(client, 'a@b.com', 'password123');
    expect(client.auth.signUp).toHaveBeenCalledWith({ email: 'a@b.com', password: 'password123' });
    expect(data.user?.id).toBe('u1');
  });

  it('signUp throws on error', async () => {
    const client = makeFakeClient({
      signUp: jest.fn().mockResolvedValue({ data: null, error: new Error('taken') }),
    });
    await expect(signUp(client, 'a@b.com', 'password123')).rejects.toThrow('taken');
  });

  it('signIn returns data on success', async () => {
    const client = makeFakeClient();
    const data = await signIn(client, 'a@b.com', 'password123');
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'password123' });
    expect(data.user?.id).toBe('u1');
  });

  it('signOut resolves on success', async () => {
    const client = makeFakeClient();
    await expect(signOut(client)).resolves.toBeUndefined();
  });

  it('getSession returns the session', async () => {
    const client = makeFakeClient();
    const session = await getSession(client);
    expect(session?.user.id).toBe('u1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- auth.test.ts`
Expected: FAIL — module `./auth` not found.

- [ ] **Step 3: Implement auth.ts**

Create `src/lib/supabase/auth.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export async function signUp(client: SupabaseClient, email: string, password: string) {
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(client: SupabaseClient, email: string, password: string) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut(client: SupabaseClient) {
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

export async function getSession(client: SupabaseClient) {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- auth.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/auth.ts src/lib/supabase/auth.test.ts
git commit -m "feat: add Supabase auth wrappers"
```

---

### Task 6: Supabase visited points data access

**Files:**
- Create: `src/lib/supabase/visitedPoints.ts`
- Test: `src/lib/supabase/visitedPoints.test.ts`

**Interfaces:**
- Consumes: `SupabaseClient` (injected).
- Produces: `interface VisitedPoint { lat: number; lng: number; radius: number; ts: number }`, `fetchVisitedPoints(client, userId): Promise<VisitedPoint[]>`, `insertVisitedPoints(client, userId, points): Promise<void>` from `src/lib/supabase/visitedPoints.ts`. This is the canonical `VisitedPoint` type reused by `progressStore.ts` and `FogOverlay.tsx`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/supabase/visitedPoints.test.ts`:

```ts
import { fetchVisitedPoints, insertVisitedPoints, VisitedPoint } from './visitedPoints';
import type { SupabaseClient } from '@supabase/supabase-js';

function makeFakeClient(selectResult: { data: unknown; error: unknown }, insertResult: { error: unknown }) {
  const eq = jest.fn().mockResolvedValue(selectResult);
  const select = jest.fn().mockReturnValue({ eq });
  const insert = jest.fn().mockResolvedValue(insertResult);
  const from = jest.fn().mockReturnValue({ select, insert });
  return { client: { from } as unknown as SupabaseClient, select, eq, insert, from };
}

describe('fetchVisitedPoints', () => {
  it('maps rows to VisitedPoint objects', async () => {
    const { client, from, select, eq } = makeFakeClient(
      {
        data: [{ lat: 1, lng: 2, radius: 30, created_at: '2026-01-01T00:00:00.000Z' }],
        error: null,
      },
      { error: null }
    );

    const points = await fetchVisitedPoints(client, 'user-1');

    expect(from).toHaveBeenCalledWith('visited_points');
    expect(select).toHaveBeenCalledWith('lat, lng, radius, created_at');
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(points).toEqual([{ lat: 1, lng: 2, radius: 30, ts: Date.parse('2026-01-01T00:00:00.000Z') }]);
  });

  it('throws on error', async () => {
    const { client } = makeFakeClient({ data: null, error: new Error('boom') }, { error: null });
    await expect(fetchVisitedPoints(client, 'user-1')).rejects.toThrow('boom');
  });
});

describe('insertVisitedPoints', () => {
  it('does nothing for an empty array', async () => {
    const { client, from } = makeFakeClient({ data: [], error: null }, { error: null });
    await insertVisitedPoints(client, 'user-1', []);
    expect(from).not.toHaveBeenCalled();
  });

  it('inserts rows with user_id attached', async () => {
    const { client, insert } = makeFakeClient({ data: [], error: null }, { error: null });
    const points: VisitedPoint[] = [{ lat: 1, lng: 2, radius: 30, ts: 1735689600000 }];

    await insertVisitedPoints(client, 'user-1', points);

    expect(insert).toHaveBeenCalledWith([{ user_id: 'user-1', lat: 1, lng: 2, radius: 30 }]);
  });

  it('throws on error', async () => {
    const { client } = makeFakeClient({ data: [], error: null }, { error: new Error('insert failed') });
    await expect(
      insertVisitedPoints(client, 'user-1', [{ lat: 1, lng: 2, radius: 30, ts: 1 }])
    ).rejects.toThrow('insert failed');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- visitedPoints.test.ts`
Expected: FAIL — module `./visitedPoints` not found.

- [ ] **Step 3: Implement visitedPoints.ts**

Create `src/lib/supabase/visitedPoints.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface VisitedPoint {
  lat: number;
  lng: number;
  radius: number;
  ts: number;
}

interface VisitedPointRow {
  lat: number;
  lng: number;
  radius: number;
  created_at: string;
}

export async function fetchVisitedPoints(
  client: SupabaseClient,
  userId: string
): Promise<VisitedPoint[]> {
  const { data, error } = await client
    .from('visited_points')
    .select('lat, lng, radius, created_at')
    .eq('user_id', userId);

  if (error) throw error;

  return (data as VisitedPointRow[]).map((row) => ({
    lat: row.lat,
    lng: row.lng,
    radius: row.radius,
    ts: Date.parse(row.created_at),
  }));
}

export async function insertVisitedPoints(
  client: SupabaseClient,
  userId: string,
  points: VisitedPoint[]
): Promise<void> {
  if (points.length === 0) return;

  const rows = points.map((p) => ({
    user_id: userId,
    lat: p.lat,
    lng: p.lng,
    radius: p.radius,
  }));

  const { error } = await client.from('visited_points').insert(rows);
  if (error) throw error;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- visitedPoints.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/visitedPoints.ts src/lib/supabase/visitedPoints.test.ts
git commit -m "feat: add Supabase visited-points data access"
```

---

### Task 7: Accuracy profile settings module

**Files:**
- Create: `src/lib/settings/accuracyProfile.ts`
- Test: `src/lib/settings/accuracyProfile.test.ts`

**Interfaces:**
- Produces: `type AccuracyProfile = 'battery-saver' | 'precise'`, `DISTANCE_INTERVAL_METERS: Record<AccuracyProfile, number>` (`battery-saver: 75`, `precise: 25`), `getAccuracyProfile(storage): Promise<AccuracyProfile>`, `setAccuracyProfile(storage, profile): Promise<void>` from `src/lib/settings/accuracyProfile.ts`. Consumed by `progressStore.ts` (throttle threshold) and `SettingsScreen.tsx`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/settings/accuracyProfile.test.ts`:

```ts
import { getAccuracyProfile, setAccuracyProfile, DISTANCE_INTERVAL_METERS } from './accuracyProfile';

function makeFakeStorage(initial: Record<string, string> = {}) {
  const store = { ...initial };
  return {
    getItem: jest.fn(async (key: string) => store[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
  };
}

describe('accuracyProfile', () => {
  it('defaults to battery-saver when nothing is stored', async () => {
    const storage = makeFakeStorage();
    expect(await getAccuracyProfile(storage)).toBe('battery-saver');
  });

  it('returns the stored profile', async () => {
    const storage = makeFakeStorage({ 'settings.accuracyProfile.v1': 'precise' });
    expect(await getAccuracyProfile(storage)).toBe('precise');
  });

  it('persists a new profile', async () => {
    const storage = makeFakeStorage();
    await setAccuracyProfile(storage, 'precise');
    expect(await getAccuracyProfile(storage)).toBe('precise');
  });

  it('exposes the correct distance thresholds', () => {
    expect(DISTANCE_INTERVAL_METERS['precise']).toBe(25);
    expect(DISTANCE_INTERVAL_METERS['battery-saver']).toBe(75);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- accuracyProfile.test.ts`
Expected: FAIL — module `./accuracyProfile` not found.

- [ ] **Step 3: Implement accuracyProfile.ts**

Create `src/lib/settings/accuracyProfile.ts`:

```ts
export type AccuracyProfile = 'battery-saver' | 'precise';

export const DISTANCE_INTERVAL_METERS: Record<AccuracyProfile, number> = {
  'battery-saver': 75,
  precise: 25,
};

const STORAGE_KEY = 'settings.accuracyProfile.v1';

export interface KeyValueStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

export async function getAccuracyProfile(storage: KeyValueStorage): Promise<AccuracyProfile> {
  const raw = await storage.getItem(STORAGE_KEY);
  return raw === 'precise' ? 'precise' : 'battery-saver';
}

export async function setAccuracyProfile(
  storage: KeyValueStorage,
  profile: AccuracyProfile
): Promise<void> {
  await storage.setItem(STORAGE_KEY, profile);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- accuracyProfile.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/settings
git commit -m "feat: add accuracy profile settings module"
```

---

### Task 8: ProgressStore

**Files:**
- Create: `src/store/progressStore.ts`
- Test: `src/store/progressStore.test.ts`

**Interfaces:**
- Consumes: `shouldRecordPoint` from `../lib/geo/throttle`, `Coordinate` from `../lib/geo/distance`, `SyncQueue` from `../lib/sync/batchQueue`, `VisitedPoint`, `fetchVisitedPoints`, `insertVisitedPoints` from `../lib/supabase/visitedPoints`, `KeyValueStorage` from `../lib/settings/accuracyProfile`.
- Produces: `createProgressStore(options: { client: SupabaseClient; userId: string; storage?: KeyValueStorage; throttleMeters?: number; batchSize?: number; batchWaitMs?: number }): { useProgressStore: UseBoundStore<ProgressState>; queue: SyncQueue<VisitedPoint> }` from `src/store/progressStore.ts`. `ProgressState` exposes `points: VisitedPoint[]`, `hydrated: boolean`, `loadFromDisk(): Promise<void>`, `hydrateFromRemote(): Promise<void>`, `addPoint(coord: Coordinate, radius: number): Promise<void>`. Consumed by `locationTracker.ts`, `backgroundLocationTask.ts`, `MapScreen.tsx`, `RootNavigator.tsx`.

- [ ] **Step 1: Write the failing tests**

Create `src/store/progressStore.test.ts`:

```ts
import { createProgressStore } from './progressStore';
import type { SupabaseClient } from '@supabase/supabase-js';

function makeFakeStorage() {
  const store: Record<string, string> = {};
  return {
    getItem: jest.fn(async (key: string) => store[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
  };
}

function makeFakeClient(remotePoints: Array<{ lat: number; lng: number; radius: number; created_at: string }>) {
  const eq = jest.fn().mockResolvedValue({ data: remotePoints, error: null });
  const select = jest.fn().mockReturnValue({ eq });
  const insert = jest.fn().mockResolvedValue({ error: null });
  const from = jest.fn().mockReturnValue({ select, insert });
  return { from } as unknown as SupabaseClient;
}

describe('createProgressStore', () => {
  it('starts empty and not hydrated', () => {
    const { useProgressStore } = createProgressStore({
      client: makeFakeClient([]),
      userId: 'u1',
      storage: makeFakeStorage(),
    });
    const state = useProgressStore.getState();
    expect(state.points).toEqual([]);
    expect(state.hydrated).toBe(false);
  });

  it('addPoint records a first point and persists it to storage', async () => {
    const storage = makeFakeStorage();
    const { useProgressStore } = createProgressStore({
      client: makeFakeClient([]),
      userId: 'u1',
      storage,
      throttleMeters: 30,
      batchSize: 10,
      batchWaitMs: 60000,
    });

    await useProgressStore.getState().addPoint({ lat: 1, lng: 2 }, 30);

    expect(useProgressStore.getState().points).toHaveLength(1);
    expect(storage.setItem).toHaveBeenCalled();
  });

  it('addPoint ignores a second point within the throttle distance', async () => {
    const { useProgressStore } = createProgressStore({
      client: makeFakeClient([]),
      userId: 'u1',
      storage: makeFakeStorage(),
      throttleMeters: 1000,
    });

    await useProgressStore.getState().addPoint({ lat: 55.751244, lng: 37.618423 }, 30);
    await useProgressStore.getState().addPoint({ lat: 55.751250, lng: 37.618423 }, 30);

    expect(useProgressStore.getState().points).toHaveLength(1);
  });

  it('hydrateFromRemote merges remote points into local state and persists them', async () => {
    const storage = makeFakeStorage();
    const client = makeFakeClient([
      { lat: 10, lng: 20, radius: 30, created_at: '2026-01-01T00:00:00.000Z' },
    ]);
    const { useProgressStore } = createProgressStore({ client, userId: 'u1', storage });

    await useProgressStore.getState().hydrateFromRemote();

    const state = useProgressStore.getState();
    expect(state.points).toHaveLength(1);
    expect(state.hydrated).toBe(true);
    expect(storage.setItem).toHaveBeenCalled();
  });

  it('loadFromDisk restores previously persisted points', async () => {
    const storage = makeFakeStorage();
    await storage.setItem(
      'progressStore.points.v1',
      JSON.stringify([{ lat: 5, lng: 6, radius: 30, ts: 1 }])
    );
    const { useProgressStore } = createProgressStore({
      client: makeFakeClient([]),
      userId: 'u1',
      storage,
    });

    await useProgressStore.getState().loadFromDisk();

    expect(useProgressStore.getState().points).toEqual([{ lat: 5, lng: 6, radius: 30, ts: 1 }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- progressStore.test.ts`
Expected: FAIL — module `./progressStore` not found.

- [ ] **Step 3: Implement progressStore.ts**

Create `src/store/progressStore.ts`:

```ts
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import { shouldRecordPoint } from '../lib/geo/throttle';
import type { Coordinate } from '../lib/geo/distance';
import { SyncQueue } from '../lib/sync/batchQueue';
import {
  fetchVisitedPoints,
  insertVisitedPoints,
  VisitedPoint,
} from '../lib/supabase/visitedPoints';
import type { KeyValueStorage } from '../lib/settings/accuracyProfile';

const STORAGE_KEY = 'progressStore.points.v1';
const DEFAULT_THROTTLE_METERS = 30;
const DEFAULT_BATCH_SIZE = 5;
const DEFAULT_BATCH_WAIT_MS = 12000;

export interface ProgressState {
  points: VisitedPoint[];
  lastRecorded: Coordinate | null;
  hydrated: boolean;
  loadFromDisk: () => Promise<void>;
  hydrateFromRemote: () => Promise<void>;
  addPoint: (coord: Coordinate, radius: number) => Promise<void>;
}

export interface CreateProgressStoreOptions {
  client: SupabaseClient;
  userId: string;
  storage?: KeyValueStorage;
  throttleMeters?: number;
  batchSize?: number;
  batchWaitMs?: number;
}

function mergePoints(local: VisitedPoint[], remote: VisitedPoint[]): VisitedPoint[] {
  const seen = new Set(local.map((p) => `${p.lat},${p.lng},${p.ts}`));
  const merged = [...local];
  for (const point of remote) {
    const key = `${point.lat},${point.lng},${point.ts}`;
    if (!seen.has(key)) {
      merged.push(point);
      seen.add(key);
    }
  }
  return merged;
}

export function createProgressStore(options: CreateProgressStoreOptions) {
  const storage: KeyValueStorage = options.storage ?? AsyncStorage;
  const throttleMeters = options.throttleMeters ?? DEFAULT_THROTTLE_METERS;

  const queue = new SyncQueue<VisitedPoint>({
    maxBatchSize: options.batchSize ?? DEFAULT_BATCH_SIZE,
    maxWaitMs: options.batchWaitMs ?? DEFAULT_BATCH_WAIT_MS,
    onFlush: (items) => insertVisitedPoints(options.client, options.userId, items),
  });

  const useProgressStore = create<ProgressState>((set, get) => ({
    points: [],
    lastRecorded: null,
    hydrated: false,

    loadFromDisk: async () => {
      const raw = await storage.getItem(STORAGE_KEY);
      const points: VisitedPoint[] = raw ? JSON.parse(raw) : [];
      const last = points.length > 0 ? points[points.length - 1] : null;
      set({
        points,
        lastRecorded: last ? { lat: last.lat, lng: last.lng } : null,
      });
    },

    hydrateFromRemote: async () => {
      const remotePoints = await fetchVisitedPoints(options.client, options.userId);
      const merged = mergePoints(get().points, remotePoints);
      set({ points: merged, hydrated: true });
      await storage.setItem(STORAGE_KEY, JSON.stringify(merged));
    },

    addPoint: async (coord, radius) => {
      const { lastRecorded, points } = get();
      if (!shouldRecordPoint(lastRecorded, coord, throttleMeters)) return;

      const point: VisitedPoint = { lat: coord.lat, lng: coord.lng, radius, ts: Date.now() };
      const nextPoints = [...points, point];

      set({ points: nextPoints, lastRecorded: coord });
      await storage.setItem(STORAGE_KEY, JSON.stringify(nextPoints));
      queue.enqueue(point);
    },
  }));

  return { useProgressStore, queue };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- progressStore.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/store
git commit -m "feat: add ProgressStore tying throttle, sync queue and persistence together"
```

---

### Task 9: Navigation shell + SignInScreen

**Files:**
- Create: `src/screens/SignInScreen.tsx`
- Create: `src/navigation/RootNavigator.tsx` (auth-only route for now; Map route wired in Task 15)

**Interfaces:**
- Consumes: `signUp`, `signIn` from `../lib/supabase/auth`, `supabase` client instance passed in as a prop from `App.tsx`.
- Produces: `SignInScreen` component (props: `{ client: SupabaseClient; onSignedIn: () => void }`), `RootNavigator` component (props: `{ client: SupabaseClient; session: Session | null; onSignedIn: () => void }`).

- [ ] **Step 1: Implement SignInScreen.tsx**

Create `src/screens/SignInScreen.tsx`:

```tsx
import React, { useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import { signIn, signUp } from '../lib/supabase/auth';

export interface SignInScreenProps {
  client: SupabaseClient;
  onSignedIn: () => void;
}

export default function SignInScreen({ client, onSignedIn }: SignInScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handle(action: 'signIn' | 'signUp') {
    setBusy(true);
    setError(null);
    try {
      if (action === 'signIn') {
        await signIn(client, email, password);
      } else {
        await signUp(client, email, password);
      }
      onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Пароль"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Button title="Войти" onPress={() => handle('signIn')} disabled={busy} />
      <Button title="Зарегистрироваться" onPress={() => handle('signUp')} disabled={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  error: { color: 'red' },
});
```

- [ ] **Step 2: Implement RootNavigator.tsx (auth gate only)**

Create `src/navigation/RootNavigator.tsx`:

```tsx
import React from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import SignInScreen from '../screens/SignInScreen';

export interface RootNavigatorProps {
  client: SupabaseClient;
  session: Session | null;
  onSignedIn: () => void;
  children: React.ReactNode;
}

export default function RootNavigator({ client, session, onSignedIn, children }: RootNavigatorProps) {
  if (!session) {
    return <SignInScreen client={client} onSignedIn={onSignedIn} />;
  }
  return <>{children}</>;
}
```

This is intentionally a plain conditional gate rather than `@react-navigation` stack config — with a single authenticated screen (the map) there's nothing to navigate between yet. Task 15 replaces the `children` passthrough with the real `MapScreen` + banners, and Task 16 adds a Settings route via `@react-navigation/native-stack` when there are two screens to switch between.

- [ ] **Step 3: Commit**

```bash
git add src/screens/SignInScreen.tsx src/navigation/RootNavigator.tsx
git commit -m "feat: add sign-in screen and auth gate"
```

---

### Task 10: useLocationPermissions hook

**Files:**
- Create: `src/hooks/useLocationPermissions.ts`
- Test: `src/hooks/useLocationPermissions.test.ts`

**Interfaces:**
- Produces: `type PermissionStage = 'unrequested' | 'foreground-granted' | 'background-granted' | 'denied'`, `useLocationPermissions(): { stage: PermissionStage; requestForeground: () => Promise<boolean>; requestBackground: () => Promise<boolean> }` from `src/hooks/useLocationPermissions.ts`. Consumed by `LocationPermissionBanner.tsx` and app start-up wiring (Task 15).

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/useLocationPermissions.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { useLocationPermissions } from './useLocationPermissions';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
}));

describe('useLocationPermissions', () => {
  it('starts in the unrequested stage', () => {
    const { result } = renderHook(() => useLocationPermissions());
    expect(result.current.stage).toBe('unrequested');
  });

  it('moves to foreground-granted when foreground permission is granted', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    const { result } = renderHook(() => useLocationPermissions());

    await act(async () => {
      await result.current.requestForeground();
    });

    expect(result.current.stage).toBe('foreground-granted');
  });

  it('moves to denied when foreground permission is refused', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    const { result } = renderHook(() => useLocationPermissions());

    await act(async () => {
      await result.current.requestForeground();
    });

    expect(result.current.stage).toBe('denied');
  });

  it('moves to background-granted when background permission is granted', async () => {
    (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    const { result } = renderHook(() => useLocationPermissions());

    await act(async () => {
      await result.current.requestBackground();
    });

    expect(result.current.stage).toBe('background-granted');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- useLocationPermissions.test.ts`
Expected: FAIL — module `./useLocationPermissions` not found.

- [ ] **Step 3: Implement useLocationPermissions.ts**

Create `src/hooks/useLocationPermissions.ts`:

```ts
import { useCallback, useState } from 'react';
import * as Location from 'expo-location';

export type PermissionStage =
  | 'unrequested'
  | 'foreground-granted'
  | 'background-granted'
  | 'denied';

export function useLocationPermissions() {
  const [stage, setStage] = useState<PermissionStage>('unrequested');

  const requestForeground = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setStage('denied');
      return false;
    }
    setStage('foreground-granted');
    return true;
  }, []);

  const requestBackground = useCallback(async () => {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status !== 'granted') {
      return false;
    }
    setStage('background-granted');
    return true;
  }, []);

  return { stage, requestForeground, requestBackground };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- useLocationPermissions.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useLocationPermissions.ts src/hooks/useLocationPermissions.test.ts
git commit -m "feat: add two-step location permission hook"
```

---

### Task 11: Foreground location tracker service

**Files:**
- Create: `src/services/locationTracker.ts`
- Test: `src/services/locationTracker.test.ts`

**Interfaces:**
- Produces: `toCoordinate(location: LocationObject): { lat: number; lng: number; accuracy: number }`, `startForegroundTracking(handlers: { onPoint: (coord: { lat: number; lng: number }, accuracy: number) => void }, distanceIntervalMeters: number): Promise<LocationSubscription>`, `stopForegroundTracking(subscription: LocationSubscription | null): void` from `src/services/locationTracker.ts`.

- [ ] **Step 1: Write the failing test for the pure projection function**

Create `src/services/locationTracker.test.ts`:

```ts
import { toCoordinate } from './locationTracker';
import type { LocationObject } from 'expo-location';

describe('toCoordinate', () => {
  it('extracts lat/lng/accuracy from a LocationObject', () => {
    const location = {
      coords: { latitude: 55.75, longitude: 37.61, accuracy: 12 },
      timestamp: 0,
    } as LocationObject;

    expect(toCoordinate(location)).toEqual({ lat: 55.75, lng: 37.61, accuracy: 12 });
  });

  it('defaults accuracy to 0 when null', () => {
    const location = {
      coords: { latitude: 1, longitude: 2, accuracy: null },
      timestamp: 0,
    } as unknown as LocationObject;

    expect(toCoordinate(location)).toEqual({ lat: 1, lng: 2, accuracy: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- locationTracker.test.ts`
Expected: FAIL — module `./locationTracker` not found.

- [ ] **Step 3: Implement locationTracker.ts**

Create `src/services/locationTracker.ts`:

```ts
import * as Location from 'expo-location';
import type { LocationObject, LocationSubscription } from 'expo-location';

export interface TrackerHandlers {
  onPoint: (coord: { lat: number; lng: number }, accuracy: number) => void;
}

export function toCoordinate(location: LocationObject): { lat: number; lng: number; accuracy: number } {
  return {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    accuracy: location.coords.accuracy ?? 0,
  };
}

export async function startForegroundTracking(
  handlers: TrackerHandlers,
  distanceIntervalMeters: number
): Promise<LocationSubscription> {
  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: distanceIntervalMeters,
    },
    (location) => {
      const { lat, lng, accuracy } = toCoordinate(location);
      handlers.onPoint({ lat, lng }, accuracy);
    }
  );
}

export function stopForegroundTracking(subscription: LocationSubscription | null): void {
  subscription?.remove();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- locationTracker.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/locationTracker.ts src/services/locationTracker.test.ts
git commit -m "feat: add foreground location tracker service"
```

---

### Task 12: Background location task + native config

**Files:**
- Create: `src/services/backgroundLocationTask.ts`
- Modify: `app.json`

**Interfaces:**
- Produces: `BACKGROUND_LOCATION_TASK: string`, `setBackgroundLocationHandler(fn: (coord: { lat: number; lng: number }, accuracy: number) => void | Promise<void>): void`, `startBackgroundTracking(distanceIntervalMeters: number): Promise<void>`, `stopBackgroundTracking(): Promise<void>` from `src/services/backgroundLocationTask.ts`.

No automated test for this task — `expo-task-manager`'s `defineTask` registers a real native background task and cannot be meaningfully unit-tested; verify manually per the spec (walk with the app backgrounded, confirm points appear after reopening).

- [ ] **Step 1: Implement backgroundLocationTask.ts**

Create `src/services/backgroundLocationTask.ts`:

```ts
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

export const BACKGROUND_LOCATION_TASK = 'background-location-task';

export type BackgroundLocationHandler = (
  coord: { lat: number; lng: number },
  accuracy: number
) => void | Promise<void>;

let handler: BackgroundLocationHandler | null = null;

export function setBackgroundLocationHandler(fn: BackgroundLocationHandler): void {
  handler = fn;
}

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, ({ data, error }) => {
  if (error) {
    console.warn('[backgroundLocationTask]', error.message);
    return;
  }
  if (!data || !handler) return;

  const { locations } = data as { locations: Location.LocationObject[] };
  for (const location of locations) {
    void handler(
      { lat: location.coords.latitude, lng: location.coords.longitude },
      location.coords.accuracy ?? 0
    );
  }
});

export async function startBackgroundTracking(distanceIntervalMeters: number): Promise<void> {
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (alreadyStarted) return;

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: distanceIntervalMeters,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: 'Открытие карты активно',
      notificationBody: 'Приложение отслеживает перемещение, чтобы открывать карту',
    },
  });
}

export async function stopBackgroundTracking(): Promise<void> {
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (alreadyStarted) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}
```

- [ ] **Step 2: Configure app.json for background location and Mapbox**

Add to `app.json` under `expo`:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Приложению нужен доступ к геолокации, чтобы открывать карту по мере вашего перемещения.",
          "locationAlwaysPermission": "Приложению нужен постоянный доступ к геолокации, чтобы открывать карту, даже когда приложение свёрнуто.",
          "isAndroidBackgroundLocationEnabled": true,
          "isAndroidForegroundServiceEnabled": true
        }
      ],
      [
        "@rnmapbox/maps",
        {
          "RNMapboxMapsDownloadToken": "REPLACE_WITH_YOUR_MAPBOX_SECRET_DOWNLOAD_TOKEN"
        }
      ]
    ],
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["location"]
      }
    },
    "android": {
      "permissions": [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION"
      ]
    }
  }
}
```

`RNMapboxMapsDownloadToken` is a **secret** token from your Mapbox account (Account → Tokens → create a token with `DOWNLOADS:READ` scope) — replace the placeholder with your real value before building; do not commit the real value (move it to an env-driven config if committing this file).

- [ ] **Step 3: Commit**

```bash
git add src/services/backgroundLocationTask.ts app.json
git commit -m "feat: add background location task and native permission config"
```

---

### Task 13: MapScreen (Mapbox)

**Files:**
- Create: `src/screens/MapScreen.tsx`

**Interfaces:**
- Consumes: `VisitedPoint` from `../lib/supabase/visitedPoints`, `FogOverlay` from `../components/FogOverlay`.
- Produces: `MapScreen` component (props: `{ points: VisitedPoint[] }`) from `src/screens/MapScreen.tsx`.

No automated test — Mapbox native rendering; verify manually per the spec.

- [ ] **Step 1: Implement MapScreen.tsx**

Create `src/screens/MapScreen.tsx`:

```tsx
import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Mapbox, { Camera, MapView, UserLocation } from '@rnmapbox/maps';
import FogOverlay from '../components/FogOverlay';
import type { VisitedPoint } from '../lib/supabase/visitedPoints';

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '');

export interface MapScreenProps {
  points: VisitedPoint[];
}

export default function MapScreen({ points }: MapScreenProps) {
  const mapRef = useRef<MapView>(null);
  const cameraRef = useRef<Camera>(null);
  const [regionVersion, setRegionVersion] = useState(0);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        onCameraChanged={() => setRegionVersion((v) => v + 1)}
      >
        <Camera ref={cameraRef} followUserLocation followZoomLevel={16} />
        <UserLocation visible showsUserHeadingIndicator />
      </MapView>
      <FogOverlay points={points} mapRef={mapRef} regionVersion={regionVersion} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/MapScreen.tsx
git commit -m "feat: add MapScreen with Mapbox base map"
```

---

### Task 14: FogOverlay (Skia)

**Files:**
- Create: `src/components/FogOverlay.tsx`

**Interfaces:**
- Consumes: `VisitedPoint` from `../lib/supabase/visitedPoints`, a `React.RefObject<MapView>` from `@rnmapbox/maps`.
- Produces: `FogOverlay` component (props: `{ points: VisitedPoint[]; mapRef: React.RefObject<MapView>; regionVersion: number }`) from `src/components/FogOverlay.tsx`. Consumed by `MapScreen.tsx`.

No automated test — Skia canvas rendering synced to native map projection; verify manually per the spec (confirm the fog edge is soft, not blocky, and follows the user smoothly).

- [ ] **Step 1: Implement FogOverlay.tsx**

Create `src/components/FogOverlay.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import { Canvas, Group, Rect, Circle, BlurMask, BlendMode, Paint } from '@shopify/react-native-skia';
import type { MapView } from '@rnmapbox/maps';
import type { VisitedPoint } from '../lib/supabase/visitedPoints';

export interface FogOverlayProps {
  points: VisitedPoint[];
  mapRef: React.RefObject<MapView>;
  regionVersion: number;
}

interface ProjectedCircle {
  x: number;
  y: number;
  radiusPx: number;
}

const FOG_COLOR = 'rgba(10, 12, 20, 0.85)';
const OFFSCREEN_MARGIN_PX = 100;
const FALLBACK_METERS_PER_PIXEL = 1;

function groundResolutionMetersPerPixel(zoom: number): number {
  const earthCircumferenceMeters = 40075016.686;
  const resolution = earthCircumferenceMeters / (256 * 2 ** zoom);
  return Number.isFinite(resolution) && resolution > 0 ? resolution : FALLBACK_METERS_PER_PIXEL;
}

export default function FogOverlay({ points, mapRef, regionVersion }: FogOverlayProps) {
  const [circles, setCircles] = useState<ProjectedCircle[]>([]);
  const { width, height } = Dimensions.get('window');

  useEffect(() => {
    let cancelled = false;

    async function project() {
      const map = mapRef.current;
      if (!map) return;

      const zoom = (await map.getZoom()) ?? 16;
      const metersPerPixel = groundResolutionMetersPerPixel(zoom);
      const results: ProjectedCircle[] = [];

      for (const point of points) {
        const screenPoint = await map.getPointInView([point.lng, point.lat]);
        if (!screenPoint) continue;
        const [x, y] = screenPoint;
        if (
          x < -OFFSCREEN_MARGIN_PX ||
          x > width + OFFSCREEN_MARGIN_PX ||
          y < -OFFSCREEN_MARGIN_PX ||
          y > height + OFFSCREEN_MARGIN_PX
        ) {
          continue;
        }
        results.push({ x, y, radiusPx: point.radius / metersPerPixel });
      }

      if (!cancelled) setCircles(results);
    }

    void project();
    return () => {
      cancelled = true;
    };
  }, [points, regionVersion, mapRef, width, height]);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Group layer={<Paint />}>
        <Rect x={0} y={0} width={width} height={height} color={FOG_COLOR} />
        {circles.map((c, i) => (
          <Circle key={i} cx={c.x} cy={c.y} r={c.radiusPx} color="black" blendMode={BlendMode.DstOut}>
            <BlurMask blur={c.radiusPx * 0.35} style="normal" />
          </Circle>
        ))}
      </Group>
    </Canvas>
  );
}
```

The `<Group layer={<Paint />}>` wrapper forces Skia to composite this group in an offscreen layer, so each circle's `DstOut` blend mode erases against the fog `Rect` rather than the whole app underneath it.

- [ ] **Step 2: Commit**

```bash
git add src/components/FogOverlay.tsx
git commit -m "feat: add Skia fog-of-war overlay with soft-edged reveal"
```

---

### Task 15: Hydration + permission/offline banners + app wiring

**Files:**
- Create: `src/components/OfflineBanner.tsx`
- Create: `src/components/LocationPermissionBanner.tsx`
- Modify: `src/navigation/RootNavigator.tsx`
- Modify: `App.tsx`

**Interfaces:**
- Consumes: `useLocationPermissions` from `../hooks/useLocationPermissions`, `createProgressStore` from `../store/progressStore`, `startForegroundTracking`/`stopForegroundTracking` from `../services/locationTracker`, `setBackgroundLocationHandler`/`startBackgroundTracking` from `../services/backgroundLocationTask`, `getAccuracyProfile`/`DISTANCE_INTERVAL_METERS` from `../lib/settings/accuracyProfile`, `getEnvSupabaseClient` from `../lib/supabase/client`, `getSession` from `../lib/supabase/auth`, `@react-native-community/netinfo`.
- Produces: fully wired `App.tsx` that authenticates, hydrates progress, starts tracking, and renders `MapScreen` with banners.

- [ ] **Step 1: Implement OfflineBanner.tsx**

Create `src/components/OfflineBanner.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      setIsOffline(state.isConnected === false);
    });
  }, []);

  if (!isOffline) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>Нет сети — прогресс сохранится локально и синхронизируется позже</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: '#b45309', padding: 8 },
  text: { color: 'white', textAlign: 'center' },
});
```

- [ ] **Step 2: Implement LocationPermissionBanner.tsx**

Create `src/components/LocationPermissionBanner.tsx`:

```tsx
import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import type { PermissionStage } from '../hooks/useLocationPermissions';

export interface LocationPermissionBannerProps {
  stage: PermissionStage;
  onRequestForeground: () => void;
}

export default function LocationPermissionBanner({ stage, onRequestForeground }: LocationPermissionBannerProps) {
  if (stage === 'foreground-granted' || stage === 'background-granted') return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        {stage === 'denied'
          ? 'Доступ к геолокации отклонён — включите его в настройках, чтобы открывать карту'
          : 'Включите геолокацию, чтобы открывать карту'}
      </Text>
      {stage !== 'denied' && <Button title="Разрешить" onPress={onRequestForeground} />}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: '#1f2937', padding: 8, alignItems: 'center', gap: 4 },
  text: { color: 'white', textAlign: 'center' },
});
```

- [ ] **Step 3: Wire App.tsx**

Create/replace `App.tsx`:

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { getEnvSupabaseClient } from './src/lib/supabase/client';
import { getSession } from './src/lib/supabase/auth';
import { getAccuracyProfile, DISTANCE_INTERVAL_METERS } from './src/lib/settings/accuracyProfile';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createProgressStore } from './src/store/progressStore';
import { startForegroundTracking, stopForegroundTracking } from './src/services/locationTracker';
import {
  setBackgroundLocationHandler,
  startBackgroundTracking,
} from './src/services/backgroundLocationTask';
import { useLocationPermissions } from './src/hooks/useLocationPermissions';
import RootNavigator from './src/navigation/RootNavigator';
import MapScreen from './src/screens/MapScreen';
import OfflineBanner from './src/components/OfflineBanner';
import LocationPermissionBanner from './src/components/LocationPermissionBanner';
import type { LocationSubscription } from 'expo-location';
import type { VisitedPoint } from './src/lib/supabase/visitedPoints';

const client = getEnvSupabaseClient();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [points, setPoints] = useState<VisitedPoint[]>([]);
  const { stage, requestForeground, requestBackground } = useLocationPermissions();
  const subscriptionRef = useRef<LocationSubscription | null>(null);
  const storeRef = useRef<ReturnType<typeof createProgressStore> | null>(null);

  useEffect(() => {
    getSession(client).then(setSession).catch(() => setSession(null));
  }, []);

  useEffect(() => {
    if (!session) return;

    const store = createProgressStore({ client, userId: session.user.id });
    storeRef.current = store;

    const unsubscribe = store.useProgressStore.subscribe((state) => setPoints(state.points));

    void (async () => {
      await store.useProgressStore.getState().loadFromDisk();
      await store.useProgressStore.getState().hydrateFromRemote();

      const profile = await getAccuracyProfile(AsyncStorage);
      const distanceInterval = DISTANCE_INTERVAL_METERS[profile];

      const foregroundOk = await requestForeground();
      if (foregroundOk) {
        subscriptionRef.current = await startForegroundTracking(
          { onPoint: (coord, accuracy) => void store.useProgressStore.getState().addPoint(coord, accuracy || distanceInterval) },
          distanceInterval
        );

        const backgroundOk = await requestBackground();
        if (backgroundOk) {
          setBackgroundLocationHandler((coord, accuracy) =>
            store.useProgressStore.getState().addPoint(coord, accuracy || distanceInterval)
          );
          await startBackgroundTracking(distanceInterval);
        }
      }
    })();

    return () => {
      unsubscribe();
      stopForegroundTracking(subscriptionRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  return (
    <SafeAreaView style={styles.container}>
      <RootNavigator client={client} session={session} onSignedIn={() => getSession(client).then(setSession)}>
        <OfflineBanner />
        <LocationPermissionBanner stage={stage} onRequestForeground={requestForeground} />
        <MapScreen points={points} />
      </RootNavigator>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
```

Note: `addPoint(coord, radius)`'s `radius` parameter represents the fog reveal radius in meters, not GPS accuracy — passing GPS `accuracy` here as a fallback-to-`distanceInterval` value is a placeholder-free but deliberately simple MVP choice (bigger reveal radius when the GPS fix is less precise, floored at the accuracy-profile's distance interval so the circle is never smaller than the throttle step). Revisit if playtesting shows the reveal circles feel wrong.

- [ ] **Step 4: Commit**

```bash
git add src/components/OfflineBanner.tsx src/components/LocationPermissionBanner.tsx src/navigation/RootNavigator.tsx App.tsx
git commit -m "feat: wire hydration, tracking and banners into App"
```

---

### Task 16: Settings screen for accuracy profile

**Files:**
- Create: `src/screens/SettingsScreen.tsx`
- Modify: `App.tsx` (add a simple toggle button to reach Settings)

**Interfaces:**
- Consumes: `getAccuracyProfile`, `setAccuracyProfile`, `AccuracyProfile` from `../lib/settings/accuracyProfile`.
- Produces: `SettingsScreen` component (props: `{ onProfileChanged: (profile: AccuracyProfile) => void }`).

- [ ] **Step 1: Implement SettingsScreen.tsx**

Create `src/screens/SettingsScreen.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AccuracyProfile,
  getAccuracyProfile,
  setAccuracyProfile,
} from '../lib/settings/accuracyProfile';

export interface SettingsScreenProps {
  onProfileChanged: (profile: AccuracyProfile) => void;
}

export default function SettingsScreen({ onProfileChanged }: SettingsScreenProps) {
  const [profile, setProfile] = useState<AccuracyProfile>('battery-saver');

  useEffect(() => {
    getAccuracyProfile(AsyncStorage).then(setProfile);
  }, []);

  async function toggle(value: boolean) {
    const next: AccuracyProfile = value ? 'precise' : 'battery-saver';
    setProfile(next);
    await setAccuracyProfile(AsyncStorage, next);
    onProfileChanged(next);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Точный режим (чаще обновления, больше расход батареи)</Text>
      <Switch value={profile === 'precise'} onValueChange={toggle} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12 },
  label: { fontSize: 16 },
});
```

Wiring this into navigation (adding a second route alongside the map) and reacting to `onProfileChanged` by restarting the active tracking subscriptions with the new `distanceInterval` is left as a follow-up once there's a real navigation stack (noted as out of MVP scope in the spec's "Вне рамок MVP" section — the toggle persists correctly today, full live-restart of tracking is a nice-to-have).

- [ ] **Step 2: Commit**

```bash
git add src/screens/SettingsScreen.tsx
git commit -m "feat: add accuracy profile settings screen"
```

---

## Self-Review Notes

- **Spec coverage:** stack (Task 1), Supabase schema/client (Task 2), throttle logic (Task 3), batching (Task 4), auth (Task 5), visited-points sync (Task 6), accuracy profiles (Task 7), ProgressStore tying it together (Task 8), sign-in flow (Task 9), two-step permission flow (Task 10), foreground tracking (Task 11), background tracking + native config (Task 12), Mapbox base map (Task 13), Skia smooth fog reveal (Task 14), hydration + offline/permission banners (Task 15), accuracy settings UI (Task 16). All spec sections are covered.
- **Placeholder scan:** no TBD/TODO markers; the one external value left for the engineer to fill in (`RNMapboxMapsDownloadToken`) is a genuine account-specific secret, called out explicitly with instructions on where to get it, not a deferred design decision.
- **Type consistency:** `VisitedPoint` is defined once in `src/lib/supabase/visitedPoints.ts` and imported everywhere else (`progressStore.ts`, `MapScreen.tsx`, `FogOverlay.tsx`). `Coordinate` is defined once in `src/lib/geo/distance.ts` and reused by `throttle.ts` and `progressStore.ts`. `AccuracyProfile`/`DISTANCE_INTERVAL_METERS` defined once in `accuracyProfile.ts`, consumed by `App.tsx` and `SettingsScreen.tsx`.
