# Regions and unvisited cities — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a country's screen, list the cities the person has not visited, grouped by collapsible regions for countries with enough cities, and a flat "Не посещено · города" list for the rest.

**Architecture:** A build script joins Natural Earth populated places to admin-1 regions and writes a compact `src/assets/world-cities.json`. A pure module `countryRegions.ts` decides regions/flat mode and marks visited cities. `CountryPlacesScreen` renders the new section (collapsible regions inside the existing `SectionList`).

**Tech Stack:** React Native 0.83 / Expo 55, Jest + Testing Library, `mapshaper` via `npx` (build only), Node for the compaction script.

**Spec:** `docs/superpowers/specs/2026-10-04-country-regions-design.md`

## Global Constraints

- Source data: Natural Earth `ne_10m_populated_places` and `ne_10m_admin_1_states_provinces` (public domain), fetched from `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/`.
- Output file `src/assets/world-cities.json`, under 1 MB; places with `ISO_A2` `-99` or a country not in `COUNTRIES` are dropped.
- **Rule:** `mode = 'regions'` when the country has more than 10 cities and more than one distinct region among them; otherwise `'flat'`. Cities with no region are grouped last as "Другое" (regions mode).
- Visited = Wikidata id equals a `CityStat.wikidata`; without Wikidata, the normalised ru or en name equals a visited city's name. A region is visited when one of its cities is.
- Order: visited regions first, then by name in the current language; cities in a region by population, descending.
- The data file is loaded lazily with `require`; failure to load adds nothing to the screen and does not crash.
- Strings in both `src/i18n/ru.ts` and `src/i18n/en.ts`. Run Jest as `npx jest --testPathIgnorePatterns .worktrees`. Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Names and country identifiers use no assumptions about gender.

## Review Focus

- A country with exactly 10 cities (flat) and one with 11 cities in a single region (flat) and 11 in two regions (regions): the boundaries. Task 2.
- A visited city whose Wikidata is missing in the dataset but whose name matches (`Saint Petersburg` vs `Санкт-Петербург`, case and ё/е): visited by name. Task 2.
- The same name in two countries (e.g. `Santiago`): visited only inside its own country. Task 2.
- Language switch changes region and city names and the ordering of regions. Task 2.
- Data that fails to load: the existing sections still render. Task 3.
- A huge country (Russia, 90 regions, 585 cities) stays collapsed and the list renders without jank. Task 4.

---

### Task 1: Build script and data file

**Files:**
- Create: `scripts/build-world-cities.sh`, `scripts/compact-world-cities.mjs`, `src/assets/world-cities.json`, `src/assets/WORLD_CITIES.md`
- Test: `src/lib/geo/worldCities.test.ts`

**Interfaces:**
- Produces: `src/assets/world-cities.json` shaped `{ regions: Record<string, { ru: string; en: string }>; cities: Array<{ ru: string; en: string; w: string | null; c: string; r: string | null; p: number; la: number; lo: number }> }`.

- [ ] **Step 1: Write the failing test** (`worldCities.test.ts`): `require('../../assets/world-cities.json')`; every city has two-letter uppercase `c` found in `COUNTRY_BY_CODE`, non-empty `ru` and `en`, `p` a non-negative number; every non-null `r` exists in `regions`; `RU` has more than 400 cities and `RU-MOS` (or the code the data really uses for Moscow Oblast; assert the region's `ru` equals `Московская область`) exists; `US` has more than 500 cities; `JSON.stringify(data).length` under 1 MB; no duplicate `(c, w)` pair when `w` is not null.
- [ ] **Step 2: Run** `npx jest src/lib/geo/worldCities.test.ts --testPathIgnorePatterns .worktrees`. Expected: FAIL, file missing.
- [ ] **Step 3: Write the scripts.** `build-world-cities.sh`: download both files to a temp dir; `npx --yes mapshaper places.geojson -join admin1.geojson fields=iso_3166_2,name_ru,name_en -o joined.geojson format=geojson`; then `node scripts/compact-world-cities.mjs joined.geojson src/assets/world-cities.json`. `compact-world-cities.mjs` maps each feature to the shape above (`ru` from `NAME_RU` else `NAME`, `en` from `NAME_EN` else `NAME`, `w` from `WIKIDATAID`, `c` from `ISO_A2`, `r` from the joined `iso_3166_2`, `p` from `POP_MAX`, coordinates rounded to 2 decimals), drops rows per the Global Constraints (read the country codes from `src/lib/geo/countries.ts` by regex like `code: "XX"`), fills `regions` from the joined names, and prints counts. Check the join's real property names on the first run and adapt; if a place falls in no polygon keep `r: null`.
- [ ] **Step 4: Run** the script, then the test. Expected: PASS. Write `WORLD_CITIES.md` (source, licence, how to regenerate, size, counts, known historical regions such as "Ust-Orda Buryat").
- [ ] **Step 5: Commit** (`feat: bundle world cities with regions (Natural Earth)`).

### Task 2: Region logic

**Files:**
- Create: `src/lib/geo/countryRegions.ts`
- Test: `src/lib/geo/countryRegions.test.ts`

**Interfaces:**
- Consumes: the data shape from Task 1, `CityStat` from `src/lib/geo/cityStats.ts`, `Lang` from `src/i18n/language`.
- Produces:
  - `interface WorldCities { regions: Record<string, { ru: string; en: string }>; cities: WorldCity[] }` and `interface WorldCity { ru: string; en: string; w: string | null; c: string; r: string | null; p: number; la: number; lo: number }`
  - `interface CityEntry { key: string; name: string; population: number; visited: boolean }`
  - `interface RegionEntry { code: string | null; name: string; cities: CityEntry[]; visitedCount: number }`
  - `type CountryCities = { mode: 'regions'; regions: RegionEntry[] } | { mode: 'flat'; unvisited: CityEntry[] }`
  - `loadWorldCities(): WorldCities | null` (lazy `require`, cached, `null` on failure)
  - `buildCountryCities(countryCode: string, visited: CityStat[], data: WorldCities, lang: Lang): CountryCities` (in `flat` mode only unvisited cities are returned; in `regions` mode every city with its `visited` flag, "Другое"/"Other" group last, using the strings `Другое` and `Other`)
  - `normalizeCityName(name: string): string` (lowercase, `ё`→`е`, trims, collapses spaces, strips punctuation)

- [ ] **Step 1: Write the failing tests** with small hand-made `WorldCities` data: flat at 10 cities and at 11 cities in one region, regions at 11 cities in two regions; visited by Wikidata; visited by name fallback (`Санкт-Петербург` vs `санкт петербург`, `ё`/`е`); same name in another country is not visited; region `visitedCount` and ordering (visited regions first, then by name in `ru` and in `en`, cities by population descending); a city with `r: null` goes to the last group; `normalizeCityName` cases; `loadWorldCities` returns the parsed data with real asset (cities length > 0).
- [ ] **Step 2: Run** `npx jest src/lib/geo/countryRegions.test.ts --testPathIgnorePatterns .worktrees`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** the signatures above.
- [ ] **Step 4: Run** the test file and `npx tsc --noEmit`. Expected: PASS and clean.
- [ ] **Step 5: Commit** (`feat: group a country's cities by region and mark visited ones`).

### Task 3: Screen section and strings

**Files:**
- Modify: `src/screens/CountryPlacesScreen.tsx` (new section built from `buildCountryCities`; row kinds `region` and `unvisitedCity`; local state of expanded region codes; the data is loaded once with `useMemo(loadWorldCities, [])`; the section is skipped when the data is `null`)
- Modify: `src/i18n/ru.ts`, `src/i18n/en.ts` (keys `country.regions` with `{n}`, `country.unvisitedCities` with `{n}`, `country.regionProgress` with `{done}` and `{total}`: "{done} из {total} городов" / "{done} of {total} cities", `country.population` for the right-hand text if a label is needed)
- Test: `src/screens/CountryPlacesScreen.test.tsx`

**Interfaces:**
- Consumes: `buildCountryCities`, `loadWorldCities`, `CountryCities`, `RegionEntry`, `CityEntry` (Task 2).

- [ ] **Step 1: Write the failing tests** (mock `../lib/geo/countryRegions` partly: `loadWorldCities` returns a small dataset; mock fonts, safe-area, `useCrests`, icons like `CountriesScreen.test.tsx`): regions mode shows the region row "Московская область · 1 из 2 городов"-style text and no city rows until it is pressed; pressing expands and shows both cities, a visited one with a check testID `city-visited-<key>`; pressing again collapses; flat mode shows "Не посещено" and only unvisited cities, none of the visited; when `loadWorldCities` returns `null` the existing "Города" section still renders and no region section appears.
- [ ] **Step 2: Run** `npx jest src/screens/CountryPlacesScreen.test.tsx --testPathIgnorePatterns .worktrees`. Expected: FAIL.
- [ ] **Step 3: Implement.** Extend `Row` with `{ kind: 'region'; region: RegionEntry; expanded: boolean }` and `{ kind: 'unvisitedCity'; city: CityEntry; visited: boolean }`; in regions mode the section data is flattened (region row, then its city rows when expanded); in flat mode the section data is the unvisited cities. Extend `keyExtractor` and `renderItem` for the new kinds, using the existing row styles; unvisited cities in `c.textFaint`, a visited one with a "✓" and normal colour; population on the right in `c.textMuted`.
- [ ] **Step 4: Run** the new test, the whole suite and `npx tsc --noEmit`. Expected: all PASS.
- [ ] **Step 5: Commit** (`feat: regions and unvisited cities on the country screen`).

### Task 4: Verify in the simulator

**Files:** none.

- [ ] **Step 1:** Open Профиль → Страны → Соединённые Штаты. Expected: section "Регионы" with states, California marked visited ("1 из N городов"), collapsed; expanding shows San Francisco checked.
- [ ] **Step 2:** Open Россия: 80+ region rows, scrolling smooth, expanding one region works. Open Грузия: regions or a flat list per the rule; open a small country (Мальта): flat list.
- [ ] **Step 3:** English: names switch. Dark theme not checked visually unless reachable.
- [ ] **Step 4:** Report results; push and PR only when asked.
