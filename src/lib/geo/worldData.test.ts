import fs from 'fs';
import path from 'path';
import { COUNTRY_BY_CODE } from './countries';

const dir = path.join(__dirname, '../../assets');
const polygonsPath = path.join(dir, 'world.geojson');
const pointsPath = path.join(dir, 'world-points.geojson');

interface Collection {
  features: Array<{ geometry: { type: string }; properties: { code?: string } }>;
}
const polygons = JSON.parse(fs.readFileSync(polygonsPath, 'utf8')) as Collection;
const points = JSON.parse(fs.readFileSync(pointsPath, 'utf8')) as Collection;
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

  it('has polygons only in world.geojson and points only in world-points.geojson', () => {
    for (const f of polygons.features) expect(f.geometry.type).toMatch(/^(Multi)?Polygon$/);
    for (const f of points.features) expect(f.geometry.type).toBe('Point');
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

  it('has the same codes in both files', () => {
    expect([...codes(points)].sort()).toEqual([...codes(polygons)].sort());
  });

  it('stays under 2 MB', () => {
    expect(fs.statSync(polygonsPath).size).toBeLessThan(2 * 1024 * 1024);
  });
});
