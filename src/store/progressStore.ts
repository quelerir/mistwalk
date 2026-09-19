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
const BACKFILL_CHUNK = 200;

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
  // Dedupe on lat/lng only (not ts): a locally-recorded point's ts (Date.now()
  // at capture time) never matches the ts it gets back from Supabase
  // (Date.parse(created_at), server-assigned on insert). lat/lng round-trip
  // byte-exact through Postgres double precision <-> JS number, and Task 3's
  // throttle already guarantees genuinely distinct points are >=25m apart, so
  // lat/lng equality alone is a safe identity key here.
  const seen = new Set(local.map((p) => `${p.lat},${p.lng}`));
  const merged = [...local];
  for (const point of remote) {
    const key = `${point.lat},${point.lng}`;
    if (!seen.has(key)) {
      merged.push(point);
      seen.add(key);
    }
  }
  return merged;
}

export function createProgressStore(options: CreateProgressStoreOptions) {
  const storage: KeyValueStorage = options.storage ?? AsyncStorage;
  let throttleMeters = options.throttleMeters ?? DEFAULT_THROTTLE_METERS;

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
      const startedAt = Date.now();
      // Points still waiting in the queue must reach the server first, or they would be re-sent below.
      await queue.flush().catch(() => {});
      const remotePoints = await fetchVisitedPoints(options.client, options.userId);
      const local = get().points;
      const merged = mergePoints(local, remotePoints);
      set({ points: merged, hydrated: true });
      await storage.setItem(STORAGE_KEY, JSON.stringify(merged));

      // A point that was recorded but never uploaded (app closed before the batch went out, or offline)
      // stays only on the phone; send it now so the server totals match.
      const remoteKeys = new Set(remotePoints.map((p) => `${p.lat},${p.lng}`));
      const missing = local.filter((p) => p.ts < startedAt && !remoteKeys.has(`${p.lat},${p.lng}`));
      for (let i = 0; i < missing.length; i += BACKFILL_CHUNK) {
        try {
          await insertVisitedPoints(options.client, options.userId, missing.slice(i, i + BACKFILL_CHUNK));
        } catch (err) {
          console.warn('[progressStore] backfill of unsent points failed', err);
          break;
        }
      }
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

  return {
    useProgressStore,
    queue,
    setThrottleMeters: (meters: number) => {
      throttleMeters = meters;
    },
  };
}
