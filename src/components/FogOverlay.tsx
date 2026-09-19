import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { BlurMask, Canvas, ColorMatrix, FractalNoise, Group, Paint, Path, Rect, Skia } from '@shopify/react-native-skia';
import type { VisitedPoint } from '../lib/supabase/visitedPoints';
import type { FogPalette } from '../lib/settings/fogStyle';
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
  fog: FogPalette;
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

function parseHex(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

interface CloudLayerProps {
  extent: number;
  color: string;
  freq: number;
  seed: number;
  gain: number;
}

// Fractal noise recoloured to one tint: alpha rises steeply above the noise midpoint, so the
// billows get defined edges instead of a uniform haze.
function CloudLayer({ extent, color, freq, seed, gain }: CloudLayerProps) {
  const [r, g, b] = parseHex(color);
  // prettier-ignore
  const matrix = [
    0, 0, 0, 0, r,
    0, 0, 0, 0, g,
    0, 0, 0, 0, b,
    gain, 0, 0, 0, -gain * 0.4,
  ];
  return (
    <Rect x={-extent} y={-extent} width={extent * 2} height={extent * 2}>
      <FractalNoise freqX={freq} freqY={freq} octaves={5} seed={seed} />
      <ColorMatrix matrix={matrix} />
    </Rect>
  );
}

const CLOUD_REFERENCE_ZOOM = 16;
const CLOUD_MIN_SCALE = 0.35;
const CLOUD_MAX_SCALE = 4;
const CLOUD_MAX_OFFSET_PX = 50000;
// Screen-space offset of the shadow copy: light comes from the top-left.
const CLOUD_SHADOW_OFFSET = { x: 9, y: 12 };

interface FogCloudsProps {
  view: MapView | null;
  size: Size;
  fog: FogPalette;
}

// Clouds are laid out in map space around a fixed origin, so they pan, zoom and rotate with the map.
function FogClouds({ view, size, fog }: FogCloudsProps) {
  const origin = useRef<[number, number] | null>(null);
  if (!view) return null;
  if (!origin.current) origin.current = [view.center[0], view.center[1]];

  let at = projectToScreen(origin.current[0], origin.current[1], view, size);
  if (Math.abs(at.x) > CLOUD_MAX_OFFSET_PX || Math.abs(at.y) > CLOUD_MAX_OFFSET_PX) {
    // Far from the origin (first real fix or a long trip): re-anchor to keep float precision.
    origin.current = [view.center[0], view.center[1]];
    at = projectToScreen(origin.current[0], origin.current[1], view, size);
  }
  const scale = Math.min(
    CLOUD_MAX_SCALE,
    Math.max(CLOUD_MIN_SCALE, 2 ** (view.zoom - CLOUD_REFERENCE_ZOOM))
  );
  const extent = Math.hypot(size.width, size.height) / scale;
  const mapTransform = [
    { translateX: at.x },
    { translateY: at.y },
    { rotate: (-view.bearing * Math.PI) / 180 },
    { scale },
  ];

  return (
    <>
      <Group transform={[{ translateX: CLOUD_SHADOW_OFFSET.x }, { translateY: CLOUD_SHADOW_OFFSET.y }]}>
        <Group transform={mapTransform}>
          <CloudLayer extent={extent} color={fog.shadow} freq={0.006} seed={3} gain={3.2} />
        </Group>
      </Group>
      <Group transform={mapTransform}>
        <CloudLayer extent={extent} color={fog.light} freq={0.006} seed={3} gain={3.2} />
        <CloudLayer extent={extent} color={fog.light} freq={0.02} seed={11} gain={1.6} />
      </Group>
    </>
  );
}

export default function FogOverlay({ points, livePosition, view, fog }: FogOverlayProps) {
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
          <Rect x={0} y={0} width={size.width} height={size.height} color={fog.base} />
          <FogClouds view={view} size={size} fog={fog} />
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
