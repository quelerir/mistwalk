// Two steps of scripts/build-regions.sh.
//   prepare <admin1.geojson> <world-cities.json> <dir>: picks the regions the app lists, computes their areas from the
//     original borders and writes <dir>/regions-in.geojson (geometry + key only) and <dir>/regions-meta.json.
//   finish <simplified.geojson> <meta.json> <out.json>: writes src/assets/regions.json.
import { readFileSync, writeFileSync } from 'node:fs';

const [step, ...args] = process.argv.slice(2);

const R = 6371.0088; // km
const rad = (d) => (d * Math.PI) / 180;

// Area of a ring of [lng, lat] on the sphere (the trapezoid formula of spherical polygons), km2.
function ringAreaKm2(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[i + 1];
    sum += rad(lng2 - lng1) * (2 + Math.sin(rad(lat1)) + Math.sin(rad(lat2)));
  }
  return Math.abs((sum * R * R) / 2);
}

function geometryAreaKm2(geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  let total = 0;
  for (const rings of polygons) {
    total += ringAreaKm2(rings[0]);
    for (const hole of rings.slice(1)) total -= ringAreaKm2(hole);
  }
  return total;
}

if (step === 'prepare') {
  const [admin1Path, citiesPath, dir] = args;
  const data = JSON.parse(readFileSync(citiesPath, 'utf8'));
  // The countries that get a regions list: more than 10 cities in more than one region (see buildCountryCities).
  const byCountry = new Map();
  for (const c of data.cities) byCountry.set(c.c, [...(byCountry.get(c.c) ?? []), c]);
  const regionsMode = new Set(
    [...byCountry]
      .filter(([, list]) => list.length > 10 && new Set(list.map((c) => c.r).filter(Boolean)).size > 1)
      .map(([code]) => code)
  );
  const countryOf = new Map();
  for (const c of data.cities) if (c.r && regionsMode.has(c.c)) countryOf.set(c.r, c.c);

  const features = [];
  const meta = {};
  for (const f of JSON.parse(readFileSync(admin1Path, 'utf8')).features) {
    const key = f.properties.adm1_code;
    if (!countryOf.has(key) || meta[key]) continue;
    meta[key] = {
      c: countryOf.get(key),
      w: f.properties.wikidataid || null,
      areaKm2: Math.round(geometryAreaKm2(f.geometry)),
    };
    features.push({ type: 'Feature', properties: { k: key }, geometry: f.geometry });
  }
  writeFileSync(`${dir}/regions-in.geojson`, JSON.stringify({ type: 'FeatureCollection', features }));
  writeFileSync(`${dir}/regions-meta.json`, JSON.stringify(meta));
  console.log(`regions ${features.length} of ${countryOf.size} used, countries ${regionsMode.size}`);
} else if (step === 'finish') {
  const [simplifiedPath, metaPath, outPath] = args;
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  const regions = {};
  for (const f of JSON.parse(readFileSync(simplifiedPath, 'utf8')).features) {
    const key = f.properties.k;
    const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    regions[key] = { ...meta[key], polygons };
  }
  writeFileSync(outPath, JSON.stringify({ regions }));
  console.log(`wrote ${Object.keys(regions).length} regions`);
} else {
  console.error('usage: compact-regions.mjs prepare|finish ...');
  process.exit(1);
}
