import React, { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { BlurMask, Canvas, Group, Paint, Path, Rect, Skia } from '@shopify/react-native-skia';
import type { VisitedPoint } from '../lib/supabase/visitedPoints';
import { haversineDistanceMeters } from '../lib/geo/distance';
import { metersPerPixel, projectToScreen, type MapView, type Size } from '../lib/geo/projection';

export interface LivePosition {
  lat: number;
  lng: number;
}

export interface FogOverlayProps {
  points: VisitedPoint[];
  livePosition: LivePosition | null;
  view: MapView | null;
  fogColor: string;
}

const REVEAL_RADIUS_METERS = 60;
const MAX_LINK_METERS = 300;
const OFFSCREEN_MARGIN_PX = 150;

interface Node {
  lat: number;
  lng: number;
}

function buildTrail(points: VisitedPoint[], livePosition: LivePosition | null): Node[] {
  const trail: Node[] = [...points]
    .sort((a, b) => a.ts - b.ts)
    .map((p) => ({ lat: p.lat, lng: p.lng }));
  if (livePosition) trail.push(livePosition);
  return trail;
}

export default function FogOverlay({ points, livePosition, view, fogColor }: FogOverlayProps) {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  const trail = useMemo(() => buildTrail(points, livePosition), [points, livePosition]);

  const revealPath = useMemo(() => {
    if (!view || size.width === 0 || trail.length === 0) return null;

    const screen = trail.map((n) => projectToScreen(n.lng, n.lat, view, size));
    const visible = screen.map(
      (s) =>
        s.x > -OFFSCREEN_MARGIN_PX &&
        s.x < size.width + OFFSCREEN_MARGIN_PX &&
        s.y > -OFFSCREEN_MARGIN_PX &&
        s.y < size.height + OFFSCREEN_MARGIN_PX
    );

    const path = Skia.Path.Make();
    let penDown = false;
    for (let i = 0; i < trail.length; i++) {
      const linked =
        i > 0 && haversineDistanceMeters(trail[i - 1], trail[i]) <= MAX_LINK_METERS;
      const onScreen = visible[i] || (i > 0 && visible[i - 1] && linked);

      if (!onScreen) {
        penDown = false;
        continue;
      }
      if (linked) {
        if (!penDown) path.moveTo(screen[i - 1].x, screen[i - 1].y);
        path.lineTo(screen[i].x, screen[i].y);
      } else {
        path.moveTo(screen[i].x, screen[i].y);
        // A zero-length segment still paints a round cap, so lone points show as dots.
        path.lineTo(screen[i].x + 0.01, screen[i].y);
      }
      penDown = true;
    }
    return path;
  }, [trail, view, size]);

  const revealWidth = useMemo(() => {
    if (!view) return 0;
    const lat = view.center[1];
    return (2 * REVEAL_RADIUS_METERS) / metersPerPixel(view.zoom, lat);
  }, [view]);

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Group layer={<Paint />}>
          <Rect x={0} y={0} width={size.width} height={size.height} color={fogColor} />
          {revealPath && (
            <Path
              path={revealPath}
              style="stroke"
              strokeWidth={revealWidth}
              strokeCap="round"
              strokeJoin="round"
              color="black"
              blendMode="dstOut"
            >
              <BlurMask blur={revealWidth * 0.18} style="normal" />
            </Path>
          )}
        </Group>
      </Canvas>
    </View>
  );
}
