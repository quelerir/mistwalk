# Republics

`republics.json` holds the borders of five self-declared republics from Natural Earth (public domain,
https://www.naturalearthdata.com/), layer `ne_10m_admin_0_disputed_areas` (`BRK_A3` B35, B37, B36, B20, B30), made by
`scripts/build-republics.sh` (needs network, node, npx; `REPUBLICS_CACHE=<dir>` keeps the download). Flags are in
`assets/flags/` (see its README). Do not edit by hand.

- Codes `XA` Abkhazia, `XS` South Ossetia, `XT` Transnistria, `XN` Northern Cyprus, `XL` Somaliland are ISO 3166
  user-assigned codes, not real country codes. `host` is the country each lies in by the Natural Earth data.
- The borders are Natural Earth's own and not simplified further (about 19 KB). `areaKm2` is computed from them with the
  flat-earth formula of `geometryAreaKm2`; for Transnistria it is smaller than the official figure (3074 against 4163).
- Names, borders and areas carry no political judgement of the app's own.

Known limits of the data:
- The borders are coarse. Natural Earth's Transnistria leaves out Bender (Tighina), which counts for Moldova; the
  coast of Northern Cyprus cuts through Kyrenia's harbour (Kyrenia's and Famagusta's own coordinates lie just outside
  the polygon).
- The city list assigns places Natural Earth labels `CYN` or `SOL` to the republic by that label, while a person's
  points use the border only: a walk on that coast counts for the country around, and the city row stays on the
  republic's screen.
