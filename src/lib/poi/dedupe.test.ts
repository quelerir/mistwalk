import { appendPois, dedupePois, isSamePlace, normalizeName, preferred, withAliases } from './dedupe';
import type { Poi, PoiKind } from './types';

// dLat 0.0009 is about 100 m.
const poi = (id: string, name: string, dLat = 0, kind: PoiKind = 'park', extra: Partial<Poi> = {}): Poi => ({
  id,
  name,
  kind,
  lat: 37.788 + dLat,
  lng: -122.407,
  ...extra,
});

describe('isSamePlace', () => {
  it('is the same place with the same kind and name close together, whatever the case or spaces', () => {
    expect(isSamePlace(poi('node/1', 'Union Square'), poi('way/2', ' union  square ', 0.0002))).toBe(true);
  });

  it('is not the same with another kind, another name, or too far away', () => {
    expect(isSamePlace(poi('node/1', 'Union Square'), poi('way/2', 'Union Square', 0, 'monument'))).toBe(false);
    expect(isSamePlace(poi('node/1', 'Union Square'), poi('way/2', 'Dewey Monument'))).toBe(false);
    expect(isSamePlace(poi('node/1', 'Union Square'), poi('way/2', 'Union Square', 0.004))).toBe(false);
  });

  it('takes the same wikidata entry as the same place even under another name, within 500 m', () => {
    const a = poi('node/1', 'Union Square', 0, 'park', { wikidata: 'Q1' });
    expect(isSamePlace(a, poi('way/2', 'Юнион-сквер', 0.003, 'park', { wikidata: 'Q1' }))).toBe(true);
    expect(isSamePlace(a, poi('way/2', 'Юнион-сквер', 0.003, 'park', { wikidata: 'Q2' }))).toBe(false);
  });
});

describe('preferred', () => {
  it('prefers a wikidata entry, then a node over an outline, then the smaller id', () => {
    expect(preferred(poi('node/9', 'A'), poi('way/1', 'A', 0, 'park', { wikidata: 'Q1' })).id).toBe('way/1');
    expect(preferred(poi('way/1', 'A'), poi('node/9', 'A')).id).toBe('node/9');
    expect(preferred(poi('node/9', 'A'), poi('node/2', 'A')).id).toBe('node/2');
  });
});

describe('appendPois', () => {
  it('adds places by id and keeps the very same list when nothing is new', () => {
    const list = appendPois([], [poi('node/1', 'A'), poi('node/2', 'B', 0.01)]);
    expect(list).toHaveLength(2);
    expect(appendPois(list, [poi('node/1', 'A')])).toBe(list);
    expect(appendPois(list, [])).toBe(list);
    expect(appendPois(list, [poi('node/3', 'C', 0.02), poi('node/3', 'C', 0.02)])).toHaveLength(3);
  });
});

describe('dedupePois', () => {
  it('leaves places without a twin alone, the very same objects', () => {
    const a = poi('node/1', 'A');
    const b = poi('node/2', 'B', 0.01);
    const out = dedupePois([a, b]);
    expect(out).toEqual([a, b]);
    expect(out[0]).toBe(a);
  });

  it('folds twins into one and remembers the dropped id', () => {
    const out = dedupePois([poi('way/22', 'Union Square'), poi('node/11', 'Union Square', 0.0001)]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('node/11');
    expect(out[0].aka).toEqual(['way/22']);
  });

  it('folds three twins into one that lists the other two', () => {
    const out = dedupePois([poi('way/3', 'X'), poi('relation/9', 'X'), poi('node/1', 'X')]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('node/1');
    expect(out[0].aka).toEqual(['relation/9', 'way/3']);
  });

  it('gives the same result whatever the order the places came in', () => {
    // A chain: a and b are twins, b and c are twins, but a and c are further apart than the limit.
    const a = poi('way/1', 'Steps', 0);
    const b = poi('way/2', 'Steps', 0.0008);
    const c = poi('way/3', 'Steps', 0.0016);
    const other = poi('node/9', 'Other', 0.02);
    const shape = (list: ReturnType<typeof dedupePois>) => list.map((p) => `${p.id}:${(p.aka ?? []).join('+')}`).sort().join('|');
    const orders = [[a, b, c, other], [c, b, a, other], [b, other, a, c], [c, a, other, b], [other, c, b, a]];
    const results = orders.map((o) => shape(dedupePois(o)));
    expect(new Set(results).size).toBe(1);
    expect(dedupePois([a, b, c, other])).toHaveLength(2);
  });

  it('keeps different places on the same spot apart', () => {
    const out = dedupePois([poi('node/1', 'Goddess of Victory', 0, 'artwork'), poi('node/2', 'Dewey Monument', 0, 'monument'), poi('way/3', 'Union Square')]);
    expect(out).toHaveLength(3);
  });

  it('folds twins that share a wikidata entry under different names', () => {
    const out = dedupePois([
      poi('node/1', 'Union Square', 0, 'park', { wikidata: 'Q1' }),
      poi('way/2', 'Юнион-сквер', 0.003, 'park', { wikidata: 'Q1' }),
    ]);
    expect(out).toHaveLength(1);
  });

  it('does not lose a place folded earlier when it is folded again with more places', () => {
    const first = dedupePois([poi('way/22', 'Union Square'), poi('node/11', 'Union Square', 0.0001)]);
    const again = dedupePois([...first, poi('relation/5', 'Union Square', 0.0002)]);
    expect(again).toHaveLength(1);
    expect(new Set([again[0].id, ...(again[0].aka ?? [])])).toEqual(new Set(['way/22', 'node/11', 'relation/5']));
  });
});

describe('withAliases', () => {
  it('counts a place as found when its dropped twin was found', () => {
    const list = dedupePois([poi('way/22', 'Union Square'), poi('node/11', 'Union Square', 0.0001)]);
    const found = new Set(['way/22']);
    const all = withAliases(found, list);
    expect(all.has('node/11')).toBe(true);
    expect(all.has('way/22')).toBe(true);
  });

  it('returns the very same set when nothing changes', () => {
    const list = dedupePois([poi('node/1', 'A')]);
    const found = new Set(['node/9']);
    expect(withAliases(found, list)).toBe(found);
  });
});

describe('normalizeName', () => {
  it('lower-cases and collapses spaces', () => {
    expect(normalizeName('  Filbert   STEPS ')).toBe('filbert steps');
  });
});
