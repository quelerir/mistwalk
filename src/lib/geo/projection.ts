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
  return TILE_SIZE * 2 ** zoom;
}

function mercatorX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * worldSize(zoom);
}

function mercatorY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  return (0.5 - Math.log(Math.tan(Math.PI / 4 + rad / 2)) / (2 * Math.PI)) * worldSize(zoom);
}

export function metersPerPixel(zoom: number, lat: number): number {
  return (EARTH_CIRCUMFERENCE_METERS * Math.cos((lat * Math.PI) / 180)) / worldSize(zoom);
}

export function projectToScreen(lng: number, lat: number, view: MapView, size: Size): ScreenPoint {
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
