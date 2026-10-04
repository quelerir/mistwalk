# Regions like countries — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Regions on a country screen get an emblem, a share of the area explored and found places, and open a region screen, like countries.

**Architecture:** Bundled simplified region borders (`regions.json`); `regionStats.ts` assigns points and places to regions and builds `RegionStat`s; batched Wikidata emblem fetching; `CountryPlacesScreen` renders region rows and doubles as the region screen.

**Tech Stack:** React Native 0.83 / Expo 55, Jest + Testing Library, `mapshaper` through `npx` and Node (build only).

**Spec:** `docs/superpowers/specs/2026-10-04-region-stats-design.md`

## Global Constraints

- Regions are keyed by Natural Earth `adm1_code` (as in `world-cities.json`); `regions.json` holds only regions that belong to a country in regions mode (more than 10 cities in more than one region), 2458 of them, with the country `c`, Wikidata `w` (or null), `areaKm2` from the original geometry and borders simplified to 4 % (`precision=0.01`).
- `regions.json` under 1.5 MB; loaded lazily with `require`; failure to load adds nothing and does not crash.
- Percent = explored area of the points inside the region / region `areaKm2` × 100; places are assigned by their coordinates; `regionAt` only considers regions of the given country.
- Emblems: Wikidata `P94` (coat of arms), and for regions `P41` (flag) when there is no coat of arms; up to 50 ids per request; cache 90 days when found, 7 days when missing, keyed by id and props.
- Flat countries are unchanged. Strings in both `src/i18n/ru.ts` and `src/i18n/en.ts`. Jest: `npx jest --testPathIgnorePatterns .worktrees`. Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- A point just outside a region (or in a hole), or in a region of another country: not counted. Task 2.
- A region with no points: 0 %, still listed; a region whose polygon is missing from `regions.json`: listed with 0 % and no area, no crash. Task 3.
- A visited city whose region differs from the point-in-polygon region (coarse borders): the city list uses the dataset region, the percent uses points; both are shown, neither crashes. Task 3.
- Emblem fetch failures (offline, 429): rows keep the letter badge and the screen does not crash; a batch failure must not drop ids from the next batch. Task 4.
- Back from a region returns to the country, and closing the overlay clears both. Task 5.

---

### Task 1: Region data

**Files:**
- Create: `scripts/build-regions.sh`, `scripts/compact-regions.mjs`, `src/assets/regions.json`, `src/assets/WORLD_REGIONS.md`
- Test: `src/lib/geo/regionsData.test.ts`

**Interfaces:**
- Produces: `src/assets/regions.json` shaped `{ regions: Record<string, { c: string; w: string | null; areaKm2: number; polygons: number[][][][] }> }`.

- [ ] **Step 1: Write the failing test:** load `regions.json` and `world-cities.json`; every region key used by a city of a regions-mode country (more than 10 cities and more than one region, computed in the test) exists in `regions`; every region has a two-letter `c` that equals its cities' country, a positive `areaKm2`, at least one polygon with closed rings of at least 4 `[lng, lat]` points in range; `w` is `null` or `Q<digits>`; the region whose Russian name is `Калифорния` has `areaKm2` within 20 % of 424000; `Texas`/`Техас` within 20 % of 695000; `JSON.stringify(data).length` under 1_500_000; no region key in the file that no city uses.
- [ ] **Step 2: Run** `npx jest src/lib/geo/regionsData.test.ts --testPathIgnorePatterns .worktrees`. Expected: FAIL (file missing).
- [ ] **Step 3: Write the scripts.** `build-regions.sh`: download `ne_10m_admin_1_states_provinces.geojson` (cache dir `REGIONS_CACHE`), run `compact-regions.mjs` pass 1 (Node: read `src/assets/world-cities.json`, compute the regions-mode countries and the used region codes, and for each used region compute `areaKm2` from the original geometry with the flat-earth formula and keep `{ k, c, w: wikidataid }`; write a filtered GeoJSON of `{k}` properties and a side file of areas), then `npx --yes mapshaper filtered.geojson -simplify 4% keep-shapes -o simplified.geojson format=geojson precision=0.01 force`, then pass 2 (join simplified geometry with areas, `c` and `w`, write `regions.json`). Use `adm1_code` and `wikidataid` properties; check the real property names on the first run.
- [ ] **Step 4: Run** the script (use the cached `admin1.geojson` in the scratchpad dir `.../scratchpad/wc/admin1.geojson` via `REGIONS_CACHE`), then the test. Expected: PASS. Write `WORLD_REGIONS.md` (source, licence, how to regenerate, size, simplification, known limits).
- [ ] **Step 5: Commit** (`feat: bundle simplified region borders (Natural Earth admin-1)`).

### Task 2: regionAt

**Files:**
- Create: `src/lib/geo/regionStats.ts` (first part)
- Test: `src/lib/geo/regionStats.test.ts`

**Interfaces:**
- Consumes: `regions.json` (Task 1).
- Produces: `loadRegions(): RegionsData | null`; `interface RegionsData { regions: Record<string, RegionGeometry> }`; `interface RegionGeometry { c: string; w: string | null; areaKm2: number; polygons: number[][][][] }`; `regionAt(lat: number, lng: number, countryCode: string): string | null`.

- [ ] **Step 1: Write the failing tests** with the real data: `regionAt(37.77, -122.42, 'US')` (San Francisco) equals the code of the region named Калифорния; `regionAt(55.75, 37.62, 'RU')` (Moscow) gives a region that is not null and `regionAt(55.75, 37.62, 'US')` is null (other country); `regionAt(0, 0, 'US')` is null; with a hand-made polygon injected through an exported `buildIndex(regions)` helper: a point in a hole is null, a point on a grid-cell boundary (an integer degree) still finds its polygon, a polygon spanning several cells is found from each of them.
- [ ] **Step 2: Run** `npx jest src/lib/geo/regionStats.test.ts --testPathIgnorePatterns .worktrees`. Expected: FAIL.
- [ ] **Step 3: Implement** `loadRegions` (lazy `require`, cached, null on failure, warn once), `buildIndex(regions)` (map from `"<floor lat>:<floor lng>"` to the list of region codes whose polygon bounding box touches that cell) and `regionAt` (index built once per `loadRegions` result; candidate codes filtered by `c === countryCode`, then ray casting over the polygon rings, outline minus holes).
- [ ] **Step 4: Run** the test and `npx tsc --noEmit`. Expected: PASS and clean.
- [ ] **Step 5: Commit** (`feat: regionAt over a grid index of region borders`).

### Task 3: Region statistics

**Files:**
- Modify: `src/lib/geo/regionStats.ts` (add), `src/lib/geo/countryRegions.ts` (`CityEntry.w`)
- Test: `src/lib/geo/regionStats.test.ts` (extend), `src/lib/geo/countryRegions.test.ts` (extend)

**Interfaces:**
- Consumes: `regionAt`, `RegionsData` (Task 2); `WorldCities`, `buildCountryCities` (existing); `computeAreaKm2`, `TimedPoint`; `CountryPlaces`, `CityStat`.
- Produces:
  - `interface RegionStat { code: string; name: string; wikidata: string | null; exploredKm2: number; totalKm2: number; percent: number; found: number; total: number }`
  - `buildRegionStats(countryCode: string, points: TimedPoint[], places: CountryPlaces | undefined, data: WorldCities, regions: RegionsData, lang: Lang): RegionStat[]`
  - `placesOfRegion(regionCode: string, countryCode: string, places: CountryPlaces | undefined, regions: RegionsData): CountryPlaces | undefined`
  - `citiesOfRegion(regionCode: string, countryCode: string, cities: CityStat[], data: WorldCities): CityStat[]`
  - `CityEntry` gains `w: string | null`.

- [ ] **Step 1: Write the failing tests** with a small hand-made `WorldCities` and `RegionsData` (two square regions R1, R2 of one country, 100 km² and 400 km² as `areaKm2`): points inside R1 give `percent = explored / areaKm2 × 100` and 0 for R2; places split by region (`found` = discovered count, `total` = discovered + hidden); only regions with cities in the dataset are listed; order percent desc then name in the language; a region missing from `RegionsData` is listed with `totalKm2: 0` and `percent: 0`; `placesOfRegion` returns only places inside; `citiesOfRegion` matches by Wikidata and by an unambiguous name and drops a city of another region; `buildCountryCities` entries carry `w`.
- [ ] **Step 2: Run** `npx jest src/lib/geo/regionStats.test.ts src/lib/geo/countryRegions.test.ts --testPathIgnorePatterns .worktrees`. Expected: FAIL.
- [ ] **Step 3: Implement** the signatures; reuse the name-matching rule of `buildCountryCities` (extract a shared helper from `countryRegions.ts` if it avoids duplication, keeping its tests green).
- [ ] **Step 4: Run** the two test files and `npx tsc --noEmit`. Expected: PASS and clean.
- [ ] **Step 5: Commit** (`feat: statistics for regions (percent, places, cities)`).

### Task 4: Batched emblems with a flag fallback

**Files:**
- Modify: `src/lib/geo/crest.ts`, `src/hooks/useCrests.ts`
- Test: `src/lib/geo/crest.test.ts` (extend or create), `src/hooks/useCrests.test.ts` (create)

**Interfaces:**
- Produces: `fetchCrestFiles(ids: string[], props?: string[], fetchImpl?: typeof fetch): Promise<Record<string, string | null>>` (one request per up to 50 ids; for each id the first of `props` (default `['P94']`) that has a value, else null); `useCrests(wikidataIds, props?)` returns the same `Record<string, string | null>` of image URLs as today.
- The existing `fetchCrestFile` stays as a thin wrapper (its tests keep passing).

- [ ] **Step 1: Write the failing tests:** 120 ids produce 3 requests of at most 50; the URL has `ids=Q1|Q2…`; with `props ['P94','P41']` an id with only P41 returns the flag file and one with both returns the P94 file; a failing request rejects (the hook handles it); hook: with a mocked `fetchCrestFiles` and `AsyncStorage`, ids are fetched in batches, cached results are not fetched again, the cache key differs for different `props`, a failure leaves the ids to retry later and does not throw.
- [ ] **Step 2: Run** `npx jest src/lib/geo/crest.test.ts src/hooks/useCrests.test.ts --testPathIgnorePatterns .worktrees`. Expected: FAIL.
- [ ] **Step 3: Implement.** `useCrests`: collect ids not cached or requested, call `fetchCrestFiles` per batch of 50, write the cache per id (`crest.v1:<props joined>:<id>`; keep reading the old `crest.v1:<id>` key for `['P94']` so nothing is refetched), set state, on a batch error remove its ids from `requested` so they are retried on the next render pass.
- [ ] **Step 4: Run** the tests and the whole suite. Expected: PASS (existing city emblem behaviour unchanged).
- [ ] **Step 5: Commit** (`feat: batched emblem fetching with a flag fallback for regions`).

### Task 5: Region rows, region screen, wiring

**Files:**
- Modify: `src/screens/CountryPlacesScreen.tsx`, `src/screens/MainScreen.tsx`, `src/i18n/ru.ts`, `src/i18n/en.ts` (reuse `countries.found`; add `region.back` only if needed)
- Test: `src/screens/CountryPlacesScreen.test.tsx` (extend)

**Interfaces:**
- Consumes: `buildRegionStats`, `placesOfRegion`, `citiesOfRegion`, `loadRegions`, `RegionStat` (Tasks 2–3), `useCrests(ids, props)` (Task 4), `CityBadge`.
- Produces: `CountryPlacesScreenProps` gains `points: TimedPoint[]`, `onOpenRegion?: (region: RegionStat) => void`, `regionCode?: string | null`, `emblemWikidata?: string | null` (the region's own Wikidata for the header badge).

- [ ] **Step 1: Write the failing tests:** regions mode shows a row per region with its percent and "found" text and a press calls `onOpenRegion` with the `RegionStat` (mock `loadRegions`/`loadWorldCities` with a tiny dataset; no accordion, no city rows under a region); a visited region has a strong name; with `regionCode` set the "Регионы" section is absent and "Не посещённые города" lists only that region's cities, each with a badge; flat mode unchanged; with `loadRegions` returning `null` the existing sections render and no region section appears.
- [ ] **Step 2: Run** `npx jest src/screens/CountryPlacesScreen.test.tsx --testPathIgnorePatterns .worktrees`. Expected: FAIL.
- [ ] **Step 3: Implement.** In `CountryPlacesScreen`: region rows built from `buildRegionStats` (memoised on points, places, cities, language) using the row layout of `CountriesScreen` (badge from `useCrests([...], ['P94','P41'])`, name, `formatPercent`, `countries.found` text, chevron); in region mode the unvisited-cities list is `buildCountryCities` restricted to the region with `CityBadge` and the population; remove the accordion state and rows. In `MainScreen`: `openRegion` state; the region screen gets `country` = `{ code: region.code, name: region.name, exploredKm2, totalKm2, percent }`, `places = placesOfRegion(...)`, `cities = citiesOfRegion(...)`, `regionCode`, `emblemWikidata`; `points={openCountryPoints}` and `onOpenRegion={setOpenRegion}` on the country screen; Back from a region clears `openRegion`; `closeProfileOverlays` clears both.
- [ ] **Step 4: Run** the new tests, the whole suite and `npx tsc --noEmit`. Expected: PASS and clean.
- [ ] **Step 5: Commit** (`feat: region rows and a region screen like countries`).

### Task 6: Verify in the simulator

**Files:** none.

- [ ] **Step 1:** Профиль → Страны → Соединённые Штаты: the "Регионы" rows look like country rows (emblem or letter, name, percent, found text); California first with a percent above 0.
- [ ] **Step 2:** Open California: the region screen shows San Francisco as a visited city (emblem, percent), the found/unvisited places of the region and the unvisited cities with badges; Back returns to the country.
- [ ] **Step 3:** Open Россия: rows render and scroll smoothly (85 regions); open a region.
- [ ] **Step 4:** Report; push and PR only when asked.
