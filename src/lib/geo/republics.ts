// Five self-declared republics with their own rows in the country list. Codes XA..XL are ISO 3166 user-assigned codes.
// Borders and names come from Natural Earth (see src/assets/WORLD_REPUBLICS.md).
export interface Republic {
  code: string;
  ru: string;
  en: string;
  // The country the republic lies in by the data; its area is taken off that country's total.
  host: string;
  w: string;
  areaKm2: number;
  // Polygons, each a list of rings (the first is the outline, the rest are holes) of [lng, lat] points.
  polygons: number[][][][];
}

export const REPUBLICS: Republic[] = (require('../../assets/republics.json') as { republics: Republic[] }).republics;

export const REPUBLIC_BY_CODE: Readonly<Record<string, Republic>> = Object.fromEntries(REPUBLICS.map((r) => [r.code, r]));

export function republicName(code: string, lang: string): string {
  const republic = REPUBLIC_BY_CODE[code];
  if (!republic) return code;
  return lang === 'en' ? republic.en : republic.ru;
}

interface Box {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
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

// Each polygon with the box of its outline, so a far-away point is rejected before any ray casting.
const INDEX = REPUBLICS.map((republic) => ({
  code: republic.code,
  polygons: republic.polygons.map((rings) => ({ rings, box: boxOf(rings[0]) })),
}));

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

// The code of the republic that contains the point, or null.
export function republicAt(lat: number, lng: number): string | null {
  for (const { code, polygons } of INDEX) {
    for (const { rings, box } of polygons) {
      if (lat < box.minLat || lat > box.maxLat || lng < box.minLng || lng > box.maxLng) continue;
      // Inside the outline and in none of the holes.
      if (inRing(lat, lng, rings[0]) && !rings.slice(1).some((hole) => inRing(lat, lng, hole))) return code;
    }
  }
  return null;
}

// A republic first, else the country of the geocoder cell, else null. The cell lookup is a parameter so that this module
// does not depend on the statistics code.
export function countryCodeAt(
  lat: number,
  lng: number,
  cellCountry: (lat: number, lng: number) => string | null | undefined
): string | null {
  return republicAt(lat, lng) ?? cellCountry(lat, lng) ?? null;
}

// The area to take off a country's total: the republics that lie in it.
export function hostAreaAdjustment(countryCode: string): number {
  return REPUBLICS.filter((r) => r.host === countryCode).reduce((sum, r) => sum + r.areaKm2, 0);
}
