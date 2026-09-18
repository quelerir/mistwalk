import { POI_TILE_ZOOM, tileBounds, tileForLngLat, tileKey, tilesForViewport } from './tiles';

describe('tiles', () => {
  it('finds the well-known z13 tile for San Francisco Union Square', () => {
    const t = tileForLngLat(-122.4075, 37.7879);
    expect(t.z).toBe(POI_TILE_ZOOM);
    expect(t.x).toBe(1310);
    expect(t.y).toBe(3166);
    expect(tileKey(t)).toBe('13/1310/3166');
  });

  it('returns bounds that contain the original point', () => {
    const t = tileForLngLat(44.8271, 41.7151);
    const b = tileBounds(t);
    expect(b.west).toBeLessThanOrEqual(44.8271);
    expect(b.east).toBeGreaterThan(44.8271);
    expect(b.south).toBeLessThanOrEqual(41.7151);
    expect(b.north).toBeGreaterThan(41.7151);
  });

  it('covers a small viewport with one tile and a wide one with several, nearest first', () => {
    const size = { width: 400, height: 800 };
    const b = tileBounds({ x: 1310, y: 3166, z: 13 });
    const middle: [number, number] = [(b.west + b.east) / 2, (b.south + b.north) / 2];
    const close = tilesForViewport({ center: middle, zoom: 16, bearing: 0 }, size);
    expect(close).toHaveLength(1);

    const wide = tilesForViewport({ center: [-122.4075, 37.7879], zoom: 11, bearing: 0 }, size);
    expect(wide.length).toBeGreaterThan(1);
    expect(wide.length).toBeLessThanOrEqual(9);
    expect(tileKey(wide[0])).toBe('13/1310/3166');
  });
});
