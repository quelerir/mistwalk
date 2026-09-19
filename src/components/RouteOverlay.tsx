import React, { useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { projectToScreen, type MapView, type Size } from '../lib/geo/projection';

export interface RouteOverlayProps {
  coordinates: Array<[number, number]> | null;
  view: MapView | null;
}

const LINE_COLOR = '#2f80ff';
const CASING_COLOR = '#ffffff';

export default function RouteOverlay({ coordinates, view }: RouteOverlayProps) {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  const path = useMemo(() => {
    if (!coordinates || !view || size.width === 0) return null;
    const p = Skia.Path.Make();
    coordinates.forEach(([lng, lat], i) => {
      const s = projectToScreen(lng, lat, view, size);
      if (i === 0) p.moveTo(s.x, s.y);
      else p.lineTo(s.x, s.y);
    });
    return p;
  }, [coordinates, view, size]);

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      <Canvas style={StyleSheet.absoluteFill}>
        {path && (
          <>
            <Path path={path} style="stroke" strokeWidth={9} strokeCap="round" strokeJoin="round" color={CASING_COLOR} />
            <Path path={path} style="stroke" strokeWidth={5} strokeCap="round" strokeJoin="round" color={LINE_COLOR} />
          </>
        )}
      </Canvas>
    </View>
  );
}
