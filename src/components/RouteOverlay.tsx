import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Group, Path, Skia } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import { worldPoint, worldScale, worldTransform, type WorldOrigin } from '../lib/geo/projection';
import { readView, type ViewShared } from '../lib/map/viewShared';

export interface RouteOverlayProps {
  coordinates: Array<[number, number]> | null;
  shared: ViewShared;
}

const LINE_COLOR = '#2f80ff';
const CASING_COLOR = '#ffffff';
const CASING_WIDTH = 9;
const LINE_WIDTH = 5;

// The route is drawn once in world space; the map moving only changes the transform, on the UI thread.
export default function RouteOverlay({ coordinates, shared }: RouteOverlayProps) {
  const origin = useMemo<WorldOrigin | null>(
    () => (coordinates && coordinates.length > 0 ? { lng: coordinates[0][0], lat: coordinates[0][1] } : null),
    [coordinates]
  );

  const path = useMemo(() => {
    if (!coordinates || !origin) return null;
    const p = Skia.Path.Make();
    coordinates.forEach(([lng, lat], i) => {
      const w = worldPoint(lng, lat, origin);
      if (i === 0) p.moveTo(w.x, w.y);
      else p.lineTo(w.x, w.y);
    });
    return p;
  }, [coordinates, origin]);

  const transform = useDerivedValue(() => (origin ? worldTransform(readView(shared), origin) : []), [origin]);
  // The line keeps the same width on screen whatever the zoom, so its width in world units shrinks as the scene grows.
  const casing = useDerivedValue(() => CASING_WIDTH / worldScale(shared.zoom.value));
  const line = useDerivedValue(() => LINE_WIDTH / worldScale(shared.zoom.value));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Canvas style={StyleSheet.absoluteFill}>
        {path && (
          <Group transform={transform}>
            <Path path={path} style="stroke" strokeWidth={casing} strokeCap="round" strokeJoin="round" color={CASING_COLOR} />
            <Path path={path} style="stroke" strokeWidth={line} strokeCap="round" strokeJoin="round" color={LINE_COLOR} />
          </Group>
        )}
      </Canvas>
    </View>
  );
}
