import React, { useMemo } from 'react';
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { VisitedPoint } from '../lib/supabase/visitedPoints';
import type { FogPalette } from '../lib/settings/fogStyle';
import { buildTrail, densifyTrail } from '../lib/map/fogTrail';
import { FOG_HEATMAP, fogHeatmapPaint } from '../lib/map/fogHeatmap';

export interface FogLayerProps {
  points: VisitedPoint[];
  fog: FogPalette;
  // Latitude of the view: the pixel radius of the heatmap depends on it (rounded, so it rarely changes).
  lat: number;
}

// A point far from anywhere anyone walks. A heatmap with no features at all draws nothing, which would show no fog to a
// player with no visits yet; this one keeps the layer alive.
const ANCHOR: [number, number] = [0, -89.9];

// The fog, drawn by the map: the trail goes in as points, the heatmap layer turns it into "clear where visited".
export default function FogLayer({ points, fog, lat }: FogLayerProps) {
  const coordinates = useMemo(
    () => [...densifyTrail(buildTrail(points), FOG_HEATMAP.stepMeters, FOG_HEATMAP.maxLinkMeters), ANCHOR],
    [points]
  );
  const data = useMemo(
    () => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'MultiPoint' as const, coordinates } }),
    [coordinates]
  );
  const roundedLat = Math.round(lat);
  const paint = useMemo(() => fogHeatmapPaint(fog, roundedLat), [fog, roundedLat]);

  return (
    <GeoJSONSource id="fog-trail" data={data}>
      <Layer id="fog-heatmap" type="heatmap" paint={paint} />
    </GeoJSONSource>
  );
}
