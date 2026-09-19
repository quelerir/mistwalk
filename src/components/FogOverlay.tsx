import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { BlurMask, Canvas, Circle, ColorMatrix, FractalNoise, Group, Paint, Path, Rect, Skia, useClock } from '@shopify/react-native-skia';
import { useDerivedValue } from 'react-native-reanimated';
import type { VisitedPoint } from '../lib/supabase/visitedPoints';
import type { FogPalette } from '../lib/settings/fogStyle';
import { haversineDistanceMeters } from '../lib/geo/distance';
import {
  WORLD_ZOOM,
  metersPerPixel,
  originOnScreen,
  projectToScreen,
  worldPoint,
  worldScale,
  worldTransform,
  type MapView,
  type Size,
  type WorldOrigin,
} from '../lib/geo/projection';
import { readView, type ViewShared } from '../lib/map/viewShared';

export interface LivePosition {
  lat: number;
  lng: number;
}

export interface FogOverlayProps {
  points: VisitedPoint[];
  livePosition: LivePosition | null;
  // The view as shared values (moves the scene every frame) and a slower JS copy (origin and which points to draw).
  shared: ViewShared;
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
// How far around the view (in screen diagonals) the reveal path is built; it is rebuilt when the view leaves it.
const WINDOW_FACTOR = 1.6;
const ORIGIN_REANCHOR_KM = 60;

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

const CLOUD_MIN_SCALE = 0.35;
const CLOUD_MAX_SCALE = 4;
// The cloud rect is centred on the origin and must reach the screen from wherever the view is (up to the re-anchor
// distance), so it is simply very large; only the visible part is ever drawn.
const CLOUD_EXTENT = 150000;
// Screen-space offset of the shadow copy: light comes from the top-left.
const CLOUD_SHADOW_OFFSET = { x: 9, y: 12 };

// Each cloud layer sways on its own slow loop (different axes and periods), so the billows slide past
// each other and the fog seems to churn. Bounded, so no wrap-around jump and no growing offsets.
const DRIFT_AMPLITUDE = 45;
const TAU = Math.PI * 2;

interface FogCloudsProps {
  shared: ViewShared;
  origin: WorldOrigin;
  fog: FogPalette;
  animated: boolean;
}

// Clouds are laid out around a fixed origin, so they pan, zoom and rotate with the map: the transform is derived from
// the shared view on the UI thread, with no React render per frame.
function FogClouds({ shared, origin, fog, animated }: FogCloudsProps) {
  const clock = useClock();
  const anchor = useDerivedValue(() => {
    const v = readView(shared);
    const at = originOnScreen(v, origin);
    const scale = Math.min(CLOUD_MAX_SCALE, Math.max(CLOUD_MIN_SCALE, worldScale(v.zoom)));
    return { x: at.x, y: at.y, scale, rotation: (-v.bearing * Math.PI) / 180 };
  }, [origin]);
  const layer = (which: 'a' | 'b') => {
    'worklet';
    const a = anchor.value;
    const t = animated ? clock.value / 1000 : 0;
    const dx = which === 'a' ? Math.sin((t / 23) * TAU) : -Math.cos((t / 17) * TAU);
    const dy = which === 'a' ? Math.cos((t / 31) * TAU) * 0.7 : Math.sin((t / 29) * TAU);
    return [
      { translateX: a.x },
      { translateY: a.y },
      { rotate: a.rotation },
      { scale: a.scale },
      { translateX: dx * DRIFT_AMPLITUDE },
      { translateY: dy * DRIFT_AMPLITUDE },
    ];
  };
  const layerA = useDerivedValue(() => layer('a'), [animated]);
  const layerB = useDerivedValue(() => layer('b'), [animated]);

  return (
    <>
      <Group transform={[{ translateX: CLOUD_SHADOW_OFFSET.x }, { translateY: CLOUD_SHADOW_OFFSET.y }]}>
        <Group transform={layerA}>
          <CloudLayer extent={CLOUD_EXTENT} color={fog.shadow} freq={0.006} seed={3} gain={3.2} />
        </Group>
      </Group>
      <Group transform={layerA}>
        <CloudLayer extent={CLOUD_EXTENT} color={fog.light} freq={0.006} seed={3} gain={3.2} />
      </Group>
      <Group transform={layerB}>
        <CloudLayer extent={CLOUD_EXTENT} color={fog.light} freq={0.02} seed={11} gain={1.6} />
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

function distanceKm(a: WorldOrigin, b: WorldOrigin): number {
  return haversineDistanceMeters({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) / 1000;
}

export default function FogOverlay({ points, livePosition, shared, view, fog, animated = true, rain = 0, userDot = false }: FogOverlayProps) {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [origin, setOrigin] = useState<WorldOrigin | null>(null);

  // The world origin: where the view first is, and again when it is more than a long way off (keeps numbers small).
  useEffect(() => {
    if (!view) return;
    const here = { lng: view.center[0], lat: view.center[1] };
    if (!origin || distanceKm(origin, here) > ORIGIN_REANCHOR_KM) setOrigin(here);
  }, [view, origin]);

  const trail = useMemo(() => buildTrail(points, livePosition), [points, livePosition]);

  // Which part of the world the path covers: a window around the view, rebuilt when the view leaves its middle.
  const windowKey = useMemo(() => {
    if (!view || !origin || size.width === 0) return null;
    const half = (WINDOW_FACTOR * Math.hypot(size.width, size.height)) / worldScale(view.zoom);
    const c = worldPoint(view.center[0], view.center[1], origin);
    const step = half / 2;
    return { half, cx: Math.round(c.x / step) * step, cy: Math.round(c.y / step) * step, zoom: Math.round(view.zoom) };
  }, [view, origin, size.width, size.height]);
  const windowId = windowKey ? `${windowKey.cx.toFixed(0)}:${windowKey.cy.toFixed(0)}:${windowKey.zoom}` : '';

  const revealPath = useMemo(() => {
    if (!origin || !windowKey || trail.length === 0) return null;
    const { half, cx, cy } = windowKey;
    const world = trail.map((n) => worldPoint(n.lng, n.lat, origin));
    const inside = world.map((w) => Math.abs(w.x - cx) < half && Math.abs(w.y - cy) < half);

    const path = Skia.Path.Make();
    let penDown = false;
    for (let i = 0; i < trail.length; i++) {
      const linked = i > 0 && haversineDistanceMeters(trail[i - 1], trail[i]) <= MAX_LINK_METERS;
      const wanted = inside[i] || (i > 0 && inside[i - 1] && linked);

      if (!wanted) {
        penDown = false;
        continue;
      }
      if (linked) {
        if (!penDown) path.moveTo(world[i - 1].x, world[i - 1].y);
        path.lineTo(world[i].x, world[i].y);
      } else {
        path.moveTo(world[i].x, world[i].y);
        // A zero-length segment still paints a round cap, so lone points show as dots.
        path.lineTo(world[i].x + 0.01, world[i].y);
      }
      penDown = true;
    }
    return path;
    // windowKey is covered by windowId: the path only changes when the window (or the points) do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trail, origin, windowId]);

  const revealWidth = origin ? (2 * REVEAL_RADIUS_METERS) / metersPerPixel(WORLD_ZOOM, origin.lat) : 0;

  const sceneTransform = useDerivedValue(
    () => (origin ? worldTransform(readView(shared), origin) : []),
    [origin]
  );
  const dotTransform = useDerivedValue(() => {
    if (!livePosition) return [];
    const v = readView(shared);
    const p = projectToScreen(livePosition.lng, livePosition.lat, { center: [v.lng, v.lat], zoom: v.zoom, bearing: v.bearing }, { width: v.width, height: v.height });
    return [{ translateX: p.x }, { translateY: p.y }];
  }, [livePosition?.lng, livePosition?.lat]);

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
    shared.width.value = width;
    shared.height.value = height;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Group layer={<Paint />}>
          <Rect x={0} y={0} width={size.width} height={size.height} color={fog.base} />
          {origin && <FogClouds shared={shared} origin={origin} fog={fog} animated={animated} />}
          {origin && revealPath && (
            <Group transform={sceneTransform}>
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
            </Group>
          )}
        </Group>
        {rain > 0 && size.width > 0 && <Rain size={size} rain={rain} animated={animated} />}
        {userDot && livePosition && (
          <Group transform={dotTransform}>
            <Circle cx={0} cy={0} r={22} color="rgba(47, 143, 255, 0.18)" />
            <Circle cx={0} cy={0} r={10} color="#FFFFFF" />
            <Circle cx={0} cy={0} r={7} color="#2F8FFF" />
          </Group>
        )}
      </Canvas>
    </View>
  );
}
