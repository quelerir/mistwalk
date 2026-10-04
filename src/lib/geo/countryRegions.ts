import type { CityStat } from './cityStats';
import type { Lang } from '../../i18n/language';
import { decimal } from '../../i18n/format';

export interface WorldCity {
  ru: string;
  en: string;
  // Wikidata id of the settlement, or null.
  w: string | null;
  // ISO country code.
  c: string;
  // Region key (Natural Earth adm1_code), or null when the place is in no region.
  r: string | null;
  p: number;
  la: number;
  lo: number;
}

export interface WorldCities {
  regions: Record<string, { ru: string; en: string }>;
  cities: WorldCity[];
}

export interface CityEntry {
  key: string;
  name: string;
  population: number;
  visited: boolean;
}

export interface RegionEntry {
  code: string | null;
  name: string;
  cities: CityEntry[];
  visitedCount: number;
}

export type CountryCities = { mode: 'regions'; regions: RegionEntry[] } | { mode: 'flat'; unvisited: CityEntry[] };

// A country is split into regions only when it has enough cities for that to help.
const REGIONS_MIN_CITIES = 10;

let cached: WorldCities | null | undefined;

// The bundled list of cities; loaded on first use, because it is large and only the country screen needs it.
export function loadWorldCities(): WorldCities | null {
  if (cached !== undefined) return cached;
  try {
    cached = require('../../assets/world-cities.json') as WorldCities;
  } catch (err) {
    console.warn('[world-cities] failed to load', err);
    cached = null;
  }
  return cached;
}

export function normalizeCityName(name: string): string {
  return name
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function buildCountryCities(
  countryCode: string,
  visited: CityStat[],
  data: WorldCities,
  lang: Lang
): CountryCities {
  const mine = visited.filter((v) => v.country === null || v.country === countryCode);
  const visitedWikidata = new Set(mine.map((v) => v.wikidata).filter((w): w is string => !!w));
  const visitedNames = new Set(mine.map((v) => normalizeCityName(v.name)));

  const cities = data.cities.filter((c) => c.c === countryCode);
  const entries = cities.map((c) => ({
    region: c.r,
    entry: {
      key: `${c.c}:${c.en}`,
      name: lang === 'ru' ? c.ru : c.en,
      population: c.p,
      visited:
        (c.w !== null && visitedWikidata.has(c.w)) ||
        visitedNames.has(normalizeCityName(c.ru)) ||
        visitedNames.has(normalizeCityName(c.en)),
    } as CityEntry,
  }));
  const byPopulation = (a: CityEntry, b: CityEntry) => b.population - a.population;

  const distinctRegions = new Set(cities.map((c) => c.r).filter((r): r is string => r !== null));
  if (cities.length <= REGIONS_MIN_CITIES || distinctRegions.size < 2) {
    return { mode: 'flat', unvisited: entries.filter((e) => !e.entry.visited).map((e) => e.entry).sort(byPopulation) };
  }

  const groups = new Map<string | null, CityEntry[]>();
  for (const { region, entry } of entries) {
    const list = groups.get(region) ?? [];
    list.push(entry);
    groups.set(region, list);
  }
  const regions: RegionEntry[] = [...groups.entries()].map(([code, list]) => ({
    code,
    name: code === null ? (lang === 'ru' ? 'Другое' : 'Other') : data.regions[code]?.[lang] ?? code,
    cities: list.sort(byPopulation),
    visitedCount: list.filter((c) => c.visited).length,
  }));
  regions.sort((a, b) => {
    if ((a.code === null) !== (b.code === null)) return a.code === null ? 1 : -1;
    if ((a.visitedCount > 0) !== (b.visitedCount > 0)) return a.visitedCount > 0 ? -1 : 1;
    return a.name.localeCompare(b.name, lang);
  });
  return { mode: 'regions', regions };
}

// "1,2 млн", "143 тыс.", "950": short enough for the right edge of a row.
export function formatPopulation(lang: Lang, population: number): string {
  if (population >= 1_000_000) {
    const millions = decimal(lang, (population / 1_000_000).toFixed(1));
    return lang === 'ru' ? `${millions} млн` : `${millions}M`;
  }
  if (population >= 1000) {
    const thousands = Math.round(population / 1000);
    return lang === 'ru' ? `${thousands} тыс.` : `${thousands}k`;
  }
  return String(population);
}
