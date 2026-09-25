# Fog, markers and route as native map layers — design

Date: 2026-09-25. Status: approved in chat, waiting for the written-spec review.

## Problem

While the map is dragged with a finger the fog, the place markers and the route trail behind it, and the harder and
faster the finger moves the more it shows. Measured on the user's iPhone (820 map events during one drag):

- `onRegionIsChanging` arrives about every frame (median gap 15 ms), but 13% of the gaps are longer than 40 ms and
  events come in bursts.
- The lag is still there in a Release build, so it is not dev-mode overhead.
- Cause: the native map is drawn under the finger at once, while the overlays (a Skia canvas for the fog, React views
  for markers, a Skia canvas for the route) learn the view only after an event has gone native -> JS -> UI thread, one
  or two frames later.
- Looking ahead by the map's speed (velocity extrapolation, 40 ms) was tried and made it worse. Reverted, nothing of
  it is kept.

An overlay that lives in a separate view can never be exactly glued to the map. The fix is to draw these things
inside the map, as MapLibre layers, so the map moves them itself in the same frame.

## Goal

Fog, place markers, the route and (Android) the "you are here" dot are MapLibre layers. Nothing that must stay glued
to the map is positioned from JS events any more.

Non-goals: changing the look of the palettes (haze, ink, night), the fog reveal radius (about 60 m), the clustering
rules, the discovery logic or the data layer.

## Design

### Fog (`FogLayer`)

- A GeoJSON source with the visited trail: the saved points, plus points added every ~20 m between two fixes that are
  linked (at most 300 m apart, the same rule as today, `MAX_LINK_METERS`); unlinked jumps are not joined.
- A `heatmap` layer above the base map and below markers. Its colour ramp is inverted: density 0 (no visits) = the fog
  colour of the current palette, growing density = transparent. Density is saturated so one visit clears fully, and the
  edge is soft because the heatmap kernel is soft.
- `heatmap-radius` is a zoom expression that keeps the cleared radius near 60 m on the ground (pixels per metre at
  the latitude of the view; recomputed when the latitude drifts by more than ~1 degree).
- The gliding head (the trail's newest end easing towards the live position over `LIVE_GLIDE_MS`) is fed into the
  source a few times a second.
- The fog palette (`FogPalette`, style auto/haze/ink/night) drives the ramp colours; changing it updates paint props.
- Clouds and rain stay a screen-space Skia layer above the map, without holes, semi-transparent. They only drift, so a
  frame of lag on them cannot be seen. `sceneTransform`, the reveal path and the world-window logic in `FogOverlay`
  go away.

### Markers (`PoiLayers`, replaces `PoiMarkers`)

- Which markers exist is still decided in JS by `layoutMarkers` on the slow view copy (updated at most every 250 ms),
  now output as GeoJSON features (places and clusters) instead of React views.
- Layers: a circle layer for the disc (colour and ring by `found` / `selected`), a symbol layer for the kind icon
  (images rendered once at start with Skia from the existing icon paths: kind x {found, not found}), a symbol layer
  for text (cluster counts, names of found places; collision handled by the map).
- Taps come from the source's press handler: select a place, open a found place, zoom into a cluster.

### Route and Android dot

- `RouteOverlay` becomes a line layer (casing + line) from a GeoJSON source.
- On Android, where the native `UserLocation` is left out, the dot is a circle layer fed by the gliding position.

### What is left of the shared view

`ViewShared` and `readView` stay only for what is still a screen overlay (clouds, rain). The slow `view` state stays
for marker layout and tile loading.

## Fallbacks and errors

- If the experiment shows the inverted heatmap cannot cover the whole screen with the fog colour, or its look is not
  acceptable, the fog is done as approach B: a polygon of the window minus the buffered trail, built in JS per tile,
  with a few stacked rings for a soft edge. The rest of the design does not change.
- If the icon images cannot be registered, markers show as plain discs; if the fonts for text are missing, the text
  layer is left out. Neither leaves the map empty.
- Android 9 phone: the app crashed on native map components before (`UserLocation`), so it is tested separately; the
  fog layer must not be turned on for Android until it is seen working there.

## Testing

Unit tests (Jest): trail densification, the radius-by-zoom expression, GeoJSON for markers and route, palette to ramp.
On the phone, in a Release build (that is where the lag is judged): dragging fast and slow, pinch zoom, rotation, the
moment the finger stops, cost on an iPhone 12 mini, then the Android 9 phone.

## Rollout

Each stage is verified on the device and committed on its own:

1. Experiment: the heatmap fog alone on the phone (look, whole-screen cover, radius). Decides A or B.
2. Fog layer, clouds and rain as the screen overlay.
3. Markers as layers.
4. Route and Android dot as layers; remove the dead overlay code.

## Risks

- Heatmap radius is in pixels, not metres: the zoom expression is an approximation, and very high zooms need a cap.
- Soft-edge look of the heatmap kernel is not identical to the current blurred stroke.
- Heatmap and many symbols on an old Android GPU: measured in stage 1 and 3 before going on.
