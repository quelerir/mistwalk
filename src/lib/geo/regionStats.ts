import { computeAreaKm2, type TimedPoint } from '../stats/coverage';
import type { Lang } from '../../i18n/language';
import type { CityStat } from './cityStats';
import { normalizeCityName, type WorldCities } from './countryRegions';
import type { CountryPlaces } from './countryStats';

// Regions of a country (oblasts, states, …) with the share of their area explored. The borders are Natural Earth's, simplified
// (see src/assets/WORLD_REGIONS.md).
export interface RegionGeometry {
  // The country the region's cities belong to.
  c: string;
  // Wikidata id, for the emblem.
  w: string | null;
  areaKm2: number;
  // Polygons, each a list of rings (the first is the outline, the rest are holes) of [lng, lat] points.
  polygons: number[][][][];
}

export interface RegionsData {
  regions: Record<string, RegionGeometry>;
}

let cached: RegionsData | null | undefined;

// The bundled borders; loaded on first use, because the file is large and only the country screens need it.
export function loadRegions(): RegionsData | null {
  if (cached !== undefined) return cached;
  try {
    cached = require('../../assets/regions.json') as RegionsData;
  } catch (err) {
    console.warn('[regions] failed to load', err);
    cached = null;
  }
  return cached;
}

interface Box {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

export interface RegionIndex {
  data: RegionsData;
  // Each polygon with the box of its outline.
  boxes: Map<string, Array<{ rings: number[][][]; box: Box }>>;
  // "<floor lat>:<floor lng>" -> codes of the regions whose polygons' boxes touch that one-degree cell.
  cells: Map<string, string[]>;
}

function boxOf(ring: number[][]): Box {
  const box = { minLng: Infinity, maxLng: -Infinity, minLat: Infinity, maxLat: -Infinity };
  for (const [lng, lat] of ring) {
    if (lng < box.minLng) box.minLng = lng;
    if (lng > box.maxLng) box.maxLng = lng;
    if (lat < box.minLat) box.minLat = lat;
    if (lat > box.maxLat) box.maxLat = lat;
  }
  return box;
}

export function buildIndex(data: RegionsData): RegionIndex {
  const boxes: RegionIndex['boxes'] = new Map();
  const cells: RegionIndex['cells'] = new Map();
  for (const [code, region] of Object.entries(data.regions)) {
    const polygons = region.polygons.map((rings) => ({ rings, box: boxOf(rings[0]) }));
    boxes.set(code, polygons);
    const seen = new Set<string>();
    for (const { box } of polygons) {
      for (let la = Math.floor(box.minLat); la <= Math.floor(box.maxLat); la++) {
        for (let lo = Math.floor(box.minLng); lo <= Math.floor(box.maxLng); lo++) {
          const key = `${la}:${lo}`;
          if (seen.has(key)) continue;
          seen.add(key);
          cells.set(key, [...(cells.get(key) ?? []), code]);
        }
      }
    }
  }
  return { data, boxes, cells };
}

// Ray casting: a point is inside a ring when a ray to the east crosses its edges an odd number of times.
function inRing(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// The borders are simplified, so a point on a coast or near a border can fall just outside every polygon; it then takes the
// nearest region of its country within this distance.
const NEAR_KM = 30;
const KM_PER_DEGREE = 111.2;

// Distance in km from a point to a ring's edges, on a flat patch around the point.
function distanceToRingKm(lat: number, lng: number, ring: number[][]): number {
  const cos = Math.cos((lat * Math.PI) / 180);
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const x1 = (ring[i][0] - lng) * cos * KM_PER_DEGREE;
    const y1 = (ring[i][1] - lat) * KM_PER_DEGREE;
    const x2 = (ring[i + 1][0] - lng) * cos * KM_PER_DEGREE;
    const y2 = (ring[i + 1][1] - lat) * KM_PER_DEGREE;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length2 = dx * dx + dy * dy;
    const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, -(x1 * dx + y1 * dy) / length2));
    const d = Math.hypot(x1 + t * dx, y1 + t * dy);
    if (d < best) best = d;
  }
  return best;
}

// The region of the country that contains the point, or null.
export function regionAtIndex(index: RegionIndex, lat: number, lng: number, countryCode: string): string | null {
  const inside = containingRegion(index, lat, lng, countryCode);
  return inside ?? nearestRegion(index, lat, lng, countryCode);
}

function nearestRegion(index: RegionIndex, lat: number, lng: number, countryCode: string): string | null {
  const la = Math.floor(lat);
  const lo = Math.floor(lng);
  const candidates = new Set<string>();
  for (let dLa = -1; dLa <= 1; dLa++) {
    for (let dLo = -1; dLo <= 1; dLo++) {
      for (const code of index.cells.get(`${la + dLa}:${lo + dLo}`) ?? []) candidates.add(code);
    }
  }
  const marginLat = NEAR_KM / KM_PER_DEGREE;
  const marginLng = marginLat / Math.max(0.05, Math.cos((lat * Math.PI) / 180));
  let best: { code: string; km: number } | null = null;
  for (const code of candidates) {
    if (index.data.regions[code].c !== countryCode) continue;
    for (const { rings, box } of index.boxes.get(code) ?? []) {
      if (lat < box.minLat - marginLat || lat > box.maxLat + marginLat) continue;
      if (lng < box.minLng - marginLng || lng > box.maxLng + marginLng) continue;
      const km = distanceToRingKm(lat, lng, rings[0]);
      if (km <= NEAR_KM && (!best || km < best.km)) best = { code, km };
    }
  }
  return best?.code ?? null;
}

function containingRegion(index: RegionIndex, lat: number, lng: number, countryCode: string): string | null {
  const candidates = index.cells.get(`${Math.floor(lat)}:${Math.floor(lng)}`);
  if (!candidates) return null;
  for (const code of candidates) {
    if (index.data.regions[code].c !== countryCode) continue;
    for (const { rings, box } of index.boxes.get(code) ?? []) {
      if (lat < box.minLat || lat > box.maxLat || lng < box.minLng || lng > box.maxLng) continue;
      if (inRing(lat, lng, rings[0]) && !rings.slice(1).some((hole) => inRing(lat, lng, hole))) return code;
    }
  }
  return null;
}

let bundledIndex: RegionIndex | null | undefined;

export function regionAt(lat: number, lng: number, countryCode: string): string | null {
  if (bundledIndex === undefined) {
    const data = loadRegions();
    bundledIndex = data ? buildIndex(data) : null;
  }
  return bundledIndex ? regionAtIndex(bundledIndex, lat, lng, countryCode) : null;
}

const indexes = new WeakMap<RegionsData, RegionIndex>();

function indexFor(regions: RegionsData): RegionIndex {
  let index = indexes.get(regions);
  if (!index) {
    index = buildIndex(regions);
    indexes.set(regions, index);
  }
  return index;
}

export interface RegionStat {
  code: string;
  name: string;
  // Wikidata id of the region, for its emblem.
  wikidata: string | null;
  exploredKm2: number;
  totalKm2: number;
  percent: number;
  // Found places, and found plus still unvisited ones, inside the region.
  found: number;
  total: number;
}

// The regions of a country that have cities in the data, with their explored share, places and Wikidata id; visited ones first,
// then alphabetical in the language given. `points` are the person's points inside the country.
export function buildRegionStats(
  countryCode: string,
  points: TimedPoint[],
  places: CountryPlaces | undefined,
  data: WorldCities,
  regions: RegionsData,
  lang: Lang
): RegionStat[] {
  const index = indexFor(regions);
  const codes = new Set(
    data.cities.filter((c) => c.c === countryCode && c.r !== null).map((c) => c.r as string)
  );

  const pointsBy = new Map<string, TimedPoint[]>();
  for (const point of points) {
    const code = regionAtIndex(index, point.lat, point.lng, countryCode);
    if (code) pointsBy.set(code, [...(pointsBy.get(code) ?? []), point]);
  }
  const found = new Map<string, number>();
  const known = new Map<string, number>();
  const count = (map: Map<string, number>, lat: number, lng: number) => {
    const code = regionAtIndex(index, lat, lng, countryCode);
    if (code) map.set(code, (map.get(code) ?? 0) + 1);
  };
  for (const place of places?.discovered ?? []) {
    count(found, place.lat, place.lng);
    count(known, place.lat, place.lng);
  }
  for (const poi of places?.hidden ?? []) count(known, poi.lat, poi.lng);

  const stats = [...codes].map((code): RegionStat => {
    const totalKm2 = regions.regions[code]?.areaKm2 ?? 0;
    const exploredKm2 = computeAreaKm2(pointsBy.get(code) ?? []);
    return {
      code,
      name: data.regions[code]?.[lang] ?? code,
      wikidata: regions.regions[code]?.w ?? null,
      exploredKm2,
      totalKm2,
      percent: totalKm2 > 0 ? (exploredKm2 / totalKm2) * 100 : 0,
      found: found.get(code) ?? 0,
      total: known.get(code) ?? 0,
    };
  });
  return stats.sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name, lang));
}

// The places (found and unvisited) that lie inside the region.
export function placesOfRegion(
  regionCode: string,
  countryCode: string,
  places: CountryPlaces | undefined,
  regions: RegionsData
): CountryPlaces | undefined {
  if (!places) return undefined;
  const index = indexFor(regions);
  const inside = (p: { lat: number; lng: number }) => regionAtIndex(index, p.lat, p.lng, countryCode) === regionCode;
  return { discovered: places.discovered.filter(inside), hidden: places.hidden.filter(inside) };
}

// The visited cities that belong to the region: by Wikidata id, else by a name that only one city of the country has.
export function citiesOfRegion(
  regionCode: string,
  countryCode: string,
  cities: CityStat[],
  data: WorldCities
): CityStat[] {
  const ofCountry = data.cities.filter((c) => c.c === countryCode);
  const nameCount = new Map<string, number>();
  const nameRegion = new Map<string, string | null>();
  for (const c of ofCountry) {
    for (const name of new Set([normalizeCityName(c.ru), normalizeCityName(c.en)])) {
      nameCount.set(name, (nameCount.get(name) ?? 0) + 1);
      nameRegion.set(name, c.r);
    }
  }
  const wikidata = new Set(ofCountry.filter((c) => c.r === regionCode && c.w).map((c) => c.w as string));
  return cities.filter((v) => {
    if (v.country !== null && v.country !== countryCode) return false;
    if (v.wikidata && wikidata.has(v.wikidata)) return true;
    const name = normalizeCityName(v.name);
    return nameCount.get(name) === 1 && nameRegion.get(name) === regionCode;
  });
}
