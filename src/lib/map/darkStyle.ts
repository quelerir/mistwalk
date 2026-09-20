// The dark map style of OpenFreeMap is almost black and pure grey: buildings rgb(10,10,10), roads #181818, labels dim
// grey. Seen through the hole in the fog it is hard to read. This lifts it to a charcoal with a blue tint: land, water,
// parks, buildings, roads and labels get their own readable shade, and everything else in the style stays as it is.

type Paint = Record<string, unknown>;

interface StyleLayer {
  id: string;
  type: string;
  paint?: Paint;
  [key: string]: unknown;
}

export interface MapStyleJson {
  layers: StyleLayer[];
  [key: string]: unknown;
}

const LAND = '#1b2129';
const WATER = '#173042';
const PARK = '#1f2f2a';
const ROAD_CASING = 'rgba(96,106,118,0.8)';
const LABEL = '#bfc6d0';
const LABEL_HALO = 'rgba(27,33,41,0.85)';

// The new colour of each layer's paint properties. A colour inside an expression (the motorway line changes with the
// zoom) is swapped by the map {old: new}.
const RECOLOR: Record<string, Paint | { 'line-color': Record<string, string> }> = {
  background: { 'background-color': LAND },
  water: { 'fill-color': WATER },
  waterway: { 'line-color': '#1d3d52' },
  landcover_ice_shelf: { 'fill-color': LAND },
  landcover_glacier: { 'fill-color': '#222a33' },
  landuse_residential: { 'fill-color': '#1e252e' },
  landcover_wood: { 'fill-color': PARK },
  landuse_park: { 'fill-color': PARK },
  building: { 'fill-color': '#2b323c', 'fill-outline-color': '#39414d' },
  'aeroway-taxiway': { 'line-color': '#2e3641' },
  'aeroway-runway-casing': { 'line-color': 'rgba(110,120,132,0.8)' },
  'aeroway-area': { 'fill-color': '#242b34' },
  'aeroway-runway': { 'line-color': '#3a434f' },
  road_area_pier: { 'fill-color': LAND },
  road_pier: { 'line-color': LAND },
  highway_path: { 'line-color': '#3a4350' },
  highway_minor: { 'line-color': '#38414d' },
  highway_major_casing: { 'line-color': ROAD_CASING },
  highway_major_inner: { 'line-color': '#48515e' },
  highway_major_subtle: { 'line-color': '#3f4855' },
  highway_motorway_casing: { 'line-color': ROAD_CASING },
  highway_motorway_inner: { 'line-color': { '#000': '#5b6573' } },
  highway_motorway_subtle: { 'line-color': '#38414d' },
  railway_transit: { 'line-color': '#404955' },
  railway_transit_dashline: { 'line-color': LAND },
  railway_minor: { 'line-color': '#404955' },
  railway_minor_dashline: { 'line-color': LAND },
  railway: { 'line-color': '#404955' },
  railway_dashline: { 'line-color': LAND },
  highway_name_other: { 'text-color': '#aab2bd', 'text-halo-color': LAND },
  highway_name_motorway: { 'text-color': '#bcc3cc' },
  water_name: { 'text-color': '#7fb0cc', 'text-halo-color': WATER },
  boundary_state: { 'line-color': '#4d5766' },
  'boundary_country_z0-4': { 'line-color': '#5a6472' },
  'boundary_country_z5-': { 'line-color': '#5a6472' },
  place_other: { 'text-color': LABEL, 'text-halo-color': LABEL_HALO },
  place_suburb: { 'text-color': LABEL, 'text-halo-color': LABEL_HALO },
  place_village: { 'text-color': LABEL, 'text-halo-color': LABEL_HALO },
  place_town: { 'text-color': LABEL, 'text-halo-color': LABEL_HALO },
  place_city: { 'text-color': LABEL, 'text-halo-color': LABEL_HALO },
  place_city_large: { 'text-color': LABEL, 'text-halo-color': LABEL_HALO },
  place_state: { 'text-color': LABEL, 'text-halo-color': LABEL_HALO },
  place_country_other: { 'text-color': LABEL, 'text-halo-color': LABEL_HALO },
  place_country_minor: { 'text-color': LABEL, 'text-halo-color': LABEL_HALO },
  place_country_major: { 'text-color': LABEL, 'text-halo-color': LABEL_HALO },
};

// Swaps colours inside an expression such as ['interpolate', ['linear'], ['zoom'], 5.8, 'hsla(...)', 6, '#000'].
function swapInExpression(value: unknown, swaps: Record<string, string>): unknown {
  if (typeof value === 'string') return swaps[value] ?? value;
  if (Array.isArray(value)) return value.map((v) => swapInExpression(v, swaps));
  return value;
}

// A copy of the style with the lighter colours; the one given is not changed. Layers the table does not know, or that a
// newer version of the style has dropped, are left alone.
export function lightenDarkStyle<T extends MapStyleJson>(style: T): T {
  const copy = JSON.parse(JSON.stringify(style)) as T;
  for (const layer of copy.layers) {
    const change = RECOLOR[layer.id];
    if (!change) continue;
    layer.paint = { ...(layer.paint ?? {}) };
    for (const [prop, next] of Object.entries(change)) {
      if (!(prop in layer.paint) && layer.type !== 'background') continue;
      layer.paint[prop] = typeof next === 'string' ? next : swapInExpression(layer.paint[prop], next as Record<string, string>);
    }
  }
  return copy;
}
