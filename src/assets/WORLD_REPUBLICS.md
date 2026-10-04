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
