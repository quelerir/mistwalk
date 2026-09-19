import { computeAreaKm2, type TimedPoint } from '../stats/coverage';
import type { DiscoveredPlace } from '../poi/types';

export interface CityStat {
  name: string;
  exploredKm2: number;
  found: number;
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const CITY_CELL_DEGREES = 0.05;

export function cityCellKey(lat: number, lng: number): string {
  return `${Math.floor(lat / CITY_CELL_DEGREES)}:${Math.floor(lng / CITY_CELL_DEGREES)}`;
}

interface NominatimCity {
  name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
  };
}

// Settlement name at a coordinate, or null in open countryside.
export async function fetchCityAt(
  lat: number,
  lng: number,
  fetchImpl: typeof fetch = fetch
): Promise<string | null> {
  const url = `${NOMINATIM_URL}?format=jsonv2&zoom=10&addressdetails=1&lat=${lat}&lon=${lng}`;
  const response = await fetchImpl(url, { headers: { 'Accept-Language': 'ru' } });
  if (!response.ok) throw new Error(`reverse geocoding responded with ${response.status}`);
  const json = (await response.json()) as NominatimCity;
  const a = json.address;
  return a?.city ?? a?.town ?? a?.village ?? a?.municipality ?? a?.county ?? json.name ?? null;
}

// Explored area and found places per city; biggest explored area first.
export function buildCityList(
  points: TimedPoint[],
  found: DiscoveredPlace[],
  cityCells: Readonly<Record<string, string | null>>
): CityStat[] {
  const byCity = new Map<string, { points: TimedPoint[]; found: number }>();
  const entry = (name: string) => {
    const existing = byCity.get(name) ?? { points: [], found: 0 };
    byCity.set(name, existing);
    return existing;
  };
  for (const point of points) {
    const name = cityCells[cityCellKey(point.lat, point.lng)];
    if (name) entry(name).points.push(point);
  }
  for (const place of found) {
    const name = cityCells[cityCellKey(place.lat, place.lng)];
    if (name) entry(name).found += 1;
  }
  return [...byCity.entries()]
    .map(([name, group]) => ({
      name,
      exploredKm2: computeAreaKm2(group.points),
      found: group.found,
    }))
    .sort((a, b) => b.exploredKm2 - a.exploredKm2 || a.name.localeCompare(b.name, 'ru'));
}

export function formatKm2(km2: number): string {
  if (km2 < 0.01) return '< 0,01 км²';
  const text = km2 < 1 ? km2.toFixed(2) : km2 < 100 ? km2.toFixed(1) : km2.toFixed(0);
  return `${text.replace('.', ',')} км²`;
}
