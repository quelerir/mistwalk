# World map of countries by visited percentage — design

Date: 2026-10-04. Branch: `world-map` (from `master`).

## Goal

A second view under "Страны": a flat world map where each country is filled by how much of it the user has explored. The list stays; the map is another way in. It is also meant to be a shareable screenshot of progress.

Agreed with the user:
- Tapping a country opens the existing country screen (`CountryPlacesScreen`), like a list row does.
- Border data is bundled, Natural Earth 1:50m, simplified (about 1–2 MB).
- Four colour levels, green palette of the "Путеводитель" design. The fog palette is not touched.

## Data already there

`useCountryStats` gives `CountryStat { code, name, exploredKm2, totalKm2, percent }` keyed by ISO 3166-1 alpha-2, the same key as the flags and `COUNTRIES` in `src/lib/geo/countries.ts`. `percent` is a share of the country's area, so it is tiny for big countries (a few km in Russia is hundredths of a percent). That is why the colours are levels, not a linear scale.

## Design

### Entry and navigation
`CountriesScreen` gets a "Список / Карта" switch at the top. The list is unchanged. A tap on a country polygon or marker calls the same `onOpenCountry(CountryStat)` as a list row.

### Border data
- `scripts/build-world-geojson.*` downloads Natural Earth `ne_50m_admin_0_countries`, keeps only the ISO code and simplified geometry, and writes `src/assets/world.json` (target 1–2 MB). The result is committed, so builds do not depend on the network. The script and the file's licence note (public domain) live in the repo.
- The ISO code comes from `ISO_A2_EH` (plain `ISO_A2` is `-99` for France and Norway). Codes are matched to `COUNTRIES`; features with no match (disputed territories) stay neutral and are not tappable. Kosovo (`XK`) and Taiwan (`TW`) are in `COUNTRIES` and must match.
- The file is loaded lazily with `require` inside the map screen, so app start is not slowed.

### Rendering
- `@maplibre/maplibre-react-native` with an empty style (water background): a `ShapeSource` with a `FillLayer` and a thin `LineLayer` for borders. No basemap, so it works offline.
- Fill colour is a `match` expression on the ISO code, built once from the stats:
  - never visited (`percent == 0`): neutral grey
  - under 1 %: light green
  - 1–10 %: medium green
  - over 10 %: deep green
  Thresholds are constants in one place. Light and dark themes each get their own shades from the theme palette.
- Camera: whole world, zoom clamped, rotation and pitch off.

### Small countries
Countries too small to see at world zoom (Malta, Singapore and the like; chosen by a pixel-area or area-km² threshold computed at build time) get a circle marker in their colour at the feature's centroid. Taps work the same.

### Legend
Four items under the map with the same colours, strings in `ru` and `en`.

### States and errors
- While the border file loads: an activity indicator.
- While country stats are still being resolved (`pending`): the map shows, countries get coloured as they resolve.
- Stats failure: the same message the list shows.

## Testing
- Jest: a pure function "stats → colour per ISO code" (thresholds, zero, unknown codes); a check that every ISO code in `world.json` exists in `COUNTRIES` or is explicitly ignored; a screen test for the switch and the tap.
- Simulator: open the map, tap a country, check the dark theme.

## Out of scope
Globe projection (native MapLibre cannot do it), filters, animation, another player's map.

## Risks
- Bundle size: 1–2 MB JSON in the JS bundle. Measured when the file is built; if too large, simplify harder or ship it as an asset read at runtime.
- Disputed borders: Natural Earth shows de facto borders; the user decides whether that is acceptable for the stores they publish to.
- A `FillLayer` with ~240 polygons of 50m detail on a phone: checked in the simulator for pan/zoom smoothness.
