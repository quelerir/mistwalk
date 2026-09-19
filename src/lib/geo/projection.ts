export interface MapView {
  center: [number, number];
  zoom: number;
  bearing: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

const TILE_SIZE = 512;
const EARTH_CIRCUMFERENCE_METERS = 40075016.686;

function worldSize(zoom: number): number {
  'worklet';
  return TILE_SIZE * 2 ** zoom;
}

function mercatorX(lng: number, zoom: number): number {
  'worklet';
  return ((lng + 180) / 360) * worldSize(zoom);
}

function mercatorY(lat: number, zoom: number): number {
  'worklet';
  const rad = (lat * Math.PI) / 180;
  return (0.5 - Math.log(Math.tan(Math.PI / 4 + rad / 2)) / (2 * Math.PI)) * worldSize(zoom);
}

export function metersPerPixel(zoom: number, lat: number): number {
  'worklet';
  return (EARTH_CIRCUMFERENCE_METERS * Math.cos((lat * Math.PI) / 180)) / worldSize(zoom);
}

export function projectToScreen(lng: number, lat: number, view: MapView, size: Size): ScreenPoint {
  'worklet';
  const dx = mercatorX(lng, view.zoom) - mercatorX(view.center[0], view.zoom);
  const dy = mercatorY(lat, view.zoom) - mercatorY(view.center[1], view.zoom);
  const bearing = (view.bearing * Math.PI) / 180;
  const cos = Math.cos(bearing);
  const sin = Math.sin(bearing);
  return {
    x: size.width / 2 + dx * cos + dy * sin,
    y: size.height / 2 - dx * sin + dy * cos,
  };
}

// ---- World space: drawing things once and moving the whole scene with a single matrix ----
// Points are laid out in pixels at a fixed zoom, relative to an origin (small numbers keep float precision), and
// a transform maps that scene to the screen for the current view. It runs on the UI thread every frame.

export const WORLD_ZOOM = 16;

export interface WorldOrigin {
  lng: number;
  lat: number;
}

export interface ViewNumbers {
  lng: number;
  lat: number;
  zoom: number;
  bearing: number;
  width: number;
  height: number;
}

export function worldPoint(lng: number, lat: number, origin: WorldOrigin): ScreenPoint {
  'worklet';
  return {
    x: mercatorX(lng, WORLD_ZOOM) - mercatorX(origin.lng, WORLD_ZOOM),
    y: mercatorY(lat, WORLD_ZOOM) - mercatorY(origin.lat, WORLD_ZOOM),
  };
}

export function worldScale(zoom: number): number {
  'worklet';
  return 2 ** (zoom - WORLD_ZOOM);
}

// Maps world-space points to the screen; the same result as projectToScreen for every point.
export function worldTransform(v: ViewNumbers, origin: WorldOrigin) {
  'worklet';
  const c = worldPoint(v.lng, v.lat, origin);
  return [
    { translateX: v.width / 2 },
    { translateY: v.height / 2 },
    { rotate: (-v.bearing * Math.PI) / 180 },
    { scale: worldScale(v.zoom) },
    { translateX: -c.x },
    { translateY: -c.y },
  ];
}

// Where the origin lands on the screen (the anchor of the clouds).
export function originOnScreen(v: ViewNumbers, origin: WorldOrigin): ScreenPoint {
  'worklet';
  const c = worldPoint(v.lng, v.lat, origin);
  const s = worldScale(v.zoom);
  const bearing = (v.bearing * Math.PI) / 180;
  const cos = Math.cos(bearing);
  const sin = Math.sin(bearing);
  const dx = -c.x * s;
  const dy = -c.y * s;
  return { x: v.width / 2 + dx * cos + dy * sin, y: v.height / 2 - dx * sin + dy * cos };
}
