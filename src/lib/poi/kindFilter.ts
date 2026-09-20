import type { KeyValueStorage } from '../settings/accuracyProfile';
import type { Poi, PoiKind } from './types';

// Every kind; the record makes the compiler say so when a kind is added and forgotten here.
const KINDS: Record<PoiKind, true> = {
  viewpoint: true,
  monument: true,
  castle: true,
  ruins: true,
  attraction: true,
  artwork: true,
  museum: true,
  park: true,
  beach: true,
  worship: true,
  nature: true,
};
export const ALL_KINDS = Object.keys(KINDS) as PoiKind[];

const STORAGE_KEY = 'settings.mapHiddenKinds.v1';

// The places whose kind is not hidden. With nothing hidden the same list comes back, so nothing downstream re-runs.
export function filterByKinds(pois: Poi[], hidden: ReadonlySet<PoiKind>): Poi[] {
  return hidden.size === 0 ? pois : pois.filter((p) => !hidden.has(p.kind));
}

// How many places of each kind, the most common first (ties in the order of the kinds).
export function countByKind(pois: Poi[]): Array<{ kind: PoiKind; count: number }> {
  const counts = new Map<PoiKind, number>();
  for (const p of pois) counts.set(p.kind, (counts.get(p.kind) ?? 0) + 1);
  return ALL_KINDS.filter((kind) => counts.has(kind))
    .map((kind) => ({ kind, count: counts.get(kind)! }))
    .sort((a, b) => b.count - a.count);
}

export async function getHiddenKinds(storage: Pick<KeyValueStorage, 'getItem'>): Promise<Set<PoiKind>> {
  try {
    const raw = await storage.getItem(STORAGE_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return new Set();
    return new Set(list.filter((k): k is PoiKind => ALL_KINDS.includes(k as PoiKind)));
  } catch {
    return new Set();
  }
}

export async function setHiddenKinds(storage: Pick<KeyValueStorage, 'setItem'>, hidden: ReadonlySet<PoiKind>): Promise<void> {
  await storage.setItem(STORAGE_KEY, JSON.stringify(Array.from(hidden)));
}
