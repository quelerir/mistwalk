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
