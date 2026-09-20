import type { Poi, PoiKind } from './types';
import type { TileBounds } from './tiles';

export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Named places worth a walk. Parks, temples and lesser historic buildings must also have a wikidata entry, otherwise
// a big city would fill the map with every churchyard and lawn.
export function buildOverpassQuery(b: TileBounds): string {
  const bbox = `${b.south},${b.west},${b.north},${b.east}`;
  return (
    '[out:json][timeout:25];(' +
    `nwr["tourism"~"^(viewpoint|attraction|artwork|museum|gallery|zoo|theme_park|aquarium)$"]["name"](${bbox});` +
    `nwr["historic"~"^(monument|memorial|castle|fort|ruins|archaeological_site)$"]["name"](${bbox});` +
    `nwr["historic"~"^(manor|city_gate|tower|tomb|building)$"]["name"]["wikidata"](${bbox});` +
    `nwr["natural"~"^(waterfall|peak|cave_entrance|beach)$"]["name"](${bbox});` +
    `nwr["man_made"="lighthouse"]["name"](${bbox});` +
    `nwr["leisure"="park"]["name"]["wikidata"](${bbox});` +
    `nwr["amenity"="place_of_worship"]["name"]["wikidata"](${bbox});` +
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

export function kindFromTags(tags: Record<string, string>): PoiKind | null {
  switch (tags.tourism) {
    case 'viewpoint':
      return 'viewpoint';
    case 'attraction':
    case 'zoo':
    case 'theme_park':
    case 'aquarium':
      return 'attraction';
    case 'artwork':
      return 'artwork';
    case 'museum':
    case 'gallery':
      return 'museum';
  }
  switch (tags.historic) {
    case 'castle':
    case 'fort':
      return 'castle';
    case 'ruins':
    case 'archaeological_site':
      return 'ruins';
    case 'monument':
    case 'memorial':
      return 'monument';
    case 'manor':
    case 'city_gate':
    case 'tower':
    case 'tomb':
    case 'building':
      return 'attraction';
  }
  if (tags.natural === 'beach') return 'beach';
  if (tags.natural === 'waterfall' || tags.natural === 'peak' || tags.natural === 'cave_entrance') return 'nature';
  if (tags.man_made === 'lighthouse') return 'attraction';
  if (tags.leisure === 'park') return 'park';
  if (tags.amenity === 'place_of_worship') return 'worship';
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
    const poi: Poi = { id: `${el.type}/${el.id}`, name, kind, lat, lng };
    if (tags.wikipedia) poi.wikipedia = tags.wikipedia;
    if (tags.wikidata) poi.wikidata = tags.wikidata;
    result.push(poi);
  }
  return result;
}
