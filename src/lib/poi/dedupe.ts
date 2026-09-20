import { haversineDistanceMeters } from '../geo/distance';
import type { Poi } from './types';

// OpenStreetMap often holds one real place as several elements: a node and the outline of the same park, or the same
// steps drawn twice. They arrive with the same name and kind almost on top of each other.
export const SAME_PLACE_METERS = 100;
// The same wikidata entry is the same place even when the elements are further apart (an outline's middle and a gate).
export const SAME_WIKIDATA_METERS = 500;

export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function isSamePlace(a: Poi, b: Poi): boolean {
  if (a.kind !== b.kind) return false;
  const meters = haversineDistanceMeters(a, b);
  if (a.wikidata && a.wikidata === b.wikidata && meters <= SAME_WIKIDATA_METERS) return true;
  return normalizeName(a.name) === normalizeName(b.name) && meters <= SAME_PLACE_METERS;
}

const TYPE_RANK: Record<string, number> = { node: 0, way: 1, relation: 2 };

function rank(poi: Poi): number {
  return TYPE_RANK[poi.id.split('/')[0]] ?? 3;
}

// Which of two twins is kept. The choice does not depend on which arrived first, so the same place keeps the same id
// from one launch to the next: one with a wikidata entry, then a node before an outline, then the smaller id.
export function preferred(a: Poi, b: Poi): Poi {
  if (Boolean(a.wikidata) !== Boolean(b.wikidata)) return a.wikidata ? a : b;
  if (rank(a) !== rank(b)) return rank(a) < rank(b) ? a : b;
  const na = Number(a.id.split('/')[1]);
  const nb = Number(b.id.split('/')[1]);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na < nb ? a : b;
  return a.id <= b.id ? a : b;
}

// Adds the incoming places to the list as they are (by id), without folding anything.
export function appendPois(current: Poi[], incoming: Poi[]): Poi[] {
  if (incoming.length === 0) return current;
  const known = new Set(current.map((p) => p.id));
  const fresh = incoming.filter((p) => {
    if (known.has(p.id)) return false;
    known.add(p.id);
    return true;
  });
  return fresh.length === 0 ? current : [...current, ...fresh];
}

// Folds twins of one real place into one. Twins form groups (a place is in the group of every place it is the same as,
// so a chain of steps drawn as several outlines becomes one place), and each group keeps its preferred place, with the
// others' ids in `aka`, so a place found under any of them still counts as found. The result depends only on the places,
// not on the order they arrived in, so a place keeps its id from one launch to the next. A place with no twin is returned
// as it is.
export function dedupePois(pois: Poi[]): Poi[] {
  const parent = pois.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };

  // Only places with the same name and kind, or the same wikidata entry, can be twins.
  const groups = new Map<string, number[]>();
  const add = (key: string, i: number) => groups.set(key, [...(groups.get(key) ?? []), i]);
  pois.forEach((p, i) => {
    add(`n|${p.kind}|${normalizeName(p.name)}`, i);
    if (p.wikidata) add(`w|${p.kind}|${p.wikidata}`, i);
  });
  for (const members of groups.values()) {
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        if (find(members[i]) !== find(members[j]) && isSamePlace(pois[members[i]], pois[members[j]])) union(members[i], members[j]);
      }
    }
  }

  const byRoot = new Map<number, Poi[]>();
  pois.forEach((p, i) => {
    const root = find(i);
    byRoot.set(root, [...(byRoot.get(root) ?? []), p]);
  });
  const result: Poi[] = [];
  for (const [, twins] of byRoot) {
    if (twins.length === 1) {
      result.push(twins[0]);
      continue;
    }
    const keep = twins.reduce(preferred);
    const aka = Array.from(new Set(twins.flatMap((t) => [t.id, ...(t.aka ?? [])]))).filter((id) => id !== keep.id).sort();
    result.push({ ...keep, aka });
  }
  return result;
}

// The found ids plus every place whose twin was found: the set to ask "was this found?" with.
export function withAliases(found: ReadonlySet<string>, pois: Poi[]): ReadonlySet<string> {
  let extended: Set<string> | null = null;
  for (const poi of pois) {
    if (!poi.aka || found.has(poi.id)) continue;
    if (poi.aka.some((id) => found.has(id))) (extended ??= new Set(found)).add(poi.id);
  }
  return extended ?? found;
}
