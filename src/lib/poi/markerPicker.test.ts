import { layoutMarkers, type LocatedCandidate } from './markerPicker';

const screen = { width: 400, height: 800 };

const loc = (id: string, x: number, y: number, found = false): LocatedCandidate => ({ id, x, y, found, lng: x / 100, lat: y / 100 });

describe('layoutMarkers', () => {
  it('keeps places that are far apart as single markers', () => {
    const items = layoutMarkers([loc('a', 50, 50), loc('b', 200, 300), loc('c', 350, 700)], screen, { radius: 44, max: 90, clearance: 30 });
    expect(items.map((i) => i.ids)).toHaveLength(3);
    expect(items.every((i) => i.ids.length === 1)).toBe(true);
  });

  it('joins places that would overlap into one cluster with a count and a middle', () => {
    const items = layoutMarkers([loc('a', 100, 100), loc('b', 110, 104), loc('c', 96, 96)], screen, { radius: 44, max: 90, clearance: 30 });
    expect(items).toHaveLength(1);
    expect(items[0].ids.sort()).toEqual(['a', 'b', 'c']);
    expect(items[0].x).toBeCloseTo((100 + 110 + 96) / 3);
    expect(items[0].lng).toBeCloseTo((1 + 1.1 + 0.96) / 3);
  });

  it('splits into several markers once the places are far enough apart (zoomed in)', () => {
    const close = layoutMarkers([loc('a', 100, 100), loc('b', 120, 100)], screen, { radius: 44, max: 90, clearance: 30 });
    const apart = layoutMarkers([loc('a', 100, 100), loc('b', 220, 100)], screen, { radius: 44, max: 90, clearance: 30 });
    expect(close).toHaveLength(1);
    expect(apart).toHaveLength(2);
  });

  it('counts every new place: nothing is dropped inside a cluster', () => {
    const crowd = Array.from({ length: 100 }, (_, i) => loc(`n${i}`, 10 + (i % 10) * 3, 10 + Math.floor(i / 10) * 3));
    const items = layoutMarkers(crowd, screen, { radius: 44, max: 90, clearance: 30 });
    expect(items.reduce((sum, i) => sum + i.ids.length, 0)).toBe(100);
  });

  it('keeps a found place as a marker of its own, never lost inside a cluster of new places', () => {
    const lone = layoutMarkers([loc('f', 100, 100, true)], screen, { radius: 44, max: 90, clearance: 30 });
    expect(lone[0].foundSingle).toBe(true);
    // two new places within 44 px of each other and of the found one: they cluster, the found one stays single
    const around = layoutMarkers([loc('f', 100, 100, true), loc('u1', 135, 100), loc('u2', 140, 105)], screen, { radius: 44, max: 90, clearance: 30 });
    expect(around.find((i) => i.foundSingle)?.ids).toEqual(['f']);
    expect(around.find((i) => i.ids.length === 2)?.ids.sort()).toEqual(['u1', 'u2']);
  });

  it('leaves out a new place that sits right on a found one', () => {
    const items = layoutMarkers([loc('f', 100, 100, true), loc('u', 110, 100)], screen, { radius: 44, max: 90, clearance: 30 });
    expect(items.map((i) => i.ids)).toEqual([['f']]);
  });

  it('groups found places among themselves', () => {
    const items = layoutMarkers([loc('f1', 100, 100, true), loc('f2', 110, 100, true)], screen, { radius: 44, max: 90, clearance: 30 });
    expect(items).toHaveLength(1);
    expect(items[0].foundSingle).toBe(false);
    expect(items[0].ids.sort()).toEqual(['f1', 'f2']);
  });

  it('never returns more than the limit, and keeps the found ones and those nearest the middle', () => {
    const spread = Array.from({ length: 60 }, (_, i) => loc(`p${i}`, (i % 8) * 50, Math.floor(i / 8) * 100));
    const items = layoutMarkers([...spread, loc('found', 390, 790, true)], screen, { radius: 20, max: 10, clearance: 8 });
    expect(items).toHaveLength(10);
    expect(items[0].ids).toEqual(['found']);
  });
});
