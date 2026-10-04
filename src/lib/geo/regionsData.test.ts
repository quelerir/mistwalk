interface Region {
  c: string;
  w: string | null;
  areaKm2: number;
  polygons: number[][][][];
}
const regions: Record<string, Region> = require('../../assets/regions.json').regions;
const cities: { c: string; r: string | null; ru: string }[] = require('../../assets/world-cities.json').cities;
const names: Record<string, { ru: string; en: string }> = require('../../assets/world-cities.json').regions;

// The countries that get a regions list: more than 10 cities in more than one region (see buildCountryCities).
const regionsModeCountries = (() => {
  const byCountry = new Map<string, typeof cities>();
  for (const city of cities) byCountry.set(city.c, [...(byCountry.get(city.c) ?? []), city]);
  return new Set(
    [...byCountry]
      .filter(([, list]) => list.length > 10 && new Set(list.map((c) => c.r).filter(Boolean)).size > 1)
      .map(([code]) => code)
  );
})();
const used = new Set(cities.filter((c) => c.r && regionsModeCountries.has(c.c)).map((c) => c.r as string));

describe('regions data', () => {
  it('has a region for every region that a regions-mode country uses, and no others', () => {
    expect(Object.keys(regions).sort()).toEqual([...used].sort());
  });

  it('gives every region its country, a positive area and closed rings', () => {
    for (const [code, region] of Object.entries(regions)) {
      expect(region.c).toMatch(/^[A-Z]{2}$/);
      expect(cities.filter((c) => c.r === code).every((c) => c.c === region.c)).toBe(true);
      expect(region.areaKm2).toBeGreaterThan(0);
      expect(region.w === null || /^Q\d+$/.test(region.w)).toBe(true);
      expect(region.polygons.length).toBeGreaterThan(0);
      for (const polygon of region.polygons) {
        for (const ring of polygon) {
          expect(ring.length).toBeGreaterThanOrEqual(4);
          expect(ring[0]).toEqual(ring[ring.length - 1]);
          for (const [lng, lat] of ring) {
            expect(Math.abs(lng)).toBeLessThanOrEqual(180);
            expect(Math.abs(lat)).toBeLessThanOrEqual(90);
          }
        }
      }
    }
  });

  it('has plausible areas (California and Texas within 20 %)', () => {
    const area = (ru: string, country: string) => {
      const code = Object.keys(names).find((k) => names[k].ru === ru && regions[k]?.c === country)!;
      return regions[code].areaKm2;
    };
    expect(Math.abs(area('Калифорния', 'US') - 424000) / 424000).toBeLessThan(0.2);
    expect(Math.abs(area('Техас', 'US') - 695000) / 695000).toBeLessThan(0.2);
  });

  it('stays under 1.5 MB', () => {
    expect(JSON.stringify({ regions }).length).toBeLessThan(1_500_000);
  });
});
