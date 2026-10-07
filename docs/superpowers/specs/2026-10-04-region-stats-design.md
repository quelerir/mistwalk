# Regions like countries — design

Date: 2026-10-04. Branch: `region-stats` (from `origin/master`).

## Goal

On a country screen, regions (oblasts, states, …) look and behave like countries: a row with an emblem or flag, the name, the share of the area explored, found places, a chevron; a tap opens a screen of its own with the cities, found places, unvisited places and not-yet-visited cities of that region. The collapsible city lists under regions go away. Unvisited cities get the same emblem badge as visited ones.

Agreed with the user (option B): real percentages by area, places per region, a screen per region. Applies to the countries that already get regions (more than 10 cities in more than one region: 119 countries). Other countries keep the flat list.

## Data

`scripts/build-regions.sh` (needs network, node, npx mapshaper; `REGIONS_CACHE` keeps downloads) writes `src/assets/regions.json`:
`{ regions: { [adm1_code]: { c: ISO country, w: Wikidata id or null, areaKm2: number, polygons: number[][][][] } } }`
for the 2458 regions of `world-cities.json` that belong to a country in regions mode. `areaKm2` is computed from the original Natural Earth geometry (flat-earth formula of `geometryAreaKm2`), then the geometry is simplified (mapshaper `-simplify 4% keep-shapes`, precision 0.01, measured at about 1.05 MB for all). Names stay in `world-cities.json`. `c` is the country the region's cities belong to. The file is loaded lazily with `require` (on the country screens), like `world-cities.json`.

## Logic (pure, tested)

`src/lib/geo/regionStats.ts`:
- `loadRegions()` (lazy, cached, null on failure).
- `regionAt(lat, lng, countryCode): string | null`: a lazily built 1° × 1° grid index of the polygons' bounding boxes, then ray casting (holes handled), only among regions whose `c` is `countryCode`.
- `interface RegionStat { code: string; name: string; wikidata: string | null; exploredKm2: number; totalKm2: number; percent: number; found: number; total: number }` (`found` = found places, `total` = found + unvisited places in the region).
- `buildRegionStats(countryCode, points, places, data, regions, lang): RegionStat[]`: groups the country's points and places by `regionAt`; `exploredKm2 = computeAreaKm2(points of the region)`; sorted by percent descending, then name in the language. Only regions that have cities in `data` are listed.
- `citiesOfRegion(regionCode, countryCode, cities: CityStat[], data): CityStat[]` and `placesOfRegion(regionCode, countryCode, places, regions): CountryPlaces`: the visited cities (matched to the dataset by Wikidata, else by an unambiguous name) and the places whose coordinates fall in the region.

`buildCountryCities` entries get `w: string | null` (Wikidata) so badges can show emblems.

## Emblems

`src/lib/geo/crest.ts`: `fetchCrestFiles(ids, props)` fetches up to 50 Wikidata ids in one `wbgetentities` call and returns id → file name (first of `props` that exists: `['P94']` for cities, `['P94', 'P41']` (coat of arms, then flag) for regions). `useCrests(ids, props?)` uses it in batches and keeps its 90-day cache (cache keys include the props so a city and a region of the same id do not clash). `CityBadge` is reused for regions (an emblem, or the first letter while there is none).

## Screens

`CountryPlacesScreen` gets `points` (the country's points) and `onOpenRegion(region: RegionStat)`. In regions mode the section "Регионы · N" lists region rows built like country rows (emblem badge, name, percent, "Найдено мест: x из y", chevron); a visited region has a strong name, an unvisited one a muted one. Tapping calls `onOpenRegion`. The accordion and its state are removed.

The region screen is the same `CountryPlacesScreen` with a `regionCode`: `country` is the region as a `CountryStat` (name, percent), `places` and `cities` are those of the region (`placesOfRegion`, `citiesOfRegion`), the header shows the emblem, the "Регионы" section is not shown, and the section "Не посещённые города · N" lists the region's unvisited cities (with emblem badges and population).

`MainScreen`: state `openRegion: RegionStat | null`; with it set, the region screen is shown instead of the country screen; Back clears `openRegion` (back to the country); closing the profile overlays clears both.

Flat countries are unchanged.

## Testing

- Jest: `regionAt` (inside, outside, hole, a region of another country is ignored, grid edges), `buildRegionStats` (percent by area, places by region, order, a region without points is 0 %), `citiesOfRegion`/`placesOfRegion`, crest batching (one request for many ids, 50 per request, props fallback, cache keys), `CountryPlacesScreen` (region rows, press calls `onOpenRegion`, region mode shows the region's cities only), data test (every region has polygons and a country, California's area within 20 % of 424,000 km², file under 1.5 MB).
- Simulator: US → California (a percent, San Francisco checked) → back.

## Out of scope

Regions on the world map, regions of the flat countries, region data for friends' profiles, bundling emblems (they load from Wikidata and are cached), a region search.

## Risks and notes

- Simplified borders: a point within a few km of a region border (or on a coast) can land in the neighbour; percentages of very small regions are approximate.
- Emblems need a network; a region or city without one shows a letter.
- A large region screen (Alaska, 84 cities) asks Wikidata for all emblems at once in a few batched requests.
