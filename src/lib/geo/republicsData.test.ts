import { COUNTRY_BY_CODE } from './countries';

interface RepublicData {
  code: string;
  ru: string;
  en: string;
  host: string;
  w: string;
  areaKm2: number;
  polygons: number[][][][];
}
const data: { republics: RepublicData[] } = require('../../assets/republics.json');

// Rounded public figures (km2). The area in the file is computed from the simplified Natural Earth border, which
// differs: Natural Earth's Transnistria is smaller than the official one, so the tolerance is wide.
const REFERENCE: Record<string, { host: string; km2: number }> = {
  XA: { host: 'GE', km2: 8700 },
  XS: { host: 'GE', km2: 3900 },
  XT: { host: 'MD', km2: 4163 },
  XN: { host: 'CY', km2: 3355 },
  XL: { host: 'SO', km2: 176000 },
};

describe('republics data', () => {
  it('has exactly the five republics with a known host country', () => {
    expect(data.republics.map((r) => r.code).sort()).toEqual(['XA', 'XL', 'XN', 'XS', 'XT']);
    for (const r of data.republics) {
      expect(r.host).toBe(REFERENCE[r.code].host);
      expect(COUNTRY_BY_CODE[r.host]).toBeDefined();
      expect(r.ru.length).toBeGreaterThan(0);
      expect(r.en.length).toBeGreaterThan(0);
      expect(r.w).toMatch(/^Q\d+$/);
    }
  });

  it('has an area within 35 % of the public figure', () => {
    for (const r of data.republics) {
      const ref = REFERENCE[r.code].km2;
      expect(Math.abs(r.areaKm2 - ref) / ref).toBeLessThan(0.35);
    }
  });

  it('has closed rings of [lng, lat] points', () => {
    for (const r of data.republics) {
      expect(r.polygons.length).toBeGreaterThan(0);
      for (const polygon of r.polygons) {
        for (const ring of polygon) {
          expect(ring.length).toBeGreaterThanOrEqual(4);
          expect(ring[0]).toEqual(ring[ring.length - 1]);
          for (const [lng, lat] of ring) {
            expect(lng).toBeGreaterThanOrEqual(-180);
            expect(lng).toBeLessThanOrEqual(180);
            expect(lat).toBeGreaterThanOrEqual(-90);
            expect(lat).toBeLessThanOrEqual(90);
          }
        }
      }
    }
  });

  it('stays small', () => {
    expect(JSON.stringify(data).length).toBeLessThan(200_000);
  });

  it('has a bundled flag for every republic', () => {
    expect(require('../../../assets/flags/xa.png')).toBeDefined();
    expect(require('../../../assets/flags/xs.png')).toBeDefined();
    expect(require('../../../assets/flags/xt.png')).toBeDefined();
    expect(require('../../../assets/flags/xn.png')).toBeDefined();
    expect(require('../../../assets/flags/xl.png')).toBeDefined();
  });
});
