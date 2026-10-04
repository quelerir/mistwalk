# Republics section — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Five self-declared republics (XA, XS, XT, XN, XL) get their own section, statistics, places and cities in the Countries list, with points inside their borders counted only for them.

**Architecture:** Bundled simplified borders (`republics.json`) and flags; `republics.ts` decides which republic (if any) contains a point and replaces the cell lookup in the stats code; `buildRepublicList` mirrors `buildCountryList`; `CountriesScreen` renders a trailing "Республики" section.

**Tech Stack:** React Native 0.83 / Expo 55, Jest + Testing Library, `mapshaper` through `npx` and Node scripts (build only).

**Spec:** `docs/superpowers/specs/2026-10-04-republics-design.md`

## Global Constraints

- Republics: `XA` Абхазия/Abkhazia (host GE, NE `B35`, Q23334), `XS` Южная Осетия/South Ossetia (GE, `B37`, Q23427), `XT` Приднестровье/Transnistria (MD, `B36`, Q907112), `XN` Северный Кипр/Northern Cyprus (CY, `B20`, Q23681), `XL` Сомалиленд/Somaliland (SO, `B30`, Q34754). Source layer `ne_10m_admin_0_disputed_areas.geojson` (field `BRK_A3`).
- A point inside a republic border counts only for the republic; a host country's total area is `areaKm2` minus the areas of its republics. The "Открыто стран: N из 218" line and the profile snapshot for friends are unchanged (republics are neither counted nor published).
- Flags: bundled PNG (80 px wide) in `assets/flags/<code lowercase>.png` from Wikimedia Commons (public domain), recorded in `assets/flags/README.md`.
- `world-cities.json` keeps its shape; places inside a republic border get the republic code as `c`, including places Natural Earth has no ISO code for.
- Strings in both `src/i18n/ru.ts` and `src/i18n/en.ts`. Run Jest as `npx jest --testPathIgnorePatterns .worktrees`. Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- A point exactly on a bounding-box edge or just outside a border must not count for the republic. Task 2.
- The same point must give the same country in the stats, in the places grouping and in `countryAt` for cities (three call sites in `MainScreen`). Tasks 3 and 5.
- A republic's total area must not push a host country's total to zero or negative (Georgia, Moldova, Cyprus, Somalia). Task 3.
- A republic with no points shows `0 %` and still opens a screen without crashing (no places, no cities). Task 5.
- The unknown code case: a stored geocoder cell whose country is also the host of a republic keeps working for points outside the republic. Task 3.

---

### Task 1: Republic data and flags

**Files:**
- Create: `scripts/build-republics.sh`, `scripts/compact-republics.mjs`, `scripts/build-republic-flags.sh`, `src/assets/republics.json`, `assets/flags/{xa,xs,xt,xn,xl}.png`, `assets/flags/README.md`, `src/assets/WORLD_REPUBLICS.md`
- Test: `src/lib/geo/republicsData.test.ts`

**Interfaces:**
- Produces: `src/assets/republics.json` shaped `{ republics: Array<{ code: string; ru: string; en: string; host: string; w: string; areaKm2: number; polygons: number[][][][] }> }` (polygons → rings → `[lng, lat]`).

- [ ] **Step 1: Write the failing test** (`republicsData.test.ts`): load the JSON with `require`; exactly the five codes `XA XS XT XN XL`; `host` is in `COUNTRY_BY_CODE` and equals `GE GE MD CY SO` respectively; each has non-empty `ru`/`en`, a Wikidata id, at least one polygon whose rings are closed (first point equals last) with at least 4 points and `[lng, lat]` inside the ranges; `areaKm2` within 20 % of Abkhazia 8700, South Ossetia 3900, Transnistria 4163, Northern Cyprus 3355, Somaliland 176000 (use these reference figures in the test and write a comment that they are rounded public figures); `JSON.stringify(data).length` under 200 000; each flag file exists (`fs`-free: `require('../../../assets/flags/xa.png')` resolves, jest-expo maps images).
- [ ] **Step 2: Run** `npx jest src/lib/geo/republicsData.test.ts --testPathIgnorePatterns .worktrees`. Expected: FAIL.
- [ ] **Step 3: Write the scripts.** `build-republics.sh`: download the layer (cache dir via `REPUBLICS_CACHE`), `mapshaper -filter 'BRK_A3 == "B35" || ...' -simplify 8% keep-shapes -o precision=0.001`, then `compact-republics.mjs` builds the JSON (names, hosts and Wikidata from a table inside the script; area from the polygons with the flat-earth formula of `geometryAreaKm2`). `build-republic-flags.sh`: for the five Commons file names (`Flag of Abkhazia.svg`, `Flag of South Ossetia.svg`, `Flag of Transnistria (state).svg`, `Flag of the Turkish Republic of Northern Cyprus.svg`, `Flag of Somaliland.svg`) query `commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=80` and download `thumburl`; write `assets/flags/README.md` with file, Commons page and licence read from the API (stop if any licence is not public domain).
- [ ] **Step 4: Run** both scripts, then the test. Expected: PASS. Write `WORLD_REPUBLICS.md` (source, how to regenerate, areas computed, codes are user-assigned).
- [ ] **Step 5: Commit** (`feat: bundle republic borders and flags (Natural Earth, Wikimedia Commons)`).

### Task 2: Geometry module

**Files:**
- Create: `src/lib/geo/republics.ts`
- Test: `src/lib/geo/republics.test.ts`

**Interfaces:**
- Consumes: `republics.json` (Task 1). `republics.ts` does not import `countryStats.ts` (that would be a cycle): `countryCodeAt` takes the cell lookup as a function.
- Produces:
  - `interface Republic { code: string; ru: string; en: string; host: string; w: string; areaKm2: number; polygons: number[][][][] }`
  - `REPUBLICS: Republic[]`, `REPUBLIC_BY_CODE: Readonly<Record<string, Republic>>`
  - `republicName(code: string, lang: string): string`
  - `republicAt(lat: number, lng: number): string | null`
  - `countryCodeAt(lat: number, lng: number, cellCountry: (lat: number, lng: number) => string | null | undefined): string | null` (a republic first, else `cellCountry(lat, lng) ?? null`)
  - `hostAreaAdjustment(code: string): number`

- [ ] **Step 1: Write the failing tests:** `republicAt(43.0, 41.02)` (Sukhumi) is `XA`; `republicAt(42.23, 43.97)` (Tskhinvali) is `XS`; `republicAt(46.84, 29.63)` (Tiraspol) is `XT`; `republicAt(35.34, 33.32)` (Kyrenia) is `XN`; `republicAt(9.56, 44.06)` (Hargeisa) is `XL`; Tbilisi `(41.72, 44.79)`, Chisinau `(47.01, 28.86)`, Larnaca `(34.92, 33.63)`, Mogadishu `(2.05, 45.32)` are `null`; a point just outside the bounding box of Abkhazia is `null`; `countryCodeAt` returns the republic over the cell country, falls back to the cell country, then to `null` when the cell has none; `hostAreaAdjustment('GE')` equals the summed areas of XA and XS, `('CY')` the area of XN, `('FR')` is 0; `republicName('XA','ru')` is `Абхазия` and `('XA','en')` is `Abkhazia`.
- [ ] **Step 2: Run** `npx jest src/lib/geo/republics.test.ts --testPathIgnorePatterns .worktrees`. Expected: FAIL.
- [ ] **Step 3: Implement** the signatures: precompute each republic's bounding box once; `republicAt` checks boxes first, then ray casting over each ring of each polygon (a point is inside a polygon when it is inside the first ring and outside the others).
- [ ] **Step 4: Run** the test and `npx tsc --noEmit`. Expected: PASS and clean.
- [ ] **Step 5: Commit** (`feat: republicAt and countryCodeAt`).

### Task 3: Statistics

**Files:**
- Modify: `src/lib/geo/countryStats.ts` (`groupPointsByCountry`, `groupPlacesByCountry`, `buildCountryList`; add `buildRepublicList`), `src/hooks/useCountryStats.ts` (return `republics`)
- Test: `src/lib/geo/countryStats.test.ts` (extend), `src/hooks/useCountryStats` has no test file today: cover `buildRepublicList` in the lib test instead.

**Interfaces:**
- Consumes: `countryCodeAt`, `REPUBLICS`, `hostAreaAdjustment`, `republicName` (Task 2).
- Produces: `buildRepublicList(points: TimedPoint[], cellCountries: Readonly<Record<string, CountryRef | null>>, lang?: Lang): CountryStat[]` (one entry per republic, `code`/`name`/`exploredKm2`/`totalKm2`/`percent`, visited first then by name); `useCountryStats(...)` returns `{ countries, republics, cells, pending, failed }`.

- [ ] **Step 1: Write the failing tests:** points inside Abkhazia (a small cluster around `43.0, 41.02`) with `cells` saying Georgia: `buildCountryList` gives Georgia `exploredKm2` 0 and `buildRepublicList` gives `XA` `exploredKm2` above 0; a point outside every republic but in Georgia's cell still counts for Georgia; Georgia's `totalKm2` equals `69700 - hostAreaAdjustment('GE')` and is positive, likewise for MD, CY, SO; `groupPlacesByCountry` puts a place at Sukhumi under `XA` and not under `GE`; `buildRepublicList` returns five entries, the visited one first, names in the language given (`en` gives `Abkhazia`); the total of the countries list still has 218 entries.
- [ ] **Step 2: Run** `npx jest src/lib/geo/countryStats.test.ts --testPathIgnorePatterns .worktrees`. Expected: FAIL.
- [ ] **Step 3: Implement.** In the two grouping functions replace `cellCountries[cellKey(...)]` by `countryCodeAt(lat, lng, (la, lo) => cellCountries[cellKey(la, lo)]?.code)` and build the `CountryRef` for a republic from `republicName(code, 'ru')`; in `buildCountryList` use `country.areaKm2 - hostAreaAdjustment(country.code)` as total; add `buildRepublicList` over `REPUBLICS`; `useCountryStats` memoises `republics` next to `countries`.
- [ ] **Step 4: Run** the test file, the whole suite and `npx tsc --noEmit`. Expected: all PASS.
- [ ] **Step 5: Commit** (`feat: republic statistics and host area adjustment`).

### Task 4: Cities in republics

**Files:**
- Modify: `scripts/compact-world-cities.mjs`, `src/assets/world-cities.json` (regenerated), `src/assets/WORLD_CITIES.md`, `src/lib/geo/worldCities.test.ts`
- Test: `src/lib/geo/worldCities.test.ts` (extend)

**Interfaces:**
- Consumes: `src/assets/republics.json` (Task 1).

- [ ] **Step 1: Write the failing tests:** in `worldCities.test.ts`, the "known country" check accepts republic codes as well (`REPUBLIC_BY_CODE`); Sukhumi has `c: 'XA'`, Tskhinvali `c: 'XS'`; `GE` has no city inside the Abkhazia or South Ossetia borders (check `republicAt` of every GE city is `null`); each republic has at least one city (`XA`, `XS`, `XT`, `XN`, `XL`).
- [ ] **Step 2: Run** `npx jest src/lib/geo/worldCities.test.ts --testPathIgnorePatterns .worktrees`. Expected: FAIL.
- [ ] **Step 3: Implement** the assignment in `compact-world-cities.mjs`: before the country-known check, test the place's coordinates against the republic polygons (same ray casting in plain JS) and, on a hit, set `c` to the republic code and skip the ISO rejection. Re-run the compaction from the cached `joined.geojson` (`WORLD_CITIES_CACHE`), then update `WORLD_CITIES.md` (Sukhumi and Tskhinvali now belong to XA and XS).
- [ ] **Step 4: Run** the test file and the geo tests. Expected: PASS.
- [ ] **Step 5: Commit** (`feat: assign cities inside republic borders to the republic`).

### Task 5: Screens, flags and wiring

**Files:**
- Create: `src/lib/geo/flags.ts`
- Modify: `src/screens/CountriesScreen.tsx` (prop `republics`, trailing section), `src/screens/MainScreen.tsx` (use `countryCodeAt` at the three call sites, pass `republics`), `src/i18n/ru.ts`, `src/i18n/en.ts` (key `countries.republics`: "Республики" / "Republics")
- Test: `src/lib/geo/flags.test.ts` (create), `src/screens/CountriesScreen.test.tsx` (extend)

**Interfaces:**
- Consumes: `buildRepublicList`/`republics` (Task 3), `REPUBLIC_BY_CODE` (Task 2).
- Produces: `flagSource(code: string): ImageSourcePropType` (a bundled image for a republic code, else `{ uri: flagUrl(code), cache: 'force-cache' }`); `CountriesScreenProps.republics: CountryStat[]`.

- [ ] **Step 1: Write the failing tests:** `flags.test.ts`: `flagSource('GE')` is an object with `uri` ending `/ge.png`; `flagSource('XA')` is a number (bundled asset) and differs for `XS`. `CountriesScreen.test.tsx` (extend `setup` with `republics`): shows a "Республики"/"Republics" header after the countries and one row per republic; pressing a republic row calls `onOpenCountry` with its `CountryStat`; the status line still says `1 из 2`-style counts from `countries` only (a visited republic does not change it); with `republics: []` no header is shown.
- [ ] **Step 2: Run** the two files with `npx jest ... --testPathIgnorePatterns .worktrees`. Expected: FAIL.
- [ ] **Step 3: Implement** `flags.ts`; in `CountriesScreen` build one `rows` array (country rows, then a header row and republic rows) for the `FlatList`, using `flagSource(item.code)` for every row's `Image`; in `MainScreen` replace `countryStats.cells[cellKey(...)]?.code` in `openCountryPoints`, `countryAt` and the places grouping input by `countryCodeAt(lat, lng, (la, lo) => countryStats.cells[cellKey(la, lo)]?.code)`; pass `republics={countryStats.republics}`.
- [ ] **Step 4: Run** the new tests, the whole suite and `npx tsc --noEmit`. Expected: all PASS.
- [ ] **Step 5: Commit** (`feat: republics section in the country list`).

### Task 6: Verify in the simulator

**Files:** none.

- [ ] **Step 1:** Open Профиль → Страны: the "Республики" header and five rows with flags at the bottom; the header line "Открыто стран: 2 из 218" is unchanged.
- [ ] **Step 2:** Open Абхазия: an empty/flat screen (no places, the city list "Сухум" under unvisited cities), no crash; open Грузия: Сухум and Цхинвал are gone from its list.
- [ ] **Step 3:** English UI shows "Republics" and the English names.
- [ ] **Step 4:** Report; push and PR only when asked.
