import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import { Canvas, Group, Rect, Circle, BlurMask, Paint } from '@shopify/react-native-skia';
import type { MapView } from '@rnmapbox/maps';
import type { VisitedPoint } from '../lib/supabase/visitedPoints';

export interface FogOverlayProps {
  points: VisitedPoint[];
  mapRef: React.RefObject<MapView>;
  regionVersion: number;
}

interface ProjectedCircle {
  x: number;
  y: number;
  radiusPx: number;
}

const FOG_COLOR = 'rgba(10, 12, 20, 0.85)';
const OFFSCREEN_MARGIN_PX = 100;
const FALLBACK_METERS_PER_PIXEL = 1;

function groundResolutionMetersPerPixel(zoom: number): number {
  const earthCircumferenceMeters = 40075016.686;
  const resolution = earthCircumferenceMeters / (256 * 2 ** zoom);
  return Number.isFinite(resolution) && resolution > 0 ? resolution : FALLBACK_METERS_PER_PIXEL;
}

export default function FogOverlay({ points, mapRef, regionVersion }: FogOverlayProps) {
  const [circles, setCircles] = useState<ProjectedCircle[]>([]);
  const { width, height } = Dimensions.get('window');

  useEffect(() => {
    let cancelled = false;

    async function project() {
      const map = mapRef.current;
      if (!map) return;

      const zoom = (await map.getZoom()) ?? 16;
      const metersPerPixel = groundResolutionMetersPerPixel(zoom);
      const results: ProjectedCircle[] = [];

      for (const point of points) {
        const screenPoint = await map.getPointInView([point.lng, point.lat]);
        if (!screenPoint) continue;
        const [x, y] = screenPoint;
        if (
          x < -OFFSCREEN_MARGIN_PX ||
          x > width + OFFSCREEN_MARGIN_PX ||
          y < -OFFSCREEN_MARGIN_PX ||
          y > height + OFFSCREEN_MARGIN_PX
        ) {
          continue;
        }
        results.push({ x, y, radiusPx: point.radius / metersPerPixel });
      }

      if (!cancelled) setCircles(results);
    }

    void project();
    return () => {
      cancelled = true;
    };
  }, [points, regionVersion, mapRef, width, height]);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Group layer={<Paint />}>
        <Rect x={0} y={0} width={width} height={height} color={FOG_COLOR} />
        {circles.map((c, i) => (
          <Circle key={i} cx={c.x} cy={c.y} r={c.radiusPx} color="black" blendMode="dstOut">
            <BlurMask blur={c.radiusPx * 0.35} style="normal" />
          </Circle>
        ))}
      </Group>
    </Canvas>
  );
}
