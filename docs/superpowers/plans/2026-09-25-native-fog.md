# Native fog layer Implementation Plan (plan 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw the fog inside the MapLibre map (an inverted heatmap layer) so it moves with the map in the same frame, and keep clouds and rain as a light screen overlay.

**Architecture:** A GeoJSON source holds the visited trail as one `MultiPoint` (saved points plus points added every ~20 m between linked fixes). A `heatmap` layer over it has an inverted colour ramp: density 0 = the fog colour, growing density = transparent, so the trail is cleared with a soft edge. The heatmap radius is a zoom expression that keeps the cleared radius near 60 m on the ground. `FogOverlay` stops drawing the fog base and the reveal path; it keeps the clouds (unmasked, semi-transparent), the rain and, on Android, the user dot.

**Tech Stack:** TypeScript, React Native 0.83 / Expo SDK 55, `@maplibre/maplibre-react-native` 11.3.10 (`GeoJSONSource`, `Layer`), Skia, Reanimated, Jest (`jest-expo`).

**Spec:** `docs/superpowers/specs/2026-09-25-native-map-layers-design.md`. This plan covers spec stages 1 and 2 (the fog). Stages 3 and 4 (markers; route and Android dot) get their own plan, written after the fog is verified on the phone.

## Global Constraints

- Work on branch `native-layers`. Tag `pre-native-layers` (commit `181106d`) is the rollback point; never move it.
- Cleared radius on the ground stays about 60 m (`REVEAL_RADIUS_METERS` in the old overlay); two fixes more than 300 m apart are not joined (`MAX_LINK_METERS`).
- Fog colours come from `FOG_PALETTES` (`src/lib/settings/fogStyle.ts`); the fog is opaque (`base` colour, alpha 1).
- The native fog is switched on for iOS only (`NATIVE_FOG = Platform.OS === 'ios'`) until it is seen working on the Android 9 phone (native map components crashed there before).
- Every commit adds only the files it names (`git add <paths>`), never `git add -A`: `ios/FogofWarMap.xcodeproj/project.pbxproj` carries the user's personal Team ID and must stay uncommitted.
- Tests: `npx jest` must stay green (356 at the start of this plan, count grows); `npx tsc --noEmit` clean.
- The lag is judged in a **Release** build on the iPhone (`/tmp/build_install.sh` builds Release, installs, launches). Dev-client checks (Metro) are only for tuning the look.
- The user-facing language is Russian in chat; code and comments are English.

## File Structure

- Create `src/lib/map/fogTrail.ts` (+ `fogTrail.test.ts`): `buildTrail`, `densifyTrail`, `glidePosition`.
- Create `src/lib/map/fogHeatmap.ts` (+ `fogHeatmap.test.ts`): tunables, radius expression, paint.
- Create `src/lib/map/nativeLayers.ts`: the `NATIVE_FOG` switch.
- Create `src/components/FogLayer.tsx`: the source and the heatmap layer.
- Modify `src/components/FogOverlay.tsx`: import `buildTrail`; with native fog, skip the base and the reveal, draw light clouds.
- Modify `src/screens/MapScreen.tsx`: mount `FogLayer` inside `<Map>`, pass `nativeFog` to `FogOverlay`.

---

### Task 1: Trail helpers (`fogTrail.ts`)

**Files:**
- Create: `src/lib/map/fogTrail.ts`
- Test: `src/lib/map/fogTrail.test.ts`
- Modify: `src/components/FogOverlay.tsx` (import `buildTrail` instead of defining it)

**Interfaces:**
- Produces: `TrailNode = { lat: number; lng: number }`; `buildTrail(points: VisitedPoint[]): TrailNode[]` (sorted by `ts`); `densifyTrail(nodes: TrailNode[], stepMeters: number, maxLinkMeters: number): Array<[number, number]>` (`[lng, lat]` pairs); `glidePosition(from: TrailNode, to: TrailNode, elapsedMs: number, durationMs: number, snapMeters: number): TrailNode`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/map/fogTrail.test.ts
import { buildTrail, densifyTrail, glidePosition } from './fogTrail';
import { haversineDistanceMeters } from '../geo/distance';

const p = (lat: number, lng: number, ts = 0) => ({ lat, lng, radius: 60, ts });

describe('buildTrail', () => {
  it('orders the points by time and keeps only where they are', () => {
    const trail = buildTrail([p(2, 2, 20), p(1, 1, 10)]);
    expect(trail).toEqual([{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }]);
  });
});

describe('densifyTrail', () => {
  it('returns a lone point as it is', () => {
    expect(densifyTrail([{ lat: 0, lng: 0 }], 20, 300)).toEqual([[0, 0]]);
  });

  it('adds points between two linked fixes, no further apart than the step', () => {
    const out = densifyTrail([{ lat: 0, lng: 0 }, { lat: 0, lng: 0.0009 }], 20, 300); // about 100 m
    expect(out.length).toBe(7);
    expect(out[0]).toEqual([0, 0]);
    expect(out[out.length - 1]).toEqual([0.0009, 0]);
    for (let i = 1; i < out.length; i++) {
      const gap = haversineDistanceMeters({ lng: out[i - 1][0], lat: out[i - 1][1] }, { lng: out[i][0], lat: out[i][1] });
      expect(gap).toBeLessThanOrEqual(20);
    }
  });

  it('does not join fixes further apart than the link limit', () => {
    const out = densifyTrail([{ lat: 0, lng: 0 }, { lat: 0, lng: 0.005 }], 20, 300); // about 550 m
    expect(out).toEqual([[0, 0], [0.005, 0]]);
  });

  it('adds nothing between fixes closer than the step', () => {
    expect(densifyTrail([{ lat: 0, lng: 0 }, { lat: 0, lng: 0.0001 }], 20, 300)).toEqual([[0, 0], [0.0001, 0]]);
  });
});

describe('glidePosition', () => {
  const a = { lat: 0, lng: 0 };
  const b = { lat: 0, lng: 0.0009 }; // about 100 m

  it('starts at the old fix and ends at the new one', () => {
    expect(glidePosition(a, b, 0, 2000, 300)).toEqual(a);
    expect(glidePosition(a, b, 2000, 2000, 300)).toEqual(b);
    expect(glidePosition(a, b, 5000, 2000, 300)).toEqual(b);
  });

  it('is halfway at half the time', () => {
    const mid = glidePosition(a, b, 1000, 2000, 300);
    expect(mid.lng).toBeCloseTo(0.00045, 8);
  });

  it('jumps at once when the fixes are further apart than the snap distance', () => {
    expect(glidePosition(a, { lat: 0, lng: 0.005 }, 0, 2000, 300)).toEqual({ lat: 0, lng: 0.005 });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest src/lib/map/fogTrail.test.ts`
Expected: FAIL (`Cannot find module './fogTrail'`).

- [ ] **Step 3: Implement**

```ts
// src/lib/map/fogTrail.ts
import type { VisitedPoint } from '../supabase/visitedPoints';
import { haversineDistanceMeters } from '../geo/distance';

export interface TrailNode {
  lat: number;
  lng: number;
}

// The places where the player has been, oldest first.
export function buildTrail(points: VisitedPoint[]): TrailNode[] {
  return [...points].sort((a, b) => a.ts - b.ts).map((p) => ({ lat: p.lat, lng: p.lng }));
}

// The trail as [lng, lat] pairs with points added between two linked fixes so that none are more than `stepMeters`
// apart: the heatmap then clears a continuous corridor instead of a string of separate discs. Fixes further apart than
// `maxLinkMeters` are a jump (teleport, lost signal), not a walk, and are not joined.
export function densifyTrail(nodes: TrailNode[], stepMeters: number, maxLinkMeters: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < nodes.length; i++) {
    const cur = nodes[i];
    if (i > 0) {
      const prev = nodes[i - 1];
      const meters = haversineDistanceMeters(prev, cur);
      if (meters <= maxLinkMeters && meters > stepMeters) {
        const segments = Math.ceil(meters / stepMeters);
        for (let s = 1; s < segments; s++) {
          const t = s / segments;
          out.push([prev.lng + (cur.lng - prev.lng) * t, prev.lat + (cur.lat - prev.lat) * t]);
        }
      }
    }
    out.push([cur.lng, cur.lat]);
  }
  return out;
}

// Where the "head" of the trail is `elapsedMs` after a new fix arrived: it eases in a straight line from the old fix to
// the new one over `durationMs`; a fix further than `snapMeters` away is a jump and is taken at once.
export function glidePosition(from: TrailNode, to: TrailNode, elapsedMs: number, durationMs: number, snapMeters: number): TrailNode {
  if (haversineDistanceMeters(from, to) > snapMeters) return to;
  const t = Math.min(1, Math.max(0, elapsedMs / durationMs));
  if (t >= 1) return to;
  if (t <= 0) return from;
  return { lat: from.lat + (to.lat - from.lat) * t, lng: from.lng + (to.lng - from.lng) * t };
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx jest src/lib/map/fogTrail.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Reuse `buildTrail` in `FogOverlay`**

In `src/components/FogOverlay.tsx` delete the local `interface Node` and `function buildTrail` (they sit right after the `GLIDE_SNAP_METERS` constant), add `import { buildTrail, type TrailNode } from '../lib/map/fogTrail';` next to the other imports, and replace the two remaining `Node` type uses (in `headAnchor`/trail helpers) with `TrailNode` if the compiler asks. Run `npx tsc --noEmit` (clean) and `npx jest` (green).

- [ ] **Step 6: Commit**

```bash
git add src/lib/map/fogTrail.ts src/lib/map/fogTrail.test.ts src/components/FogOverlay.tsx
git commit -m "Add trail helpers for the native fog layer

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Heatmap tunables, radius and paint (`fogHeatmap.ts`)

**Files:**
- Create: `src/lib/map/fogHeatmap.ts`
- Test: `src/lib/map/fogHeatmap.test.ts`

**Interfaces:**
- Consumes: `metersPerPixel(zoom, lat)` from `src/lib/geo/projection.ts`; `FogPalette` from `src/lib/settings/fogStyle.ts`.
- Produces: `FOG_HEATMAP` (tunables); `heatmapRadiusPx(zoom: number, lat: number): number`; `heatmapRadiusExpression(lat: number)`; `fogHeatmapPaint(fog: FogPalette, lat: number): FogHeatmapPaint`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/map/fogHeatmap.test.ts
import { FOG_HEATMAP, fogHeatmapPaint, heatmapRadiusExpression, heatmapRadiusPx } from './fogHeatmap';
import { metersPerPixel } from '../geo/projection';
import { FOG_PALETTES } from '../settings/fogStyle';

const LAT = 41.6;

describe('heatmapRadiusPx', () => {
  it('is the kernel radius in metres over the metres one pixel covers', () => {
    const expected = (FOG_HEATMAP.clearRadiusMeters * FOG_HEATMAP.kernelFactor) / metersPerPixel(17, LAT);
    expect(heatmapRadiusPx(17, LAT)).toBeCloseTo(expected, 6);
  });

  it('doubles with every zoom level up to the cap and stops growing after it', () => {
    expect(heatmapRadiusPx(11, LAT) / heatmapRadiusPx(10, LAT)).toBeCloseTo(2, 6);
    expect(heatmapRadiusPx(FOG_HEATMAP.maxRadiusZoom + 2, LAT)).toBeCloseTo(heatmapRadiusPx(FOG_HEATMAP.maxRadiusZoom, LAT), 6);
  });
});

describe('heatmapRadiusExpression', () => {
  it('is an exponential zoom interpolation whose ends match heatmapRadiusPx', () => {
    const [kind, base, input, z0, r0, z1, r1] = heatmapRadiusExpression(LAT) as unknown[] as [unknown[], unknown[], unknown[], number, number, number, number];
    expect(kind).toBe('interpolate');
    expect(base).toEqual(['exponential', 2]);
    expect(input).toEqual(['zoom']);
    expect(z0).toBe(0);
    expect(r0).toBeCloseTo(heatmapRadiusPx(0, LAT), 9);
    expect(z1).toBe(FOG_HEATMAP.maxRadiusZoom);
    expect(r1).toBeCloseTo(heatmapRadiusPx(FOG_HEATMAP.maxRadiusZoom, LAT), 6);
  });

  it('gives the exact radius in between (base-2 interpolation of a 2^z curve)', () => {
    const [, , , z0, r0, z1, r1] = heatmapRadiusExpression(LAT) as unknown[] as [unknown, unknown, unknown, number, number, number, number];
    const z = 15;
    const t = (2 ** z - 2 ** z0) / (2 ** z1 - 2 ** z0);
    expect(r0 + (r1 - r0) * t).toBeCloseTo(heatmapRadiusPx(z, LAT), 4);
  });
});

describe('fogHeatmapPaint', () => {
  const paint = fogHeatmapPaint(FOG_PALETTES.ink, LAT);

  it('is the fog colour where nothing has been visited and clear where a lot has', () => {
    const ramp = paint['heatmap-color'] as unknown[];
    expect(ramp.slice(0, 3)).toEqual(['interpolate', ['linear'], ['heatmap-density']]);
    expect(ramp[3]).toBe(0);
    expect(ramp[4]).toBe('rgba(59,64,77,1)');
    expect(ramp[5]).toBe(FOG_HEATMAP.clearAtDensity);
    expect(ramp[6]).toBe('rgba(59,64,77,0)');
  });

  it('uses the radius expression and full opacity', () => {
    expect(paint['heatmap-radius']).toEqual(heatmapRadiusExpression(LAT));
    expect(paint['heatmap-opacity']).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest src/lib/map/fogHeatmap.test.ts`
Expected: FAIL (`Cannot find module './fogHeatmap'`).

- [ ] **Step 3: Implement**

```ts
// src/lib/map/fogHeatmap.ts
import type { HeatmapLayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import { metersPerPixel } from '../geo/projection';
import type { FogPalette } from '../settings/fogStyle';

// Values to tune on the phone (task 4). The heatmap kernel is soft: density is highest at a point and falls to nothing
// at `kernelFactor` times the cleared radius, so the cleared area is where density is above `clearAtDensity`.
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

// Inverted heatmap: no visits (density 0) = the fog, many visits = clear.
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
  } as FogHeatmapPaint;
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx jest src/lib/map/fogHeatmap.test.ts && npx tsc --noEmit`
Expected: PASS (6 tests), tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/map/fogHeatmap.ts src/lib/map/fogHeatmap.test.ts
git commit -m "Add the fog heatmap radius and colour ramp

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `FogLayer`, the switch, and mounting it

**Files:**
- Create: `src/lib/map/nativeLayers.ts`
- Create: `src/components/FogLayer.tsx`
- Modify: `src/components/FogOverlay.tsx` (prop `nativeFog`)
- Modify: `src/screens/MapScreen.tsx`

**Interfaces:**
- Consumes: `buildTrail`, `densifyTrail` (task 1); `FOG_HEATMAP`, `fogHeatmapPaint` (task 2); `GeoJSONSource`, `Layer` from `@maplibre/maplibre-react-native`.
- Produces: `NATIVE_FOG: boolean`; `<FogLayer points fog lat />`; `FogOverlay` prop `nativeFog?: boolean`.

- [ ] **Step 1: The switch**

```ts
// src/lib/map/nativeLayers.ts
import { Platform } from 'react-native';

// Fog (and later markers and route) drawn as layers of the map itself, so they move with it in the same frame.
// iOS only for now: the Android 9 phone crashed on native map components before, so it stays on the old overlays until
// the layers are seen working there.
export const NATIVE_FOG = Platform.OS === 'ios';
```

- [ ] **Step 2: `FogLayer` (first version, no live head yet; task 5 replaces it, so `FogLayer` takes no `livePosition` until then)**

```tsx
// src/components/FogLayer.tsx
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
```

- [ ] **Step 2b: Confirm the component compiles against the library types**

Run: `npx tsc --noEmit`
Expected: clean. If `Layer`'s `paint` type rejects the object, keep the cast inside `fogHeatmapPaint` (already `as FogHeatmapPaint`) and pass `paint={paint}`; if `GeoJSONSource` wants `children` typed differently, wrap the `Layer` in a fragment. Do not change behaviour to satisfy types.

- [ ] **Step 3: `FogOverlay` draws no fog when the map does**

In `FogOverlayProps` add `// The fog itself is a layer of the map; this overlay then draws only the rain and the user dot.` and `nativeFog?: boolean;`. Add `nativeFog = false` to the destructured props. In the JSX, wrap the whole `<Group layer={<Paint />}> … </Group>` block in `{!nativeFog && ( … )}` (the clouds come back in task 6). Leave the rain and the user dot as they are.

- [ ] **Step 4: Mount it in `MapScreen`**

In `src/screens/MapScreen.tsx` add the imports `import FogLayer from '../components/FogLayer';` and `import { NATIVE_FOG } from '../lib/map/nativeLayers';`. Inside `<Map …>` after `<Camera …/>` and the `UserLocation` line add:

```tsx
          {NATIVE_FOG && <FogLayer points={points} fog={fog} lat={view?.center[1] ?? 0} />}
```

and pass `nativeFog={NATIVE_FOG}` to the existing `<FogOverlay … />`.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx jest`
Expected: clean, all green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/map/nativeLayers.ts src/components/FogLayer.tsx src/components/FogOverlay.tsx src/screens/MapScreen.tsx
git commit -m "Draw the fog as a heatmap layer of the map (iOS)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: The experiment on the phone (decides approach A or B)

This is a manual checkpoint; it needs the user's eyes on the iPhone.

**Files:** possibly `src/lib/map/fogHeatmap.ts` (tunables only).

- [ ] **Step 1: Install a Debug build and start Metro (fast tuning)**

```bash
pkill -f "expo start" ; (nohup npx expo start --dev-client --port 8081 --lan > /tmp/metro.log 2>&1 &)
CI=1 npx expo run:ios --device 00008101-00114D623E03001E --no-bundler   # Debug; if it hangs at "Connecting", kill it and install the .app with devicectl as in /tmp/build_install.sh
```

Open the app on the phone (it connects to Metro).

- [ ] **Step 2: Ask the user to look, and record the answers**

Questions, in this order, answered by the user:
1. Is the whole map covered with fog except along the walked trail? (The key question: does the heatmap fill the screen at density 0? **If the map is not covered, stop: the approach is B, go back to brainstorming for the polygon fog.**)
2. Is the cleared corridor about as wide as before, and are its edges soft? Too narrow / too wide → adjust `clearRadiusMeters` / `kernelFactor` / `clearAtDensity`.
3. Zoom in and out and pinch: does the cleared width stay sensible (not shrinking to nothing when zoomed far in)?
4. Does it still stay covered when there are no visits (new account) — the anchor point at work?

- [ ] **Step 3: Tune**

Adjust the tunables in `FOG_HEATMAP`, let Metro reload, ask again. Keep a list of the values tried and the verdict of each.

- [ ] **Step 4: Decide**

If the fog covers, clears and looks acceptable: record the final values, run `npx jest` (the radius tests read the tunables, so they keep passing), commit:

```bash
git add src/lib/map/fogHeatmap.ts
git commit -m "Tune the fog heatmap on the phone

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

If not, do not go on to the next tasks: report to the user and go back to the spec's fallback.

---

### Task 5: The gliding head of the trail

Today the newest end of the cleared trail eases towards the live position over `LIVE_GLIDE_MS` (2 s), and a newly saved point joins the trail only once the glide has reached it. Keep that behaviour: feed the head into the source a few times a second.

**Files:**
- Modify: `src/components/FogLayer.tsx`
- Modify: `src/screens/MapScreen.tsx` (pass `livePosition`)

**Interfaces:**
- Consumes: `glidePosition` (task 1); `LIVE_GLIDE_MS` and `LivePosition` exported by `FogOverlay.tsx`.

- [ ] **Step 1: Pass the live position, hold back new points, animate the head**

Replace `src/components/FogLayer.tsx` with:

```tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { VisitedPoint } from '../lib/supabase/visitedPoints';
import type { FogPalette } from '../lib/settings/fogStyle';
import { buildTrail, densifyTrail, glidePosition } from '../lib/map/fogTrail';
import { FOG_HEATMAP, fogHeatmapPaint } from '../lib/map/fogHeatmap';
import { LIVE_GLIDE_MS, type LivePosition } from './FogOverlay';

export interface FogLayerProps {
  points: VisitedPoint[];
  livePosition: LivePosition | null;
  fog: FogPalette;
  // Latitude of the view: the pixel radius of the heatmap depends on it (rounded, so it rarely changes).
  lat: number;
}

// A point far from anywhere anyone walks. A heatmap with no features at all draws nothing, which would show no fog to a
// player with no visits yet; this one keeps the layer alive.
const ANCHOR: [number, number] = [0, -89.9];
// A fix further than this from the last one is a jump (teleport, lost signal), not a walk: snap instead of gliding.
const GLIDE_SNAP_METERS = 300;
// 8 updates a second is smooth enough for a 2 s glide and cheap for the source.
const HEAD_TICK_MS = 125;

// The fog, drawn by the map: the trail goes in as points, the heatmap layer turns it into "clear where visited".
export default function FogLayer({ points, livePosition, fog, lat }: FogLayerProps) {
  const hasLive = livePosition !== null;

  // Points saved within the last glide are held back so the trail does not run ahead of the gliding head.
  const newestTs = useMemo(() => points.reduce((m, p) => Math.max(m, p.ts), 0), [points]);
  const [settledAt, setSettledAt] = useState(() => Date.now());
  useEffect(() => {
    const wait = newestTs + LIVE_GLIDE_MS - Date.now();
    if (!hasLive || wait <= 0) return;
    const timer = setTimeout(() => setSettledAt(Date.now()), wait + 30);
    return () => clearTimeout(timer);
  }, [newestTs, hasLive]);
  const cutoff = hasLive ? settledAt - LIVE_GLIDE_MS : Infinity;
  const savedTrail = useMemo(() => buildTrail(points.filter((p) => p.ts <= cutoff)), [points, cutoff]);

  // The head of the trail: eased towards each new fix.
  const [head, setHead] = useState<LivePosition | null>(livePosition);
  const headRef = useRef<LivePosition | null>(livePosition);
  const glide = useRef<{ from: LivePosition; to: LivePosition; startedAt: number } | null>(null);
  useEffect(() => {
    if (!livePosition) {
      glide.current = null;
      headRef.current = null;
      setHead(null);
      return;
    }
    glide.current = { from: headRef.current ?? livePosition, to: livePosition, startedAt: Date.now() };
    const timer = setInterval(() => {
      const g = glide.current;
      if (!g) return;
      const elapsed = Date.now() - g.startedAt;
      const next = glidePosition(g.from, g.to, elapsed, LIVE_GLIDE_MS, GLIDE_SNAP_METERS);
      headRef.current = next;
      setHead(next);
      if (elapsed >= LIVE_GLIDE_MS) clearInterval(timer);
    }, HEAD_TICK_MS);
    return () => clearInterval(timer);
  }, [livePosition?.lat, livePosition?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const coordinates = useMemo(() => {
    const nodes = head ? [...savedTrail, head] : savedTrail;
    return [...densifyTrail(nodes, FOG_HEATMAP.stepMeters, FOG_HEATMAP.maxLinkMeters), ANCHOR];
  }, [savedTrail, head]);
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
```

- [ ] **Step 2: Pass it from `MapScreen`**

replace the `<FogLayer … />` line with `{NATIVE_FOG && <FogLayer points={points} livePosition={livePosition} fog={fog} lat={view?.center[1] ?? 0} />}`.

- [ ] **Step 3: Verify**

Run `npx tsc --noEmit && npx jest` (green). On the phone (Debug): walk or teleport a little in the simulator/phone and watch the cleared head follow the dot smoothly, with no jump when a new fix is saved.

- [ ] **Step 4: Commit**

```bash
git add src/components/FogLayer.tsx src/screens/MapScreen.tsx
git commit -m "Glide the head of the native fog trail to the live position

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Clouds and rain as a light screen overlay

In native-fog mode `FogOverlay` draws no fog base and no reveal; bring the clouds back as a light layer over the whole map, without holes.

**Files:**
- Modify: `src/components/FogOverlay.tsx`

- [ ] **Step 1: Draw the clouds unmasked, semi-transparent**

Where task 3 hid the group with `!nativeFog`, add the native-fog branch:

```tsx
{nativeFog && origin && (
  <Group opacity={NATIVE_CLOUD_OPACITY}>
    <FogClouds shared={shared} origin={origin} fog={fog} animated={animated} drift={drift} />
  </Group>
)}
```

with a constant `const NATIVE_CLOUD_OPACITY = 0.35;` next to the other cloud constants (comment: "the clouds are only decoration over the native fog, so a light touch; a frame of lag on them is not visible"). Keep the rain and the user dot as they are.

- [ ] **Step 2: Tune on the phone**

On the Debug build, look at the clouds over fog and over the cleared area. Ask the user: too strong / too weak? Adjust `NATIVE_CLOUD_OPACITY` until they say it is good (0 = no clouds is a valid answer).

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit && npx jest
git add src/components/FogOverlay.tsx
git commit -m "Keep the clouds as a light screen overlay over the native fog

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Judge the lag in a Release build

**Files:** none (verification).

- [ ] **Step 1: Build, install, launch**

Run `/tmp/build_install.sh` (Release build, installs on the iPhone, launches). If the script is gone, its steps are: `npx expo run:ios --device 00008101-00114D623E03001E --configuration Release --no-bundler` until "Build Succeeded", kill it, then `xcrun devicectl device install app --device C95FE219-7DF3-5B69-B235-4CD9248471E4 <the Release-iphoneos .app>` and `xcrun devicectl device process launch --terminate-existing --device C95FE219-7DF3-5B69-B235-4CD9248471E4 com.quelerir.mistwalk`.

- [ ] **Step 2: Ask the user**

Drag the map fast and slow, pinch, rotate, stop suddenly: does the fog now stay glued to the map? Is the phone warm or slow (the heatmap costs GPU)? Anything wrong at the edges of the trail?

- [ ] **Step 3: Record the verdict**

If good: tell the user the fog is done and that plan 2 (markers, route, Android dot) comes next; leave the branch as it is (merge into `master` only when the user says so). If not good: report what is wrong; the rollback is the tag `pre-native-layers`.

---

## Follow-up for plan 2 (markers, route, Android dot)

The old fog code stays in `FogOverlay` while Android still uses it: `revealPath`, `headPath`, `sceneTransform`, the
world-window logic (`windowKey`) and the base `Rect`. Plan 2 removes them, together with the `NATIVE_FOG` switch, once
Android draws its fog through the map too (after it is seen working on the Android 9 phone).
