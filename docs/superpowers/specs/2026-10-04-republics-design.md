# Republics section in the country list — design

Date: 2026-10-04. Branch: `republics`, on top of `country-regions` (it uses the city data built there).

## Goal

Five self-declared republics get their own rows in a "Республики" section at the bottom of the Countries list, each with its own screen, percentage, places and cities: **Абхазия (XA), Южная Осетия (XS), Приднестровье (XT), Северный Кипр (XN), Сомалиленд (XL)**. They are not added to the list of 218 countries and not counted in "Открыто стран: N из 218".

Agreed with the user:
- A point inside a republic's border counts **only** for the republic; the republic's area is subtracted from the country it lies in, in the data (Georgia, Moldova, Cyprus, Somalia).
- Flags are bundled in the app (Wikimedia Commons, public domain).
- Names, borders and areas come from Natural Earth (`ne_10m_admin_0_disputed_areas`, type `Breakaway`/`Disputed`: B35, B37, B36, B20, B30). The app adds no political judgement of its own.

Codes `XA`, `XS`, `XT`, `XN`, `XL` are ISO 3166 user-assigned codes, not real country codes.

## Data

`scripts/build-republics.sh` (needs network, node, npx mapshaper) writes `src/assets/republics.json`:
`{ republics: [ { code, ru, en, host (ISO of the country it lies in), w (Wikidata), areaKm2, polygons: number[][][][] } ] }`
where `polygons` is a list of polygons, each a list of rings of `[lng, lat]`, rounded to 3 decimals; the Natural Earth borders are already low resolution, so they are not simplified further (about 19 KB). `areaKm2` is computed with the same flat-earth formula as `geometryAreaKm2` in `cityStats.ts`. Short names: Абхазия / Abkhazia, Южная Осетия / South Ossetia, Приднестровье / Transnistria, Северный Кипр / Northern Cyprus, Сомалиленд / Somaliland.

`scripts/build-republic-flags.sh` downloads small PNG thumbnails (about 120 px wide) of the five flags from Commons (via the API, `iiurlwidth=80`) into `assets/flags/xa.png` and so on; `assets/flags/README.md` records each file, its Commons page and licence (all five are public domain on Commons).

`scripts/compact-world-cities.mjs` also assigns each place to a republic when its coordinates fall inside a republic polygon (the place's `c` becomes the republic code), and keeps such places even where Natural Earth has no ISO code for them (Kyrenia, Famagusta, Hargeisa). Sukhumi and Tskhinvali therefore leave Georgia.

## Logic

`src/lib/geo/republics.ts`:
- `REPUBLICS`, `REPUBLIC_BY_CODE`, `republicName(code, lang)`.
- `republicAt(lat, lng): string | null`: bounding-box prefilter, then ray casting over the polygons.
- `countryCodeAt(lat, lng, cells): string | null`: a republic first, else the country of the geocoder cell (`cells[cellKey(lat, lng)]?.code`), else null.
- `hostAreaAdjustment(code): number`: the summed area of the republics whose host is `code`.

`countryStats.ts`: `groupPointsByCountry` and `groupPlacesByCountry` use `countryCodeAt`; `buildCountryList` uses `areaKm2 - hostAreaAdjustment(code)` as the total of a host country; new `buildRepublicList(points, cells, lang): CountryStat[]` (same shape as a country; visited first, then by name). `useCountryStats` returns `republics` next to `countries`.

`MainScreen`: the three places that read `countryStats.cells[cellKey(...)]` use `countryCodeAt` (open-country points, `countryAt` for city stats, places by country); `republics` is passed to `CountriesScreen`.

Friends and older apps know only countries: `buildSnapshot` publishes a republic as the country it lies in (`publicCountryCode`) for the places and the cities, and the shared list of countries has no republics.

## Screens

`CountriesScreen`: new prop `republics: CountryStat[]`. After the countries, a header row "Республики" and one row per republic in the same style as a country row (name, percent, chevron); the status line is unchanged. A row opens the same country screen (`onOpenCountry`).

`src/lib/geo/flags.ts`: `flagSource(code): ImageSourcePropType` returns the bundled image for a republic code and `{ uri: flagUrl(code), cache: 'force-cache' }` otherwise; `CountriesScreen` uses it.

`CountryPlacesScreen` needs no change: it works from the `CountryStat`, the places and the cities of that code; the regions logic gives a flat list for these small sets of cities.

## Testing

- Jest: polygon containment (inside, outside, on a bounding-box edge, a hole-free multipolygon), republic precedence over the country, `hostAreaAdjustment`, `buildCountryList` (a point in Abkhazia is not counted for Georgia; Georgia's total shrinks), `buildRepublicList`, `groupPlacesByCountry` with a place in Abkhazia, data tests (five republics, codes, areas within 20 % of known figures, polygons closed, flags present), `CountriesScreen` (section shown, a row opens the screen, flag source), `flagSource`.
- Simulator: the list shows the section at the bottom; a republic screen opens.

## Out of scope

Republics on the world map (their areas stay coloured as part of the host country), republics in the shared profile, the other breakaway areas in the Natural Earth layer (Donetsk, Luhansk, Nagorno-Karabakh, Western Sahara), Crimea (stays in Russia as in the current data).

## Risks and notes

- Natural Earth's borders are coarse: a point within 1–3 km of a border (or on a coast, like Kyrenia's harbour) can land on the wrong side.
- Natural Earth's border for Somaliland (~166,000 km²) and others is its own; areas are computed from it, not from official figures.
- This changes Georgia's, Moldova's, Cyprus's and Somalia's percentages (smaller denominator, fewer points).
