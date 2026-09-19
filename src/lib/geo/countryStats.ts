import { computeAreaKm2, type TimedPoint } from '../stats/coverage';

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
const WORLD_BANK_URL = 'https://api.worldbank.org/v2/country';
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

// Total surface area (land plus inland water) in km² from the World Bank, or null if unknown.
export async function fetchCountryAreaKm2(
  code: string,
  fetchImpl: typeof fetch = fetch
): Promise<number | null> {
  const url = `${WORLD_BANK_URL}/${code}/indicator/AG.SRF.TOTL.K2?format=json&mrv=1`;
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`area lookup responded with ${response.status}`);
  const json = (await response.json()) as [unknown, Array<{ value: number | null }>?];
  const value = json[1]?.[0]?.value;
  return typeof value === 'number' && value > 0 ? value : null;
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

export function buildCountryStats(
  points: TimedPoint[],
  cellCountries: Readonly<Record<string, CountryRef | null>>,
  areasKm2: Readonly<Record<string, number>>
): CountryStat[] {
  const stats: CountryStat[] = [];
  for (const { country, points: countryPoints } of groupPointsByCountry(points, cellCountries).values()) {
    const totalKm2 = areasKm2[country.code];
    if (!totalKm2) continue;
    const exploredKm2 = computeAreaKm2(countryPoints);
    stats.push({ ...country, exploredKm2, totalKm2, percent: (exploredKm2 / totalKm2) * 100 });
  }
  return stats.sort((a, b) => b.percent - a.percent);
}

export function formatPercent(percent: number): string {
  if (percent <= 0) return '0 %';
  if (percent < 0.000001) return '< 0,000001 %';
  // Two significant digits below 1 %, so tiny shares of a big country still read as a number.
  const digits =
    percent >= 10 ? 0 : percent >= 1 ? 1 : Math.min(7, Math.ceil(-Math.log10(percent)) + 1);
  return `${percent.toFixed(digits).replace('.', ',')} %`;
}
