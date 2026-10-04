# Regions and unvisited cities on the country screen — design

Date: 2026-10-04. Branch: `country-regions` (from `origin/master`).

## Goal

On a country's screen, show the cities the person has **not** visited yet, grouped by region (oblasts in Russia, states in the USA, and so on), so the country reads as a checklist. Today the screen lists only the cities found from the person's own points (reverse geocoding), so a city appears only after a visit.

Agreed with the user:
- Structure "region → cities", regions collapsible (collapsed by default, a tap opens the cities).
- Data is bundled, from Natural Earth (public domain), works offline.
- Regions are shown for countries with enough cities (see Rule); other countries get a flat list.

## Data

Source: Natural Earth `ne_10m_populated_places` (7342 places, 585 in Russia, 769 in the USA; fields `NAME_RU`, `NAME_EN`, `WIKIDATAID` (95 %), `POP_MAX`, `ISO_A2`, `ADM1NAME`, coordinates) and `ne_10m_admin_1_states_provinces` (`name_ru`, `name_en`, `iso_3166_2`) for the region of each city. The populated places have the region only as an English name, so the build joins each city to the admin-1 polygon that contains it (point in polygon), which gives the region code (`RU-MOS`) and its Russian name. The polygons are used only at build time and are not shipped.

`scripts/build-world-cities.sh` writes `src/assets/world-cities.json`, committed like the border data:

```
{ "regions": { "RU-MOS": { "ru": "Московская область", "en": "Moscow Oblast" } },
  "cities": [ { "ru": "Пятигорск", "en": "Pyatigorsk", "w": "Q41970", "c": "RU", "r": "RU-STA", "p": 142865, "la": 44.04, "lo": 43.06 } ] }
```

Places with no `ISO_A2` (`-99`) and places whose country is not in `COUNTRIES` are dropped. A city that falls in no admin-1 polygon gets `r: null`. Target size under 1 MB. A short licence and regeneration note goes in `src/assets/WORLD_CITIES.md`. The file is loaded lazily with `require` on the country screen only.

## Logic (pure, tested)

`src/lib/geo/countryRegions.ts`:
- `loadWorldCities()` returns the parsed data (lazy `require`, cached), or `null` when it cannot be loaded.
- `buildRegionList(countryCode, visited, data)` returns `{ mode: 'regions' | 'flat'; regions: RegionEntry[]; cities: CityEntry[] }`.
  - **Rule:** `mode = 'regions'` when the country has more than 10 cities in the data and more than one distinct region among them; otherwise `'flat'`. Cities with `r: null` go to a last group "Другое" (regions mode) or into the flat list.
  - A city is **visited** when its Wikidata id equals the `wikidata` of one of the person's `CityStat`s; when it has no Wikidata, when the normalised Russian or English name equals a visited city's name.
  - A region is visited when any of its cities is visited. `RegionEntry`: `{ code, name, cities, visitedCount }`.
  - Order: visited regions first, then by name in the current language; cities inside a region by population, descending (visited ones are not moved).
- Names follow the app language (`ru` or `en`).

## Screen

`CountryPlacesScreen`: below the existing "Города" section (visited cities found from the person's points), a new section.
- `regions` mode: "Регионы · N"; each region a row "Московская область · 2 из 9 городов" with a chevron; a tap expands its cities. A visited city is shown in the normal colour with a check; an unvisited one is grey with its population on the right.
- `flat` mode: one section "Не посещено · города" under the visited cities, unvisited cities by population, descending.
- In `regions` mode a region lists all its cities, visited ones with a check, so the checklist is complete (a visited city also appears in the existing "Города" section; that repeat is intended). In `flat` mode a visited city is not repeated, only unvisited ones are listed. Nothing is added when the data cannot be loaded.

## Testing

- Jest: `buildRegionList` (regions vs flat rule at the 10-city and one-region boundaries; visited by Wikidata, by name fallback; region visited when one city is; ordering; `r: null` group; language switch), `worldCities` data test (every country code in `COUNTRIES`, region codes present in `regions`, size under 1 MB), screen test (collapsed by default, expand, flat mode, visited city not duplicated, failure to load shows nothing extra).
- Simulator: open Georgia/Russia/USA; expand a region; check a visited city (San Francisco) is marked and California is "visited".

## Out of scope

Region-level percentage of the area, region polygons on the map, searching cities, towns that are not in the 7342, remembering the region from the geocoder, fixing historical regions by hand (Natural Earth still has "Ust-Orda Buryat" and "Koryak").

## Risks and notes

- Natural Earth draws de facto borders, including for disputed areas such as Crimea; the user decides whether that suits the stores they publish to (same as the world map).
- A small settlement that is not among the 7342 places will not make its region "visited".
- Historical regions in Natural Earth appear under their old names.
