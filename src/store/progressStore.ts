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
