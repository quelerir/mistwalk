// Turns the Natural Earth republic borders (already low resolution, so not simplified further) into src/assets/republics.json (see build-republics.sh).
import { readFileSync, writeFileSync } from 'node:fs';

const [input, output] = process.argv.slice(2);

// Codes XA..XL are ISO 3166 user-assigned codes, not real country codes. `host` is the country each lies in, by the
// Natural Earth data.
const TABLE = {
  B35: { code: 'XA', ru: 'Абхазия', en: 'Abkhazia', host: 'GE', w: 'Q23334' },
  B37: { code: 'XS', ru: 'Южная Осетия', en: 'South Ossetia', host: 'GE', w: 'Q23427' },
  B36: { code: 'XT', ru: 'Приднестровье', en: 'Transnistria', host: 'MD', w: 'Q907112' },
  B20: { code: 'XN', ru: 'Северный Кипр', en: 'Northern Cyprus', host: 'CY', w: 'Q23681' },
  B30: { code: 'XL', ru: 'Сомалиленд', en: 'Somaliland', host: 'SO', w: 'Q34754' },
};

// Same local flat-earth formula as geometryAreaKm2 in src/lib/geo/cityStats.ts (rings[0] minus the holes).
function ringAreaKm2(ring) {
  const cosLat = Math.cos((ring[0][1] * Math.PI) / 180);
  let twice = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const x1 = ring[i][0] * 111.32 * cosLat;
    const y1 = ring[i][1] * 110.57;
    const x2 = ring[i + 1][0] * 111.32 * cosLat;
    const y2 = ring[i + 1][1] * 110.57;
    twice += x1 * y2 - x2 * y1;
  }
  return Math.abs(twice / 2);
}

const features = JSON.parse(readFileSync(input, 'utf8')).features;
const republics = [];
for (const f of features) {
  const meta = TABLE[f.properties.BRK_A3];
  if (!meta) continue;
  const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  let areaKm2 = 0;
  for (const rings of polygons) {
    areaKm2 += ringAreaKm2(rings[0]);
    for (const hole of rings.slice(1)) areaKm2 -= ringAreaKm2(hole);
  }
  republics.push({ ...meta, areaKm2: Math.round(areaKm2), polygons });
}
republics.sort((a, b) => a.code.localeCompare(b.code));

writeFileSync(output, JSON.stringify({ republics }));
console.log(republics.map((r) => `${r.code} ${r.en} ${r.areaKm2} km2, ${r.polygons.length} polygon(s)`).join('\n'));
