import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { BlurMask, Canvas, Circle, ColorMatrix, FractalNoise, Group, Paint, Path, Rect, Skia, useClock } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
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
  animated?: boolean;
  // 0 = dry; above 0 falling drops are drawn over the map, more of them the stronger it is (max 1).
  rain?: number;
  // Draw the "you are here" dot ourselves (Android; the native MapLibre one is left out there).
  userDot?: boolean;
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
  animated: boolean;
}

// Each cloud layer sways on its own slow loop (different axes and periods), so the billows slide past
// each other and the fog seems to churn. Bounded, so no wrap-around jump and no growing offsets.
const DRIFT_AMPLITUDE = 45;
const TAU = Math.PI * 2;

// Clouds are laid out in map space around a fixed origin, so they pan, zoom and rotate with the map.
function FogClouds({ view, size, fog, animated }: FogCloudsProps) {
  const origin = useRef<[number, number] | null>(null);
  const clock = useClock();

  let at = { x: 0, y: 0 };
  let scale = 1;
  let rotation = 0;
  let extent = 0;
  if (view) {
    if (!origin.current) origin.current = [view.center[0], view.center[1]];
    at = projectToScreen(origin.current[0], origin.current[1], view, size);
    if (Math.abs(at.x) > CLOUD_MAX_OFFSET_PX || Math.abs(at.y) > CLOUD_MAX_OFFSET_PX) {
      // Far from the origin (first real fix or a long trip): re-anchor to keep float precision.
      origin.current = [view.center[0], view.center[1]];
      at = projectToScreen(origin.current[0], origin.current[1], view, size);
    }
    scale = Math.min(CLOUD_MAX_SCALE, Math.max(CLOUD_MIN_SCALE, 2 ** (view.zoom - CLOUD_REFERENCE_ZOOM)));
    rotation = (-view.bearing * Math.PI) / 180;
    // The cloud rect is centred on the anchor, so it must reach the farthest screen corner (plus the sway).
    const reach = Math.hypot(
      Math.max(Math.abs(at.x), Math.abs(at.x - size.width)),
      Math.max(Math.abs(at.y), Math.abs(at.y - size.height))
    );
    extent = reach / scale + DRIFT_AMPLITUDE * 1.5;
  }
  const { x: atX, y: atY } = at;
  const mapTransform = (layer: 'a' | 'b') => {
    'worklet';
    const t = animated ? clock.value / 1000 : 0;
    const dx = layer === 'a' ? Math.sin((t / 23) * TAU) : -Math.cos((t / 17) * TAU);
    const dy = layer === 'a' ? Math.cos((t / 31) * TAU) * 0.7 : Math.sin((t / 29) * TAU);
    return [
      { translateX: atX },
      { translateY: atY },
      { rotate: rotation },
      { scale },
      { translateX: dx * DRIFT_AMPLITUDE },
      { translateY: dy * DRIFT_AMPLITUDE },
    ];
  };
  const layerA = useDerivedValue(() => mapTransform('a'), [atX, atY, rotation, scale, animated]);
  const layerB = useDerivedValue(() => mapTransform('b'), [atX, atY, rotation, scale, animated]);

  if (!view) return null;

  return (
    <>
      <Group transform={[{ translateX: CLOUD_SHADOW_OFFSET.x }, { translateY: CLOUD_SHADOW_OFFSET.y }]}>
        <Group transform={layerA}>
          <CloudLayer extent={extent} color={fog.shadow} freq={0.006} seed={3} gain={3.2} />
        </Group>
      </Group>
      <Group transform={layerA}>
        <CloudLayer extent={extent} color={fog.light} freq={0.006} seed={3} gain={3.2} />
      </Group>
      <Group transform={layerB}>
        <CloudLayer extent={extent} color={fog.light} freq={0.02} seed={11} gain={1.6} />
      </Group>
    </>
  );
}

const MAX_DROPS = 80;
const MAX_SPLASHES = 22;
const DROP_SPEED = 820; // px/s
const DROP_SLANT = 0.1;

// Deterministic pseudo-random numbers, so drops keep their places between frames.
function unit(i: number, salt: number): number {
  'worklet';
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

interface RainProps {
  size: Size;
  rain: number;
  animated: boolean;
}

// Short round drops fall from the top over the whole map (not only the fog). Splashes bloom at random spots:
// a ring grows and fades while a few tiny droplets jump up and out. Each splash has its own rhythm and moves to a
// new place every cycle. The ring fades in three steps, because a single path has one colour.
function Rain({ size, rain, animated }: RainProps) {
  const clock = useClock();
  const dropCount = Math.round(18 + rain * (MAX_DROPS - 18));
  const splashCount = Math.round(7 + rain * (MAX_SPLASHES - 7));

  const dropPath = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const t = animated ? clock.value / 1000 : 0;
    const span = size.height + 40;
    for (let i = 0; i < dropCount; i++) {
      const speed = DROP_SPEED * (0.75 + unit(i, 3) * 0.5);
      const len = 8 + unit(i, 5) * 8;
      const x0 = unit(i, 1) * (size.width + 60) - 30;
      const y = ((unit(i, 2) * span + t * speed) % span) - 20;
      p.moveTo(x0 - y * DROP_SLANT, y);
      p.lineTo(x0 - (y + len) * DROP_SLANT, y + len);
    }
    return p;
  }, [size.width, size.height, dropCount, animated]);

  const splashes = useDerivedValue(() => {
    const early = Skia.Path.Make();
    const mid = Skia.Path.Make();
    const late = Skia.Path.Make();
    const t = animated ? clock.value / 1000 : 0;
    for (let i = 0; i < splashCount; i++) {
      const period = 0.9 + unit(i, 21) * 0.7;
      const shifted = t / period + unit(i, 22);
      const cycle = Math.floor(shifted);
      const phase = shifted - cycle;
      const seed = i * 13 + cycle;
      const x = unit(seed, 23) * size.width;
      const y = unit(seed, 24) * size.height;
      const r = 2 + phase * 13;
      const bucket = phase < 0.33 ? early : phase < 0.66 ? mid : late;
      bucket.addCircle(x, y, r);
      if (phase < 0.55) {
        const lift = Math.sin((phase / 0.55) * Math.PI) * 9;
        for (let a = 0; a < 4; a++) {
          const angle = (a / 4) * Math.PI * 2 + unit(seed, 30 + a) * 1.2;
          const reach = r * 1.15 + phase * 10;
          bucket.addCircle(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach * 0.6 - lift, 1.2);
        }
      }
    }
    return { early, mid, late };
  }, [size.width, size.height, splashCount, animated]);
  const early = useDerivedValue(() => splashes.value.early);
  const mid = useDerivedValue(() => splashes.value.mid);
  const late = useDerivedValue(() => splashes.value.late);

  return (
    <>
      <Path path={dropPath} style="stroke" strokeWidth={2.4} strokeCap="round" color="rgba(225, 236, 255, 0.6)" />
      <Path path={early} style="stroke" strokeWidth={1.6} color="rgba(235, 243, 255, 0.8)" />
      <Path path={mid} style="stroke" strokeWidth={1.5} color="rgba(235, 243, 255, 0.45)" />
      <Path path={late} style="stroke" strokeWidth={1.3} color="rgba(235, 243, 255, 0.2)" />
    </>
  );
}

export default function FogOverlay({ points, livePosition, view, fog, animated = true, rain = 0, userDot = false }: FogOverlayProps) {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  const dot = useMemo(
    () => (view && livePosition && size.width > 0 ? projectToScreen(livePosition.lng, livePosition.lat, view, size) : null),
    [view, livePosition, size]
  );

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
          <FogClouds view={view} size={size} fog={fog} animated={animated} />
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
        {rain > 0 && size.width > 0 && <Rain size={size} rain={rain} animated={animated} />}
        {userDot && dot && (
          <>
            <Circle cx={dot.x} cy={dot.y} r={22} color="rgba(47, 143, 255, 0.18)" />
            <Circle cx={dot.x} cy={dot.y} r={10} color="#FFFFFF" />
            <Circle cx={dot.x} cy={dot.y} r={7} color="#2F8FFF" />
          </>
        )}
      </Canvas>
    </View>
  );
}
