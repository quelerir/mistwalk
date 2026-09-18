import type { MapView, Size } from '../geo/projection';

export const POI_TILE_ZOOM = 13;
const MAX_TILES = 9;

export interface Tile {
  x: number;
  y: number;
  z: number;
}

export interface TileBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export function tileForLngLat(lng: number, lat: number, z: number = POI_TILE_ZOOM): Tile {
  const n = 2 ** z;
  const rad = (lat * Math.PI) / 180;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return { x: Math.min(Math.max(x, 0), n - 1), y: Math.min(Math.max(y, 0), n - 1), z };
}

export function tileKey(tile: Tile): string {
  return `${tile.z}/${tile.x}/${tile.y}`;
}

function tileLng(x: number, z: number): number {
  return (x / 2 ** z) * 360 - 180;
}

function tileLat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export function tileBounds(tile: Tile): TileBounds {
  return {
    north: tileLat(tile.y, tile.z),
    south: tileLat(tile.y + 1, tile.z),
    west: tileLng(tile.x, tile.z),
    east: tileLng(tile.x + 1, tile.z),
  };
}

export function tilesForViewport(view: MapView, size: Size): Tile[] {
  const [lng, lat] = view.center;
  const degPerPx = 360 / (512 * 2 ** view.zoom);
  const halfLng = (size.width / 2) * degPerPx;
  const halfLat = (size.height / 2) * degPerPx * Math.cos((lat * Math.PI) / 180);

  const nw = tileForLngLat(lng - halfLng, lat + halfLat);
  const se = tileForLngLat(lng + halfLng, lat - halfLat);

  const tiles: Tile[] = [];
  for (let x = nw.x; x <= se.x; x++) {
    for (let y = nw.y; y <= se.y; y++) {
      tiles.push({ x, y, z: POI_TILE_ZOOM });
    }
  }
  const center = tileForLngLat(lng, lat);
  tiles.sort(
    (a, b) =>
      Math.abs(a.x - center.x) + Math.abs(a.y - center.y) -
      (Math.abs(b.x - center.x) + Math.abs(b.y - center.y))
  );
  return tiles.slice(0, MAX_TILES);
}
