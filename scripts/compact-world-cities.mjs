// Turns the joined Natural Earth places into the compact file the app bundles (see build-world-cities.sh).
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [input, output] = process.argv.slice(2);
const root = resolve(new URL('.', import.meta.url).pathname, '..');

const norm = (s) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// Country codes the app knows (src/lib/geo/countries.ts); places elsewhere are dropped.
const known = new Set(
  [...readFileSync(resolve(root, 'src/lib/geo/countries.ts'), 'utf8').matchAll(/code: "([A-Z]{2})"/g)].map((m) => m[1])
);

// Republic borders (src/assets/republics.json): a place inside one belongs to the republic, not to the country around it.
const republics = JSON.parse(readFileSync(resolve(root, 'src/assets/republics.json'), 'utf8')).republics;
for (const r of republics) known.add(r.code);

function inRing(lat, lng, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function republicAt(lat, lng) {
  for (const r of republics) {
    for (const rings of r.polygons) {
      if (inRing(lat, lng, rings[0]) && !rings.slice(1).some((h) => inRing(lat, lng, h))) return r.code;
    }
  }
  return null;
}
// Natural Earth gives these two no ISO code; its own country label puts a place on the coast, just outside the coarse
// border, in the right republic anyway.
const BY_ADM0 = { CYN: 'XN', SOL: 'XL' };

const features = JSON.parse(readFileSync(input, 'utf8')).features;
const regionNames = {};
let cities = [];
const seen = new Set();
let dropped = 0;

for (const { properties: p } of features) {
  const country = republicAt(p.LATITUDE, p.LONGITUDE) ?? BY_ADM0[p.ADM0_A3] ?? p.ISO_A2;
  if (!country || country === '-99' || !known.has(country)) {
    dropped += 1;
    continue;
  }
  const wikidata = p.WIKIDATAID || null;
  // The same settlement can appear twice (e.g. a capital and an admin-1 capital): keep the first.
  if (wikidata && seen.has(`${country}:${wikidata}`)) {
    dropped += 1;
    continue;
  }
  if (wikidata) seen.add(`${country}:${wikidata}`);

  // adm1_code is unique per area; the ISO code is not (Natural Earth has Moscow and its oblast swapped).
  const region = p.adm1_code || null;
  if (region && !regionNames[region]) {
    regionNames[region] = { ru: p.name_ru || p.name_en || region, en: p.name_en || p.name_ru || region };
  }
  cities.push({
    ru: p.NAME_RU || p.NAME,
    en: p.NAME_EN || p.NAME,
    w: wikidata,
    c: country,
    r: region,
    p: Math.max(0, Math.round(p.POP_MAX || 0)),
    la: Math.round(p.LATITUDE * 100) / 100,
    lo: Math.round(p.LONGITUDE * 100) / 100,
  });
}

// Natural Earth has a few mislabelled rows with no Wikidata id that copy a real city of the same country (a second
// "Натал" in Amazonas): drop the unlabelled one when a labelled city of that name exists in the country.
const labelled = new Set(cities.filter((c) => c.w).map((c) => `${c.c}:${norm(c.ru)}`));
const before = cities.length;
cities = cities.filter((c) => c.w || !labelled.has(`${c.c}:${norm(c.ru)}`));
const phantoms = before - cities.length;

// A region lies in one country: a place across the border (Natural Earth puts Mukusso in Angola inside a Namibian
// area) loses its region instead of dragging a foreign region into the list.
const perRegion = new Map();
for (const c of cities) {
  if (!c.r) continue;
  const counts = perRegion.get(c.r) ?? new Map();
  counts.set(c.c, (counts.get(c.c) ?? 0) + 1);
  perRegion.set(c.r, counts);
}
const home = new Map([...perRegion].map(([r, counts]) => [r, [...counts].sort((a, b) => b[1] - a[1])[0][0]]));
let crossBorder = 0;
for (const c of cities) {
  if (c.r && home.get(c.r) !== c.c) {
    c.r = null;
    crossBorder += 1;
  }
}

// Two regions of one country can end up with the same name (Natural Earth labels Altai Krai "Республика Алтай", and
// the state and the district of Washington are both "Вашингтон"): the name of the biggest city tells them apart.
const used = [...new Set(cities.map((c) => c.r).filter(Boolean))];
const regions = {};
for (const code of used) regions[code] = { ...regionNames[code] };
for (const lang of ['ru', 'en']) {
  const byName = new Map();
  for (const code of used) {
    const key = `${home.get(code)}:${regions[code][lang]}`;
    byName.set(key, [...(byName.get(key) ?? []), code]);
  }
  for (const codes of byName.values()) {
    if (codes.length < 2) continue;
    for (const code of codes) {
      const top = cities.filter((c) => c.r === code).sort((a, b) => b.p - a.p)[0];
      // A region named after its own biggest city (the city of Moscow, the district of Washington) stays as it is.
      if (norm(top[lang]) === norm(regions[code][lang])) continue;
      regions[code][lang] = `${regions[code][lang]} (${top[lang]})`;
    }
  }
}

writeFileSync(output, JSON.stringify({ regions, cities }));
console.log(
  `cities ${cities.length}, regions ${used.length}, dropped ${dropped}, phantoms ${phantoms}, cross-border ${crossBorder}, no region ${cities.filter((c) => !c.r).length}`
);
