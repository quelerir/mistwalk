import { computeAreaKm2, type TimedPoint } from '../stats/coverage';
import { COUNTRIES, COUNTRY_BY_CODE } from './countries';

export interface CountryRef {
  code: string;
  name: string;
}

export interface CountryStat extends CountryRef {
  exploredKm2: number;
  totalKm2: number;
  percent: number;
}

// Nominatim asks for at most one request per second and an identifying User-Agent.
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const CELL_DEGREES = 0.25;

export function cellKey(lat: number, lng: number): string {
  return `${Math.floor(lat / CELL_DEGREES)}:${Math.floor(lng / CELL_DEGREES)}`;
}

interface NominatimResponse {
  address?: { country?: string; country_code?: string };
}

// Resolves the country at a coordinate, or null over open water / unknown territory.
export async function fetchCountryAt(
  lat: number,
  lng: number,
  fetchImpl: typeof fetch = fetch
): Promise<CountryRef | null> {
  const url = `${NOMINATIM_URL}?format=jsonv2&zoom=3&lat=${lat}&lon=${lng}`;
  const response = await fetchImpl(url, { headers: { 'Accept-Language': 'ru' } });
  if (!response.ok) throw new Error(`reverse geocoding responded with ${response.status}`);
  const json = (await response.json()) as NominatimResponse;
  const code = json.address?.country_code?.toUpperCase();
  const name = json.address?.country;
  return code && name ? { code, name } : null;
}

export function groupPointsByCountry(
  points: TimedPoint[],
  cellCountries: Readonly<Record<string, CountryRef | null>>
): Map<string, { country: CountryRef; points: TimedPoint[] }> {
  const groups = new Map<string, { country: CountryRef; points: TimedPoint[] }>();
  for (const point of points) {
    const country = cellCountries[cellKey(point.lat, point.lng)];
    if (!country) continue;
    const group = groups.get(country.code) ?? { country, points: [] };
    group.points.push(point);
    groups.set(country.code, group);
  }
  return groups;
}

// Every country in the table with its explored share; visited ones first, then alphabetical.
export function buildCountryList(
  points: TimedPoint[],
  cellCountries: Readonly<Record<string, CountryRef | null>>
): CountryStat[] {
  const groups = groupPointsByCountry(points, cellCountries);
  const list = COUNTRIES.map((country) => {
    const group = groups.get(country.code);
    const exploredKm2 = group ? computeAreaKm2(group.points) : 0;
    return {
      code: country.code,
      name: country.name,
      exploredKm2,
      totalKm2: country.areaKm2,
      percent: (exploredKm2 / country.areaKm2) * 100,
    };
  });
  return list.sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name, 'ru'));
}

// Names come from our table so they are Russian and consistent with the list.
export function toCountryRef(code: string, fallbackName: string): CountryRef {
  const known = COUNTRY_BY_CODE[code];
  return { code, name: known?.name ?? fallbackName };
}

export function formatPercent(percent: number): string {
  if (percent <= 0) return '0 %';
  if (percent < 0.000001) return '< 0,000001 %';
  // Two significant digits below 1 %, so tiny shares of a big country still read as a number.
  const digits =
    percent >= 10 ? 0 : percent >= 1 ? 1 : Math.min(7, Math.ceil(-Math.log10(percent)) + 1);
  return `${percent.toFixed(digits).replace('.', ',')} %`;
}
