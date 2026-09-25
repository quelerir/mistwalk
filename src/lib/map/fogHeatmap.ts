import type { HeatmapLayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import { metersPerPixel } from '../geo/projection';
import type { FogPalette } from '../settings/fogStyle';

// Values to tune on the phone (task 4 of the plan). The heatmap kernel is soft: density is highest at a point and falls
// to nothing at `kernelFactor` times the cleared radius, so the cleared area is where density is above `clearAtDensity`.
export const FOG_HEATMAP = {
  // How far the fog is cleared around the trail, on the ground.
  clearRadiusMeters: 60,
  // Kernel radius as a multiple of the cleared radius: the soft edge lies between the two.
  kernelFactor: 1.6,
  // Above this zoom the pixel radius stops growing: the kernel would get huge and the cleared area a little smaller.
  maxRadiusZoom: 18,
  // Density (0..1) at and above which the fog is fully gone; below it the fog fades in towards 0.
  clearAtDensity: 0.5,
  // Points are added along the trail every this many metres (see densifyTrail).
  stepMeters: 20,
  // Two fixes further apart than this are a jump and are not joined.
  maxLinkMeters: 300,
} as const;

type FogHeatmapPaint = NonNullable<HeatmapLayerSpecification['paint']>;

// The kernel radius in screen pixels that covers the cleared radius (times the kernel factor) on the ground.
export function heatmapRadiusPx(zoom: number, lat: number): number {
  const z = Math.min(zoom, FOG_HEATMAP.maxRadiusZoom);
  return (FOG_HEATMAP.clearRadiusMeters * FOG_HEATMAP.kernelFactor) / metersPerPixel(z, lat);
}

// A pixel radius that follows the map's scale: it doubles with every zoom level. A base-2 exponential interpolation
// between the two ends is exactly that curve.
export function heatmapRadiusExpression(lat: number) {
  return [
    'interpolate',
    ['exponential', 2],
    ['zoom'],
    0,
    heatmapRadiusPx(0, lat),
    FOG_HEATMAP.maxRadiusZoom,
    heatmapRadiusPx(FOG_HEATMAP.maxRadiusZoom, lat),
  ];
}

function rgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// Inverted heatmap: no visits (density 0) = the fog, many visits = clear. The style-spec types describe every legal
// expression too strictly for a plain array literal, hence the cast.
export function fogHeatmapPaint(fog: FogPalette, lat: number): FogHeatmapPaint {
  return {
    'heatmap-radius': heatmapRadiusExpression(lat),
    'heatmap-weight': 1,
    'heatmap-intensity': 1,
    'heatmap-opacity': 1,
    'heatmap-color': [
      'interpolate',
      ['linear'],
      ['heatmap-density'],
      0,
      rgba(fog.base, 1),
      FOG_HEATMAP.clearAtDensity,
      rgba(fog.base, 0),
    ],
  } as unknown as FogHeatmapPaint;
}
