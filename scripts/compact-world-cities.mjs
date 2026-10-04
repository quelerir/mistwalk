// Turns the joined Natural Earth places into the compact file the app bundles (see build-world-cities.sh).
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [input, output] = process.argv.slice(2);
const root = resolve(new URL('.', import.meta.url).pathname, '..');

// Country codes the app knows (src/lib/geo/countries.ts); places elsewhere are dropped.
const known = new Set(
  [...readFileSync(resolve(root, 'src/lib/geo/countries.ts'), 'utf8').matchAll(/code: "([A-Z]{2})"/g)].map((m) => m[1])
);

const features = JSON.parse(readFileSync(input, 'utf8')).features;
const regions = {};
const cities = [];
const seen = new Set();
let dropped = 0;

for (const { properties: p } of features) {
  const country = p.ISO_A2;
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

  const region = p.adm1_code || null; // unique per area; the ISO code is not (Natural Earth has Moscow and its oblast swapped)
  if (region && !regions[region]) {
    regions[region] = { ru: p.name_ru || p.name_en || region, en: p.name_en || p.name_ru || region };
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

writeFileSync(output, JSON.stringify({ regions, cities }));
console.log(`cities ${cities.length}, regions ${Object.keys(regions).length}, dropped ${dropped}, no region ${cities.filter((c) => !c.r).length}`);
