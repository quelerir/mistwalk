import type { Poi, PoiKind } from './types';
import type { TileBounds } from './tiles';

export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export function buildOverpassQuery(b: TileBounds): string {
  const bbox = `${b.south},${b.west},${b.north},${b.east}`;
  return (
    '[out:json][timeout:25];(' +
    `nwr["tourism"~"^(viewpoint|attraction|artwork)$"]["name"](${bbox});` +
    `nwr["historic"~"^(monument|memorial|castle|ruins|archaeological_site)$"]["name"](${bbox});` +
    ');out center;'
  );
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function kindFromTags(tags: Record<string, string>): PoiKind | null {
  if (tags.tourism === 'viewpoint') return 'viewpoint';
  if (tags.tourism === 'attraction') return 'attraction';
  if (tags.tourism === 'artwork') return 'artwork';
  if (tags.historic === 'castle') return 'castle';
  if (tags.historic === 'ruins' || tags.historic === 'archaeological_site') return 'ruins';
  if (tags.historic === 'monument' || tags.historic === 'memorial') return 'monument';
  return null;
}

export function parseOverpassResponse(json: { elements?: OverpassElement[] }): Poi[] {
  const result: Poi[] = [];
  for (const el of json.elements ?? []) {
    const tags = el.tags;
    const name = tags?.['name:ru'] ?? tags?.name;
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (!tags || !name || lat === undefined || lng === undefined) continue;
    const kind = kindFromTags(tags);
    if (!kind) continue;
    result.push({ id: `${el.type}/${el.id}`, name, kind, lat, lng });
  }
  return result;
}
