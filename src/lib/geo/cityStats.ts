import { computeAreaKm2, type TimedPoint } from '../stats/coverage';
import type { DiscoveredPlace } from '../poi/types';

export interface CityRef {
  name: string;
  // Boundary area; null when the geocoder only knew a point.
  areaKm2: number | null;
}

export interface CityStat {
  name: string;
  country: string | null;
  exploredKm2: number;
  totalKm2: number | null;
  percent: number | null;
  found: number;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const CITY_CELL_DEGREES = 0.05;

export function cityCellKey(lat: number, lng: number): string {
  return `${Math.floor(lat / CITY_CELL_DEGREES)}:${Math.floor(lng / CITY_CELL_DEGREES)}`;
}

type Ring = Array<[number, number]>;
type Geometry =
  | { type: 'Polygon'; coordinates: Ring[] }
  | { type: 'MultiPolygon'; coordinates: Ring[][] }
  | { type: string; coordinates?: unknown };

// Local flat-earth projection: accurate to a few percent for city-sized shapes.
function ringAreaKm2(ring: Ring, cosLat: number): number {
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

export function geometryAreaKm2(geometry: Geometry | undefined): number | null {
  if (!geometry) return null;
  let polygons: Ring[][];
  if (geometry.type === 'Polygon') polygons = [(geometry as { coordinates: Ring[] }).coordinates];
  else if (geometry.type === 'MultiPolygon') polygons = (geometry as { coordinates: Ring[][] }).coordinates;
  else return null;

  let total = 0;
  for (const rings of polygons) {
    if (rings.length === 0 || rings[0].length < 4) continue;
    const meanLat = rings[0].reduce((sum, p) => sum + p[1], 0) / rings[0].length;
    const cosLat = Math.cos((meanLat * Math.PI) / 180);
    rings.forEach((ring, i) => {
      const area = ringAreaKm2(ring, cosLat);
      total += i === 0 ? area : -area; // the first ring is the outline, the rest are holes
    });
  }
  return total > 0 ? total : null;
}

interface NominatimCity {
  name?: string;
  geojson?: Geometry;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
  };
}

// Settlement name and boundary area at a coordinate, or null in open countryside.
export async function fetchCityAt(
  lat: number,
  lng: number,
  fetchImpl: typeof fetch = fetch
): Promise<CityRef | null> {
  const url = `${NOMINATIM_URL}?format=jsonv2&zoom=10&addressdetails=1&polygon_geojson=1&polygon_threshold=0.0005&lat=${lat}&lon=${lng}`;
  const response = await fetchImpl(url, { headers: { 'Accept-Language': 'ru' } });
  if (!response.ok) throw new Error(`reverse geocoding responded with ${response.status}`);
  const json = (await response.json()) as NominatimCity;
  const a = json.address;
  const name = a?.city ?? a?.town ?? a?.village ?? a?.municipality ?? a?.county ?? json.name;
  return name ? { name, areaKm2: geometryAreaKm2(json.geojson) } : null;
}

// Explored area and found places per city; biggest explored area first.
export function buildCityList(
  points: TimedPoint[],
  found: DiscoveredPlace[],
  cityCells: Readonly<Record<string, CityRef | null>>,
  countryAt?: (lat: number, lng: number) => string | null
): CityStat[] {
  const byCity = new Map<
    string,
    { points: TimedPoint[]; found: number; areaKm2: number | null; country: string | null }
  >();
  const entry = (city: CityRef, lat: number, lng: number) => {
    const existing = byCity.get(city.name) ?? { points: [], found: 0, areaKm2: null, country: null };
    existing.country = existing.country ?? countryAt?.(lat, lng) ?? null;
    existing.areaKm2 = existing.areaKm2 ?? city.areaKm2;
    byCity.set(city.name, existing);
    return existing;
  };
  for (const point of points) {
    const city = cityCells[cityCellKey(point.lat, point.lng)];
    if (city) entry(city, point.lat, point.lng).points.push(point);
  }
  for (const place of found) {
    const city = cityCells[cityCellKey(place.lat, place.lng)];
    if (city) entry(city, place.lat, place.lng).found += 1;
  }
  return [...byCity.entries()]
    .map(([name, group]) => {
      const exploredKm2 = computeAreaKm2(group.points);
      return {
        name,
        country: group.country,
        exploredKm2,
        totalKm2: group.areaKm2,
        percent: group.areaKm2 ? (exploredKm2 / group.areaKm2) * 100 : null,
        found: group.found,
      };
    })
    .sort(
      (a, b) =>
        (b.percent ?? -1) - (a.percent ?? -1) ||
        b.exploredKm2 - a.exploredKm2 ||
        a.name.localeCompare(b.name, 'ru')
    );
}

export function formatKm2(km2: number): string {
  if (km2 < 0.01) return '< 0,01 км²';
  const text = km2 < 1 ? km2.toFixed(2) : km2 < 100 ? km2.toFixed(1) : km2.toFixed(0);
  return `${text.replace('.', ',')} км²`;
}
