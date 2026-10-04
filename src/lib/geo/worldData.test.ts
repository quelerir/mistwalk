import { COUNTRY_BY_CODE } from './countries';

interface Collection {
  features: Array<{ geometry: { type: string }; properties: { code?: string } }>;
}
const polygons: Collection = require('../../assets/world.json');
const codes = (c: Collection) => c.features.map((f) => f.properties.code);

// Territories Natural Earth draws but our country table does not have: they stay grey and cannot be tapped.
// (The reverse gap: Gibraltar, GI, is in the table but too small to exist in the 1:50m data.)
const IGNORED_CODES = new Set<string>([
  'GS', 'IO', 'SH', 'PN', 'AI', 'FK', 'MS', 'JE', 'GG', 'NU', 'CK', 'EH', 'PM', 'WF', 'BL', 'TF', 'AX', 'HM', 'NF', 'AQ',
]);

describe('world border data', () => {
  it('gives every feature a two-letter uppercase code', () => {
    for (const code of codes(polygons)) expect(code).toMatch(/^[A-Z]{2}$/);
  });

  it('has polygons only', () => {
    for (const f of polygons.features) expect(f.geometry.type).toMatch(/^(Multi)?Polygon$/);
  });

  it('has each country once (merged), and the hard cases are present', () => {
    const list = codes(polygons);
    expect(new Set(list).size).toBe(list.length);
    for (const code of ['FR', 'NO', 'XK', 'TW', 'RU', 'US']) expect(list).toContain(code);
  });

  it('knows every code or lists it as ignored', () => {
    for (const code of codes(polygons)) {
      if (!COUNTRY_BY_CODE[code!]) expect(IGNORED_CODES.has(code!)).toBe(true);
    }
  });

  it('stays under 2 MB', () => {
    expect(JSON.stringify(polygons).length).toBeLessThan(2 * 1024 * 1024);
  });
});
